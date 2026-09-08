from __future__ import annotations

import base64
import json
import logging
import os
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import aiohttp
from aiohttp import web

VERSION = "2.0.0-beta.1"
ENGINE_NAME = "HomeStock Engine"
CONFIG_DIR = Path("/config")
STATE_FILE = CONFIG_DIR / "engine_state.json"
MAX_MEDIA_BYTES = 12 * 1024 * 1024
SUPPORTED_MEDIA_TYPES = {
    "audio/mp4", "audio/x-m4a", "audio/aac", "audio/mpeg", "audio/webm", "audio/ogg", "audio/wav", "audio/x-wav",
    "image/jpeg", "image/png", "image/webp", "image/heic", "image/heif",
}
MODEL_RE = re.compile(r"^models/(gemini-(\d+)\.(\d+)-flash(?:-lite)?)$")
TRANSCRIBE_PROMPT = """Trascrivi fedelmente questo messaggio vocale in italiano.
Il contenuto riguarda prodotti alimentari o consumabili usati in casa, quindi conserva con cura nomi prodotto, marche, quantità e numeri.
Restituisci esclusivamente JSON valido nella forma {\"text\":\"trascrizione\"}.
Non aggiungere spiegazioni, commenti o informazioni non presenti nell'audio.
"""


def _log_level() -> int:
    raw = os.environ.get("HOMESTOCK_LOG_LEVEL", "info").upper()
    return getattr(logging, raw, logging.INFO)


logging.basicConfig(level=_log_level(), format="%(asctime)s %(levelname)s homestock-engine: %(message)s")
LOGGER = logging.getLogger("homestock-engine")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _load_state() -> dict:
    try:
        if STATE_FILE.exists():
            data = json.loads(STATE_FILE.read_text(encoding="utf-8"))
            if isinstance(data, dict):
                return data
    except Exception as err:
        LOGGER.warning("Could not load state: %s", err)
    return {}


def _save_state(data: dict) -> None:
    try:
        CONFIG_DIR.mkdir(parents=True, exist_ok=True)
        STATE_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    except Exception as err:
        LOGGER.warning("Could not save state: %s", err)


STATE = _load_state()
STATE["last_start"] = _now()
STATE["version"] = VERSION
_save_state(STATE)


def _is_modern_gemini(model: str) -> bool:
    return model.startswith(("gemini-3.5-", "gemini-3.6-", "gemini-3.7-", "gemini-3.8-", "gemini-4-"))


async def _candidate_models(session: aiohttp.ClientSession, api_key: str, preferred: str | None, requested: list[str] | None = None) -> list[str]:
    if requested:
        clean: list[str] = []
        for model in requested:
            value = str(model or "").strip()
            if value and value not in clean:
                clean.append(value)
        if clean:
            return clean

    discovered: list[tuple[tuple[int, int, int], str]] = []
    try:
        async with session.get(
            "https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000",
            headers={"x-goog-api-key": api_key}, timeout=aiohttp.ClientTimeout(total=20),
        ) as response:
            if response.status < 400:
                payload = await response.json(content_type=None)
                for item in payload.get("models", []):
                    if not isinstance(item, dict) or "generateContent" not in (item.get("supportedGenerationMethods") or []):
                        continue
                    match = MODEL_RE.match(str(item.get("name") or ""))
                    if not match:
                        continue
                    model, major, minor = match.groups()
                    normal = 0 if model.endswith("-flash-lite") else 1
                    discovered.append(((normal, int(major), int(minor)), model))
    except (aiohttp.ClientError, TimeoutError, ValueError):
        pass
    discovered.sort(reverse=True)
    models = [m for _, m in discovered]
    if preferred and preferred in models:
        models.remove(preferred)
        models.insert(0, preferred)
    if not models:
        for model in (preferred, "gemini-3.5-flash-lite", "gemini-3.5-flash"):
            if model and model not in models:
                models.append(model)
    return models


def _decode_media(media_data: str, mime_type: str) -> tuple[bytes, str]:
    mime = str(mime_type or "").split(";", 1)[0].strip().lower()
    if mime not in SUPPORTED_MEDIA_TYPES:
        raise ValueError(f"Formato non supportato: {mime or 'sconosciuto'}")
    try:
        raw = base64.b64decode(str(media_data or ""), validate=True)
    except (ValueError, TypeError) as err:
        raise ValueError("Dati media non validi") from err
    if not raw:
        raise ValueError("Media vuoto")
    if len(raw) > MAX_MEDIA_BYTES:
        raise ValueError("Media troppo grande")
    return raw, mime


async def _gemini_json_model(session: aiohttp.ClientSession, api_key: str, model: str, prompt: str, media: bytes | None = None, mime: str | None = None) -> dict:
    generation_config: dict[str, Any] = {"responseMimeType": "application/json"}
    if not _is_modern_gemini(model):
        generation_config["temperature"] = 0
    parts: list[dict[str, Any]] = []
    if media is not None and mime:
        parts.append({"inline_data": {"mime_type": mime, "data": base64.b64encode(media).decode("ascii")}})
    parts.append({"text": prompt})
    payload = {"contents": [{"parts": parts}], "generationConfig": generation_config}
    async with session.post(
        f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
        headers={"x-goog-api-key": api_key, "Content-Type": "application/json"},
        json=payload, timeout=aiohttp.ClientTimeout(total=75),
    ) as response:
        body = await response.text()
        if response.status >= 400:
            raise RuntimeError(f"Gemini API {response.status} ({model}): {body[:500]}")
    raw = json.loads(body)
    parts_out = raw["candidates"][0]["content"]["parts"]
    text = next(p["text"] for p in parts_out if isinstance(p, dict) and isinstance(p.get("text"), str))
    parsed = json.loads(text)
    if not isinstance(parsed, dict):
        raise RuntimeError("Risposta Gemini non è un oggetto JSON")
    return parsed


async def _run_gemini(data: dict[str, Any]) -> tuple[dict[str, Any] | None, str | None, list[str], int]:
    api_key = str(data.get("api_key") or "").strip()
    prompt = str(data.get("prompt") or "").strip()
    if not api_key or not prompt:
        return None, None, ["API key o prompt mancante"], 400
    media = None
    mime = None
    if data.get("media_data"):
        try:
            media, mime = _decode_media(data.get("media_data") or "", data.get("mime_type") or "")
        except ValueError as err:
            return None, None, [str(err)], 400
    preferred = str(data.get("preferred_model") or "").strip() or None
    requested = data.get("models") if isinstance(data.get("models"), list) else None
    errors: list[str] = []
    async with aiohttp.ClientSession() as session:
        models = await _candidate_models(session, api_key, preferred, requested)
        for model in models:
            try:
                parsed = await _gemini_json_model(session, api_key, model, prompt, media, mime)
                STATE["last_ai_request"] = _now()
                STATE["last_good_model"] = model
                STATE["last_ai_kind"] = "media" if media is not None else "text"
                _save_state(STATE)
                return parsed, model, errors, 200
            except (aiohttp.ClientError, TimeoutError, RuntimeError, KeyError, IndexError, StopIteration, TypeError, json.JSONDecodeError) as err:
                errors.append(str(err))
    return None, None, errors[-3:], 502


async def health(_: web.Request) -> web.Response:
    return web.json_response({"ok": True, "name": ENGINE_NAME, "version": VERSION, "started_at": STATE.get("last_start")})


async def capabilities(_: web.Request) -> web.Response:
    return web.json_response({
        "ok": True,
        "version": VERSION,
        "capabilities": {
            "image_analysis": True,
            "audio_transcription": True,
            "voice_intent_parser": True,
            "generic_gemini_json": True,
            "background_jobs": False,
            "diagnostics": True,
        },
        "migration_phase": "beta_full_ai",
        "inventory_owner": "home_assistant_integration",
    })


async def gemini_json(request: web.Request) -> web.Response:
    try:
        data = await request.json()
    except ValueError:
        return web.json_response({"message": "JSON non valido"}, status=400)
    parsed, model, errors, status = await _run_gemini(data)
    if status >= 400:
        return web.json_response({"message": "Analisi HomeStock Engine non riuscita", "detail": errors}, status=status)
    return web.json_response({"success": True, "data": parsed, "model": model, "engine": VERSION})


async def transcribe(request: web.Request) -> web.Response:
    try:
        data = await request.json()
    except ValueError:
        return web.json_response({"message": "JSON non valido"}, status=400)
    payload = {
        "api_key": data.get("api_key"),
        "prompt": TRANSCRIBE_PROMPT,
        "media_data": data.get("audio_data"),
        "mime_type": data.get("mime_type"),
        "preferred_model": data.get("preferred_model"),
        "models": data.get("models"),
    }
    parsed, model, errors, status = await _run_gemini(payload)
    if status >= 400:
        return web.json_response({"message": "Trascrizione HomeStock Engine non riuscita", "detail": errors}, status=status)
    text = str((parsed or {}).get("text") or "").strip()
    if not text:
        return web.json_response({"message": "Non ho riconosciuto parole nella registrazione"}, status=502)
    STATE["last_audio_transcription"] = _now()
    _save_state(STATE)
    return web.json_response({"success": True, "text": text, "model": model, "engine": VERSION})


async def diagnostics(_: web.Request) -> web.Response:
    return web.json_response({"engine": ENGINE_NAME, "version": VERSION, "state": STATE, "config_path": str(CONFIG_DIR), "status": "ready"})


async def index(_: web.Request) -> web.Response:
    html = f"""<!doctype html><html lang='it'><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'><title>HomeStock Engine</title><style>body{{margin:0;background:#07111d;color:#eef6ff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}}main{{max-width:720px;margin:0 auto;padding:36px 22px}}.card{{background:linear-gradient(145deg,#102238,#0a1522);border:1px solid #284663;border-radius:24px;padding:24px}}h1{{margin:0 0 8px}}p{{color:#9fb3c8;line-height:1.5}}.pill{{display:inline-block;padding:7px 11px;border-radius:999px;background:#0c3d67;color:#7fc8ff;font-weight:700;font-size:12px}}.grid{{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:18px}}.box{{background:#0a1725;border:1px solid #1f354b;border-radius:14px;padding:12px}}</style></head><body><main><div class='card'><h1>HomeStock Engine</h1><p>Motore 2.0 beta attivo. Audio, parsing vocale e analisi foto AI possono ora essere elaborati qui; inventario e conferme restano protetti nell'integrazione Home Assistant.</p><span class='pill'>v{VERSION} · full AI migration</span><div class='grid'><div class='box'>🎙 Audio</div><div class='box'>🧠 Parsing voce</div><div class='box'>📷 Foto alimenti</div><div class='box'>🧴 Foto consumabili</div></div></div></main></body></html>"""
    return web.Response(text=html, content_type="text/html")


app = web.Application(client_max_size=14 * 1024 * 1024)
app.router.add_get("/", index)
app.router.add_get("/health", health)
app.router.add_get("/v1/capabilities", capabilities)
app.router.add_get("/v1/diagnostics", diagnostics)
app.router.add_post("/v1/gemini_json", gemini_json)
app.router.add_post("/v1/transcribe", transcribe)

if __name__ == "__main__":
    LOGGER.info("Starting %s %s on port 8099", ENGINE_NAME, VERSION)
    web.run_app(app, host="0.0.0.0", port=8099, print=None)
