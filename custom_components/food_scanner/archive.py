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
EDITABLE_TEXT_FIELDS = {
    "product_name",
    "brand",
    "quantity",
    "barcode",
    "expiry_type",
    "unit_name",
    "package_type",
}


def _norm(value: Any) -> str:
    if value is None:
        return ""
    return " ".join(str(value).strip().casefold().split())


def _int_at_least_one(value: Any, default: int = 1) -> int:
    try:
        return max(1, int(value))
    except (TypeError, ValueError):
        return default


def _stock_units(item: dict[str, Any]) -> int:
    if "stock_units" in item:
        return _int_at_least_one(item.get("stock_units"))
    return _int_at_least_one(item.get("stock_count", 1))


def _units_per_package(food_or_item: dict[str, Any]) -> int:
    return _int_at_least_one(food_or_item.get("units_per_package", 1))


def _same_lot(item: dict[str, Any], food: dict[str, Any], location: str | None) -> bool:
    """Raggruppa solo prodotti compatibili nello stesso lotto/scadenza."""
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
        and _norm(item.get("unit_name")) == _norm(food.get("unit_name"))
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
        raw_items = data.get("items", []) if isinstance(data, dict) else []

        changed = False
        merged: list[dict[str, Any]] = []
        for raw in raw_items:
            if not isinstance(raw, dict):
                changed = True
                continue
            item = dict(raw)

            if "stock_units" not in item:
                item["stock_units"] = _int_at_least_one(item.pop("stock_count", 1))
                changed = True
            if "units_per_package" not in item:
                item["units_per_package"] = 1
                changed = True
            if "unit_name" not in item:
                item["unit_name"] = "unità"
                changed = True
            if "package_type" not in item:
                item["package_type"] = "confezione"
                changed = True
            if "updated_at" not in item:
                item["updated_at"] = item.get("added_at")
                changed = True

            match = next(
                (existing for existing in merged if _same_lot(existing, item, item.get("location"))),
                None,
            )
            if match is None:
                merged.append(item)
            else:
                match["stock_units"] = _stock_units(match) + _stock_units(item)
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
    ) -> tuple[dict[str, Any], bool, int]:
        """Aggiunge una confezione scansionata e le sue unità consumabili."""
        now = dt_util.utcnow().isoformat()
        added_units = _units_per_package(food)
        unit_name = str(food.get("unit_name") or "unità").strip()
        package_type = str(food.get("package_type") or "confezione").strip()

        normalized_food = dict(food)
        normalized_food["units_per_package"] = added_units
        normalized_food["unit_name"] = unit_name
        normalized_food["package_type"] = package_type

        async with self._lock:
            existing = next(
                (item for item in self._items if _same_lot(item, normalized_food, location)),
                None,
            )
            if existing is not None:
                existing["stock_units"] = _stock_units(existing) + added_units
                existing["units_per_package"] = added_units
                existing["unit_name"] = unit_name
                existing["package_type"] = package_type
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
                    "package_type": package_type,
                    "units_per_package": added_units,
                    "unit_name": unit_name,
                    "stock_units": added_units,
                    "added_at": now,
                    "updated_at": now,
                }
                self._items.append(item)
                await self._async_save()
                result = dict(item)
                created = True

        self._update_summary_sensors()
        return result, created, added_units

    async def async_consume(self, product_id: str, amount: int = 1) -> dict[str, Any] | None:
        """Rimuove unità consumabili. Elimina il lotto solo a zero."""
        if amount < 1:
            raise ValueError("La quantità da togliere deve essere almeno 1.")

        async with self._lock:
            item = next((x for x in self._items if x.get("id") == product_id), None)
            if item is None:
                return None

            current = _stock_units(item)
            if amount > current:
                raise ValueError(f"Disponibili solo {current} {item.get('unit_name') or 'unità'}.")

            if amount == current:
                self._items = [x for x in self._items if x.get("id") != product_id]
                result = dict(item)
                result["stock_units"] = 0
                result["removed"] = True
            else:
                item["stock_units"] = current - amount
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
            count = sum(_stock_units(item) for item in self._items)
            self._items = []
            await self._async_save()
        self._update_summary_sensors()
        return count

    async def async_set_units(self, product_id: str, amount: int) -> dict[str, Any] | None:
        """Corregge manualmente le unità disponibili di un lotto."""
        if amount < 0:
            raise ValueError("La quantità non può essere negativa.")
        async with self._lock:
            item = next((x for x in self._items if x.get("id") == product_id), None)
            if item is None:
                return None
            if amount == 0:
                self._items = [x for x in self._items if x.get("id") != product_id]
                result = dict(item)
                result["stock_units"] = 0
                result["removed"] = True
            else:
                item["stock_units"] = amount
                item["updated_at"] = dt_util.utcnow().isoformat()
                result = dict(item)
                result["removed"] = False
            await self._async_save()
        self._update_summary_sensors()
        return result

    async def async_update_item(
        self,
        product_id: str,
        changes: dict[str, Any],
    ) -> dict[str, Any] | None:
        """Corregge manualmente i dati di un lotto e unisce eventuali duplicati."""
        async with self._lock:
            item = next((x for x in self._items if x.get("id") == product_id), None)
            if item is None:
                return None

            for field in EDITABLE_TEXT_FIELDS:
                if field not in changes:
                    continue
                value = changes.get(field)
                if value is None:
                    item[field] = None
                else:
                    value = str(value).strip()
                    item[field] = value or None

            if "product_name" in changes and not item.get("product_name"):
                raise ValueError("Il nome del prodotto non può essere vuoto.")

            if "location" in changes:
                location = str(changes.get("location") or "").strip().lower()
                if location not in VALID_LOCATIONS:
                    raise ValueError("Posizione non valida.")
                item["location"] = location

            if "expiry_date" in changes:
                raw_date = str(changes.get("expiry_date") or "").strip()
                if raw_date:
                    try:
                        date.fromisoformat(raw_date)
                    except ValueError as err:
                        raise ValueError("La scadenza deve essere nel formato YYYY-MM-DD.") from err
                    item["expiry_date"] = raw_date
                else:
                    item["expiry_date"] = None

            if "units_per_package" in changes:
                try:
                    units = int(changes["units_per_package"])
                except (TypeError, ValueError) as err:
                    raise ValueError("Unità per confezione non valide.") from err
                if units < 1:
                    raise ValueError("Le unità per confezione devono essere almeno 1.")
                item["units_per_package"] = units

            item["updated_at"] = dt_util.utcnow().isoformat()

            duplicate = next(
                (
                    other
                    for other in self._items
                    if other is not item
                    and _same_lot(other, item, item.get("location"))
                ),
                None,
            )
            if duplicate is not None:
                duplicate["stock_units"] = _stock_units(duplicate) + _stock_units(item)
                duplicate["updated_at"] = item["updated_at"]
                self._items = [x for x in self._items if x is not item]
                result = dict(duplicate)
            else:
                result = dict(item)

            await self._async_save()

        self._update_summary_sensors()
        return result

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
            units = _stock_units(item)
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
                    "stock_units": _stock_units(next_item),
                    "unit_name": next_item.get("unit_name"),
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
