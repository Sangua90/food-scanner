from __future__ import annotations

import base64
from http import HTTPStatus

from homeassistant.components.http import KEY_HASS
from homeassistant.components.http.view import HomeAssistantView
from homeassistant.exceptions import HomeAssistantError

from .archive import get_archive
from .review import get_review_queue
from .service import async_analyze_image_bytes

SUPPORTED_MIME_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/heic",
    "image/heif",
}
VALID_LOCATIONS = {"frigo", "freezer", "dispensa"}
MAX_IMAGE_BYTES = 12 * 1024 * 1024
EXPIRY_FIELDS = {"expiry_date", "expiry", "scadenza", "tmc"}
MIN_SKIP_CONFIDENCE = 65


def _can_skip_expiry(food: dict) -> bool:
    if not food.get("product_name"):
        return False
    try:
        if int(food.get("confidence") or 0) < MIN_SKIP_CONFIDENCE:
            return False
    except (TypeError, ValueError):
        return False

    missing = {
        str(value or "").strip().casefold()
        for value in (food.get("missing_fields") or [])
        if str(value or "").strip()
    }
    non_expiry_missing = {value for value in missing if value not in EXPIRY_FIELDS}
    if non_expiry_missing:
        return False

    target = str(food.get("photo_target") or "").strip().casefold()
    return target == "expiry" or bool(missing & EXPIRY_FIELDS)


class FoodScannerDashboardScanView(HomeAssistantView):
    """Analizza una foto dalla dashboard e restituisce l'esito nello stesso flusso."""

    url = "/api/food_scanner/dashboard_scan"
    name = "api:food_scanner:dashboard_scan"
    requires_auth = True

    async def post(self, request):
        hass = request.app[KEY_HASS]
        try:
            data = await request.json()
        except ValueError:
            return self.json_message("JSON non valido", status_code=HTTPStatus.BAD_REQUEST)

        action = str(data.get("action") or "scan").strip().lower()
        review_id = str(data.get("review_id") or "").strip() or None

        if action == "skip_expiry":
            if not review_id:
                return self.json_message("Verifica mancante", status_code=HTTPStatus.BAD_REQUEST)
            pending = get_review_queue(hass).get(review_id)
            if pending is None:
                return self.json_message("Verifica non trovata o già completata", status_code=HTTPStatus.NOT_FOUND)

            food = dict(pending.get("food") or {})
            location = str(pending.get("location") or data.get("location") or "").strip().lower()
            if location not in VALID_LOCATIONS:
                return self.json_message("Posizione non valida", status_code=HTTPStatus.BAD_REQUEST)
            if not _can_skip_expiry(food):
                return self.json_message(
                    "Non posso saltare la verifica: oltre alla scadenza manca un altro dato essenziale.",
                    status_code=HTTPStatus.BAD_REQUEST,
                )

            food["expiry_date"] = None
            food["expiry_type"] = None
            food["needs_more_photo"] = False
            food["inventory_ready"] = True
            food["missing_fields"] = [
                value for value in (food.get("missing_fields") or [])
                if str(value or "").strip().casefold() not in EXPIRY_FIELDS
            ]
            food["photo_request"] = None
            food["photo_reason"] = None
            food["photo_instruction"] = None
            food["photo_target"] = None
            food["photo_button_label"] = None
            food["expiry_skipped"] = True

            item, created, added_units = await get_archive(hass).async_add(food, location)
            await get_review_queue(hass).async_remove(review_id)
            return self.json({
                "success": True,
                "status": "archived",
                "product_name": item.get("product_name") or food.get("product_name"),
                "archive_id": item.get("id"),
                "new_product": created,
                "added_units": added_units,
                "expiry_date": None,
                "expiry_skipped": True,
            })

        location = str(data.get("location") or "").strip().lower()
        if location not in VALID_LOCATIONS:
            return self.json_message(
                "Posizione non valida: usa frigo, freezer o dispensa",
                status_code=HTTPStatus.BAD_REQUEST,
            )

        mime_type = str(data.get("mime_type") or "image/jpeg").strip().lower()
        if mime_type not in SUPPORTED_MIME_TYPES:
            return self.json_message(
                "Formato foto non supportato",
                status_code=HTTPStatus.BAD_REQUEST,
            )

        raw = str(data.get("image_data") or "")
        try:
            image_bytes = base64.b64decode(raw, validate=True)
        except (ValueError, TypeError):
            return self.json_message("Foto non valida", status_code=HTTPStatus.BAD_REQUEST)

        if not image_bytes or len(image_bytes) > MAX_IMAGE_BYTES:
            return self.json_message(
                "Foto vuota o troppo grande (massimo 12 MB)",
                status_code=HTTPStatus.BAD_REQUEST,
            )

        try:
            result = await async_analyze_image_bytes(
                hass,
                image_bytes,
                mime_type,
                notify=False,
                location=location,
                review_id=review_id,
            )
        except HomeAssistantError as err:
            return self.json_message(str(err), status_code=HTTPStatus.BAD_REQUEST)

        return self.json(result)
