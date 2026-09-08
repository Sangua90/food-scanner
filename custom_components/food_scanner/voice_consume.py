from __future__ import annotations

import json
from typing import Any

import aiohttp
from homeassistant.core import HomeAssistant
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers.aiohttp_client import async_get_clientsession

from .archive import get_archive
from .consumables import get_consumables
from .const import CONF_API_KEY
from .gemini_compat import RUNTIME_KEY, _candidate_models, _get_entry as _compat_entry, _is_modern_gemini, _model_mode


def _system_prompt(kind: str) -> str:
    noun = "consumabili" if kind == "cons" else "alimenti"
    verbs = '"usato", "tolto", "finito", "consumato"' if kind == "cons" else '"usato", "tolto", "mangiato", "aperto", "consumato"'
    return f"""Sei il parser vocale di HomeStock.
L'utente detta {noun} che ha consumato. Devi confrontare la frase SOLO con l'inventario fornito.
Restituisci esclusivamente JSON valido con forma:
{{
  "requests": [
    {{
      "spoken_name": "testo breve",
      "amount": 2,
      "consume_all": false,
      "matched_id": "id esatto oppure null",
      "confidence": 0,
      "ambiguous_ids": []
    }}
  ]
}}

Regole:
- Interpreta italiano naturale: {verbs}.
- Numeri scritti o detti vanno convertiti in interi positivi.
- "ho finito", "finita", "finite", "tutto", "tutta la confezione rimasta" => consume_all=true.
- Usa nome prodotto, marca e formato per scegliere il prodotto corretto.
- Se l'utente cita una marca, darle molto peso.
- matched_id deve essere ESATTAMENTE uno degli id dell'inventario oppure null.
- Se due o più prodotti sono plausibili e non c'e una scelta sicura, matched_id=null e ambiguous_ids contiene gli id plausibili (massimo 4).
- Se non trovi il prodotto, matched_id=null e ambiguous_ids=[].
- Non inventare prodotti, marche, id o quantita.
- confidence e 0-100 e misura la sicurezza dell'abbinamento.
- Una frase puo contenere piu prodotti: crea una request per ciascuno.
"""


def _compact_item(item: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": str(item.get("id") or ""),
        "product_name": item.get("product_name"),
        "generic_name": item.get("generic_name"),
        "brand": item.get("brand"),
        "quantity": item.get("quantity"),
        "category": item.get("category"),
        "location": item.get("location"),
        "unit_name": item.get("unit_name"),
        "stock_units": int(item.get("stock_units") or 0),
        "expiry_date": item.get("expiry_date"),
    }


def _extract_json_text(body: str, model: str) -> dict[str, Any]:
    try:
        raw = json.loads(body)
        answer = raw["candidates"][0]["content"]["parts"][0]["text"]
        parsed = json.loads(answer)
    except (KeyError, IndexError, TypeError, json.JSONDecodeError) as err:
        raise HomeAssistantError(f"Gemini non ha restituito un'analisi vocale valida ({model}).") from err
    if not isinstance(parsed, dict) or not isinstance(parsed.get("requests"), list):
        raise HomeAssistantError(f"Analisi vocale non valida ({model}).")
    return parsed


async def _call_voice_model(hass: HomeAssistant, api_key: str, model: str, prompt: str) -> dict[str, Any]:
    generation_config: dict[str, Any] = {"responseMimeType": "application/json"}
    if not _is_modern_gemini(model):
        generation_config["temperature"] = 0
    payload = {"contents": [{"parts": [{"text": prompt}]}], "generationConfig": generation_config}
    session = async_get_clientsession(hass)
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
    try:
        async with session.post(
            url,
            headers={"x-goog-api-key": api_key, "Content-Type": "application/json"},
            json=payload,
            timeout=aiohttp.ClientTimeout(total=45),
        ) as response:
            body = await response.text()
            if response.status >= 400:
                raise HomeAssistantError(f"Gemini API {response.status} ({model}): {body[:500]}")
    except aiohttp.ClientError as err:
        raise HomeAssistantError(f"Errore di connessione a Gemini ({model}): {err}") from err
    return _extract_json_text(body, model)


async def _gemini_parse(hass: HomeAssistant, text: str, inventory: list[dict[str, Any]], kind: str) -> dict[str, Any]:
    entry = _compat_entry(hass)
    api_key = entry.data.get(CONF_API_KEY)
    if not api_key:
        raise HomeAssistantError("API key Gemini mancante.")
    prompt = _system_prompt(kind) + "\n\nFRASE DETTATA:\n" + text + "\n\nINVENTARIO DISPONIBILE:\n" + json.dumps(inventory, ensure_ascii=False, separators=(",", ":"))
    candidates = await _candidate_models(hass, entry, api_key)
    errors: list[str] = []
    for model in candidates:
        try:
            parsed = await _call_voice_model(hass, api_key, model, prompt)
            hass.data.setdefault(RUNTIME_KEY, {})["gemini_last_good_model"] = model
            return parsed
        except HomeAssistantError as err:
            errors.append(str(err))
            if _model_mode(entry) != "auto":
                raise
    detail = " | ".join(errors[-3:])
    raise HomeAssistantError(f"Nessun modello Gemini compatibile per la funzione vocale. {detail}")


def _safe_amount(value: Any) -> int:
    try:
        return max(1, int(value))
    except (TypeError, ValueError):
        return 1


def _normalize_kind(kind: str | None) -> str:
    return "cons" if str(kind or "").strip().lower() in {"cons", "consumable", "consumables", "consumabili"} else "food"


def _inventory(hass: HomeAssistant, kind: str) -> list[dict[str, Any]]:
    if kind == "cons":
        return get_consumables(hass).items()
    return get_archive(hass).items_sorted(sort="expiry")


async def async_voice_consume_preview(hass: HomeAssistant, text: str, kind: str = "food") -> dict[str, Any]:
    kind = _normalize_kind(kind)
    phrase = " ".join(str(text or "").strip().split())
    if not phrase:
        raise HomeAssistantError("Non ho ricevuto nulla da analizzare.")
    if len(phrase) > 1500:
        raise HomeAssistantError("Dettatura troppo lunga.")

    active = [_compact_item(x) for x in _inventory(hass, kind) if int(x.get("stock_units") or 0) > 0]
    if not active:
        label = "consumabili" if kind == "cons" else "alimenti"
        return {"success": True, "kind": kind, "phrase": phrase, "operations": [], "can_confirm": False, "message": f"Il magazzino {label} e vuoto."}

    parsed = await _gemini_parse(hass, phrase, active, kind)
    by_id = {x["id"]: x for x in active}
    operations: list[dict[str, Any]] = []
    for request in parsed.get("requests", [])[:20]:
        if not isinstance(request, dict):
            continue
        spoken = str(request.get("spoken_name") or "Prodotto").strip() or "Prodotto"
        consume_all = bool(request.get("consume_all"))
        requested = _safe_amount(request.get("amount", 1))
        matched_id = str(request.get("matched_id") or "").strip()
        try:
            confidence = max(0, min(100, int(request.get("confidence") or 0)))
        except (TypeError, ValueError):
            confidence = 0
        matched = by_id.get(matched_id)
        ambiguous_ids: list[str] = []
        raw_ambiguous = request.get("ambiguous_ids") if isinstance(request.get("ambiguous_ids"), list) else []
        for candidate_id in raw_ambiguous[:4]:
            candidate = by_id.get(str(candidate_id))
            if candidate and candidate["id"] not in ambiguous_ids:
                ambiguous_ids.append(candidate["id"])
        if matched is None:
            options = [by_id[x] for x in ambiguous_ids if x in by_id]
            operations.append({"spoken_name": spoken, "status": "ambiguous" if options else "not_found", "id": None, "amount": requested, "consume_all": consume_all, "confidence": confidence, "options": options})
            continue
        available = int(matched.get("stock_units") or 0)
        amount = available if consume_all else requested
        operations.append({
            "spoken_name": spoken,
            "status": "matched" if amount <= available else "insufficient",
            "id": matched["id"],
            "product_name": matched.get("product_name"),
            "brand": matched.get("brand"),
            "quantity": matched.get("quantity"),
            "location": matched.get("location"),
            "unit_name": matched.get("unit_name") or "unita",
            "available": available,
            "amount": amount,
            "consume_all": consume_all,
            "confidence": confidence,
            "options": [],
        })
    can_confirm = bool(operations) and all(x.get("status") == "matched" for x in operations)
    return {"success": True, "kind": kind, "phrase": phrase, "operations": operations, "can_confirm": can_confirm}


async def async_voice_consume_apply(hass: HomeAssistant, operations: list[dict[str, Any]], kind: str = "food") -> dict[str, Any]:
    kind = _normalize_kind(kind)
    if not isinstance(operations, list) or not operations:
        raise HomeAssistantError("Nessuna modifica da confermare.")
    store = get_consumables(hass) if kind == "cons" else get_archive(hass)
    current = {str(x.get("id")): x for x in store.items()}
    validated: list[tuple[str, int, dict[str, Any]]] = []
    for op in operations[:20]:
        if not isinstance(op, dict):
            raise HomeAssistantError("Modifica non valida.")
        product_id = str(op.get("id") or "").strip()
        item = current.get(product_id)
        if item is None:
            raise HomeAssistantError("Uno dei prodotti non e piu disponibile. Rianalizza la dettatura.")
        available = int(item.get("stock_units") or 0)
        amount = available if bool(op.get("consume_all")) else _safe_amount(op.get("amount", 1))
        if amount < 1 or amount > available:
            raise HomeAssistantError(f"Quantita non disponibile per {item.get('product_name') or 'prodotto'}: presenti {available}.")
        validated.append((product_id, amount, item))
    results = []
    for product_id, amount, item in validated:
        result = await store.async_consume(product_id, amount)
        results.append({
            "id": product_id,
            "product_name": item.get("product_name"),
            "brand": item.get("brand"),
            "amount": amount,
            "remaining": int(result.get("stock_units") or 0) if result else 0,
        })
    return {"success": True, "kind": kind, "results": results}
