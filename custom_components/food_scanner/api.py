from __future__ import annotations

import logging
import uuid
from http import HTTPStatus

from aiohttp import web
from homeassistant.components.http import KEY_HASS
from homeassistant.components.http.view import HomeAssistantView
from homeassistant.components.persistent_notification import async_create as async_create_persistent_notification
from homeassistant.exceptions import HomeAssistantError

from .const import CONF_EXPIRY_NOTIFY_SERVICE, DEFAULT_EXPIRY_NOTIFY_SERVICE, DOMAIN
from .review import get_review_queue
from .service import async_analyze_image_bytes

_LOGGER = logging.getLogger(__name__)
MAX_UPLOAD_BYTES = 12 * 1024 * 1024
SUPPORTED_MIME_TYPES = {"image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"}
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
    if len(image_bytes) >= 12 and image_bytes[4:8] == b"ftyp":
        brand = image_bytes[8:12]
        if brand in {b"heic", b"heix", b"hevc", b"hevx", b"heim", b"heis"}:
            return "image/heic"
        if brand in {b"mif1", b"msf1"}:
            return "image/heif"
    return None


def _resolve_notify_target(hass):
    entries = hass.data.get(DOMAIN, {})
    entry = next(iter(entries.values()), None) if entries else None
    configured = ""
    if entry is not None:
        configured = str(entry.options.get(CONF_EXPIRY_NOTIFY_SERVICE, DEFAULT_EXPIRY_NOTIFY_SERVICE) or "").strip()
    if configured:
        domain, service = configured.split(".", 1) if "." in configured else ("notify", configured)
        if hass.services.has_service(domain, service):
            return domain, service
    services = hass.services.async_services().get("notify", {})
    mobile = [name for name in services if name.startswith("mobile_app_")]
    return ("notify", mobile[0]) if len(mobile) == 1 else None


async def _queue_failed_scan(hass, location: str | None, error_text: str) -> None:
    food = {
        "product_name": None, "brand": None, "quantity": None, "barcode": None,
        "expiry_date": None, "expiry_type": None, "confidence": 0,
        "package_type": "confezione", "units_per_package": 1, "unit_name": "unità",
        "inventory_ready": False, "needs_more_photo": True,
        "missing_fields": ["analisi"],
        "photo_request": "L'analisi non è riuscita. Rifai una foto chiara del fronte, della quantità e della scadenza.",
        "last_error": error_text[:300],
    }
    pending = await get_review_queue(hass).async_upsert(food, location)
    review_id = pending["id"]
    message = "La scansione richiede attenzione. Apri Food Scanner → Da verificare."
    async_create_persistent_notification(
        hass, message, title="📸 Food Scanner — da verificare",
        notification_id=f"food_scanner_review_{review_id}",
    )
    target = _resolve_notify_target(hass)
    if target:
        domain, service = target
        try:
            await hass.services.async_call(domain, service, {
                "title": "Food Scanner — da verificare", "message": message,
                "data": {"url": "/food-scanner"},
            }, blocking=False)
        except Exception:
            _LOGGER.debug("Impossibile inviare push errore Food Scanner", exc_info=True)


async def _process_scan(hass, image_bytes: bytes, mime_type: str, location: str | None, job_id: str) -> None:
    try:
        await async_analyze_image_bytes(hass, image_bytes, mime_type, notify=False, location=location)
    except HomeAssistantError as err:
        _LOGGER.error("Scansione %s fallita: %s", job_id, err)
        await _queue_failed_scan(hass, location, str(err))
    except Exception as err:
        _LOGGER.exception("Errore inatteso durante la scansione %s", job_id)
        await _queue_failed_scan(hass, location, f"{type(err).__name__}: {err}")


class FoodScannerUploadView(HomeAssistantView):
    url = "/api/food_scanner/upload"
    name = "api:food_scanner:upload"
    requires_auth = True

    async def post(self, request: web.Request) -> web.Response:
        hass = request.app[KEY_HASS]
        if request.content_length is not None and request.content_length > MAX_UPLOAD_BYTES:
            return self.json_message("Foto troppo grande: massimo 12 MB", status_code=HTTPStatus.REQUEST_ENTITY_TOO_LARGE)
        image_bytes = await request.read()
        if len(image_bytes) > MAX_UPLOAD_BYTES:
            return self.json_message("Foto troppo grande: massimo 12 MB", status_code=HTTPStatus.REQUEST_ENTITY_TOO_LARGE)
        mime_type = _detect_mime(image_bytes, request.content_type.lower())
        if mime_type is None:
            return self.json_message("Formato non supportato: usa JPEG, PNG, WEBP, HEIC o HEIF", status_code=HTTPStatus.BAD_REQUEST)
        location = request.query.get("location")
        if location is not None:
            location = location.strip().lower()
            if location not in VALID_LOCATIONS:
                return self.json_message("Posizione non valida: usa frigo, freezer o dispensa", status_code=HTTPStatus.BAD_REQUEST)
        job_id = uuid.uuid4().hex[:12]
        hass.async_create_background_task(
            _process_scan(hass, image_bytes, mime_type, location, job_id), f"food_scanner_{job_id}"
        )
        return self.json({
            "success": True, "accepted": True, "job_id": job_id, "location": location,
            "message": "Foto ricevuta. Puoi continuare con la prossima scansione.",
        }, status_code=HTTPStatus.ACCEPTED)
