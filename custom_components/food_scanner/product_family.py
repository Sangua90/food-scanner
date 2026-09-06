from __future__ import annotations

import re
from typing import Any


def _clean(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, dict):
        for key in ("value", "text", "name", "label", "product_name"):
            if key in value:
                return _clean(value.get(key))
        return ""
    if isinstance(value, list):
        for item in value:
            text = _clean(item)
            if text:
                return text
        return ""
    return " ".join(str(value).strip().split())


def derive_generic_name(product_name: Any, brand: Any = None, category: Any = None) -> str:
    original = _clean(product_name) or "Prodotto"
    name = original
    brand_text = _clean(brand)
    if brand_text:
        name = re.sub(rf"\b{re.escape(brand_text)}\b", " ", name, flags=re.IGNORECASE)
    name = re.sub(r"\b\d+\s*[x×]\s*\d+(?:[.,]\d+)?\s*(?:kg|g|mg|l|cl|ml)?\b", " ", name, flags=re.IGNORECASE)
    name = re.sub(r"\b\d+(?:[.,]\d+)?\s*(?:kg|g|mg|l|cl|ml)\b", " ", name, flags=re.IGNORECASE)
    name = re.sub(r"\b(?:confezione|conf\.?|pacco|pack)\s*(?:da|di)?\s*\d+\b", " ", name, flags=re.IGNORECASE)
    name = re.sub(r"[|·_]+", " ", name)
    name = re.sub(r"\s+", " ", name).strip(" -–—,.;:") or original
    low = name.casefold()
    for pattern, label in ((r"\buova?\b", "Uova"),(r"\bketchup\b", "Ketchup"),(r"\bmaionese\b", "Maionese"),(r"\bsenape\b", "Senape")):
        if re.search(pattern, low, flags=re.IGNORECASE):
            return label
    return name[:1].upper() + name[1:] if name else "Prodotto"


def ensure_generic_name(food: dict[str, Any]) -> str:
    explicit = _clean(food.get("generic_name"))
    generic = explicit or derive_generic_name(food.get("product_name"), food.get("brand"), food.get("category"))
    food["generic_name"] = generic
    return generic


def install_product_family() -> None:
    """Add family metadata only at archive/store level; never alter Gemini scan parsing."""
    from . import archive
    if getattr(archive.FoodArchive, "__homestock_product_family_installed", False):
        return

    original_load = archive.FoodArchive.async_load
    original_add = archive.FoodArchive.async_add
    original_add_manual = archive.FoodArchive.async_add_manual
    original_update = archive.FoodArchive.async_update_item

    async def load_with_family(self):
        await original_load(self)
        changed = False
        for item in self._items:
            if not _clean(item.get("generic_name")):
                ensure_generic_name(item); changed = True
        if changed:
            await self._async_save()

    async def add_with_family(self, food, location):
        prepared = dict(food)
        ensure_generic_name(prepared)
        result, created, added_units = await original_add(self, prepared, location)
        target = next((x for x in self._items if x.get("id") == result.get("id")), None)
        if target is not None:
            target["generic_name"] = prepared["generic_name"]
            await self._async_save(); result = dict(target)
        return result, created, added_units

    async def add_manual_with_family(self, data):
        prepared = dict(data); ensure_generic_name(prepared)
        result, created, added_units = await original_add_manual(self, prepared)
        target = next((x for x in self._items if x.get("id") == result.get("id")), None)
        if target is not None:
            target["generic_name"] = prepared["generic_name"]
            await self._async_save(); result = dict(target)
        return result, created, added_units

    async def update_with_family(self, product_id, changes):
        result = await original_update(self, product_id, changes)
        if result is None: return None
        target = next((x for x in self._items if x.get("id") == result.get("id")), None)
        if target is not None and any(k in changes for k in ("product_name", "brand", "category", "generic_name")):
            target["generic_name"] = _clean(changes.get("generic_name")) or derive_generic_name(target.get("product_name"), target.get("brand"), target.get("category"))
            await self._async_save(); result = dict(target)
        return result

    archive.FoodArchive.async_load = load_with_family
    archive.FoodArchive.async_add = add_with_family
    archive.FoodArchive.async_add_manual = add_manual_with_family
    archive.FoodArchive.async_update_item = update_with_family
    archive.FoodArchive.__homestock_product_family_installed = True
