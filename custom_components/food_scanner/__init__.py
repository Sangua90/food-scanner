from __future__ import annotations

from pathlib import Path

from homeassistant.components import frontend, panel_custom
from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant

from .api import FoodScannerUploadView
from .archive import get_archive
from .archive_api import FoodScannerArchiveView
from .const import DOMAIN
from .consumables import get_consumables
from .consumables_api import FoodScannerConsumablesView
from .expiry import ExpiryNotifier
from .export_api import FoodScannerExportDataView, FoodScannerExportView
from .history import get_history
from .review import get_review_queue
from .scan_api import FoodScannerDashboardScanView
from .service import async_setup_services
from .units import async_install_standard_units

RUNTIME_KEY = f"{DOMAIN}_runtime"
PANEL_URL_PATH = "food-scanner"
PANEL_STATIC_URL = "/food_scanner_static"
PANEL_VERSION = "1.2.0"


async def async_setup(hass: HomeAssistant, config: dict) -> bool:
    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    hass.data.setdefault(DOMAIN, {})[entry.entry_id] = entry
    runtime = hass.data.setdefault(RUNTIME_KEY, {})

    archive = get_archive(hass)
    if not runtime.get("archive_loaded"):
        await archive.async_load()
        runtime["archive_loaded"] = True
    await async_install_standard_units(archive)

    review_queue = get_review_queue(hass)
    if not runtime.get("review_queue_loaded"):
        await review_queue.async_load()
        runtime["review_queue_loaded"] = True

    history = get_history(hass)
    if not runtime.get("history_loaded"):
        await history.async_load()
        runtime["history_loaded"] = True

    consumables = get_consumables(hass)
    if not runtime.get("consumables_loaded"):
        await consumables.async_load()
        runtime["consumables_loaded"] = True

    await async_setup_services(hass)

    if not runtime.get("upload_view_registered"):
        hass.http.register_view(FoodScannerUploadView)
        runtime["upload_view_registered"] = True

    if not runtime.get("archive_view_registered"):
        hass.http.register_view(FoodScannerArchiveView)
        runtime["archive_view_registered"] = True

    if not runtime.get("dashboard_scan_view_registered"):
        hass.http.register_view(FoodScannerDashboardScanView)
        runtime["dashboard_scan_view_registered"] = True

    if not runtime.get("consumables_view_registered"):
        hass.http.register_view(FoodScannerConsumablesView)
        runtime["consumables_view_registered"] = True

    if not runtime.get("export_view_registered"):
        hass.http.register_view(FoodScannerExportView)
        hass.http.register_view(FoodScannerExportDataView)
        runtime["export_view_registered"] = True

    if not runtime.get("panel_static_registered"):
        await hass.http.async_register_static_paths([
            StaticPathConfig(
                PANEL_STATIC_URL,
                str(Path(__file__).parent / "www"),
                cache_headers=False,
            )
        ])
        runtime["panel_static_registered"] = True

    if not frontend.async_panel_exists(hass, PANEL_URL_PATH):
        await panel_custom.async_register_panel(
            hass=hass,
            frontend_url_path=PANEL_URL_PATH,
            webcomponent_name="food-scanner-panel",
            sidebar_title="Food Scanner",
            sidebar_icon="mdi:food-apple-outline",
            module_url=f"{PANEL_STATIC_URL}/panel_v120.js?v={PANEL_VERSION}",
            require_admin=False,
        )
    runtime["panel_registered"] = True

    old_notifier = runtime.pop("expiry_notifier", None)
    if old_notifier is not None:
        await old_notifier.async_unload()
    notifier = ExpiryNotifier(hass, entry)
    await notifier.async_setup()
    runtime["expiry_notifier"] = notifier

    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    hass.data.get(DOMAIN, {}).pop(entry.entry_id, None)
    runtime = hass.data.setdefault(RUNTIME_KEY, {})

    notifier = runtime.pop("expiry_notifier", None)
    if notifier is not None:
        await notifier.async_unload()

    if frontend.async_panel_exists(hass, PANEL_URL_PATH):
        frontend.async_remove_panel(hass, PANEL_URL_PATH)
    runtime["panel_registered"] = False

    return True
