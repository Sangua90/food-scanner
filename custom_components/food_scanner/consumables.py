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
VALID_LOCATIONS = ("magazzino", "bagno", "cucina", "lavanderia")
DEFAULT_LOW_STOCK = 2


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _norm(v: Any) -> str:
    return " ".join(str(v or "").strip().casefold().split())


def _unit(v: Any) -> str:
    raw = str(v or "Pezzi").strip().casefold()
    for unit in STANDARD_UNITS:
        if raw == unit.casefold():
            return unit
    if "bott" in raw or "flacon" in raw: return "Bottiglie"
    if "latt" in raw or "scatol" in raw: return "Lattine"
    if "vasett" in raw or "baratt" in raw: return "Vasetti"
    if "confez" in raw or "pacc" in raw: return "Confezioni"
    return "Pezzi"


def _location(v: Any) -> str:
    raw = str(v or "magazzino").strip().casefold()
    return raw if raw in VALID_LOCATIONS else "magazzino"


def _effective_min_stock(item: dict[str, Any]) -> int:
    custom = max(0, int(item.get("min_stock", 0) or 0))
    return custom if custom > 0 else DEFAULT_LOW_STOCK


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
        cleaned = []
        for item in self._items:
            item["unit_name"] = _unit(item.get("unit_name"))
            item["stock_units"] = max(0, int(item.get("stock_units", 1) or 0))
            item.setdefault("category", "Casa")
            item["location"] = _location(item.get("location"))
            # Older HomeStock builds silently assigned min_stock=1. Since the
            # threshold was not user-facing, normalize that legacy default to
            # 0 = automatic threshold (currently 2).
            if int(item.get("min_stock", 0) or 0) == 1 and not item.get("threshold_customized"):
                item["min_stock"] = 0
            else:
                item["min_stock"] = max(0, int(item.get("min_stock", 0) or 0))
            item["threshold_customized"] = bool(item.get("min_stock", 0))
            if item["stock_units"] > 0:
                cleaned.append(item)
        self._items = cleaned
        await self._async_save()

    async def _async_save(self) -> None:
        await self.store.async_save({"items": self._items, "history": self._history[-5000:]})

    def items(self) -> list[dict[str, Any]]:
        result = []
        for item in self._items:
            copy = dict(item)
            copy["effective_min_stock"] = _effective_min_stock(item)
            result.append(copy)
        return result

    def history(self, limit: int = 50) -> list[dict[str, Any]]:
        return [dict(x) for x in reversed(self._history[-max(1, limit):])]

    def summary(self) -> dict[str, Any]:
        return {
            "products": len(self._items),
            "units": sum(max(0, int(x.get("stock_units", 0) or 0)) for x in self._items),
            "low_stock": sum(1 for x in self._items if int(x.get("stock_units", 0) or 0) <= _effective_min_stock(x)),
            **{loc: sum(1 for x in self._items if x.get("location") == loc) for loc in VALID_LOCATIONS},
        }

    async def async_add(self, data: dict[str, Any]) -> tuple[dict[str, Any], bool]:
        name = str(data.get("product_name") or "").strip()
        if not name: raise ValueError("Il nome del consumabile è obbligatorio.")
        barcode = str(data.get("barcode") or "").strip() or None
        brand = str(data.get("brand") or "").strip() or None
        quantity = str(data.get("quantity") or "").strip() or None
        category = str(data.get("category") or "Casa").strip() or "Casa"
        location = _location(data.get("location"))
        unit_name = _unit(data.get("unit_name"))
        add_units = max(1, int(data.get("stock_units", data.get("units_per_package", 1)) or 1))
        min_stock = max(0, int(data.get("min_stock", 0) or 0))
        threshold_customized = min_stock > 0
        now = _now()
        async with self._lock:
            existing = next((x for x in self._items if ((barcode and x.get("barcode") == barcode) or (not barcode and _norm(x.get("product_name")) == _norm(name) and _norm(x.get("brand")) == _norm(brand))) and x.get("location") == location), None)
            if existing:
                existing["stock_units"] = int(existing.get("stock_units", 0) or 0) + add_units
                existing["unit_name"] = unit_name
                existing["updated_at"] = now
                if "min_stock" in data:
                    existing["min_stock"] = min_stock
                    existing["threshold_customized"] = threshold_customized
                if category: existing["category"] = category
                result, created = dict(existing), False
            else:
                item = {
                    "id": uuid.uuid4().hex,
                    "product_name": name,
                    "brand": brand,
                    "quantity": quantity,
                    "barcode": barcode,
                    "category": category,
                    "location": location,
                    "unit_name": unit_name,
                    "stock_units": add_units,
                    "min_stock": min_stock,
                    "threshold_customized": threshold_customized,
                    "added_at": now,
                    "updated_at": now,
                }
                self._items.append(item)
                result, created = dict(item), True
            result["effective_min_stock"] = _effective_min_stock(result)
            self._history.append({"type":"added","at":now,"product_id":result["id"],"product_name":name,"amount":add_units,"unit_name":unit_name})
            await self._async_save()
        return result, created

    async def async_consume(self, product_id: str, amount: int) -> dict[str, Any] | None:
        amount=int(amount)
        if amount<1: raise ValueError("La quantità deve essere almeno 1.")
        async with self._lock:
            item=next((x for x in self._items if x.get("id")==product_id),None)
            if item is None:return None
            current=int(item.get("stock_units",0) or 0)
            if amount>current:raise ValueError(f"Disponibili solo {current} {item.get('unit_name') or 'Pezzi'}.")
            now=_now()
            remaining=current-amount
            self._history.append({"type":"consumed","at":now,"product_id":item["id"],"product_name":item.get("product_name"),"amount":amount,"unit_name":item.get("unit_name")})
            if remaining <= 0:
                result={**item,"stock_units":0,"updated_at":now,"depleted":True}
                self._items=[x for x in self._items if x.get("id")!=product_id]
            else:
                item["stock_units"]=remaining;item["updated_at"]=now;result=dict(item)
                result["effective_min_stock"]=_effective_min_stock(item)
            await self._async_save()
        return result

    async def async_update(self, product_id: str, changes: dict[str, Any]) -> dict[str, Any] | None:
        async with self._lock:
            item=next((x for x in self._items if x.get("id")==product_id),None)
            if item is None:return None
            for key in ("product_name","brand","quantity","barcode","category"):
                if key in changes:item[key]=str(changes.get(key) or "").strip() or None
            if not item.get("product_name"):raise ValueError("Il nome del consumabile non può essere vuoto.")
            if "unit_name" in changes:item["unit_name"]=_unit(changes.get("unit_name"))
            if "stock_units" in changes:
                value=max(0,int(changes.get("stock_units") or 0))
                if value == 0:
                    self._items=[x for x in self._items if x.get("id")!=product_id]
                    await self._async_save()
                    return {**item,"stock_units":0,"depleted":True}
                item["stock_units"]=value
            if "min_stock" in changes:
                item["min_stock"]=max(0,int(changes.get("min_stock") or 0))
                item["threshold_customized"]=item["min_stock"]>0
            if "location" in changes:item["location"]=_location(changes.get("location"))
            item["updated_at"]=_now()
            await self._async_save()
            result=dict(item);result["effective_min_stock"]=_effective_min_stock(item);return result

    async def async_remove(self, product_id: str) -> bool:
        async with self._lock:
            item=next((x for x in self._items if x.get("id")==product_id),None)
            if item is None:return False
            self._items=[x for x in self._items if x.get("id")!=product_id]
            self._history.append({"type":"removed","at":_now(),"product_id":product_id,"product_name":item.get("product_name"),"amount":int(item.get("stock_units",0) or 0),"unit_name":item.get("unit_name")})
            await self._async_save();return True


def get_consumables(hass: HomeAssistant) -> ConsumablesStore:
    runtime=hass.data.setdefault(RUNTIME_KEY,{})
    store=runtime.get("consumables")
    if store is None:store=ConsumablesStore(hass);runtime["consumables"]=store
    return store
