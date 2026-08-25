from __future__ import annotations

import base64
import json
import re
from datetime import date
from pathlib import Path
from typing import Any

import aiohttp
import voluptuous as vol
from homeassistant.components.persistent_notification import (
    async_create as async_create_persistent_notification,
    async_dismiss,
)
from homeassistant.core import HomeAssistant, ServiceCall
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers.aiohttp_client import async_get_clientsession

from .archive import get_archive
from .const import (
    DOMAIN,
    CONF_API_KEY,
    CONF_MODEL,
    CONF_NOTIFY,
    CONF_EXPIRY_NOTIFY_SERVICE,
    DEFAULT_MODEL,
    DEFAULT_NOTIFY,
    DEFAULT_EXPIRY_NOTIFY_SERVICE,
    SERVICE_SCAN_IMAGE,
    SERVICE_CONSUME_PRODUCT,
    SERVICE_SET_STOCK,
    SERVICE_REMOVE_PRODUCT,
    SERVICE_CLEAR_ARCHIVE,
)
from .openfoodfacts import async_lookup_barcode, merge_off_data
from .review import get_review_queue

BASE_PROMPT = """Analizza questa foto di un prodotto alimentare.
Restituisci esclusivamente un oggetto JSON valido con questi campi:
product_name, brand, quantity, barcode, expiry_date, expiry_type, confidence,
package_type, units_per_package, unit_name, category,
inventory_ready, needs_more_photo, missing_fields, photo_request.

Regole:
- expiry_date deve essere YYYY-MM-DD oppure null.
- expiry_type deve essere \"scadenza\", \"TMC\" oppure null.
- confidence deve essere un numero da 0 a 100.
- category deve essere una categoria breve in italiano, preferibilmente una tra:
  Latticini, Carne e salumi, Pesce, Bevande, Colazione, Snack e dolci,
  Pasta riso e cereali, Conserve, Frutta, Verdura, Surgelati,
  Salse e condimenti, Pane e prodotti da forno, Altro.
- package_type descrive il contenitore/confezione visibile, per esempio:
  \"scatola\", \"confezione\", \"bottiglia\", \"lattina\", \"barattolo\", \"vasetto\", \"busta\", \"pezzo\".
- units_per_package è il numero di unità realmente consumabili nella confezione fotografata.
  Esempi: scatola con 10 merendine = 10; confezione 3 x 80 g di tonno = 3;
  pacco da 6 bottiglie = 6; singola bottiglia = 1; singolo vasetto = 1.
- unit_name descrive quelle unità al plurale in italiano, ad esempio:
  \"merendine\", \"lattine\", \"bottiglie\", \"vasetti\", \"buste\", \"pezzi\".
- quantity resta la quantità commerciale riportata sulla confezione, ad esempio \"3 x 80 g\", \"1 L\", \"10 x 30 g\".
- Se la confezione sembra multipack ma il numero di pezzi non è leggibile, NON presumere 1:
  imposta needs_more_photo=true, inventory_ready=false e chiedi una foto del lato con quantità/pezzi.
- Se la data di scadenza/TMC non è leggibile, needs_more_photo=true e inventory_ready=false.
- Se il nome del prodotto non è abbastanza chiaro, needs_more_photo=true e inventory_ready=false.
- missing_fields è una lista dei campi importanti mancanti o incerti.
- photo_request è una breve istruzione in italiano su cosa fotografare meglio, oppure null se non serve.
- inventory_ready deve essere true solo quando i dati essenziali per il magazzino sono sufficientemente affidabili.
- needs_more_photo deve essere true quando una nuova foto può risolvere un dato importante incerto.
- Non inventare mai una data, un codice a barre o un numero di unità.
- Interpreta correttamente le date italiane GG/MM/AAAA e GG/MM/AA.
- \"da consumarsi entro\" indica scadenza; \"da consumarsi preferibilmente entro\" indica TMC.
"""

SUPPORTED_MIME_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/heic",
    "image/heif",
}
VALID_LOCATIONS = {"frigo", "freezer", "dispensa"}
MIN_READY_CONFIDENCE = 65
MULTIPACK_RE = re.compile(r"\b\d+\s*[x×]\s*\d+", re.IGNORECASE)


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


def _to_bool(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.strip().lower() in {"1", "true", "yes", "si", "sì"}
    return bool(value)


def _normalize_package_fields(food: dict[str, Any]) -> None:
    try:
        units = int(food.get("units_per_package") or 1)
    except (TypeError, ValueError):
        units = 1
    food["units_per_package"] = max(1, units)
    food["unit_name"] = str(food.get("unit_name") or "unità").strip()
    food["package_type"] = str(food.get("package_type") or "confezione").strip()
    food["category"] = str(food.get("category") or "Altro").strip() or "Altro"

    try:
        food["confidence"] = max(0, min(100, int(food.get("confidence") or 0)))
    except (TypeError, ValueError):
        food["confidence"] = 0

    food["inventory_ready"] = _to_bool(food.get("inventory_ready"))
    food["needs_more_photo"] = _to_bool(food.get("needs_more_photo"))

    if not isinstance(food.get("missing_fields"), list):
        food["missing_fields"] = []
    food["photo_request"] = str(food.get("photo_request") or "").strip() or None


def _is_inventory_ready(food: dict[str, Any]) -> bool:
    if not food.get("product_name"):
        return False

    raw_expiry = str(food.get("expiry_date") or "").strip()
    if not raw_expiry:
        return False
    try:
        date.fromisoformat(raw_expiry)
    except ValueError:
        return False

    quantity = str(food.get("quantity") or "")
    if MULTIPACK_RE.search(quantity) and int(food.get("units_per_package") or 1) <= 1:
        food["needs_more_photo"] = True
        if "units_per_package" not in food["missing_fields"]:
            food["missing_fields"].append("units_per_package")
        if not food.get("photo_request"):
            food["photo_request"] = "Fotografa il lato dove si legge chiaramente quante unità contiene la confezione."
        return False

    if food.get("needs_more_photo"):
        return False
    if not food.get("inventory_ready"):
        return False
    return int(food.get("confidence") or 0) >= MIN_READY_CONFIDENCE


def _build_prompt(previous_food: dict[str, Any] | None = None) -> str:
    if not previous_food:
        return BASE_PROMPT
    previous = json.dumps(previous_food, ensure_ascii=False)
    return (
        BASE_PROMPT
        + "\nQuesta è una FOTO AGGIUNTIVA dello stesso prodotto. "
        + "Usa i dati già estratti dalla foto precedente come contesto, correggili se la nuova foto li contraddice, "
        + "e completa i campi mancanti. Dati precedenti:\n"
        + previous
    )


def _resolve_mobile_notify(hass: HomeAssistant, entry) -> tuple[str, str] | None:
    configured = str(
        entry.options.get(CONF_EXPIRY_NOTIFY_SERVICE, DEFAULT_EXPIRY_NOTIFY_SERVICE) or ""
    ).strip()
    if configured:
        if "." in configured:
            domain, service = configured.split(".", 1)
        else:
            domain, service = "notify", configured
        if hass.services.has_service(domain, service):
            return domain, service

    services = hass.services.async_services().get("notify", {})
    mobile = [name for name in services if name.startswith("mobile_app_")]
    if len(mobile) == 1:
        return "notify", mobile[0]
    return None


async def _send_review_alert(hass: HomeAssistant, entry, food: dict[str, Any], review_id: str) -> None:
    name = food.get("product_name") or "Prodotto non identificato"
    request = food.get("photo_request") or "Serve una foto più chiara del prodotto e della scadenza."
    message = f"{name}: {request} Apri Food Scanner → Da verificare."
    async_create_persistent_notification(
        hass,
        f"**{name}**\n\n{request}\n\nID verifica: `{review_id}`",
        title="📸 Food Scanner — serve un'altra foto",
        notification_id=f"food_scanner_review_{review_id}",
    )
    target = _resolve_mobile_notify(hass, entry)
    if target:
        domain, service = target
        try:
            await hass.services.async_call(
                domain,
                service,
                {"title": "Food Scanner — serve un'altra foto", "message": message, "data": {"url": "/food-scanner"}},
                blocking=False,
            )
        except Exception:
            pass


async def _call_gemini(
    hass: HomeAssistant,
    image_bytes: bytes,
    mime_type: str,
    previous_food: dict[str, Any] | None = None,
) -> tuple[dict[str, Any], str]:
    entry = _get_entry(hass)
    api_key = entry.data.get(CONF_API_KEY)
    if not api_key:
        raise HomeAssistantError("API key Gemini mancante.")
    model, _ = _entry_settings(entry)
    encoded = base64.b64encode(image_bytes).decode("ascii")
    payload = {
        "contents": [{"parts": [
            {"inline_data": {"mime_type": mime_type, "data": encoded}},
            {"text": _build_prompt(previous_food)},
        ]}],
        "generationConfig": {"temperature": 0, "responseMimeType": "application/json"},
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
    if not isinstance(food, dict):
        raise HomeAssistantError("Risposta Gemini non valida: oggetto prodotto mancante.")
    _normalize_package_fields(food)
    return food, model


async def async_analyze_image_bytes(
    hass: HomeAssistant,
    image_bytes: bytes,
    mime_type: str,
    notify: bool | None = None,
    location: str | None = None,
    review_id: str | None = None,
) -> dict:
    if not image_bytes:
        raise HomeAssistantError("La foto ricevuta è vuota.")
    if mime_type not in SUPPORTED_MIME_TYPES:
        raise HomeAssistantError("Formato immagine non supportato. Usa JPG, PNG, WEBP, HEIC o HEIF.")

    location = _normalize_location(location)
    entry = _get_entry(hass)
    _model, default_notify = _entry_settings(entry)
    should_notify = default_notify if notify is None else notify

    previous_food = None
    if review_id:
        pending = get_review_queue(hass).get(review_id)
        if pending is None:
            raise HomeAssistantError("Verifica non trovata o già completata.")
        previous_food = pending.get("food") or {}
        location = pending.get("location") or location

    food, model = await _call_gemini(hass, image_bytes, mime_type, previous_food)

    if food.get("barcode"):
        off = await async_lookup_barcode(hass, str(food.get("barcode")))
        food = merge_off_data(food, off)
        _normalize_package_fields(food)

    ready = _is_inventory_ready(food)
    archive_item = None
    created = False
    added_units = 0
    pending_item = None

    if ready:
        archive_item, created, added_units = await get_archive(hass).async_add(food, location)
        if review_id:
            await get_review_queue(hass).async_remove(review_id)
            async_dismiss(hass, f"food_scanner_review_{review_id}")
    else:
        pending_item = await get_review_queue(hass).async_upsert(food, location, review_id)
        review_id = pending_item["id"]
        await _send_review_alert(hass, entry, food, review_id)

    state = food.get("product_name") or "Prodotto da verificare"
    attributes = {"friendly_name": "Food Scanner - Ultimo risultato", "model": model, **food}
    if location:
        attributes["location"] = location
    if archive_item:
        attributes["archive_id"] = archive_item["id"]
        attributes["stock_units"] = archive_item.get("stock_units", 1)
    if pending_item:
        attributes["review_id"] = pending_item["id"]
        attributes["status"] = "da_verificare"
    hass.states.async_set("sensor.food_scanner_last_result", state, attributes)

    if ready and should_notify:
        lines = [f"**{state}**"]
        if food.get("brand"):
            lines[0] += f" — {food['brand']}"
        if food.get("quantity"):
            lines.append(str(food["quantity"]))
        if food.get("category"):
            lines.append(f"Categoria: **{food['category']}**")
        if location:
            labels = {"frigo": "Frigo", "freezer": "Freezer", "dispensa": "Dispensa"}
            lines.append(f"Posizione: **{labels[location]}**")
        lines.append(f"Scadenza/TMC: **{food.get('expiry_date') or 'non rilevata'}**")
        if food.get("barcode"):
            source = " · Open Food Facts" if food.get("open_food_facts_found") else ""
            lines.append(f"EAN: `{food['barcode']}`{source}")
        if archive_item:
            unit_name = archive_item.get("unit_name") or "unità"
            total = archive_item.get("stock_units", added_units or 1)
            if added_units > 1:
                lines.append(f"Confezione rilevata: **{added_units} {unit_name}**")
            lines.append(f"Magazzino: **{total} {unit_name}**")
            lines.append("Nuovo lotto" if created else "Lotto esistente aggiornato")
        if food.get("confidence") is not None:
            lines.append(f"Confidenza: {food['confidence']}%")
        async_create_persistent_notification(
            hass,
            "\n".join(lines),
            title="📦 Food Scanner",
            notification_id="food_scanner_last",
        )

    response_data = {"success": True, "model": model, "status": "archived" if ready else "needs_review", **food}
    if location:
        response_data["location"] = location
    if archive_item:
        response_data["archive_id"] = archive_item["id"]
        response_data["stock_units"] = archive_item.get("stock_units", 1)
        response_data["added_units"] = added_units
        response_data["new_lot"] = created
    if pending_item:
        response_data["review_id"] = pending_item["id"]
    return response_data


async def async_confirm_review(hass: HomeAssistant, review_id: str) -> dict[str, Any]:
    pending = get_review_queue(hass).get(review_id)
    if pending is None:
        raise HomeAssistantError("Verifica non trovata.")
    food = dict(pending.get("food") or {})
    if not food.get("product_name"):
        raise HomeAssistantError("Il nome del prodotto manca: serve almeno un'altra foto.")
    item, created, added_units = await get_archive(hass).async_add(food, pending.get("location"))
    await get_review_queue(hass).async_remove(review_id)
    async_dismiss(hass, f"food_scanner_review_{review_id}")
    return {"item": item, "new_lot": created, "added_units": added_units}


async def async_setup_services(hass: HomeAssistant) -> None:
    async def handle_scan(call: ServiceCall) -> None:
        try:
            path = Path(call.data["image_path"])
            if not path.exists() or not path.is_file():
                raise HomeAssistantError(f"Immagine non trovata: {path}")
            suffix = path.suffix.lower()
            mime_map = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".heic": "image/heic", ".heif": "image/heif"}
            mime_type = mime_map.get(suffix)
            if mime_type is None:
                raise HomeAssistantError("Formato immagine non supportato. Usa JPG, PNG, WEBP, HEIC o HEIF.")
            await async_analyze_image_bytes(hass, path.read_bytes(), mime_type, call.data.get(CONF_NOTIFY), call.data.get("location"))
        except HomeAssistantError:
            raise
        except Exception as err:
            raise HomeAssistantError(f"Errore interno Food Scanner: {type(err).__name__}: {err}") from err

    async def handle_consume(call: ServiceCall) -> None:
        try:
            result = await get_archive(hass).async_consume(call.data["product_id"], call.data.get("amount", 1))
        except ValueError as err:
            raise HomeAssistantError(str(err)) from err
        if result is None:
            raise HomeAssistantError("Prodotto non trovato nell'archivio.")

    async def handle_set_stock(call: ServiceCall) -> None:
        try:
            result = await get_archive(hass).async_set_units(call.data["product_id"], call.data["amount"])
        except ValueError as err:
            raise HomeAssistantError(str(err)) from err
        if result is None:
            raise HomeAssistantError("Prodotto non trovato nell'archivio.")

    async def handle_remove(call: ServiceCall) -> None:
        removed = await get_archive(hass).async_remove(call.data["product_id"])
        if not removed:
            raise HomeAssistantError("Prodotto non trovato nell'archivio.")

    async def handle_clear(call: ServiceCall) -> None:
        await get_archive(hass).async_clear()

    if not hass.services.has_service(DOMAIN, SERVICE_SCAN_IMAGE):
        hass.services.async_register(DOMAIN, SERVICE_SCAN_IMAGE, handle_scan, vol.Schema({vol.Required("image_path"): str, vol.Optional(CONF_NOTIFY): bool, vol.Optional("location"): vol.In(["frigo", "freezer", "dispensa"])}))
    if not hass.services.has_service(DOMAIN, SERVICE_CONSUME_PRODUCT):
        hass.services.async_register(DOMAIN, SERVICE_CONSUME_PRODUCT, handle_consume, vol.Schema({vol.Required("product_id"): str, vol.Optional("amount", default=1): vol.All(vol.Coerce(int), vol.Range(min=1))}))
    if not hass.services.has_service(DOMAIN, SERVICE_SET_STOCK):
        hass.services.async_register(DOMAIN, SERVICE_SET_STOCK, handle_set_stock, vol.Schema({vol.Required("product_id"): str, vol.Required("amount"): vol.All(vol.Coerce(int), vol.Range(min=0))}))
    if not hass.services.has_service(DOMAIN, SERVICE_REMOVE_PRODUCT):
        hass.services.async_register(DOMAIN, SERVICE_REMOVE_PRODUCT, handle_remove, vol.Schema({vol.Required("product_id"): str}))
    if not hass.services.has_service(DOMAIN, SERVICE_CLEAR_ARCHIVE):
        hass.services.async_register(DOMAIN, SERVICE_CLEAR_ARCHIVE, handle_clear, vol.Schema({}))
