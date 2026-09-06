from __future__ import annotations

from homeassistant.util import dt as dt_util

from .history import get_history


def _stock_units_allow_zero(item: dict) -> int:
    try:
        return max(0, int(item.get("stock_units", item.get("stock_count", 0)) or 0))
    except (TypeError, ValueError):
        return 0


async def _async_set_units_keep_zero(self, product_id: str, amount: int):
    if amount < 0:
        raise ValueError("La quantità non può essere negativa.")
    async with self._lock:
        item = next((x for x in self._items if x.get("id") == product_id), None)
        if item is None:
            return None
        item["stock_units"] = amount
        item["updated_at"] = dt_util.utcnow().isoformat()
        result = dict(item)
        result["removed"] = False
        result["depleted"] = amount == 0
        await self._async_save()
    self._update_summary_sensors()
    return result


async def _async_consume_keep_zero(self, product_id: str, amount: int = 1):
    if amount < 1:
        raise ValueError("La quantità da togliere deve essere almeno 1.")
    source_item = None
    async with self._lock:
        item = next((x for x in self._items if x.get("id") == product_id), None)
        if item is None:
            return None
        current = _stock_units_allow_zero(item)
        if amount > current:
            raise ValueError(f"Disponibili solo {current} {item.get('unit_name') or 'unità'}.")
        source_item = dict(item)
        item["stock_units"] = current - amount
        item["updated_at"] = dt_util.utcnow().isoformat()
        result = dict(item)
        result["removed"] = False
        result["depleted"] = item["stock_units"] == 0
        await self._async_save()
    await get_history(self.hass).async_record("consumed", source_item, amount)
    self._update_summary_sensors()
    return result


def install_zero_stock_compat() -> None:
    from . import archive

    archive._stock_units = _stock_units_allow_zero
    archive.FoodArchive.async_set_units = _async_set_units_keep_zero
    archive.FoodArchive.async_consume = _async_consume_keep_zero
