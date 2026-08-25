from __future__ import annotations

import logging
from typing import Any

import aiohttp
from homeassistant.core import HomeAssistant
from homeassistant.helpers.aiohttp_client import async_get_clientsession

_LOGGER = logging.getLogger(__name__)
OPF_URL = "https://world.openproductsfacts.org/api/v2/product/{barcode}.json"
OPF_USER_AGENT = "HomeStockHomeAssistant/1.3 (https://github.com/Sangua90/food-scanner)"


def _clean(value: Any) -> str | None:
    text = str(value or "").strip()
    return text or None


async def async_lookup_product(hass: HomeAssistant, barcode: str | None) -> dict[str, Any] | None:
    code = "".join(ch for ch in str(barcode or "") if ch.isdigit())
    if len(code) < 8 or len(code) > 14:
        return None

    session = async_get_clientsession(hass)
    params = {
        "fields": "code,product_name,product_name_it,brands,quantity,categories,categories_tags,image_front_small_url",
    }
    try:
        async with session.get(
            OPF_URL.format(barcode=code),
            params=params,
            headers={"User-Agent": OPF_USER_AGENT},
            timeout=aiohttp.ClientTimeout(total=8),
            allow_redirects=True,
        ) as response:
            if response.status != 200:
                return None
            data = await response.json(content_type=None)
    except (aiohttp.ClientError, TimeoutError, ValueError):
        _LOGGER.debug("Open Products Facts lookup fallito per %s", code, exc_info=True)
        return None

    if int(data.get("status") or 0) != 1:
        return None
    product = data.get("product")
    if not isinstance(product, dict):
        return None

    category = _clean(product.get("categories"))
    return {
        "barcode": code,
        "product_name": _clean(product.get("product_name_it")) or _clean(product.get("product_name")),
        "brand": _clean(product.get("brands")),
        "quantity": _clean(product.get("quantity")),
        "category": category or "Altro",
        "image_url": _clean(product.get("image_front_small_url")),
        "source": "open_products_facts",
    }
