from __future__ import annotations

import base64
import json

import aiohttp
from homeassistant.core import HomeAssistant
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers.aiohttp_client import async_get_clientsession

from .const import CONF_API_KEY, CONF_MODEL, DEFAULT_MODEL, DOMAIN


def _get_entry(hass: HomeAssistant):
    entries = hass.data.get(DOMAIN, {})
    if not entries:
        raise HomeAssistantError("Food Scanner non configurato.")
    return next(iter(entries.values()))


def _model(entry) -> str:
    return str(entry.options.get(CONF_MODEL, entry.data.get(CONF_MODEL, DEFAULT_MODEL)) or DEFAULT_MODEL).strip()


def _is_modern_gemini(model: str) -> bool:
    return model.startswith(("gemini-3.6-", "gemini-3.7-", "gemini-3.8-", "gemini-4-"))


async def async_call_gemini_compat(
    hass: HomeAssistant,
    image_bytes: bytes,
    mime_type: str,
    previous_food: dict | None = None,
):
    # Import at runtime to reuse HomeStock's existing prompt + normalization logic
    # without duplicating the scanner behaviour.
    from . import service

    entry = _get_entry(hass)
    api_key = entry.data.get(CONF_API_KEY)
    if not api_key:
        raise HomeAssistantError("API key Gemini mancante.")

    model = _model(entry)
    encoded = base64.b64encode(image_bytes).decode("ascii")

    generation_config = {"responseMimeType": "application/json"}
    # Gemini 3.6+ rejects legacy sampling controls such as temperature.
    if not _is_modern_gemini(model):
        generation_config["temperature"] = 0

    payload = {
        "contents": [{"parts": [
            {"inline_data": {"mime_type": mime_type, "data": encoded}},
            {"text": service._build_prompt(previous_food)},
        ]}],
        "generationConfig": generation_config,
    }

    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
    session = async_get_clientsession(hass)
    try:
        async with session.post(
            url,
            headers={"x-goog-api-key": api_key, "Content-Type": "application/json"},
            json=payload,
            timeout=aiohttp.ClientTimeout(total=75),
        ) as response:
            body = await response.text()
            if response.status >= 400:
                raise HomeAssistantError(f"Gemini API {response.status}: {body[:700]}")
    except aiohttp.ClientError as err:
        raise HomeAssistantError(f"Errore di connessione a Gemini: {err}") from err

    try:
        result = json.loads(body)
        text = result["candidates"][0]["content"]["parts"][0]["text"]
        food = json.loads(text)
    except (KeyError, IndexError, TypeError, json.JSONDecodeError) as err:
        raise HomeAssistantError(f"Risposta Gemini non valida: {err}") from err

    if not isinstance(food, dict):
        raise HomeAssistantError("Risposta Gemini non valida: oggetto prodotto mancante.")

    service._normalize_package_fields(food)
    return food, model


def install_gemini_compat() -> None:
    from . import informha_api, service

    service._call_gemini = async_call_gemini_compat
    informha_api._call_gemini = async_call_gemini_compat
