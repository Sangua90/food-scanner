from __future__ import annotations

import base64
import os
from typing import Any

import aiohttp
from homeassistant.core import HomeAssistant
from homeassistant.helpers.aiohttp_client import async_get_clientsession

ENGINE_PORT = 8099
ENGINE_SLUG = "homestock"


def _supervisor_connection() -> tuple[str, str] | None:
    host = str(os.environ.get("SUPERVISOR") or "").strip().rstrip("/")
    token = str(os.environ.get("SUPERVISOR_TOKEN") or "").strip()
    if not host or not token:
        return None
    return host, token


def _extract_addons(payload: Any) -> list[dict[str, Any]]:
    if not isinstance(payload, dict):
        return []
    data = payload.get("data")
    if isinstance(data, dict) and isinstance(data.get("addons"), list):
        return [x for x in data["addons"] if isinstance(x, dict)]
    if isinstance(payload.get("addons"), list):
        return [x for x in payload["addons"] if isinstance(x, dict)]
    return []


async def async_find_engine(hass: HomeAssistant) -> dict[str, Any] | None:
    connection = _supervisor_connection()
    if connection is None:
        return None
    supervisor, token = connection
    session = async_get_clientsession(hass)
    try:
        async with session.get(
            f"{supervisor}/addons",
            headers={"Authorization": f"Bearer {token}"},
            timeout=aiohttp.ClientTimeout(total=8),
        ) as response:
            if response.status >= 400:
                return None
            payload = await response.json(content_type=None)
    except (aiohttp.ClientError, TimeoutError, ValueError):
        return None

    for addon in _extract_addons(payload):
        slug = str(addon.get("slug") or "").strip()
        name = str(addon.get("name") or "").strip().casefold()
        if not slug:
            continue
        if slug == ENGINE_SLUG or slug.endswith(f"_{ENGINE_SLUG}") or name == "homestock":
            return {
                "slug": slug,
                "name": addon.get("name") or "HomeStock",
                "state": addon.get("state"),
                "version": addon.get("version"),
                "hostname": slug.replace("_", "-"),
            }
    return None


async def async_engine_health(hass: HomeAssistant) -> dict[str, Any]:
    addon = await async_find_engine(hass)
    if addon is None:
        return {"available": False, "installed": False, "healthy": False, "message": "HomeStock Engine non installato"}
    result = {"available": False, "installed": True, "healthy": False, "addon": addon}
    if str(addon.get("state") or "").lower() not in {"started", "running"}:
        result["message"] = "HomeStock Engine installato ma non avviato"
        return result
    session = async_get_clientsession(hass)
    try:
        async with session.get(f"http://{addon['hostname']}:{ENGINE_PORT}/health", timeout=aiohttp.ClientTimeout(total=5)) as response:
            body = await response.json(content_type=None)
            if response.status < 400 and isinstance(body, dict) and body.get("ok"):
                result.update({"available": True, "healthy": True, "health": body})
                return result
            result["message"] = f"Engine ha risposto HTTP {response.status}"
    except (aiohttp.ClientError, TimeoutError, ValueError) as err:
        result["message"] = f"Engine non raggiungibile: {err}"
    return result


async def _healthy_hostname(hass: HomeAssistant) -> str | None:
    health = await async_engine_health(hass)
    if not health.get("healthy"):
        return None
    return str((health.get("addon") or {}).get("hostname") or "").strip() or None


async def async_engine_gemini_json(
    hass: HomeAssistant,
    *,
    api_key: str,
    prompt: str,
    models: list[str],
    media_bytes: bytes | None = None,
    mime_type: str | None = None,
) -> tuple[dict[str, Any], str] | None:
    hostname = await _healthy_hostname(hass)
    if not hostname:
        return None
    payload: dict[str, Any] = {
        "api_key": api_key,
        "prompt": prompt,
        "models": models,
        "preferred_model": models[0] if models else None,
    }
    if media_bytes is not None:
        payload["media_data"] = base64.b64encode(media_bytes).decode("ascii")
        payload["mime_type"] = mime_type
    session = async_get_clientsession(hass)
    try:
        async with session.post(
            f"http://{hostname}:{ENGINE_PORT}/v1/gemini_json",
            json=payload,
            timeout=aiohttp.ClientTimeout(total=85),
        ) as response:
            body = await response.json(content_type=None)
            if response.status >= 400:
                return None
    except (aiohttp.ClientError, TimeoutError, ValueError):
        return None
    data = body.get("data") if isinstance(body, dict) else None
    model = str(body.get("model") or "") if isinstance(body, dict) else ""
    if not isinstance(data, dict) or not model:
        return None
    return data, model


async def async_engine_transcribe(
    hass: HomeAssistant,
    *,
    api_key: str,
    audio_data: str,
    mime_type: str,
    preferred_model: str | None = None,
) -> dict[str, Any] | None:
    hostname = await _healthy_hostname(hass)
    if not hostname:
        return None
    session = async_get_clientsession(hass)
    payload = {
        "api_key": api_key,
        "audio_data": audio_data,
        "mime_type": mime_type,
        "preferred_model": preferred_model,
    }
    try:
        async with session.post(
            f"http://{hostname}:{ENGINE_PORT}/v1/transcribe",
            json=payload,
            timeout=aiohttp.ClientTimeout(total=75),
        ) as response:
            body = await response.json(content_type=None)
            if response.status >= 400:
                return None
            if isinstance(body, dict) and body.get("success") and str(body.get("text") or "").strip():
                return body
    except (aiohttp.ClientError, TimeoutError, ValueError):
        return None
    return None
