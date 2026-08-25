from __future__ import annotations

import asyncio
import uuid
from datetime import date
from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.helpers.storage import Store
from homeassistant.util import dt as dt_util

from .const import DOMAIN

STORAGE_VERSION = 1
STORAGE_KEY = f"{DOMAIN}.archive"
RUNTIME_KEY = f"{DOMAIN}_runtime"
VALID_LOCATIONS = {"frigo", "freezer", "dispensa"}


def _norm(value: Any) -> str:
    if value is None:
        return ""
    return " ".join(str(value).strip().casefold().split())


def _stock_count(item: dict[str, Any]) -> int:
    try:
        return max(1, int(item.get("stock_count", 1)))
    except (TypeError, ValueError):
        return 1


def _same_lot(item: dict[str, Any], food: dict[str, Any], location: str | None) -> bool:
    """Raggruppa solo prodotti realmente compatibili nello stesso lotto."""
    if _norm(item.get("location")) != _norm(location):
        return False
    if _norm(item.get("expiry_date")) != _norm(food.get("expiry_date")):
        return False
    if _norm(item.get("quantity")) != _norm(food.get("quantity")):
        return False

    old_barcode = _norm(item.get("barcode"))
    new_barcode = _norm(food.get("barcode"))
    if old_barcode and new_barcode:
        return old_barcode == new_barcode

    return (
        _norm(item.get("product_name")) == _norm(food.get("product_name"))
        and _norm(item.get("brand")) == _norm(food.get("brand"))
    )


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
            raw_items = data["items"]
        else:
            raw_items = []

        changed = False
        merged: list[dict[str, Any]] = []
        for raw in raw_items:
            if not isinstance(raw, dict):
                changed = True
                continue
            item = dict(raw)
            if "stock_count" not in item:
                item["stock_count"] = 1
                changed = True
            if "updated_at" not in item:
                item["updated_at"] = item.get("added_at")
                changed = True

            match = next(
                (
                    existing
                    for existing in merged
                    if _same_lot(existing, item, item.get("location"))
                ),
                None,
            )
            if match is None:
                merged.append(item)
            else:
                match["stock_count"] = _stock_count(match) + _stock_count(item)
                match["updated_at"] = item.get("updated_at") or match.get("updated_at")
                changed = True

        self._items = merged
        if changed:
            await self._async_save()
        self._update_summary_sensors()

    async def async_add(
        self,
        food: dict[str, Any],
        location: str | None,
    ) -> tuple[dict[str, Any], bool]:
        """Aggiunge una unità. Restituisce (lotto, nuovo_lotto)."""
        now = dt_util.utcnow().isoformat()
        async with self._lock:
            existing = next(
                (item for item in self._items if _same_lot(item, food, location)),
                None,
            )
            if existing is not None:
                existing["stock_count"] = _stock_count(existing) + 1
                existing["updated_at"] = now
                if food.get("confidence") is not None:
                    existing["confidence"] = food.get("confidence")
                await self._async_save()
                result = dict(existing)
                created = False
            else:
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
                    "stock_count": 1,
                    "added_at": now,
                    "updated_at": now,
                }
                self._items.append(item)
                await self._async_save()
                result = dict(item)
                created = True

        self._update_summary_sensors()
        return result, created

    async def async_consume(self, product_id: str, amount: int = 1) -> dict[str, Any] | None:
        """Rimuove alcune unità. Elimina il lotto quando arriva a zero."""
        if amount < 1:
            raise ValueError("La quantità da togliere deve essere almeno 1.")

        async with self._lock:
            item = next((x for x in self._items if x.get("id") == product_id), None)
            if item is None:
                return None

            current = _stock_count(item)
            if amount > current:
                raise ValueError(f"Disponibili solo {current} unità.")

            if amount == current:
                self._items = [x for x in self._items if x.get("id") != product_id]
                result = dict(item)
                result["stock_count"] = 0
                result["removed"] = True
            else:
                item["stock_count"] = current - amount
                item["updated_at"] = dt_util.utcnow().isoformat()
                result = dict(item)
                result["removed"] = False

            await self._async_save()

        self._update_summary_sensors()
        return result

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
            count = sum(_stock_count(item) for item in self._items)
            self._items = []
            await self._async_save()
        self._update_summary_sensors()
        return count

    def items(self) -> list[dict[str, Any]]:
        return [dict(item) for item in self._items]

    def items_sorted(
        self,
        sort: str = "expiry",
        location: str | None = None,
        search: str | None = None,
    ) -> list[dict[str, Any]]:
        items = self.items()
        if location in VALID_LOCATIONS:
            items = [item for item in items if item.get("location") == location]
        if search:
            needle = _norm(search)
            items = [
                item
                for item in items
                if needle in _norm(item.get("product_name"))
                or needle in _norm(item.get("brand"))
                or needle in _norm(item.get("barcode"))
            ]

        if sort == "name":
            key = lambda item: (
                _norm(item.get("product_name")),
                _norm(item.get("brand")),
                item.get("expiry_date") or "9999-12-31",
            )
        elif sort == "added":
            key = lambda item: (item.get("added_at") or "",)
        else:
            key = lambda item: (
                item.get("expiry_date") is None,
                item.get("expiry_date") or "9999-12-31",
                _norm(item.get("product_name")),
            )
        return sorted(items, key=key)

    def items_sorted_by_expiry(self) -> list[dict[str, Any]]:
        return self.items_sorted("expiry")

    def expiring_within(self, days: int) -> list[dict[str, Any]]:
        today = dt_util.now().date()
        result: list[dict[str, Any]] = []
        for item in self.items_sorted_by_expiry():
            raw = item.get("expiry_date")
            if not raw:
                continue
            try:
                expiry = date.fromisoformat(str(raw))
            except ValueError:
                continue
            delta = (expiry - today).days
            if delta <= days:
                copy = dict(item)
                copy["days_until_expiry"] = delta
                result.append(copy)
        return result

    async def _async_save(self) -> None:
        await self.store.async_save({"items": self._items})

    def _update_summary_sensors(self) -> None:
        counts = {"frigo": 0, "freezer": 0, "dispensa": 0, "senza_posizione": 0}
        total_units = 0
        for item in self._items:
            units = _stock_count(item)
            total_units += units
            location = item.get("location")
            if location in VALID_LOCATIONS:
                counts[location] += units
            else:
                counts["senza_posizione"] += units

        sorted_items = self.items_sorted_by_expiry()
        next_item = next((item for item in sorted_items if item.get("expiry_date")), None)

        self.hass.states.async_set(
            "sensor.food_scanner_archive_count",
            total_units,
            {
                "friendly_name": "Food Scanner - Unità in magazzino",
                "lots": len(self._items),
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
                    "stock_count": _stock_count(next_item),
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
