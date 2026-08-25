from __future__ import annotations

import base64
from http import HTTPStatus

from homeassistant.components.http import KEY_HASS
from homeassistant.components.http.view import HomeAssistantView
from homeassistant.exceptions import HomeAssistantError

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

        review_id = str(data.get("review_id") or "").strip() or None
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
