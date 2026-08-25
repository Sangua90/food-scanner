from __future__ import annotations

import asyncio
import uuid
from collections import Counter
from datetime import datetime, timedelta, timezone
from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.helpers.storage import Store

from .const import DOMAIN

STORE_VERSION = 1
STORE_KEY = f"{DOMAIN}.history"
RUNTIME_KEY = f"{DOMAIN}_runtime"
MAX_EVENTS = 5000


class FoodHistory:
    """Storico leggero di consumo, scarto e scadenza."""

    def __init__(self, hass: HomeAssistant) -> None:
        self.hass = hass
        self.store = Store(hass, STORE_VERSION, STORE_KEY)
        self._events: list[dict[str, Any]] = []
        self._lock = asyncio.Lock()

    async def async_load(self) -> None:
        data = await self.store.async_load()
        if isinstance(data, dict) and isinstance(data.get("events"), list):
            self._events = [dict(x) for x in data["events"] if isinstance(x, dict)][-MAX_EVENTS:]
        else:
            self._events = []

    async def async_record(self, event_type: str, item: dict[str, Any], amount: int) -> None:
        if amount < 1:
            return
        event = {
            "id": uuid.uuid4().hex,
            "type": event_type,
            "amount": int(amount),
            "product_id": item.get("id"),
            "product_name": item.get("product_name"),
            "brand": item.get("brand"),
            "category": item.get("category") or "Altro",
            "location": item.get("location"),
            "unit_name": item.get("unit_name") or "unità",
            "expiry_date": item.get("expiry_date"),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        async with self._lock:
            self._events.append(event)
            if len(self._events) > MAX_EVENTS:
                self._events = self._events[-MAX_EVENTS:]
            await self.store.async_save({"events": self._events})

    def events(self, limit: int = 100) -> list[dict[str, Any]]:
        return [dict(x) for x in reversed(self._events[-max(1, min(limit, 500)):])]

    def stats(self) -> dict[str, Any]:
        now = datetime.now(timezone.utc)
        cutoff_30 = now - timedelta(days=30)
        totals = Counter()
        last30 = Counter()
        categories = Counter()

        for event in self._events:
            amount = int(event.get("amount") or 0)
            event_type = str(event.get("type") or "other")
            totals[event_type] += amount
            categories[str(event.get("category") or "Altro")] += amount
            try:
                stamp = datetime.fromisoformat(str(event.get("timestamp")))
                if stamp.tzinfo is None:
                    stamp = stamp.replace(tzinfo=timezone.utc)
                if stamp >= cutoff_30:
                    last30[event_type] += amount
            except (TypeError, ValueError):
                pass

        return {
            "consumed_units": totals.get("consumed", 0),
            "expired_units": totals.get("expired", 0),
            "removed_units": totals.get("removed", 0),
            "consumed_last_30_days": last30.get("consumed", 0),
            "expired_last_30_days": last30.get("expired", 0),
            "removed_last_30_days": last30.get("removed", 0),
            "top_categories": [
                {"category": name, "units": units}
                for name, units in categories.most_common(8)
            ],
            "events_count": len(self._events),
        }


def get_history(hass: HomeAssistant) -> FoodHistory:
    runtime = hass.data.setdefault(RUNTIME_KEY, {})
    history = runtime.get("history")
    if history is None:
        history = FoodHistory(hass)
        runtime["history"] = history
    return history
