from __future__ import annotations

import base64
import json
from pathlib import Path

import aiohttp
import voluptuous as vol
from homeassistant.components.persistent_notification import async_create as async_create_persistent_notification
from homeassistant.core import HomeAssistant, ServiceCall
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers.aiohttp_client import async_get_clientsession

from .archive import get_archive
from .const import (
    DOMAIN,
    CONF_API_KEY,
    CONF_MODEL,
    CONF_NOTIFY,
    DEFAULT_MODEL,
    DEFAULT_NOTIFY,
    SERVICE_SCAN_IMAGE,
)

PROMPT = """Analizza questa foto di un prodotto alimentare.
Restituisci esclusivamente un oggetto JSON valido con questi campi:
product_name, brand, quantity, barcode, expiry_date, expiry_type, confidence.
expiry_date deve essere YYYY-MM-DD oppure null.
expiry_type deve essere \"scadenza\", \"TMC\" oppure null.
confidence deve essere un numero da 0 a 100.
Non inventare mai una data o un codice a barre. Se non sono leggibili usa null.
Interpreta correttamente le date italiane GG/MM/AAAA e GG/MM/AA.
\"da consumarsi entro\" indica scadenza; \"da consumarsi preferibilmente entro\" indica TMC.
"""

SUPPORTED_MIME_TYPES = {"image/jpeg", "image/png", "image/webp"}
VALID_LOCATIONS = {"frigo", "freezer", "dispensa"}
SERVICE_REMOVE_PRODUCT = "remove_product"
SERVICE_CLEAR_ARCHIVE = "clear_archive"


def _entry_settings(entry):
    model = entry.options.get(CONF_MODEL, entry.data.get(CONF_MODEL, DEFAULT_MODEL))
    notify = entry.options.get(CONF_NOTIFY, DEFAULT_NOTIFY)
    return model, notify


def _get_entry(hass: HomeAssistant):
    entries = hass.data.get(DOMAIN, {})
    if not entries:
        raise HomeAssistantError("Food Scanner non configurato.")
    return next(iter(entries.values()))


def _normalize_location(location: str | None) -> str | None:
    if location is None:
        return None
    value = location.strip().lower()
    if value not in VALID_LOCATIONS:
        raise HomeAssistantError("Posizione non valida. Usa frigo, freezer o dispensa.")
    return value


async def async_analyze_image_bytes(
    hass: HomeAssistant,
    image_bytes: bytes,
    mime_type: str,
    notify: bool | None = None,
    location: str | None = None,
) -> dict:
    """Analizza bytes immagine con Gemini e salva il prodotto in archivio."""
    if not image_bytes:
        raise HomeAssistantError("La foto ricevuta è vuota.")
    if mime_type not in SUPPORTED_MIME_TYPES:
        raise HomeAssistantError("Formato immagine non supportato. Usa JPG, PNG o WEBP.")

    location = _normalize_location(location)

    entry = _get_entry(hass)
    api_key = entry.data.get(CONF_API_KEY)
    if not api_key:
        raise HomeAssistantError("API key Gemini mancante.")

    model, default_notify = _entry_settings(entry)
    should_notify = default_notify if notify is None else notify

    encoded = base64.b64encode(image_bytes).decode("ascii")
    payload = {
        "contents": [{"parts": [
            {"inline_data": {"mime_type": mime_type, "data": encoded}},
            {"text": PROMPT},
        ]}],
        "generationConfig": {
            "temperature": 0,
            "responseMimeType": "application/json",
        },
    }

    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
    session = async_get_clientsession(hass)
    try:
        async with session.post(
            url,
            headers={"x-goog-api-key": api_key, "Content-Type": "application/json"},
            json=payload,
            timeout=aiohttp.ClientTimeout(total=60),
        ) as response:
            body = await response.text()
            if response.status >= 400:
                raise HomeAssistantError(f"Gemini API {response.status}: {body[:500]}")
    except aiohttp.ClientError as err:
        raise HomeAssistantError(f"Errore di connessione a Gemini: {err}") from err

    try:
        result = json.loads(body)
        text = result["candidates"][0]["content"]["parts"][0]["text"]
        food = json.loads(text)
    except (KeyError, IndexError, TypeError, json.JSONDecodeError) as err:
        raise HomeAssistantError(f"Risposta Gemini non valida: {err}") from err

    state = food.get("product_name") or "Prodotto non riconosciuto"
    archive_item = None
    if food.get("product_name"):
        archive_item = await get_archive(hass).async_add(food, location)

    attributes = {"friendly_name": "Food Scanner - Ultimo risultato", "model": model, **food}
    if location:
        attributes["location"] = location
    if archive_item:
        attributes["archive_id"] = archive_item["id"]

    hass.states.async_set(
        "sensor.food_scanner_last_result",
        state,
        attributes,
    )

    if should_notify:
        lines = [f"**{state}**"]
        if food.get("brand"):
            lines[0] += f" — {food['brand']}"
        if food.get("quantity"):
            lines.append(str(food["quantity"]))
        if location:
            labels = {"frigo": "Frigo", "freezer": "Freezer", "dispensa": "Dispensa"}
            lines.append(f"Posizione: **{labels[location]}**")
        lines.append(f"Scadenza/TMC: **{food.get('expiry_date') or 'non rilevata'}**")
        if food.get("barcode"):
            lines.append(f"EAN: `{food['barcode']}`")
        if archive_item:
            lines.append("Salvato in archivio: **sì**")
        if food.get("confidence") is not None:
            lines.append(f"Confidenza: {food['confidence']}%")
        async_create_persistent_notification(
            hass,
            "\n".join(lines),
            title="📦 Food Scanner",
            notification_id="food_scanner_last",
        )

    response_data = {"success": True, "model": model, **food}
    if location:
        response_data["location"] = location
    if archive_item:
        response_data["archive_id"] = archive_item["id"]
    return response_data


async def async_setup_services(hass: HomeAssistant) -> None:
    async def handle_scan(call: ServiceCall) -> None:
        try:
            path = Path(call.data["image_path"])
            if not path.exists() or not path.is_file():
                raise HomeAssistantError(f"Immagine non trovata: {path}")

            suffix = path.suffix.lower()
            mime_map = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp"}
            mime_type = mime_map.get(suffix)
            if mime_type is None:
                raise HomeAssistantError("Formato immagine non supportato. Usa JPG, PNG o WEBP.")

            await async_analyze_image_bytes(
                hass,
                path.read_bytes(),
                mime_type,
                call.data.get(CONF_NOTIFY),
                call.data.get("location"),
            )
        except HomeAssistantError:
            raise
        except Exception as err:
            raise HomeAssistantError(f"Errore interno Food Scanner: {type(err).__name__}: {err}") from err

    async def handle_remove(call: ServiceCall) -> None:
        product_id = call.data["product_id"]
        removed = await get_archive(hass).async_remove(product_id)
        if not removed:
            raise HomeAssistantError("Prodotto non trovato nell'archivio.")

    async def handle_clear(call: ServiceCall) -> None:
        await get_archive(hass).async_clear()

    if not hass.services.has_service(DOMAIN, SERVICE_SCAN_IMAGE):
        scan_schema = vol.Schema(
            {
                vol.Required("image_path"): str,
                vol.Optional(CONF_NOTIFY): bool,
                vol.Optional("location"): vol.In(["frigo", "freezer", "dispensa"]),
            }
        )
        hass.services.async_register(DOMAIN, SERVICE_SCAN_IMAGE, handle_scan, scan_schema)

    if not hass.services.has_service(DOMAIN, SERVICE_REMOVE_PRODUCT):
        remove_schema = vol.Schema({vol.Required("product_id"): str})
        hass.services.async_register(DOMAIN, SERVICE_REMOVE_PRODUCT, handle_remove, remove_schema)

    if not hass.services.has_service(DOMAIN, SERVICE_CLEAR_ARCHIVE):
        hass.services.async_register(DOMAIN, SERVICE_CLEAR_ARCHIVE, handle_clear, vol.Schema({}))
