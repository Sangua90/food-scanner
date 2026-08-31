from __future__ import annotations

import logging
from typing import Any

import aiohttp
from homeassistant.core import HomeAssistant
from homeassistant.helpers.aiohttp_client import async_get_clientsession

_LOGGER = logging.getLogger(__name__)
OFF_URL = "https://world.openfoodfacts.org/api/v2/product/{barcode}.json"
OFF_USER_AGENT = "FoodScannerHomeAssistant/1.1 (https://github.com/Sangua90/food-scanner)"

CATEGORY_RULES = [
    (("dairies", "milk", "cheeses", "yogurts"), "Latticini"),
    (("meats", "hams", "sausages", "poultry"), "Carne e salumi"),
    (("fish", "seafood"), "Pesce"),
    (("beverages", "waters", "juices", "soft-drinks"), "Bevande"),
    (("breakfasts", "cereals"), "Colazione"),
    (("snacks", "biscuits", "cakes", "chocolates", "candies"), "Snack e dolci"),
    (("pastas", "rices", "grains"), "Pasta, riso e cereali"),
    (("canned-foods", "preserves"), "Conserve"),
    (("fruits",), "Frutta"),
    (("vegetables",), "Verdura"),
    (("frozen-foods",), "Surgelati"),
    (("sauces", "condiments"), "Salse e condimenti"),
    (("breads",), "Pane e prodotti da forno"),
]


def _simple_category(tags: list[str]) -> str | None:
    haystack = " ".join(str(x).casefold() for x in tags)
    for needles, label in CATEGORY_RULES:
        if any(needle in haystack for needle in needles):
            return label
    return None


def _clean(value: Any) -> str | None:
    text = str(value or "").strip()
    return text or None


def _number(value: Any) -> float | None:
    try:
        return round(float(value), 3)
    except (TypeError, ValueError):
        return None


def _nutrition(nutriments: Any) -> dict[str, Any] | None:
    if not isinstance(nutriments, dict):
        return None
    result = {
        "basis": "100g",
        "energy_kcal": _number(nutriments.get("energy-kcal_100g")),
        "protein_g": _number(nutriments.get("proteins_100g")),
        "carbohydrates_g": _number(nutriments.get("carbohydrates_100g")),
        "sugars_g": _number(nutriments.get("sugars_100g")),
        "fat_g": _number(nutriments.get("fat_100g")),
        "saturated_fat_g": _number(nutriments.get("saturated-fat_100g")),
        "fiber_g": _number(nutriments.get("fiber_100g")),
        "salt_g": _number(nutriments.get("salt_100g")),
        "sodium_g": _number(nutriments.get("sodium_100g")),
    }
    if not any(v is not None for k, v in result.items() if k != "basis"):
        return None
    return result


async def async_lookup_barcode(hass: HomeAssistant, barcode: str | None) -> dict[str, Any] | None:
    code = "".join(ch for ch in str(barcode or "") if ch.isdigit())
    if len(code) < 8 or len(code) > 14:
        return None

    session = async_get_clientsession(hass)
    params = {
        "fields": "code,product_name,product_name_it,brands,quantity,categories_tags,image_front_small_url,nutriments",
    }
    try:
        async with session.get(
            OFF_URL.format(barcode=code),
            params=params,
            headers={"User-Agent": OFF_USER_AGENT},
            timeout=aiohttp.ClientTimeout(total=8),
        ) as response:
            if response.status != 200:
                return None
            data = await response.json(content_type=None)
    except (aiohttp.ClientError, TimeoutError, ValueError):
        _LOGGER.debug("Open Food Facts lookup fallito per %s", code, exc_info=True)
        return None

    if int(data.get("status") or 0) != 1:
        return None
    product = data.get("product")
    if not isinstance(product, dict):
        return None

    tags = product.get("categories_tags")
    if not isinstance(tags, list):
        tags = []

    return {
        "barcode": code,
        "product_name": _clean(product.get("product_name_it")) or _clean(product.get("product_name")),
        "brand": _clean(product.get("brands")),
        "quantity": _clean(product.get("quantity")),
        "category": _simple_category(tags),
        "image_url": _clean(product.get("image_front_small_url")),
        "nutrition": _nutrition(product.get("nutriments")),
        "source": "open_food_facts",
    }


def merge_off_data(food: dict[str, Any], off: dict[str, Any] | None) -> dict[str, Any]:
    if not off:
        return food

    merged = dict(food)
    for target, source in (
        ("product_name", "product_name"),
        ("brand", "brand"),
        ("quantity", "quantity"),
    ):
        if not merged.get(target) and off.get(source):
            merged[target] = off[source]

    if off.get("category") and str(merged.get("category") or "Altro").strip().casefold() in {"", "altro"}:
        merged["category"] = off["category"]

    if off.get("image_url"):
        merged["product_image_url"] = off["image_url"]
    if off.get("nutrition"):
        merged["nutrition"] = off["nutrition"]
    merged["barcode_source"] = "Open Food Facts"
    merged["open_food_facts_found"] = True
    return merged
