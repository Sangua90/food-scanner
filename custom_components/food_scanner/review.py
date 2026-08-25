from __future__ import annotations

import asyncio
import uuid
from typing import Any

from homeassistant.components.persistent_notification import async_dismiss
from homeassistant.core import HomeAssistant
from homeassistant.helpers.storage import Store
from homeassistant.util import dt as dt_util

from .const import DOMAIN

STORE_VERSION = 1
STORE_KEY = f"{DOMAIN}.reviews"
RUNTIME_KEY = f"{DOMAIN}_runtime"


class ReviewQueue:
    """Scansioni che richiedono una seconda foto o una conferma manuale."""

    def __init__(self, hass: HomeAssistant) -> None:
        self.hass = hass
        self.store = Store(hass, STORE_VERSION, STORE_KEY)
        self._items: list[dict[str, Any]] = []
        self._lock = asyncio.Lock()

    async def async_load(self) -> None:
        data = await self.store.async_load()
        if isinstance(data, dict) and isinstance(data.get("items"), list):
            self._items = [dict(x) for x in data["items"] if isinstance(x, dict)]
        else:
            self._items = []
        self._update_sensor()

    async def async_upsert(
        self,
        food: dict[str, Any],
        location: str | None,
        review_id: str | None = None,
    ) -> dict[str, Any]:
        now = dt_util.utcnow().isoformat()
        async with self._lock:
            item = None
            if review_id:
                item = next((x for x in self._items if x.get("id") == review_id), None)

            if item is None:
                item = {
                    "id": review_id or uuid.uuid4().hex,
                    "location": location,
                    "food": dict(food),
                    "attempts": 1,
                    "created_at": now,
                    "updated_at": now,
                }
                self._items.append(item)
            else:
                item["food"] = dict(food)
                item["location"] = location
                item["attempts"] = int(item.get("attempts", 1)) + 1
                item["updated_at"] = now

            await self._async_save()
            result = dict(item)
            result["food"] = dict(item["food"])

        self._update_sensor()
        return result

    async def async_remove(self, review_id: str) -> bool:
        async with self._lock:
            before = len(self._items)
            self._items = [x for x in self._items if x.get("id") != review_id]
            removed = len(self._items) != before
            if removed:
                await self._async_save()
        if removed:
            async_dismiss(self.hass, f"food_scanner_review_{review_id}")
            self._update_sensor()
        return removed

    def get(self, review_id: str) -> dict[str, Any] | None:
        item = next((x for x in self._items if x.get("id") == review_id), None)
        if item is None:
            return None
        result = dict(item)
        result["food"] = dict(item.get("food") or {})
        return result

    def items(self) -> list[dict[str, Any]]:
        result = []
        for item in self._items:
            copy = dict(item)
            copy["food"] = dict(item.get("food") or {})
            result.append(copy)
        return sorted(result, key=lambda x: x.get("created_at") or "", reverse=True)

    async def _async_save(self) -> None:
        await self.store.async_save({"items": self._items})

    def _update_sensor(self) -> None:
        self.hass.states.async_set(
            "sensor.food_scanner_to_review",
            len(self._items),
            {
                "friendly_name": "Food Scanner - Da verificare",
                "icon": "mdi:camera-retake-outline",
            },
        )


def get_review_queue(hass: HomeAssistant) -> ReviewQueue:
    runtime = hass.data.setdefault(RUNTIME_KEY, {})
    queue = runtime.get("review_queue")
    if queue is None:
        queue = ReviewQueue(hass)
        runtime["review_queue"] = queue
    return queue
