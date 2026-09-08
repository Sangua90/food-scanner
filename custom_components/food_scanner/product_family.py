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


# Families are intentionally generic: brand, format and package size must not
# split the stock calculation. More specific families are listed first.
_FAMILY_RULES: tuple[tuple[str, str], ...] = (
    (r"\btonno\b", "Tonno"),
    (r"\bmaionese\b", "Maionese"),
    (r"\bketchup\b", "Ketchup"),
    (r"\bsenape\b", "Senape"),
    (r"\buova?\b", "Uova"),
    (r"\blatte\b", "Latte"),
    (r"\bmozzarella\b", "Mozzarella"),
    (r"\byogurt\b", "Yogurt"),
    (r"\bburro\b", "Burro"),
    (r"\bparmigiano\b|\bgrana\b", "Parmigiano / Grana"),
    (r"\bprosciutto\s+cotto\b", "Prosciutto cotto"),
    (r"\bprosciutto\s+crudo\b", "Prosciutto crudo"),
    (r"\bsalame\b", "Salame"),
    (r"\bpasta\b", "Pasta"),
    (r"\briso\b", "Riso"),
    (r"\bpane\b", "Pane"),
    (r"\bpassata\b", "Passata di pomodoro"),
    (r"\bpelati\b", "Pomodori pelati"),
    (r"\bpolpa\s+di\s+pomodoro\b", "Polpa di pomodoro"),
    (r"\bfagioli\b", "Fagioli"),
    (r"\bceci\b", "Ceci"),
    (r"\blenticchie\b", "Lenticchie"),
    (r"\bpiselli\b", "Piselli"),
    (r"\bmais\b", "Mais"),
    (r"\bfarina\b", "Farina"),
    (r"\bzucchero\b", "Zucchero"),
    (r"\bsale\b", "Sale"),
    (r"\bolio\s+(?:extra\s+vergine|extravergine|evo)?\s*(?:di\s+oliva)?\b", "Olio d'oliva"),
    (r"\bacqua\b", "Acqua"),
    (r"\bcaff[eè]\b", "Caffè"),
    (r"\bbiscott", "Biscotti"),
    (r"\bfette\s+biscottate\b", "Fette biscottate"),
    (r"\bcereali\b", "Cereali"),
    (r"\bmarmellata\b|\bconfettura\b", "Marmellata / Confettura"),
    (r"\bcrema\s+spalmabile\b", "Crema spalmabile"),
    (r"\bpizza\b", "Pizza"),
    (r"\bpatatine\b", "Patatine"),
    (r"\bcracker\b", "Cracker"),
)


def canonical_family(product_name: Any, category: Any = None) -> str | None:
    text = f"{_clean(product_name)} {_clean(category)}".casefold()
    for pattern, label in _FAMILY_RULES:
        if re.search(pattern, text, flags=re.IGNORECASE):
            return label
    return None


def derive_generic_name(product_name: Any, brand: Any = None, category: Any = None) -> str:
    canonical = canonical_family(product_name, category)
    if canonical:
        return canonical

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
    return name[:1].upper() + name[1:] if name else "Prodotto"


def ensure_generic_name(food: dict[str, Any], *, migrate_existing: bool = False) -> str:
    # Known families always win during migration. This merges existing products
    # such as different brands of tuna/mayonnaise into one stock family.
    canonical = canonical_family(food.get("product_name"), food.get("category"))
    explicit = _clean(food.get("generic_name"))
    if canonical:
        generic = canonical
    elif explicit and not migrate_existing:
        generic = explicit
    else:
        generic = explicit or derive_generic_name(food.get("product_name"), food.get("brand"), food.get("category"))
    food["generic_name"] = generic
    return generic


def install_product_family() -> None:
    """Install family metadata and migrate existing inventory in-place."""
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
            before = _clean(item.get("generic_name"))
            ensure_generic_name(item, migrate_existing=True)
            if _clean(item.get("generic_name")) != before:
                changed = True
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
        if result is None:
            return None
        target = next((x for x in self._items if x.get("id") == result.get("id")), None)
        if target is not None and any(k in changes for k in ("product_name", "brand", "category", "generic_name")):
            if "generic_name" in changes and _clean(changes.get("generic_name")):
                target["generic_name"] = _clean(changes.get("generic_name"))
            else:
                target["generic_name"] = derive_generic_name(target.get("product_name"), target.get("brand"), target.get("category"))
            await self._async_save(); result = dict(target)
        return result

    archive.FoodArchive.async_load = load_with_family
    archive.FoodArchive.async_add = add_with_family
    archive.FoodArchive.async_add_manual = add_manual_with_family
    archive.FoodArchive.async_update_item = update_with_family
    archive.FoodArchive.__homestock_product_family_installed = True
