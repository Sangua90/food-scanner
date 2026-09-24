from __future__ import annotations

import asyncio
import json
import re
import unicodedata
from typing import Any

import aiohttp
from homeassistant.core import HomeAssistant
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers.aiohttp_client import async_get_clientsession

from .archive import get_archive
from .consumables import get_consumables
from .const import CONF_API_KEY
from .engine_client import async_engine_gemini_json
from .gemini_compat import RUNTIME_KEY, _candidate_models, _get_entry as _compat_entry, _is_modern_gemini, _model_mode


_FAST_MODEL = "gemini-2.5-flash-lite"
VOICE_AI_TIMEOUT = 22
_NUMBER_WORDS = {
    "un": 1, "uno": 1, "una": 1,
    "due": 2, "tre": 3, "quattro": 4, "cinque": 5,
    "sei": 6, "sette": 7, "otto": 8, "nove": 9, "dieci": 10,
}
_STOPWORDS = {
    "ho", "hai", "abbiamo", "usato", "usata", "usati", "usate", "tolto", "tolta",
    "tolti", "tolte", "mangiato", "mangiata", "mangiati", "mangiate", "aperto", "aperta",
    "aperti", "aperte", "consumato", "consumata", "consumati", "consumate", "finito", "finita",
    "finiti", "finite", "del", "della", "dei", "degli", "delle", "di", "da", "dal", "dallo",
    "dalla", "dai", "dagli", "dalle", "il", "lo", "la", "i", "gli", "le", "un", "uno", "una",
    "e", "poi", "anche", "tutto", "tutta", "tutti", "tutte", "confezione", "confezioni",
    "pezzo", "pezzi", "vasetto", "vasetti", "bottiglia", "bottiglie", "lattina", "lattine",
}


def _norm_fast(value: Any) -> str:
    text = unicodedata.normalize("NFKD", str(value or "").casefold())
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    text = re.sub(r"[^a-z0-9]+", " ", text)
    return " ".join(text.split())


def _tokens_fast(value: Any) -> set[str]:
    return {x for x in _norm_fast(value).split() if len(x) > 1 and x not in _STOPWORDS and x not in _NUMBER_WORDS and not x.isdigit()}


def _amount_from_segment(segment: str) -> int:
    norm = _norm_fast(segment)
    match = re.search(r"\b(\d{1,3})\b", norm)
    if match:
        return max(1, int(match.group(1)))
    for word, number in _NUMBER_WORDS.items():
        if re.search(rf"\b{word}\b", norm):
            return number
    return 1


def _consume_all_from_segment(segment: str) -> bool:
    norm = _norm_fast(segment)
    return any(re.search(rf"\b{word}\b", norm) for word in ("finito", "finita", "finiti", "finite", "tutto", "tutta", "tutti", "tutte"))


def _fast_local_parse(text: str, inventory: list[dict[str, Any]]) -> dict[str, Any] | None:
    # Fast path: match every clearly recognizable segment locally. Unresolved
    # segments are returned as not_found instead of forcing the whole request
    # through a slow remote AI call.
    segments = [
        part.strip(" .;:-")
        for part in re.split(r"\s*(?:,|;|\be\b|\bpoi\b)\s*", text, flags=re.IGNORECASE)
        if part.strip(" .;:-")
    ]
    if not segments:
        return None

    requests: list[dict[str, Any]] = []
    matched_any = False
    for segment in segments[:20]:
        seg_tokens = _tokens_fast(segment)
        if not seg_tokens:
            continue

        scored: list[tuple[float, dict[str, Any]]] = []
        seg_norm = _norm_fast(segment)
        for item in inventory:
            name = _norm_fast(item.get("product_name"))
            generic = _norm_fast(item.get("generic_name"))
            brand = _norm_fast(item.get("brand"))
            fields = " ".join(x for x in (name, generic, brand) if x)
            item_tokens = _tokens_fast(fields)
            if not item_tokens:
                continue
            overlap = len(seg_tokens & item_tokens)
            if overlap == 0:
                continue
            coverage = overlap / max(1, len(seg_tokens))
            item_coverage = overlap / max(1, min(len(item_tokens), 4))
            bonus = 0.0
            if name and name in seg_norm:
                bonus += 0.45
            elif generic and generic in seg_norm:
                bonus += 0.35
            if brand and brand in seg_norm:
                bonus += 0.25
            score = coverage * 0.65 + item_coverage * 0.25 + bonus
            scored.append((score, item))

        scored.sort(key=lambda x: x[0], reverse=True)
        best_score, best = scored[0] if scored else (0.0, None)
        second_score = scored[1][0] if len(scored) > 1 else 0.0
        clear = bool(best) and best_score >= 0.72 and (second_score == 0 or best_score - second_score >= 0.18)

        if clear:
            matched_any = True
            requests.append({
                "spoken_name": segment,
                "amount": _amount_from_segment(segment),
                "consume_all": _consume_all_from_segment(segment),
                "matched_id": best.get("id"),
                "confidence": min(99, max(80, int(best_score * 100))),
                "ambiguous_ids": [],
            })
        else:
            requests.append({
                "spoken_name": segment,
                "amount": _amount_from_segment(segment),
                "consume_all": _consume_all_from_segment(segment),
                "matched_id": None,
                "confidence": 0,
                "ambiguous_ids": [],
            })

    # If at least one product is clear, return immediately and let the UI save
    # the valid matches while showing the unresolved ones. Only fully unresolved
    # phrases use Gemini.
    return {"requests": requests} if requests and matched_any else None

def _system_prompt(kind: str) -> str:
    if kind == "auto":
        noun = "prodotti (alimenti e consumabili)"
        verbs = '"usato", "tolto", "finito", "mangiato", "aperto", "consumato"'
    else:
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
        "source_kind": item.get("source_kind"),
        "original_id": item.get("original_id"),
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
        async with session.post(url, headers={"x-goog-api-key": api_key, "Content-Type": "application/json"}, json=payload, timeout=aiohttp.ClientTimeout(total=12)) as response:
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
    candidates = await _candidate_models(hass, entry, api_key, discovery_timeout=2)
    # Prefer the lightest/fastest model for this tiny structured task, while
    # retaining the normal candidate list as fallback if it is unavailable.
    if _model_mode(entry) == "auto":
        candidates = [_FAST_MODEL] + [m for m in candidates if m != _FAST_MODEL]

    engine_result = await async_engine_gemini_json(
        hass,
        api_key=api_key,
        prompt=prompt,
        models=candidates,
        timeout=3,
    )
    if engine_result is not None:
        parsed, model = engine_result
        if isinstance(parsed.get("requests"), list):
            hass.data.setdefault(RUNTIME_KEY, {})["gemini_last_good_model"] = model
            hass.data.setdefault(RUNTIME_KEY, {})["last_ai_backend"] = "engine"
            return parsed

    errors: list[str] = []
    for model in candidates:
        try:
            parsed = await _call_voice_model(hass, api_key, model, prompt)
            hass.data.setdefault(RUNTIME_KEY, {})["gemini_last_good_model"] = model
            hass.data.setdefault(RUNTIME_KEY, {})["last_ai_backend"] = "integration_fallback"
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
    value = str(kind or "").strip().lower()
    if value in {"auto", "all", "tutti", "prodotti"}:
        return "auto"
    if value in {"cons", "consumable", "consumables", "consumabili"}:
        return "cons"
    return "food"


def _inventory(hass: HomeAssistant, kind: str) -> list[dict[str, Any]]:
    if kind == "cons":
        return get_consumables(hass).items()
    if kind == "food":
        return get_archive(hass).items_sorted(sort="expiry")

    combined: list[dict[str, Any]] = []
    for item in get_archive(hass).items_sorted(sort="expiry"):
        copy = dict(item)
        original_id = str(copy.get("id") or "")
        copy["original_id"] = original_id
        copy["source_kind"] = "food"
        copy["id"] = f"food:{original_id}"
        combined.append(copy)
    for item in get_consumables(hass).items():
        copy = dict(item)
        original_id = str(copy.get("id") or "")
        copy["original_id"] = original_id
        copy["source_kind"] = "cons"
        copy["id"] = f"cons:{original_id}"
        combined.append(copy)
    return combined


async def async_voice_consume_preview(hass: HomeAssistant, text: str, kind: str = "food") -> dict[str, Any]:
    kind = _normalize_kind(kind)
    phrase = " ".join(str(text or "").strip().split())
    if not phrase:
        raise HomeAssistantError("Non ho ricevuto nulla da analizzare.")
    if len(phrase) > 1500:
        raise HomeAssistantError("Dettatura troppo lunga.")
    active = [_compact_item(x) for x in _inventory(hass, kind) if int(x.get("stock_units") or 0) > 0]
    if not active:
        label = "prodotti" if kind == "auto" else ("consumabili" if kind == "cons" else "alimenti")
        return {"success": True, "kind": kind, "phrase": phrase, "operations": [], "can_confirm": False, "message": f"Il magazzino {label} e vuoto."}
    parsed = _fast_local_parse(phrase, active)
    if parsed is not None:
        hass.data.setdefault(RUNTIME_KEY, {})["last_ai_backend"] = "local_fast_match"
        # Resolve only the local misses with AI, preserving the instant matches.
        unresolved = [x for x in parsed.get("requests", []) if not x.get("matched_id")]
        if unresolved:
            try:
                async with asyncio.timeout(VOICE_AI_TIMEOUT):
                    ai_parsed = await _gemini_parse(hass, phrase, active, kind)
                ai_requests = ai_parsed.get("requests", []) if isinstance(ai_parsed, dict) else []
                for local_req in parsed.get("requests", []):
                    if local_req.get("matched_id"):
                        continue
                    local_tokens = _tokens_fast(local_req.get("spoken_name"))
                    best_ai = None
                    best_overlap = 0
                    for ai_req in ai_requests:
                        overlap = len(local_tokens & _tokens_fast(ai_req.get("spoken_name")))
                        if overlap > best_overlap:
                            best_overlap = overlap
                            best_ai = ai_req
                    if best_ai and (best_ai.get("matched_id") or best_ai.get("ambiguous_ids")):
                        local_req.update(best_ai)
            except (TimeoutError, HomeAssistantError):
                # Local results remain usable even if AI is temporarily unavailable.
                pass
    else:
        # Nothing matched locally: try AI, but never turn a temporary/model
        # failure into an HTTP 400 for the user. A safe unresolved preview is
        # preferable and no stock is modified at this stage.
        try:
            async with asyncio.timeout(VOICE_AI_TIMEOUT):
                parsed = await _gemini_parse(hass, phrase, active, kind)
        except (TimeoutError, HomeAssistantError):
            segments = [
                part.strip(" .;:-")
                for part in re.split(r"\\s*(?:,|;|\\be\\b|\\bpoi\\b)\\s*", phrase, flags=re.IGNORECASE)
                if part.strip(" .;:-")
            ]
            parsed = {
                "requests": [
                    {
                        "spoken_name": segment,
                        "amount": _amount_from_segment(segment),
                        "consume_all": _consume_all_from_segment(segment),
                        "matched_id": None,
                        "confidence": 0,
                        "ambiguous_ids": [],
                    }
                    for segment in segments[:20]
                ]
            }
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
            "source_kind": matched.get("source_kind") or kind,
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

    matched_count = sum(1 for x in operations if x.get("status") == "matched" and x.get("id"))
    unresolved_count = len(operations) - matched_count
    can_confirm = matched_count > 0
    return {
        "success": True,
        "kind": kind,
        "phrase": phrase,
        "operations": operations,
        "can_confirm": can_confirm,
        "matched_count": matched_count,
        "unresolved_count": unresolved_count,
        "message": (
            f"Puoi salvare {matched_count} prodotti riconosciuti; {unresolved_count} non verranno modificati."
            if matched_count and unresolved_count else None
        ),
    }


async def async_voice_consume_apply(hass: HomeAssistant, operations: list[dict[str, Any]], kind: str = "food") -> dict[str, Any]:
    kind = _normalize_kind(kind)
    if not isinstance(operations, list) or not operations:
        raise HomeAssistantError("Nessuna modifica da confermare.")

    food_store = get_archive(hass)
    cons_store = get_consumables(hass)

    if kind == "auto":
        food_current = {f"food:{str(x.get('id'))}": x for x in food_store.items()}
        cons_current = {f"cons:{str(x.get('id'))}": x for x in cons_store.items()}
        current = {**food_current, **cons_current}
    else:
        store = cons_store if kind == "cons" else food_store
        current = {str(x.get("id")): x for x in store.items()}

    remaining = {key: int(item.get("stock_units") or 0) for key, item in current.items()}
    validated: list[tuple[str, str, int, dict[str, Any]]] = []
    skipped: list[dict[str, Any]] = []

    for op in operations[:20]:
        if not isinstance(op, dict):
            skipped.append({"spoken_name": "Prodotto", "reason": "invalid"})
            continue

        spoken_name = str(op.get("spoken_name") or op.get("product_name") or "Prodotto").strip() or "Prodotto"
        status = str(op.get("status") or "").strip().lower()
        product_id = str(op.get("id") or "").strip()

        if not product_id or status in {"not_found", "ambiguous", "insufficient"}:
            skipped.append({"spoken_name": spoken_name, "status": status or "not_found", "reason": "not_applied"})
            continue

        item = current.get(product_id)
        if item is None:
            skipped.append({"spoken_name": spoken_name, "status": "unavailable", "reason": "not_applied"})
            continue

        available = remaining[product_id]
        amount = available if bool(op.get("consume_all")) else _safe_amount(op.get("amount", 1))
        if amount < 1 or amount > available:
            skipped.append({
                "spoken_name": spoken_name,
                "product_name": item.get("product_name"),
                "status": "insufficient",
                "available": available,
                "reason": "not_applied",
            })
            continue

        if kind == "auto":
            source_kind, original_id = product_id.split(":", 1)
        else:
            source_kind, original_id = kind, product_id

        validated.append((source_kind, original_id, amount, item))
        remaining[product_id] -= amount

    if not validated:
        raise HomeAssistantError("Nessun prodotto riconosciuto da salvare.")

    results = []
    for source_kind, original_id, amount, item in validated:
        store = cons_store if source_kind == "cons" else food_store
        result = await store.async_consume(original_id, amount)
        results.append({
            "id": original_id,
            "source_kind": source_kind,
            "product_name": item.get("product_name"),
            "brand": item.get("brand"),
            "amount": amount,
            "remaining": int(result.get("stock_units") or 0) if result else 0,
        })

    return {
        "success": True,
        "kind": kind,
        "results": results,
        "skipped": skipped,
        "applied_count": len(results),
        "skipped_count": len(skipped),
    }

