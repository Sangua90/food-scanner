from __future__ import annotations

import base64
import json
from http import HTTPStatus
import aiohttp
from homeassistant.components.http import KEY_HASS
from homeassistant.components.http.view import HomeAssistantView
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from .const import CONF_API_KEY, CONF_MODEL, DEFAULT_MODEL, DOMAIN
from .consumables import get_consumables, VALID_LOCATIONS

SUPPORTED_MIME_TYPES={"image/jpeg","image/png","image/webp","image/heic","image/heif"}
MAX_IMAGE_BYTES=12*1024*1024
PROMPT="""Analizza questa foto di un consumabile domestico NON alimentare. Esempi: carta igienica, fazzoletti, detersivo, capsule lavastoviglie, sacchetti, sapone, shampoo, spugne, prodotti pulizia. Restituisci esclusivamente JSON valido con: product_name, brand, quantity, barcode, category, unit_name, units_per_package, confidence. category deve essere una tra: Carta e igiene, Pulizia casa, Bucato, Lavastoviglie, Bagno e persona, Sacchetti e monouso, Altro. unit_name deve essere ESATTAMENTE una tra: Pezzi, Bottiglie, Lattine, Vasetti, Confezioni. units_per_package è il numero di unità realmente consumabili nella confezione fotografata. Non inventare barcode o quantità non leggibili. confidence è 0-100."""

def _entry(hass):
    entries=hass.data.get(DOMAIN,{})
    if not entries:raise HomeAssistantError("Food Scanner non configurato.")
    return next(iter(entries.values()))

async def _analyze(hass,image_bytes:bytes,mime_type:str)->dict:
    entry=_entry(hass);api_key=entry.data.get(CONF_API_KEY)
    if not api_key:raise HomeAssistantError("API key Gemini mancante.")
    model=entry.options.get(CONF_MODEL,entry.data.get(CONF_MODEL,DEFAULT_MODEL))
    payload={"contents":[{"parts":[{"inline_data":{"mime_type":mime_type,"data":base64.b64encode(image_bytes).decode("ascii")}}, {"text":PROMPT}]}],"generationConfig":{"temperature":0,"responseMimeType":"application/json"}}
    session=async_get_clientsession(hass);url=f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
    try:
        async with session.post(url,headers={"x-goog-api-key":api_key,"Content-Type":"application/json"},json=payload,timeout=aiohttp.ClientTimeout(total=60)) as response:
            body=await response.text()
            if response.status>=400:raise HomeAssistantError(f"Gemini API {response.status}: {body[:400]}")
    except aiohttp.ClientError as err:raise HomeAssistantError(f"Errore di connessione a Gemini: {err}") from err
    try:raw=json.loads(body);text=raw["candidates"][0]["content"]["parts"][0]["text"];data=json.loads(text)
    except (KeyError,IndexError,TypeError,json.JSONDecodeError) as err:raise HomeAssistantError(f"Risposta Gemini non valida: {err}") from err
    if not isinstance(data,dict) or not data.get("product_name"):raise HomeAssistantError("Consumabile non identificato correttamente.")
    try:data["units_per_package"]=max(1,int(data.get("units_per_package") or 1))
    except (TypeError,ValueError):data["units_per_package"]=1
    return data

class FoodScannerConsumablesView(HomeAssistantView):
    url="/api/food_scanner/consumables";name="api:food_scanner:consumables";requires_auth=True
    async def get(self,request):
        store=get_consumables(request.app[KEY_HASS]);return self.json({"items":store.items(),"summary":store.summary(),"history":store.history(50)})
    async def post(self,request):
        hass=request.app[KEY_HASS];store=get_consumables(hass)
        try:data=await request.json()
        except ValueError:return self.json_message("JSON non valido",status_code=HTTPStatus.BAD_REQUEST)
        action=str(data.get("action") or "").strip().lower()
        try:
            if action=="add_manual":
                item,created=await store.async_add(data.get("changes") or {});return self.json({"success":True,"item":item,"new_product":created})
            if action=="consume":
                item=await store.async_consume(str(data.get("id") or ""),int(data.get("amount",1)))
                if item is None:return self.json_message("Consumabile non trovato",status_code=HTTPStatus.NOT_FOUND)
                return self.json({"success":True,"item":item})
            if action=="update":
                item=await store.async_update(str(data.get("id") or ""),data.get("changes") or {})
                if item is None:return self.json_message("Consumabile non trovato",status_code=HTTPStatus.NOT_FOUND)
                return self.json({"success":True,"item":item})
            if action=="remove":
                ok=await store.async_remove(str(data.get("id") or ""));return self.json({"success":ok}) if ok else self.json_message("Consumabile non trovato",status_code=HTTPStatus.NOT_FOUND)
            if action in ("scan","scan_preview"):
                location=str(data.get("location") or "magazzino").strip().lower()
                if location not in VALID_LOCATIONS:return self.json_message("Posizione consumabile non valida",status_code=HTTPStatus.BAD_REQUEST)
                mime_type=str(data.get("mime_type") or "image/jpeg").lower()
                if mime_type not in SUPPORTED_MIME_TYPES:return self.json_message("Formato foto non supportato",status_code=HTTPStatus.BAD_REQUEST)
                try:image_bytes=base64.b64decode(str(data.get("image_data") or ""),validate=True)
                except (ValueError,TypeError):return self.json_message("Foto non valida",status_code=HTTPStatus.BAD_REQUEST)
                if not image_bytes or len(image_bytes)>MAX_IMAGE_BYTES:return self.json_message("Foto vuota o troppo grande",status_code=HTTPStatus.BAD_REQUEST)
                detected=await _analyze(hass,image_bytes,mime_type);detected["stock_units"]=detected.get("units_per_package",1);detected["location"]=location
                if action=="scan_preview":return self.json({"success":True,"detected":detected})
                item,created=await store.async_add(detected);return self.json({"success":True,"item":item,"detected":detected,"new_product":created})
        except (ValueError,HomeAssistantError) as err:return self.json_message(str(err),status_code=HTTPStatus.BAD_REQUEST)
        return self.json_message("Azione non valida",status_code=HTTPStatus.BAD_REQUEST)
