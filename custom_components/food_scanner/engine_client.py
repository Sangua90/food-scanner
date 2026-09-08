from __future__ import annotations

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

    candidates = _extract_addons(payload)
    for addon in candidates:
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
    url = f"http://{addon['hostname']}:{ENGINE_PORT}/health"
    try:
        async with session.get(url, timeout=aiohttp.ClientTimeout(total=5)) as response:
            body = await response.json(content_type=None)
            if response.status < 400 and isinstance(body, dict) and body.get("ok"):
                result.update({"available": True, "healthy": True, "health": body})
                return result
            result["message"] = f"Engine ha risposto HTTP {response.status}"
    except (aiohttp.ClientError, TimeoutError, ValueError) as err:
        result["message"] = f"Engine non raggiungibile: {err}"
    return result


async def async_engine_transcribe(
    hass: HomeAssistant,
    *,
    api_key: str,
    audio_data: str,
    mime_type: str,
    preferred_model: str | None = None,
) -> dict[str, Any] | None:
    health = await async_engine_health(hass)
    if not health.get("healthy"):
        return None
    addon = health.get("addon") or {}
    hostname = str(addon.get("hostname") or "").strip()
    if not hostname:
        return None

    session = async_get_clientsession(hass)
    try:
        async with session.get(
            f"http://{hostname}:{ENGINE_PORT}/v1/capabilities",
            timeout=aiohttp.ClientTimeout(total=5),
        ) as response:
            caps = await response.json(content_type=None)
            if response.status >= 400 or not bool((caps.get("capabilities") or {}).get("audio_transcription")):
                return None
    except (aiohttp.ClientError, TimeoutError, ValueError, AttributeError):
        return None

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
