from __future__ import annotations

import base64
from http import HTTPStatus
from typing import Any

from homeassistant.components.http import KEY_HASS
from homeassistant.components.http.view import HomeAssistantView
from homeassistant.exceptions import HomeAssistantError

from .archive import get_archive
from .nutrition_store import async_persist_nutrition
from .openfoodfacts import async_lookup_barcode, merge_off_data
from .service import _call_gemini

SUPPORTED_MIME_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/heic",
    "image/heif",
}
MAX_IMAGE_BYTES = 12 * 1024 * 1024


def _clean_barcode(value: Any) -> str:
    return "".join(ch for ch in str(value or "") if ch.isdigit())


def _nutrition(item: dict[str, Any]) -> dict[str, Any] | None:
    value = item.get("nutrition") or item.get("nutriments")
    return dict(value) if isinstance(value, dict) and value else None


def _catalog_item(item: dict[str, Any], source: str = "homestock") -> dict[str, Any]:
    return {
        "id": item.get("id"),
        "barcode": item.get("barcode"),
        "product_name": item.get("product_name"),
        "brand": item.get("brand"),
        "quantity": item.get("quantity"),
        "stock_units": item.get("stock_units"),
        "units_per_package": item.get("units_per_package"),
        "unit_name": item.get("unit_name"),
        "location": item.get("location"),
        "expiry_date": item.get("expiry_date"),
        "expiry_type": item.get("expiry_type"),
        "category": item.get("category"),
        "product_image_url": item.get("product_image_url") or item.get("image_url"),
        "nutrition": _nutrition(item),
        "source": source,
    }


def _find_archive_by_barcode(hass, barcode: str) -> dict[str, Any] | None:
    code = _clean_barcode(barcode)
    if not code:
        return None
    for item in get_archive(hass).items():
        if _clean_barcode(item.get("barcode")) == code:
            return item
    return None


class HomeStockInFormhaCatalogView(HomeAssistantView):
    url = "/api/food_scanner/informha/catalog"
    name = "api:food_scanner:informha:catalog"
    requires_auth = True

    async def get(self, request):
        hass = request.app[KEY_HASS]
        items = [_catalog_item(item) for item in get_archive(hass).items_sorted(sort="name")]
        return self.json({"source": "HomeStock", "domain": "food_scanner", "count": len(items), "items": items})


class HomeStockInFormhaBarcodeView(HomeAssistantView):
    url = "/api/food_scanner/informha/barcode/{barcode}"
    name = "api:food_scanner:informha:barcode"
    requires_auth = True

    async def get(self, request, barcode: str):
        hass = request.app[KEY_HASS]
        code = _clean_barcode(barcode)
        if len(code) < 8 or len(code) > 14:
            return self.json_message("Barcode non valido", status_code=HTTPStatus.BAD_REQUEST)

        stored = _find_archive_by_barcode(hass, code)
        off = await async_lookup_barcode(hass, code)
        if stored:
            merged = merge_off_data(dict(stored), off)
            if off and off.get("nutrition"):
                await async_persist_nutrition(hass, stored.get("id"), off.get("nutrition"))
            return self.json({"found": True, "in_stock": True, "item": _catalog_item(merged, "homestock")})
        if off:
            return self.json({"found": True, "in_stock": False, "item": _catalog_item(off, "open_food_facts")})
        return self.json({"found": False, "in_stock": False, "barcode": code})


class HomeStockInFormhaScanView(HomeAssistantView):
    url = "/api/food_scanner/informha/scan"
    name = "api:food_scanner:informha:scan"
    requires_auth = True

    async def post(self, request):
        hass = request.app[KEY_HASS]
        try:
            data = await request.json()
        except ValueError:
            return self.json_message("JSON non valido", status_code=HTTPStatus.BAD_REQUEST)

        barcode = _clean_barcode(data.get("barcode"))
        if barcode:
            stored = _find_archive_by_barcode(hass, barcode)
            off = await async_lookup_barcode(hass, barcode)
            if stored:
                item = merge_off_data(dict(stored), off)
                if off and off.get("nutrition"):
                    await async_persist_nutrition(hass, stored.get("id"), off.get("nutrition"))
                return self.json({"found": True, "method": "barcode", "in_stock": True, "item": _catalog_item(item, "homestock")})
            if off:
                return self.json({"found": True, "method": "barcode", "in_stock": False, "item": _catalog_item(off, "open_food_facts")})
            return self.json({"found": False, "method": "barcode", "barcode": barcode})

        mime_type = str(data.get("mime_type") or "image/jpeg").strip().lower()
        if mime_type not in SUPPORTED_MIME_TYPES:
            return self.json_message("Formato foto non supportato", status_code=HTTPStatus.BAD_REQUEST)

        raw = str(data.get("image_data") or "")
        try:
            image_bytes = base64.b64decode(raw, validate=True)
        except (ValueError, TypeError):
            return self.json_message("Foto non valida", status_code=HTTPStatus.BAD_REQUEST)
        if not image_bytes or len(image_bytes) > MAX_IMAGE_BYTES:
            return self.json_message("Foto vuota o troppo grande (massimo 12 MB)", status_code=HTTPStatus.BAD_REQUEST)

        try:
            food, model = await _call_gemini(hass, image_bytes, mime_type)
        except HomeAssistantError as err:
            return self.json_message(str(err), status_code=HTTPStatus.BAD_REQUEST)

        code = _clean_barcode(food.get("barcode"))
        off = await async_lookup_barcode(hass, code) if code else None
        food = merge_off_data(food, off)
        stored = _find_archive_by_barcode(hass, code) if code else None
        if stored:
            stock_data = dict(stored)
            stock_data.update({k: v for k, v in food.items() if v is not None})
            food = stock_data
            if off and off.get("nutrition"):
                await async_persist_nutrition(hass, stored.get("id"), off.get("nutrition"))

        return self.json({
            "found": bool(food.get("product_name") or food.get("barcode")),
            "method": "photo",
            "model": model,
            "in_stock": stored is not None,
            "item": _catalog_item(food, "homestock_photo"),
        })
