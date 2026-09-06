from __future__ import annotations

import re
from typing import Any


def _clean(value: Any) -> str:
    return " ".join(str(value or "").strip().split())


def derive_generic_name(product_name: Any, brand: Any = None, category: Any = None) -> str:
    """Return a conservative household-level product family name.

    New Gemini scans can provide a better generic_name directly. This fallback is
    mainly for existing/archive/manual items: it removes brand and pack-size noise
    without trying to erase meaningful variants such as 'senza lattosio'.
    """
    original = _clean(product_name) or "Prodotto"
    name = original
    brand_text = _clean(brand)

    if brand_text:
        name = re.sub(rf"\b{re.escape(brand_text)}\b", " ", name, flags=re.IGNORECASE)

    name = re.sub(r"\b\d+\s*[x×]\s*\d+(?:[.,]\d+)?\s*(?:kg|g|mg|l|cl|ml)?\b", " ", name, flags=re.IGNORECASE)
    name = re.sub(r"\b\d+(?:[.,]\d+)?\s*(?:kg|g|mg|l|cl|ml)\b", " ", name, flags=re.IGNORECASE)
    name = re.sub(r"\b(?:confezione|conf\.?|pacco|pack)\s*(?:da|di)?\s*\d+\b", " ", name, flags=re.IGNORECASE)
    name = re.sub(r"[|·_]+", " ", name)
    name = re.sub(r"\s+", " ", name).strip(" -–—,.;:")

    if not name or len(name) < 2:
        name = original

    # Normalize a few extremely common plural/singular household labels.
    low = name.casefold()
    aliases = (
        (r"\buova?\b", "Uova"),
        (r"\bketchup\b", "Ketchup"),
        (r"\bmaionese\b", "Maionese"),
        (r"\bsenape\b", "Senape"),
    )
    for pattern, label in aliases:
        if re.search(pattern, low, flags=re.IGNORECASE):
            return label

    return name[:1].upper() + name[1:] if name else "Prodotto"


def ensure_generic_name(food: dict[str, Any]) -> str:
    explicit = _clean(food.get("generic_name"))
    if explicit:
        food["generic_name"] = explicit
        return explicit
    generic = derive_generic_name(food.get("product_name"), food.get("brand"), food.get("category"))
    food["generic_name"] = generic
    return generic


def install_product_family() -> None:
    """Install product-family support without changing the integration domain/storage key."""
    from . import archive, service

    if getattr(archive.FoodArchive, "__homestock_product_family_installed", False):
        return

    # Extend Gemini contract and normalization. gemini_compat resolves these service
    # globals at runtime, so both normal and compatibility calls benefit from this.
    original_build_prompt = service._build_prompt
    original_normalize = service._normalize_package_fields

    def build_prompt_with_family(previous_food=None):
        prompt = original_build_prompt(previous_food)
        extra = (
            "\nAggiungi anche il campo generic_name. generic_name deve essere il nome comune breve "
            "della tipologia di prodotto, indipendente da marca, formato e quantità, ma deve mantenere "
            "varianti che cambiano davvero l'uso del prodotto. Esempi: 'Ketchup Heinz 500 ml' -> 'Ketchup'; "
            "'Uova Coop 6 pezzi' -> 'Uova'; 'Tonno Rio Mare 3 x 80 g' -> 'Tonno'; "
            "'Latte senza lattosio 1 L' -> 'Latte senza lattosio'. Sii conservativo: non raggruppare prodotti "
            "diversi solo perché appartengono alla stessa categoria."
        )
        return prompt + extra

    def normalize_with_family(food):
        original_normalize(food)
        ensure_generic_name(food)

    service._build_prompt = build_prompt_with_family
    service._normalize_package_fields = normalize_with_family

    original_load = archive.FoodArchive.async_load
    original_add = archive.FoodArchive.async_add
    original_add_manual = archive.FoodArchive.async_add_manual
    original_update = archive.FoodArchive.async_update_item

    async def load_with_family(self):
        await original_load(self)
        changed = False
        for item in self._items:
            before = _clean(item.get("generic_name"))
            if not before:
                ensure_generic_name(item)
                changed = True
        if changed:
            await self._async_save()

    async def add_with_family(self, food, location):
        prepared = dict(food)
        ensure_generic_name(prepared)
        result, created, added_units = await original_add(self, prepared, location)
        target = next((x for x in self._items if x.get("id") == result.get("id")), None)
        if target is not None and target.get("generic_name") != prepared.get("generic_name"):
            target["generic_name"] = prepared.get("generic_name")
            await self._async_save()
            result = dict(target)
        return result, created, added_units

    async def add_manual_with_family(self, data):
        prepared = dict(data)
        ensure_generic_name(prepared)
        result, created, added_units = await original_add_manual(self, prepared)
        target = next((x for x in self._items if x.get("id") == result.get("id")), None)
        if target is not None:
            generic = prepared.get("generic_name") or derive_generic_name(target.get("product_name"), target.get("brand"), target.get("category"))
            if target.get("generic_name") != generic:
                target["generic_name"] = generic
                await self._async_save()
                result = dict(target)
        return result, created, added_units

    async def update_with_family(self, product_id, changes):
        result = await original_update(self, product_id, changes)
        if result is None:
            return None
        target = next((x for x in self._items if x.get("id") == result.get("id")), None)
        if target is not None and any(k in changes for k in ("product_name", "brand", "category", "generic_name")):
            explicit = _clean(changes.get("generic_name"))
            target["generic_name"] = explicit or derive_generic_name(target.get("product_name"), target.get("brand"), target.get("category"))
            await self._async_save()
            result = dict(target)
        return result

    archive.FoodArchive.async_load = load_with_family
    archive.FoodArchive.async_add = add_with_family
    archive.FoodArchive.async_add_manual = add_manual_with_family
    archive.FoodArchive.async_update_item = update_with_family
    archive.FoodArchive.__homestock_product_family_installed = True
