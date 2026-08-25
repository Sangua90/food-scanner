from __future__ import annotations

import asyncio
import uuid
from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.helpers.storage import Store
from homeassistant.util import dt as dt_util

from .const import DOMAIN

STORAGE_VERSION = 1
STORAGE_KEY = f"{DOMAIN}.archive"
RUNTIME_KEY = f"{DOMAIN}_runtime"


class FoodArchive:
    """Archivio persistente degli alimenti scansionati."""

    def __init__(self, hass: HomeAssistant) -> None:
        self.hass = hass
        self.store = Store(hass, STORAGE_VERSION, STORAGE_KEY)
        self._items: list[dict[str, Any]] = []
        self._lock = asyncio.Lock()

    async def async_load(self) -> None:
        data = await self.store.async_load()
        if isinstance(data, dict) and isinstance(data.get("items"), list):
            self._items = data["items"]
        else:
            self._items = []
        self._update_summary_sensors()

    async def async_add(self, food: dict[str, Any], location: str | None) -> dict[str, Any]:
        item = {
            "id": uuid.uuid4().hex,
            "product_name": food.get("product_name"),
            "brand": food.get("brand"),
            "quantity": food.get("quantity"),
            "barcode": food.get("barcode"),
            "expiry_date": food.get("expiry_date"),
            "expiry_type": food.get("expiry_type"),
            "confidence": food.get("confidence"),
            "location": location,
            "added_at": dt_util.utcnow().isoformat(),
        }
        async with self._lock:
            self._items.append(item)
            await self._async_save()
        self._update_summary_sensors()
        return item

    async def async_remove(self, product_id: str) -> bool:
        async with self._lock:
            before = len(self._items)
            self._items = [item for item in self._items if item.get("id") != product_id]
            removed = len(self._items) != before
            if removed:
                await self._async_save()
        if removed:
            self._update_summary_sensors()
        return removed

    async def async_clear(self) -> int:
        async with self._lock:
            count = len(self._items)
            self._items = []
            await self._async_save()
        self._update_summary_sensors()
        return count

    def items(self) -> list[dict[str, Any]]:
        return [dict(item) for item in self._items]

    def items_sorted_by_expiry(self) -> list[dict[str, Any]]:
        return sorted(
            self.items(),
            key=lambda item: (
                item.get("expiry_date") is None,
                item.get("expiry_date") or "9999-12-31",
                (item.get("product_name") or "").casefold(),
            ),
        )

    async def _async_save(self) -> None:
        await self.store.async_save({"items": self._items})

    def _update_summary_sensors(self) -> None:
        counts = {"frigo": 0, "freezer": 0, "dispensa": 0, "senza_posizione": 0}
        for item in self._items:
            location = item.get("location")
            if location in {"frigo", "freezer", "dispensa"}:
                counts[location] += 1
            else:
                counts["senza_posizione"] += 1

        sorted_items = self.items_sorted_by_expiry()
        next_item = next((item for item in sorted_items if item.get("expiry_date")), None)

        self.hass.states.async_set(
            "sensor.food_scanner_archive_count",
            len(self._items),
            {
                "friendly_name": "Food Scanner - Prodotti in archivio",
                **counts,
            },
        )

        if next_item:
            self.hass.states.async_set(
                "sensor.food_scanner_next_expiry",
                next_item["expiry_date"],
                {
                    "friendly_name": "Food Scanner - Prossima scadenza",
                    "product_id": next_item.get("id"),
                    "product_name": next_item.get("product_name"),
                    "brand": next_item.get("brand"),
                    "location": next_item.get("location"),
                    "expiry_type": next_item.get("expiry_type"),
                },
            )
        else:
            self.hass.states.async_set(
                "sensor.food_scanner_next_expiry",
                "unknown",
                {"friendly_name": "Food Scanner - Prossima scadenza"},
            )


def get_archive(hass: HomeAssistant) -> FoodArchive:
    runtime = hass.data.setdefault(RUNTIME_KEY, {})
    archive = runtime.get("archive")
    if archive is None:
        archive = FoodArchive(hass)
        runtime["archive"] = archive
    return archive
