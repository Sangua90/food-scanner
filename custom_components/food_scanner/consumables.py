from __future__ import annotations

import asyncio
import uuid
from datetime import datetime, timezone
from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.helpers.storage import Store

from .const import DOMAIN

STORAGE_VERSION = 1
STORAGE_KEY = f"{DOMAIN}.consumables"
RUNTIME_KEY = f"{DOMAIN}_runtime"
STANDARD_UNITS = ("Pezzi", "Bottiglie", "Lattine", "Vasetti", "Confezioni")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _norm(v: Any) -> str:
    return " ".join(str(v or "").strip().casefold().split())


def _unit(v: Any) -> str:
    raw = str(v or "Pezzi").strip().casefold()
    for unit in STANDARD_UNITS:
        if raw == unit.casefold():
            return unit
    if "bott" in raw or "flacon" in raw:
        return "Bottiglie"
    if "latt" in raw or "scatol" in raw:
        return "Lattine"
    if "vasett" in raw or "baratt" in raw:
        return "Vasetti"
    if "confez" in raw or "pacc" in raw:
        return "Confezioni"
    return "Pezzi"


class ConsumablesStore:
    def __init__(self, hass: HomeAssistant) -> None:
        self.hass = hass
        self.store = Store(hass, STORAGE_VERSION, STORAGE_KEY)
        self._items: list[dict[str, Any]] = []
        self._history: list[dict[str, Any]] = []
        self._lock = asyncio.Lock()

    async def async_load(self) -> None:
        data = await self.store.async_load()
        if isinstance(data, dict):
            self._items = [dict(x) for x in data.get("items", []) if isinstance(x, dict)]
            self._history = [dict(x) for x in data.get("history", []) if isinstance(x, dict)][-5000:]
        for item in self._items:
            item["unit_name"] = _unit(item.get("unit_name"))
            item["stock_units"] = max(0, int(item.get("stock_units", 1) or 0))
            item.setdefault("category", "Casa")
            item.setdefault("location", "magazzino")
        await self._async_save()

    async def _async_save(self) -> None:
        await self.store.async_save({"items": self._items, "history": self._history[-5000:]})

    def items(self) -> list[dict[str, Any]]:
        return [dict(x) for x in self._items]

    def history(self, limit: int = 50) -> list[dict[str, Any]]:
        return [dict(x) for x in reversed(self._history[-max(1, limit):])]

    def summary(self) -> dict[str, Any]:
        return {
            "products": len(self._items),
            "units": sum(max(0, int(x.get("stock_units", 0) or 0)) for x in self._items),
            "low_stock": sum(1 for x in self._items if int(x.get("stock_units", 0) or 0) <= int(x.get("min_stock", 1) or 1)),
        }

    async def async_add(self, data: dict[str, Any]) -> tuple[dict[str, Any], bool]:
        name = str(data.get("product_name") or "").strip()
        if not name:
            raise ValueError("Il nome del consumabile è obbligatorio.")
        barcode = str(data.get("barcode") or "").strip() or None
        brand = str(data.get("brand") or "").strip() or None
        quantity = str(data.get("quantity") or "").strip() or None
        category = str(data.get("category") or "Casa").strip() or "Casa"
        unit_name = _unit(data.get("unit_name"))
        add_units = max(1, int(data.get("stock_units", data.get("units_per_package", 1)) or 1))
        min_stock = max(0, int(data.get("min_stock", 1) or 0))
        now = _now()

        async with self._lock:
            existing = next((x for x in self._items if (barcode and x.get("barcode") == barcode) or (
                not barcode and _norm(x.get("product_name")) == _norm(name) and _norm(x.get("brand")) == _norm(brand)
            )), None)
            if existing:
                existing["stock_units"] = int(existing.get("stock_units", 0) or 0) + add_units
                existing["unit_name"] = unit_name
                existing["updated_at"] = now
                existing["min_stock"] = min_stock if "min_stock" in data else existing.get("min_stock", 1)
                if category:
                    existing["category"] = category
                result, created = dict(existing), False
            else:
                item = {
                    "id": uuid.uuid4().hex,
                    "product_name": name,
                    "brand": brand,
                    "quantity": quantity,
                    "barcode": barcode,
                    "category": category,
                    "location": "magazzino",
                    "unit_name": unit_name,
                    "stock_units": add_units,
                    "min_stock": min_stock,
                    "added_at": now,
                    "updated_at": now,
                }
                self._items.append(item)
                result, created = dict(item), True
            self._history.append({"type": "added", "at": now, "product_id": result["id"], "product_name": name, "amount": add_units, "unit_name": unit_name})
            await self._async_save()
        return result, created

    async def async_consume(self, product_id: str, amount: int) -> dict[str, Any] | None:
        amount = int(amount)
        if amount < 1:
            raise ValueError("La quantità deve essere almeno 1.")
        async with self._lock:
            item = next((x for x in self._items if x.get("id") == product_id), None)
            if item is None:
                return None
            current = int(item.get("stock_units", 0) or 0)
            if amount > current:
                raise ValueError(f"Disponibili solo {current} {item.get('unit_name') or 'Pezzi'}.")
            item["stock_units"] = current - amount
            item["updated_at"] = _now()
            result = dict(item)
            self._history.append({"type": "consumed", "at": item["updated_at"], "product_id": item["id"], "product_name": item.get("product_name"), "amount": amount, "unit_name": item.get("unit_name")})
            await self._async_save()
        return result

    async def async_update(self, product_id: str, changes: dict[str, Any]) -> dict[str, Any] | None:
        async with self._lock:
            item = next((x for x in self._items if x.get("id") == product_id), None)
            if item is None:
                return None
            for key in ("product_name", "brand", "quantity", "barcode", "category"):
                if key in changes:
                    item[key] = str(changes.get(key) or "").strip() or None
            if not item.get("product_name"):
                raise ValueError("Il nome del consumabile non può essere vuoto.")
            if "unit_name" in changes:
                item["unit_name"] = _unit(changes.get("unit_name"))
            if "stock_units" in changes:
                item["stock_units"] = max(0, int(changes.get("stock_units") or 0))
            if "min_stock" in changes:
                item["min_stock"] = max(0, int(changes.get("min_stock") or 0))
            item["updated_at"] = _now()
            await self._async_save()
            return dict(item)

    async def async_remove(self, product_id: str) -> bool:
        async with self._lock:
            item = next((x for x in self._items if x.get("id") == product_id), None)
            if item is None:
                return False
            self._items = [x for x in self._items if x.get("id") != product_id]
            self._history.append({"type": "removed", "at": _now(), "product_id": product_id, "product_name": item.get("product_name"), "amount": int(item.get("stock_units", 0) or 0), "unit_name": item.get("unit_name")})
            await self._async_save()
            return True


def get_consumables(hass: HomeAssistant) -> ConsumablesStore:
    runtime = hass.data.setdefault(RUNTIME_KEY, {})
    store = runtime.get("consumables")
    if store is None:
        store = ConsumablesStore(hass)
        runtime["consumables"] = store
    return store
