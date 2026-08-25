from __future__ import annotations

import base64
from http import HTTPStatus
from typing import Any

from aiohttp import web
from homeassistant.components.http import KEY_HASS
from homeassistant.components.http.view import HomeAssistantView
from homeassistant.components.persistent_notification import async_dismiss
from homeassistant.exceptions import HomeAssistantError

from .archive import get_archive
from .const import (
    CONF_EXPIRY_NOTIFY,
    CONF_EXPIRY_NOTIFY_DAYS,
    CONF_EXPIRY_NOTIFY_SERVICE,
    CONF_MODEL,
    CONF_NOTIFY,
    DEFAULT_EXPIRY_NOTIFY,
    DEFAULT_EXPIRY_NOTIFY_DAYS,
    DEFAULT_EXPIRY_NOTIFY_SERVICE,
    DEFAULT_MODEL,
    DEFAULT_NOTIFY,
    DOMAIN,
)
from .history import get_history
from .openfoodfacts import async_lookup_barcode
from .review import get_review_queue

VALID_SORTS = {"expiry", "name", "added"}
VALID_LOCATIONS = {"frigo", "freezer", "dispensa"}
SUPPORTED_MIME_TYPES = {"image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"}
MAX_RETRY_IMAGE_BYTES = 12 * 1024 * 1024


def _get_entry(hass):
    entries = hass.data.get(DOMAIN, {})
    if not entries:
        return None
    return next(iter(entries.values()))


def _settings(entry) -> dict[str, Any]:
    return {
        "model": entry.options.get(CONF_MODEL, entry.data.get(CONF_MODEL, DEFAULT_MODEL)),
        "notify": entry.options.get(CONF_NOTIFY, DEFAULT_NOTIFY),
        "expiry_notify": entry.options.get(CONF_EXPIRY_NOTIFY, DEFAULT_EXPIRY_NOTIFY),
        "expiry_notify_days": entry.options.get(CONF_EXPIRY_NOTIFY_DAYS, DEFAULT_EXPIRY_NOTIFY_DAYS),
        "expiry_notify_service": entry.options.get(CONF_EXPIRY_NOTIFY_SERVICE, DEFAULT_EXPIRY_NOTIFY_SERVICE),
    }


class FoodScannerArchiveView(HomeAssistantView):
    url = "/api/food_scanner/archive"
    name = "api:food_scanner:archive"
    requires_auth = True

    async def get(self, request: web.Request) -> web.Response:
        hass = request.app[KEY_HASS]
        archive = get_archive(hass)
        sort = (request.query.get("sort") or "expiry").strip().lower()
        if sort not in VALID_SORTS:
            sort = "expiry"
        location = (request.query.get("location") or "").strip().lower() or None
        if location not in VALID_LOCATIONS:
            location = None
        search = (request.query.get("search") or "").strip() or None

        items = archive.items_sorted(sort=sort, location=location, search=search)
        reviews = get_review_queue(hass).items()
        history = get_history(hass)
        entry = _get_entry(hass)
        return self.json({
            "count": len(items),
            "total_units": sum(int(item.get("stock_units", 1)) for item in items),
            "sort": sort,
            "location": location,
            "items": items,
            "review_count": len(reviews),
            "reviews": reviews,
            "summary": archive.summary(),
            "statistics": history.stats(),
            "history": history.events(limit=50),
            "settings": _settings(entry) if entry else {},
        })

    async def post(self, request: web.Request) -> web.Response:
        hass = request.app[KEY_HASS]
        archive = get_archive(hass)
        queue = get_review_queue(hass)
        try:
            data = await request.json()
        except ValueError:
            return self.json_message("JSON non valido", status_code=HTTPStatus.BAD_REQUEST)

        action = str(data.get("action") or "").strip().lower()

        if action == "lookup_barcode":
            barcode = str(data.get("barcode") or "").strip()
            if not barcode:
                return self.json_message("Codice a barre mancante", status_code=HTTPStatus.BAD_REQUEST)
            result = await async_lookup_barcode(hass, barcode)
            return self.json({"success": True, "found": result is not None, "product": result})

        if action == "add_manual":
            changes = data.get("changes")
            if not isinstance(changes, dict):
                return self.json_message("Dati prodotto mancanti o non validi", status_code=HTTPStatus.BAD_REQUEST)
            try:
                item, created, added_units = await archive.async_add_manual(changes)
            except ValueError as err:
                return self.json_message(str(err), status_code=HTTPStatus.BAD_REQUEST)
            return self.json({"success": True, "item": item, "new_lot": created, "added_units": added_units})

        if action == "update_settings":
            entry = _get_entry(hass)
            if entry is None:
                return self.json_message("Food Scanner non configurato", status_code=HTTPStatus.BAD_REQUEST)
            current = dict(entry.options)
            if "notify" in data:
                current[CONF_NOTIFY] = bool(data.get("notify"))
            if "expiry_notify" in data:
                current[CONF_EXPIRY_NOTIFY] = bool(data.get("expiry_notify"))
            if "expiry_notify_days" in data:
                try:
                    days = int(data.get("expiry_notify_days"))
                except (TypeError, ValueError):
                    return self.json_message("Giorni di preavviso non validi", status_code=HTTPStatus.BAD_REQUEST)
                if days < 0 or days > 365:
                    return self.json_message("I giorni di preavviso devono essere tra 0 e 365", status_code=HTTPStatus.BAD_REQUEST)
                current[CONF_EXPIRY_NOTIFY_DAYS] = days
            if "expiry_notify_service" in data:
                current[CONF_EXPIRY_NOTIFY_SERVICE] = str(data.get("expiry_notify_service") or "").strip()
            if "model" in data:
                model = str(data.get("model") or "").strip()
                if not model:
                    return self.json_message("Il modello Gemini non può essere vuoto", status_code=HTTPStatus.BAD_REQUEST)
                current[CONF_MODEL] = model
            hass.config_entries.async_update_entry(entry, options=current)
            return self.json({"success": True, "settings": _settings(entry)})

        product_id = str(data.get("id") or "").strip()
        if not product_id:
            return self.json_message("Parametro id mancante", status_code=HTTPStatus.BAD_REQUEST)

        if action == "retry_review":
            pending = queue.get(product_id)
            if pending is None:
                return self.json_message("Verifica non trovata", status_code=HTTPStatus.NOT_FOUND)
            mime_type = str(data.get("mime_type") or "image/jpeg").lower()
            if mime_type not in SUPPORTED_MIME_TYPES:
                return self.json_message("Formato foto non supportato", status_code=HTTPStatus.BAD_REQUEST)
            raw = str(data.get("image_data") or "")
            try:
                image_bytes = base64.b64decode(raw, validate=True)
            except (ValueError, TypeError):
                return self.json_message("Foto non valida", status_code=HTTPStatus.BAD_REQUEST)
            if not image_bytes or len(image_bytes) > MAX_RETRY_IMAGE_BYTES:
                return self.json_message("Foto vuota o troppo grande", status_code=HTTPStatus.BAD_REQUEST)
            try:
                from .service import async_analyze_image_bytes
                result = await async_analyze_image_bytes(hass, image_bytes, mime_type, notify=True, review_id=product_id)
            except HomeAssistantError as err:
                return self.json_message(str(err), status_code=HTTPStatus.BAD_REQUEST)
            if result.get("status") == "archived":
                async_dismiss(hass, f"food_scanner_review_{product_id}")
            return self.json(result)

        if action == "confirm_review":
            try:
                from .service import async_confirm_review
                result = await async_confirm_review(hass, product_id)
            except HomeAssistantError as err:
                return self.json_message(str(err), status_code=HTTPStatus.BAD_REQUEST)
            async_dismiss(hass, f"food_scanner_review_{product_id}")
            return self.json({"success": True, **result})

        if action == "discard_review":
            removed = await queue.async_remove(product_id)
            if not removed:
                return self.json_message("Verifica non trovata", status_code=HTTPStatus.NOT_FOUND)
            async_dismiss(hass, f"food_scanner_review_{product_id}")
            return self.json({"success": True, "discarded_id": product_id})

        if action == "update_item":
            changes = data.get("changes")
            if not isinstance(changes, dict):
                return self.json_message("Dati di modifica mancanti o non validi", status_code=HTTPStatus.BAD_REQUEST)
            try:
                result = await archive.async_update_item(product_id, changes)
            except ValueError as err:
                return self.json_message(str(err), status_code=HTTPStatus.BAD_REQUEST)
            if result is None:
                return self.json_message("Prodotto non trovato", status_code=HTTPStatus.NOT_FOUND)
            return self.json({"success": True, "item": result})

        try:
            amount = int(data.get("amount", 1))
        except (TypeError, ValueError):
            return self.json_message("Quantità non valida", status_code=HTTPStatus.BAD_REQUEST)

        try:
            if action == "consume":
                result = await archive.async_consume(product_id, amount)
            elif action == "set_stock":
                result = await archive.async_set_units(product_id, amount)
            else:
                return self.json_message("Azione non valida", status_code=HTTPStatus.BAD_REQUEST)
        except ValueError as err:
            return self.json_message(str(err), status_code=HTTPStatus.BAD_REQUEST)
        if result is None:
            return self.json_message("Prodotto non trovato", status_code=HTTPStatus.NOT_FOUND)
        return self.json({"success": True, "item": result})

    async def delete(self, request: web.Request) -> web.Response:
        hass = request.app[KEY_HASS]
        product_id = (request.query.get("id") or "").strip()
        if not product_id:
            return self.json_message("Parametro id mancante", status_code=HTTPStatus.BAD_REQUEST)
        removed = await get_archive(hass).async_remove(product_id)
        if not removed:
            return self.json_message("Prodotto non trovato", status_code=HTTPStatus.NOT_FOUND)
        return self.json({"success": True, "removed_id": product_id})
