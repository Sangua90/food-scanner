from __future__ import annotations

import base64
import json
from pathlib import Path

import aiohttp
import voluptuous as vol
from homeassistant.core import HomeAssistant, ServiceCall
from homeassistant.exceptions import HomeAssistantError

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


def _entry_settings(entry):
    model = entry.options.get(CONF_MODEL, entry.data.get(CONF_MODEL, DEFAULT_MODEL))
    notify = entry.options.get(CONF_NOTIFY, DEFAULT_NOTIFY)
    return model, notify


async def async_setup_services(hass: HomeAssistant) -> None:
    if hass.services.has_service(DOMAIN, SERVICE_SCAN_IMAGE):
        return

    async def handle_scan(call: ServiceCall) -> None:
        entries = hass.data.get(DOMAIN, {})
        if not entries:
            raise HomeAssistantError("Food Scanner non configurato.")

        entry = next(iter(entries.values()))
        api_key = entry.data.get(CONF_API_KEY)
        if not api_key:
            raise HomeAssistantError("API key Gemini mancante.")

        model, default_notify = _entry_settings(entry)
        notify = call.data.get(CONF_NOTIFY, default_notify)

        path = Path(call.data["image_path"])
        if not path.exists() or not path.is_file():
            raise HomeAssistantError(f"Immagine non trovata: {path}")

        suffix = path.suffix.lower()
        if suffix in (".jpg", ".jpeg"):
            mime = "image/jpeg"
        elif suffix == ".png":
            mime = "image/png"
        elif suffix == ".webp":
            mime = "image/webp"
        else:
            raise HomeAssistantError("Formato immagine non supportato. Usa JPG, PNG o WEBP.")

        encoded = base64.b64encode(path.read_bytes()).decode("ascii")
        payload = {
            "contents": [{"parts": [
                {"inline_data": {"mime_type": mime, "data": encoded}},
                {"text": PROMPT},
            ]}],
            "generationConfig": {
                "temperature": 0,
                "responseMimeType": "application/json",
            },
        }

        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
        session = aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=60))
        try:
            async with session.post(
                url,
                headers={"x-goog-api-key": api_key, "Content-Type": "application/json"},
                json=payload,
            ) as response:
                body = await response.text()
                if response.status >= 400:
                    raise HomeAssistantError(f"Gemini API {response.status}: {body[:500]}")
        finally:
            await session.close()

        try:
            result = json.loads(body)
            text = result["candidates"][0]["content"]["parts"][0]["text"]
            food = json.loads(text)
        except (KeyError, IndexError, TypeError, json.JSONDecodeError) as err:
            raise HomeAssistantError(f"Risposta Gemini non valida: {err}") from err

        state = food.get("product_name") or "Prodotto non riconosciuto"
        hass.states.async_set(
            "sensor.food_scanner_last_result",
            state,
            {"friendly_name": "Food Scanner - Ultimo risultato", "model": model, **food},
        )

        if notify:
            lines = [f"**{state}**"]
            if food.get("brand"):
                lines[0] += f" — {food['brand']}"
            if food.get("quantity"):
                lines.append(str(food["quantity"]))
            lines.append(f"Scadenza/TMC: **{food.get('expiry_date') or 'non rilevata'}**")
            if food.get("barcode"):
                lines.append(f"EAN: `{food['barcode']}`")
            if food.get("confidence") is not None:
                lines.append(f"Confidenza: {food['confidence']}%")

            hass.components.persistent_notification.async_create(
                "\n".join(lines),
                title="📦 Food Scanner",
                notification_id="food_scanner_last",
            )

    schema = vol.Schema(
        {
            vol.Required("image_path"): str,
            vol.Optional(CONF_NOTIFY): bool,
        }
    )
    hass.services.async_register(DOMAIN, SERVICE_SCAN_IMAGE, handle_scan, schema)
