from __future__ import annotations

from types import MethodType
from typing import Any

STANDARD_UNITS = ("Pezzi", "Bottiglie", "Lattine", "Vasetti", "Confezioni")


def standard_unit(value: Any, package_type: Any = None) -> str:
    raw = f"{value or ''} {package_type or ''}".casefold()
    if any(word in raw for word in ("bottigl", "flacone")):
        return "Bottiglie"
    if any(word in raw for word in ("lattin", "scatoletta", "scatolette")):
        return "Lattine"
    if any(word in raw for word in ("vasett", "barattol")):
        return "Vasetti"
    if any(word in raw for word in ("confezion", "pacco", "pacchi", "busta")) and not any(
        word in str(value or "").casefold() for word in ("pez", "merend", "biscott", "capsul", "sacchett")
    ):
        return "Confezioni"
    return "Pezzi"


def normalize_food(food: dict[str, Any]) -> dict[str, Any]:
    data = dict(food)
    data["unit_name"] = standard_unit(data.get("unit_name"), data.get("package_type"))
    return data


async def async_install_standard_units(archive) -> None:
    """Migra i dati esistenti e normalizza tutti i futuri inserimenti."""
    if getattr(archive, "_food_scanner_units_wrapped", False):
        return

    changed = False
    for item in getattr(archive, "_items", []):
        wanted = standard_unit(item.get("unit_name"), item.get("package_type"))
        if item.get("unit_name") != wanted:
            item["unit_name"] = wanted
            changed = True
    if changed:
        await archive._async_save()
        archive._update_summary_sensors()

    original_add = archive.async_add
    original_manual = archive.async_add_manual
    original_update = archive.async_update_item

    async def wrapped_add(self, food, location):
        return await original_add(normalize_food(food), location)

    async def wrapped_manual(self, data):
        return await original_manual(normalize_food(data))

    async def wrapped_update(self, product_id, changes):
        data = dict(changes)
        if "unit_name" in data or "package_type" in data:
            current = next((x for x in self._items if x.get("id") == product_id), {})
            data["unit_name"] = standard_unit(
                data.get("unit_name", current.get("unit_name")),
                data.get("package_type", current.get("package_type")),
            )
        return await original_update(product_id, data)

    archive.async_add = MethodType(wrapped_add, archive)
    archive.async_add_manual = MethodType(wrapped_manual, archive)
    archive.async_update_item = MethodType(wrapped_update, archive)
    archive._food_scanner_units_wrapped = True
