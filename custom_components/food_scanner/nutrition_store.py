from __future__ import annotations

from typing import Any

from homeassistant.util import dt as dt_util

from .archive import FoodArchive, get_archive


def _valid_nutrition(value: Any) -> dict[str, Any] | None:
    if not isinstance(value, dict) or not value:
        return None
    return dict(value)


async def async_persist_nutrition(hass, product_id: str | None, nutrition: Any) -> bool:
    data = _valid_nutrition(nutrition)
    if not product_id or not data:
        return False

    archive = get_archive(hass)
    async with archive._lock:
        item = next((x for x in archive._items if x.get("id") == product_id), None)
        if item is None:
            return False
        if item.get("nutrition") == data:
            return False
        item["nutrition"] = data
        item["nutrition_updated_at"] = dt_util.utcnow().isoformat()
        await archive._async_save()
    return True


def install_nutrition_persistence() -> None:
    """Persist nutrition returned during normal HomeStock scans without changing the UI."""
    if getattr(FoodArchive, "_homestock_nutrition_patched", False):
        return

    original_async_add = FoodArchive.async_add

    async def async_add_with_nutrition(self, food, location):
        result, created, added_units = await original_async_add(self, food, location)
        nutrition = _valid_nutrition(food.get("nutrition"))
        product_id = result.get("id") if isinstance(result, dict) else None
        if nutrition and product_id:
            async with self._lock:
                item = next((x for x in self._items if x.get("id") == product_id), None)
                if item is not None:
                    item["nutrition"] = nutrition
                    item["nutrition_updated_at"] = dt_util.utcnow().isoformat()
                    await self._async_save()
                    result = dict(item)
        return result, created, added_units

    FoodArchive.async_add = async_add_with_nutrition
    FoodArchive._homestock_nutrition_patched = True
