from __future__ import annotations

import base64
import json
import re
from typing import Any

import aiohttp
from homeassistant.core import HomeAssistant
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers.aiohttp_client import async_get_clientsession

from .const import (
    CONF_API_KEY,
    CONF_MODEL,
    CONF_MODEL_MODE,
    DEFAULT_MODEL,
    DEFAULT_MODEL_MODE,
    DOMAIN,
    MODEL_MODE_AUTO,
)

RUNTIME_KEY = f"{DOMAIN}_runtime"
MODEL_RE = re.compile(r"^models/(gemini-(\d+)\.(\d+)-flash)$")


def _get_entry(hass: HomeAssistant):
    entries = hass.data.get(DOMAIN, {})
    if not entries:
        raise HomeAssistantError("Food Scanner non configurato.")
    return next(iter(entries.values()))


def _manual_model(entry) -> str:
    return str(entry.options.get(CONF_MODEL, entry.data.get(CONF_MODEL, DEFAULT_MODEL)) or DEFAULT_MODEL).strip()


def _model_mode(entry) -> str:
    return str(entry.options.get(CONF_MODEL_MODE, entry.data.get(CONF_MODEL_MODE, DEFAULT_MODEL_MODE)) or DEFAULT_MODEL_MODE).strip()


def _is_modern_gemini(model: str) -> bool:
    return model.startswith(("gemini-3.6-", "gemini-3.7-", "gemini-3.8-", "gemini-4-"))


async def _list_flash_models(hass: HomeAssistant, api_key: str) -> list[str]:
    session = async_get_clientsession(hass)
    url = "https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000"
    try:
        async with session.get(
            url,
            headers={"x-goog-api-key": api_key},
            timeout=aiohttp.ClientTimeout(total=20),
        ) as response:
            body = await response.text()
            if response.status >= 400:
                raise HomeAssistantError(f"Gemini models API {response.status}: {body[:500]}")
    except aiohttp.ClientError as err:
        raise HomeAssistantError(f"Errore di connessione alla lista modelli Gemini: {err}") from err

    try:
        payload = json.loads(body)
    except json.JSONDecodeError as err:
        raise HomeAssistantError("Risposta lista modelli Gemini non valida.") from err

    ranked: list[tuple[tuple[int, int], str]] = []
    for item in payload.get("models", []):
        if not isinstance(item, dict):
            continue
        methods = item.get("supportedGenerationMethods") or []
        if "generateContent" not in methods:
            continue
        name = str(item.get("name") or "")
        match = MODEL_RE.match(name)
        if not match:
            continue
        model, major, minor = match.groups()
        ranked.append(((int(major), int(minor)), model))

    ranked.sort(reverse=True)
    return [model for _, model in ranked]


async def _candidate_models(hass: HomeAssistant, entry, api_key: str) -> list[str]:
    manual = _manual_model(entry)
    if _model_mode(entry) != MODEL_MODE_AUTO:
        return [manual]

    runtime = hass.data.setdefault(RUNTIME_KEY, {})
    last_good = str(runtime.get("gemini_last_good_model") or "").strip()

    try:
        discovered = await _list_flash_models(hass, api_key)
    except HomeAssistantError:
        discovered = []

    candidates: list[str] = []
    for model in discovered:
        if model not in candidates:
            candidates.append(model)
    if last_good and last_good not in candidates:
        candidates.append(last_good)
    if manual and manual not in candidates:
        candidates.append(manual)
    if DEFAULT_MODEL not in candidates:
        candidates.append(DEFAULT_MODEL)
    return candidates


async def _call_model(
    hass: HomeAssistant,
    api_key: str,
    model: str,
    image_bytes: bytes,
    mime_type: str,
    previous_food: dict[str, Any] | None,
):
    from . import service

    encoded = base64.b64encode(image_bytes).decode("ascii")
    generation_config: dict[str, Any] = {"responseMimeType": "application/json"}
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
                raise HomeAssistantError(f"Gemini API {response.status} ({model}): {body[:700]}")
    except aiohttp.ClientError as err:
        raise HomeAssistantError(f"Errore di connessione a Gemini ({model}): {err}") from err

    try:
        result = json.loads(body)
        text = result["candidates"][0]["content"]["parts"][0]["text"]
        food = json.loads(text)
    except (KeyError, IndexError, TypeError, json.JSONDecodeError) as err:
        raise HomeAssistantError(f"Risposta Gemini non valida ({model}): {err}") from err

    if not isinstance(food, dict):
        raise HomeAssistantError(f"Risposta Gemini non valida ({model}): oggetto prodotto mancante.")

    service._normalize_package_fields(food)
    return food, model


async def async_call_gemini_compat(
    hass: HomeAssistant,
    image_bytes: bytes,
    mime_type: str,
    previous_food: dict | None = None,
):
    entry = _get_entry(hass)
    api_key = entry.data.get(CONF_API_KEY)
    if not api_key:
        raise HomeAssistantError("API key Gemini mancante.")

    candidates = await _candidate_models(hass, entry, api_key)
    errors: list[str] = []
    for model in candidates:
        try:
            food, used_model = await _call_model(hass, api_key, model, image_bytes, mime_type, previous_food)
            hass.data.setdefault(RUNTIME_KEY, {})["gemini_last_good_model"] = used_model
            return food, used_model
        except HomeAssistantError as err:
            errors.append(str(err))
            if _model_mode(entry) != MODEL_MODE_AUTO:
                raise

    detail = " | ".join(errors[-3:])
    raise HomeAssistantError(f"Nessun modello Gemini compatibile ha completato l'analisi. {detail}")


def install_gemini_compat() -> None:
    from . import informha_api, service

    service._call_gemini = async_call_gemini_compat
    informha_api._call_gemini = async_call_gemini_compat
