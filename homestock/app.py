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

VERSION = "2.0.0-alpha.2"
ENGINE_NAME = "HomeStock Engine"
CONFIG_DIR = Path("/config")
STATE_FILE = CONFIG_DIR / "engine_state.json"
MAX_AUDIO_BYTES = 10 * 1024 * 1024
SUPPORTED_AUDIO_TYPES = {
    "audio/mp4", "audio/x-m4a", "audio/aac", "audio/mpeg",
    "audio/webm", "audio/ogg", "audio/wav", "audio/x-wav",
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


def _decode_audio(audio_data: str, mime_type: str) -> tuple[bytes, str]:
    mime = str(mime_type or "").split(";", 1)[0].strip().lower()
    if mime not in SUPPORTED_AUDIO_TYPES:
        raise web.HTTPBadRequest(text=json.dumps({"message": f"Formato audio non supportato: {mime or 'sconosciuto'}."}), content_type="application/json")
    try:
        raw = base64.b64decode(str(audio_data or ""), validate=True)
    except (ValueError, TypeError):
        raise web.HTTPBadRequest(text=json.dumps({"message": "Registrazione audio non valida."}), content_type="application/json")
    if not raw:
        raise web.HTTPBadRequest(text=json.dumps({"message": "La registrazione è vuota."}), content_type="application/json")
    if len(raw) > MAX_AUDIO_BYTES:
        raise web.HTTPRequestEntityTooLarge(max_size=MAX_AUDIO_BYTES, actual_size=len(raw))
    return raw, mime


def _is_modern_gemini(model: str) -> bool:
    return model.startswith(("gemini-3.5-", "gemini-3.6-", "gemini-3.7-", "gemini-3.8-", "gemini-4-"))


async def _candidate_models(session: aiohttp.ClientSession, api_key: str, preferred: str | None) -> list[str]:
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


async def _transcribe_model(session: aiohttp.ClientSession, api_key: str, model: str, audio: bytes, mime: str) -> str:
    generation_config: dict[str, Any] = {"responseMimeType": "application/json"}
    if not _is_modern_gemini(model):
        generation_config["temperature"] = 0
    payload = {
        "contents": [{"parts": [
            {"inline_data": {"mime_type": mime, "data": base64.b64encode(audio).decode("ascii")}},
            {"text": TRANSCRIBE_PROMPT},
        ]}],
        "generationConfig": generation_config,
    }
    async with session.post(
        f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
        headers={"x-goog-api-key": api_key, "Content-Type": "application/json"},
        json=payload, timeout=aiohttp.ClientTimeout(total=60),
    ) as response:
        body = await response.text()
        if response.status >= 400:
            raise RuntimeError(f"Gemini audio {response.status} ({model}): {body[:400]}")
    raw = json.loads(body)
    answer = raw["candidates"][0]["content"]["parts"][0]["text"]
    parsed = json.loads(answer)
    text = str(parsed.get("text") or "").strip()
    if not text:
        raise RuntimeError("Nessuna parola riconosciuta")
    return text


async def health(_: web.Request) -> web.Response:
    return web.json_response({"ok": True, "name": ENGINE_NAME, "version": VERSION, "started_at": STATE.get("last_start")})


async def capabilities(_: web.Request) -> web.Response:
    return web.json_response({
        "ok": True, "version": VERSION,
        "capabilities": {
            "image_analysis": False,
            "audio_transcription": True,
            "voice_intent_parser": False,
            "background_jobs": False,
            "diagnostics": True,
        },
        "migration_phase": "audio",
        "inventory_owner": "home_assistant_integration",
    })


async def transcribe(request: web.Request) -> web.Response:
    try:
        data = await request.json()
    except ValueError:
        return web.json_response({"message": "JSON non valido"}, status=400)
    api_key = str(data.get("api_key") or "").strip()
    if not api_key:
        return web.json_response({"message": "API key Gemini mancante"}, status=400)
    audio, mime = _decode_audio(data.get("audio_data") or "", data.get("mime_type") or "")
    preferred = str(data.get("preferred_model") or "").strip() or None
    errors: list[str] = []
    async with aiohttp.ClientSession() as session:
        models = await _candidate_models(session, api_key, preferred)
        for model in models:
            try:
                text = await _transcribe_model(session, api_key, model, audio, mime)
                STATE["last_audio_transcription"] = _now()
                STATE["last_good_model"] = model
                _save_state(STATE)
                return web.json_response({"success": True, "text": text, "model": model, "engine": VERSION})
            except (aiohttp.ClientError, TimeoutError, RuntimeError, KeyError, IndexError, TypeError, json.JSONDecodeError) as err:
                errors.append(str(err))
    LOGGER.warning("Audio transcription failed: %s", " | ".join(errors[-3:]))
    return web.json_response({"message": "Nessun modello Gemini compatibile ha trascritto l'audio", "detail": errors[-3:]}, status=502)


async def diagnostics(_: web.Request) -> web.Response:
    return web.json_response({"engine": ENGINE_NAME, "version": VERSION, "state": STATE, "config_path": str(CONFIG_DIR), "status": "ready"})


async def index(_: web.Request) -> web.Response:
    html = f"""<!doctype html><html lang='it'><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'><title>HomeStock Engine</title><style>body{{margin:0;background:#07111d;color:#eef6ff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}}main{{max-width:720px;margin:0 auto;padding:36px 22px}}.card{{background:linear-gradient(145deg,#102238,#0a1522);border:1px solid #284663;border-radius:24px;padding:24px}}h1{{margin:0 0 8px}}p{{color:#9fb3c8;line-height:1.5}}.pill{{display:inline-block;padding:7px 11px;border-radius:999px;background:#0c3d67;color:#7fc8ff;font-weight:700;font-size:12px}}</style></head><body><main><div class='card'><h1>HomeStock Engine</h1><p>Motore 2.0 attivo. La trascrizione audio è ora gestita dall'Engine; inventario e conferme restano nell'integrazione Home Assistant.</p><span class='pill'>v{VERSION} · audio migration</span></div></main></body></html>"""
    return web.Response(text=html, content_type="text/html")


app = web.Application(client_max_size=12 * 1024 * 1024)
app.router.add_get("/", index)
app.router.add_get("/health", health)
app.router.add_get("/v1/capabilities", capabilities)
app.router.add_get("/v1/diagnostics", diagnostics)
app.router.add_post("/v1/transcribe", transcribe)

if __name__ == "__main__":
    LOGGER.info("Starting %s %s on port 8099", ENGINE_NAME, VERSION)
    web.run_app(app, host="0.0.0.0", port=8099, print=None)
