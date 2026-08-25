from __future__ import annotations

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant

from .archive import get_archive
from .const import CONF_MODEL, DEFAULT_MODEL, DOMAIN
from .consumables import get_consumables
from .history import get_history
from .review import get_review_queue


async def async_get_config_entry_diagnostics(
    hass: HomeAssistant,
    entry: ConfigEntry,
) -> dict:
    """Return non-sensitive diagnostics for HomeStock support."""
    archive = get_archive(hass)
    consumables = get_consumables(hass)
    reviews = get_review_queue(hass)
    history = get_history(hass)

    return {
        "integration": {
            "domain": DOMAIN,
            "entry_title": entry.title,
            "model": entry.options.get(
                CONF_MODEL,
                entry.data.get(CONF_MODEL, DEFAULT_MODEL),
            ),
            "api_key_configured": bool(entry.data.get("api_key")),
        },
        "food_archive": archive.summary(),
        "consumables": consumables.summary(),
        "review_queue_count": len(reviews.items()),
        "history_stats": history.stats(),
        "notes": {
            "api_key_redacted": True,
            "photos_are_not_included": True,
        },
    }
