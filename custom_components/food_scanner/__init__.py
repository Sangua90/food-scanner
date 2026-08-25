from __future__ import annotations

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant

from .api import FoodScannerUploadView
from .const import DOMAIN
from .service import async_setup_services

RUNTIME_KEY = f"{DOMAIN}_runtime"


async def async_setup(hass: HomeAssistant, config: dict) -> bool:
    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    hass.data.setdefault(DOMAIN, {})[entry.entry_id] = entry
    await async_setup_services(hass)

    runtime = hass.data.setdefault(RUNTIME_KEY, {})
    if not runtime.get("upload_view_registered"):
        hass.http.register_view(FoodScannerUploadView)
        runtime["upload_view_registered"] = True

    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    hass.data.get(DOMAIN, {}).pop(entry.entry_id, None)
    return True
