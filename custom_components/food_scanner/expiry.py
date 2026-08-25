from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from homeassistant.components.persistent_notification import async_create as async_create_persistent_notification
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.event import async_track_time_change
from homeassistant.helpers.storage import Store

from .archive import get_archive
from .const import (
    CONF_EXPIRY_NOTIFY,
    CONF_EXPIRY_NOTIFY_DAYS,
    CONF_EXPIRY_NOTIFY_SERVICE,
    DEFAULT_EXPIRY_NOTIFY,
    DEFAULT_EXPIRY_NOTIFY_DAYS,
    DEFAULT_EXPIRY_NOTIFY_SERVICE,
    DOMAIN,
)

_LOGGER = logging.getLogger(__name__)
STORE_VERSION = 1
STORE_KEY = f"{DOMAIN}.expiry_notifications"
RUNTIME_KEY = f"{DOMAIN}_runtime"


def _day_text(days: int) -> str:
    if days < 0:
        return f"scaduto da {abs(days)} giorni"
    if days == 0:
        return "scade oggi"
    if days == 1:
        return "scade domani"
    return f"scade tra {days} giorni"


class ExpiryNotifier:
    def __init__(self, hass: HomeAssistant, entry: ConfigEntry) -> None:
        self.hass = hass
        self.entry = entry
        self.store = Store(hass, STORE_VERSION, STORE_KEY)
        self.sent: dict[str, str] = {}
        self._unsub = None

    async def async_setup(self) -> None:
        data = await self.store.async_load()
        if isinstance(data, dict) and isinstance(data.get("sent"), dict):
            self.sent = {str(k): str(v) for k, v in data["sent"].items()}
        else:
            self.sent = {}

        self._unsub = async_track_time_change(
            self.hass,
            self._scheduled_check,
            hour=9,
            minute=0,
            second=0,
        )
        self.hass.async_create_task(self.async_check(), eager_start=True)

    async def async_unload(self) -> None:
        if self._unsub:
            self._unsub()
            self._unsub = None

    async def _scheduled_check(self, now) -> None:
        await self.async_check()

    async def async_check(self) -> None:
        if not self.entry.options.get(CONF_EXPIRY_NOTIFY, DEFAULT_EXPIRY_NOTIFY):
            return

        try:
            days = max(0, int(self.entry.options.get(CONF_EXPIRY_NOTIFY_DAYS, DEFAULT_EXPIRY_NOTIFY_DAYS)))
        except (TypeError, ValueError):
            days = DEFAULT_EXPIRY_NOTIFY_DAYS

        candidates: list[tuple[dict[str, Any], str]] = []
        for item in get_archive(self.hass).expiring_within(days):
            marker = f"{item.get('id')}:{item.get('expiry_date')}:{days}"
            if marker not in self.sent:
                candidates.append((item, marker))

        if not candidates:
            return

        lines: list[str] = []
        for item, _marker in candidates[:15]:
            name = item.get("product_name") or "Prodotto"
            stock = item.get("stock_units", 1)
            unit_name = item.get("unit_name") or "unità"
            location = {"frigo": "Frigo", "freezer": "Freezer", "dispensa": "Dispensa"}.get(
                item.get("location"), "Senza posizione"
            )
            lines.append(
                f"• {name}: {stock} {unit_name} — {_day_text(int(item.get('days_until_expiry', 0)))} ({location})"
            )

        if len(candidates) > 15:
            lines.append(f"• …e altri {len(candidates) - 15} lotti")

        title = "Food Scanner — scadenze"
        message = "\n".join(lines)
        service_name = str(
            self.entry.options.get(CONF_EXPIRY_NOTIFY_SERVICE, DEFAULT_EXPIRY_NOTIFY_SERVICE) or ""
        ).strip()

        delivered = False
        if service_name:
            if "." in service_name:
                domain, service = service_name.split(".", 1)
            else:
                domain, service = "notify", service_name
            if self.hass.services.has_service(domain, service):
                try:
                    await self.hass.services.async_call(
                        domain,
                        service,
                        {"title": title, "message": message},
                        blocking=True,
                    )
                    delivered = True
                except Exception:
                    _LOGGER.exception("Invio notifica scadenze Food Scanner fallito")
            else:
                _LOGGER.warning("Servizio notifica Food Scanner non trovato: %s", service_name)

        if not delivered:
            async_create_persistent_notification(
                self.hass,
                message,
                title=title,
                notification_id="food_scanner_expiry",
            )
            delivered = True

        if delivered:
            stamp = datetime.now(timezone.utc).isoformat()
            for _item, marker in candidates:
                self.sent[marker] = stamp
            if len(self.sent) > 2000:
                newest = sorted(self.sent.items(), key=lambda x: x[1], reverse=True)[:1500]
                self.sent = dict(newest)
            await self.store.async_save({"sent": self.sent})


def get_expiry_notifier(hass: HomeAssistant) -> ExpiryNotifier | None:
    return hass.data.setdefault(RUNTIME_KEY, {}).get("expiry_notifier")
