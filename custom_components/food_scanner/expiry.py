from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from homeassistant.components.persistent_notification import async_create as async_create_persistent_notification
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.event import async_track_time_change
from homeassistant.helpers.storage import Store
from homeassistant.util import dt as dt_util

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


def _resolve_notify_target(hass: HomeAssistant, entry: ConfigEntry) -> tuple[str, str] | None:
    configured = str(
        entry.options.get(CONF_EXPIRY_NOTIFY_SERVICE, DEFAULT_EXPIRY_NOTIFY_SERVICE) or ""
    ).strip()
    if configured:
        if "." in configured:
            domain, service = configured.split(".", 1)
        else:
            domain, service = "notify", configured
        if hass.services.has_service(domain, service):
            return domain, service

    services = hass.services.async_services().get("notify", {})
    mobile = [name for name in services if name.startswith("mobile_app_")]
    if len(mobile) == 1:
        return "notify", mobile[0]
    return None


class ExpiryNotifier:
    def __init__(self, hass: HomeAssistant, entry: ConfigEntry) -> None:
        self.hass = hass
        self.entry = entry
        self.store = Store(hass, STORE_VERSION, STORE_KEY)
        self.sent: dict[str, str] = {}
        self._unsubs: list[Any] = []

    async def async_setup(self) -> None:
        data = await self.store.async_load()
        if isinstance(data, dict) and isinstance(data.get("sent"), dict):
            self.sent = {str(k): str(v) for k, v in data["sent"].items()}
        else:
            self.sent = {}

        # Due controlli quotidiani nell'ora locale di Home Assistant:
        # 11:30 prima di pranzo e 18:30 prima di cena.
        for hour, minute, slot in ((11, 30, "11:30"), (18, 30, "18:30")):
            async def _callback(now, slot_name=slot):
                await self.async_check(slot_name)

            self._unsubs.append(
                async_track_time_change(
                    self.hass,
                    _callback,
                    hour=hour,
                    minute=minute,
                    second=0,
                )
            )

    async def async_unload(self) -> None:
        for unsub in self._unsubs:
            unsub()
        self._unsubs = []

    async def async_check(self, slot: str = "manual") -> None:
        if not self.entry.options.get(CONF_EXPIRY_NOTIFY, DEFAULT_EXPIRY_NOTIFY):
            return

        try:
            days = max(0, int(self.entry.options.get(CONF_EXPIRY_NOTIFY_DAYS, DEFAULT_EXPIRY_NOTIFY_DAYS)))
        except (TypeError, ValueError):
            days = DEFAULT_EXPIRY_NOTIFY_DAYS

        # Un avviso per fascia oraria, per ogni lotto, durante tutta la finestra:
        # es. soglia 3 -> 3, 2, 1 giorni prima e giorno di scadenza,
        # sia alle 11:30 sia alle 18:30.
        today = dt_util.now().date().isoformat()
        candidates: list[tuple[dict[str, Any], str]] = []
        for item in get_archive(self.hass).expiring_within(days):
            remaining = int(item.get("days_until_expiry", 0))
            if remaining < 0 or remaining > days:
                continue
            marker = f"{item.get('id')}:{item.get('expiry_date')}:{today}:{slot}"
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

        title = "HomeStock — scadenze"
        message = "\n".join(lines)
        delivered = False

        target = _resolve_notify_target(self.hass, self.entry)
        if target:
            domain, service = target
            try:
                await self.hass.services.async_call(
                    domain,
                    service,
                    {
                        "title": title,
                        "message": message,
                        "data": {"url": "/food-scanner"},
                    },
                    blocking=True,
                )
                delivered = True
            except Exception:
                _LOGGER.exception("Invio notifica scadenze HomeStock fallito")

        if not delivered:
            async_create_persistent_notification(
                self.hass,
                message,
                title=title,
                notification_id=f"food_scanner_expiry_{slot.replace(':', '')}",
            )
            delivered = True

        if delivered:
            stamp = datetime.now(timezone.utc).isoformat()
            for _item, marker in candidates:
                self.sent[marker] = stamp
            if len(self.sent) > 3000:
                newest = sorted(self.sent.items(), key=lambda x: x[1], reverse=True)[:2000]
                self.sent = dict(newest)
            await self.store.async_save({"sent": self.sent})


def get_expiry_notifier(hass: HomeAssistant) -> ExpiryNotifier | None:
    return hass.data.setdefault(RUNTIME_KEY, {}).get("expiry_notifier")
