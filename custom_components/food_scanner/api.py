from __future__ import annotations

from http import HTTPStatus

from aiohttp import web
from homeassistant.components.http import KEY_HASS
from homeassistant.components.http.view import HomeAssistantView
from homeassistant.exceptions import HomeAssistantError

from .service import async_analyze_image_bytes

MAX_UPLOAD_BYTES = 12 * 1024 * 1024


class FoodScannerUploadView(HomeAssistantView):
    """Endpoint autenticato per caricare direttamente una foto."""

    url = "/api/food_scanner/upload"
    name = "api:food_scanner:upload"
    requires_auth = True

    async def post(self, request: web.Request) -> web.Response:
        hass = request.app[KEY_HASS]

        content_type = request.content_type.lower()
        if content_type not in {"image/jpeg", "image/png", "image/webp"}:
            return self.json_message(
                "Formato non supportato: usa JPEG, PNG o WEBP",
                status_code=HTTPStatus.BAD_REQUEST,
            )

        if request.content_length is not None and request.content_length > MAX_UPLOAD_BYTES:
            return self.json_message(
                "Foto troppo grande: massimo 12 MB",
                status_code=HTTPStatus.REQUEST_ENTITY_TOO_LARGE,
            )

        image_bytes = await request.read()
        if len(image_bytes) > MAX_UPLOAD_BYTES:
            return self.json_message(
                "Foto troppo grande: massimo 12 MB",
                status_code=HTTPStatus.REQUEST_ENTITY_TOO_LARGE,
            )

        notify = request.query.get("notify", "1").lower() not in {"0", "false", "no"}

        try:
            result = await async_analyze_image_bytes(
                hass,
                image_bytes,
                content_type,
                notify=notify,
            )
        except HomeAssistantError as err:
            return self.json(
                {"success": False, "error": str(err)},
                status_code=HTTPStatus.BAD_REQUEST,
            )
        except Exception as err:
            return self.json(
                {
                    "success": False,
                    "error": f"Errore interno Food Scanner: {type(err).__name__}: {err}",
                },
                status_code=HTTPStatus.INTERNAL_SERVER_ERROR,
            )

        return self.json(result)
