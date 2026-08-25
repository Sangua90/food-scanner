from __future__ import annotations

import logging
import uuid
from http import HTTPStatus

from aiohttp import web
from homeassistant.components.http import KEY_HASS
from homeassistant.components.http.view import HomeAssistantView
from homeassistant.exceptions import HomeAssistantError

from .service import async_analyze_image_bytes

_LOGGER = logging.getLogger(__name__)

MAX_UPLOAD_BYTES = 12 * 1024 * 1024
SUPPORTED_MIME_TYPES = {"image/jpeg", "image/png", "image/webp"}
VALID_LOCATIONS = {"frigo", "freezer", "dispensa"}


def _detect_mime(image_bytes: bytes, declared: str) -> str | None:
    if declared in SUPPORTED_MIME_TYPES:
        return declared
    if image_bytes.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if image_bytes.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if len(image_bytes) >= 12 and image_bytes[:4] == b"RIFF" and image_bytes[8:12] == b"WEBP":
        return "image/webp"
    return None


async def _process_scan(hass, image_bytes: bytes, mime_type: str, notify: bool, location: str | None, job_id: str) -> None:
    """Esegue Gemini in background dopo che l'iPhone ha già ricevuto conferma."""
    try:
        await async_analyze_image_bytes(
            hass,
            image_bytes,
            mime_type,
            notify=notify,
            location=location,
        )
    except HomeAssistantError as err:
        _LOGGER.error("Scansione %s fallita: %s", job_id, err)
    except Exception:
        _LOGGER.exception("Errore inatteso durante la scansione %s", job_id)


class FoodScannerUploadView(HomeAssistantView):
    """Endpoint autenticato per caricare una foto e rispondere subito all'iPhone."""

    url = "/api/food_scanner/upload"
    name = "api:food_scanner:upload"
    requires_auth = True

    async def post(self, request: web.Request) -> web.Response:
        hass = request.app[KEY_HASS]

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

        mime_type = _detect_mime(image_bytes, request.content_type.lower())
        if mime_type is None:
            return self.json_message(
                "Formato non supportato: usa JPEG, PNG o WEBP",
                status_code=HTTPStatus.BAD_REQUEST,
            )

        notify = request.query.get("notify", "1").lower() not in {"0", "false", "no"}
        location = request.query.get("location")
        if location is not None:
            location = location.strip().lower()
            if location not in VALID_LOCATIONS:
                return self.json_message(
                    "Posizione non valida: usa frigo, freezer o dispensa",
                    status_code=HTTPStatus.BAD_REQUEST,
                )

        job_id = uuid.uuid4().hex[:12]
        hass.async_create_background_task(
            _process_scan(hass, image_bytes, mime_type, notify, location, job_id),
            f"food_scanner_{job_id}",
        )

        return self.json(
            {
                "success": True,
                "accepted": True,
                "job_id": job_id,
                "location": location,
                "message": "Foto ricevuta. Analisi in corso; il risultato arriverà tramite notifica Home Assistant.",
            },
            status_code=HTTPStatus.ACCEPTED,
        )
