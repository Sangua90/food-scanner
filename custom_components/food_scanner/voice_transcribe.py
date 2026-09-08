from __future__ import annotations

import base64
import json
from typing import Any

import aiohttp
from homeassistant.core import HomeAssistant
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers.aiohttp_client import async_get_clientsession

from .const import CONF_API_KEY
from .gemini_compat import RUNTIME_KEY, _candidate_models, _get_entry, _is_modern_gemini, _model_mode

MAX_AUDIO_BYTES = 10 * 1024 * 1024
SUPPORTED_AUDIO_TYPES = {
    "audio/mp4",
    "audio/x-m4a",
    "audio/aac",
    "audio/mpeg",
    "audio/webm",
    "audio/ogg",
    "audio/wav",
    "audio/x-wav",
}

TRANSCRIBE_PROMPT = """Trascrivi fedelmente questo messaggio vocale in italiano.
Il contenuto riguarda prodotti alimentari o consumabili usati in casa, quindi conserva con cura nomi prodotto, marche, quantità e numeri.
Restituisci esclusivamente JSON valido nella forma {\"text\":\"trascrizione\"}.
Non aggiungere spiegazioni, commenti o informazioni non presenti nell'audio.
"""


def decode_audio(audio_data: str, mime_type: str) -> tuple[bytes, str]:
    mime = str(mime_type or "").split(";", 1)[0].strip().lower()
    if mime not in SUPPORTED_AUDIO_TYPES:
        raise HomeAssistantError(f"Formato audio non supportato: {mime or 'sconosciuto'}.")
    try:
        raw = base64.b64decode(str(audio_data or ""), validate=True)
    except (ValueError, TypeError) as err:
        raise HomeAssistantError("Registrazione audio non valida.") from err
    if not raw:
        raise HomeAssistantError("La registrazione è vuota.")
    if len(raw) > MAX_AUDIO_BYTES:
        raise HomeAssistantError("Registrazione troppo lunga: massimo 10 MB.")
    return raw, mime


async def _call_transcribe_model(
    hass: HomeAssistant,
    api_key: str,
    model: str,
    audio_bytes: bytes,
    mime_type: str,
) -> str:
    encoded = base64.b64encode(audio_bytes).decode("ascii")
    generation_config: dict[str, Any] = {"responseMimeType": "application/json"}
    if not _is_modern_gemini(model):
        generation_config["temperature"] = 0
    payload = {
        "contents": [{"parts": [
            {"inline_data": {"mime_type": mime_type, "data": encoded}},
            {"text": TRANSCRIBE_PROMPT},
        ]}],
        "generationConfig": generation_config,
    }
    session = async_get_clientsession(hass)
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
    try:
        async with session.post(
            url,
            headers={"x-goog-api-key": api_key, "Content-Type": "application/json"},
            json=payload,
            timeout=aiohttp.ClientTimeout(total=60),
        ) as response:
            body = await response.text()
            if response.status >= 400:
                raise HomeAssistantError(f"Gemini audio {response.status} ({model}): {body[:500]}")
    except aiohttp.ClientError as err:
        raise HomeAssistantError(f"Errore di connessione durante la trascrizione ({model}): {err}") from err

    try:
        raw = json.loads(body)
        answer = raw["candidates"][0]["content"]["parts"][0]["text"]
        parsed = json.loads(answer)
        text = str(parsed.get("text") or "").strip()
    except (KeyError, IndexError, TypeError, json.JSONDecodeError, AttributeError) as err:
        raise HomeAssistantError(f"Trascrizione Gemini non valida ({model}).") from err
    if not text:
        raise HomeAssistantError("Non ho riconosciuto parole nella registrazione.")
    return text


async def async_transcribe_voice(
    hass: HomeAssistant,
    audio_data: str,
    mime_type: str,
) -> dict[str, Any]:
    audio_bytes, mime = decode_audio(audio_data, mime_type)
    entry = _get_entry(hass)
    api_key = entry.data.get(CONF_API_KEY)
    if not api_key:
        raise HomeAssistantError("API key Gemini mancante.")

    candidates = await _candidate_models(hass, entry, api_key)
    errors: list[str] = []
    for model in candidates:
        try:
            text = await _call_transcribe_model(hass, api_key, model, audio_bytes, mime)
            hass.data.setdefault(RUNTIME_KEY, {})["gemini_last_good_model"] = model
            return {"success": True, "text": text, "model": model}
        except HomeAssistantError as err:
            errors.append(str(err))
            if _model_mode(entry) != "auto":
                raise

    detail = " | ".join(errors[-3:])
    raise HomeAssistantError(f"Nessun modello Gemini compatibile ha trascritto l'audio. {detail}")
