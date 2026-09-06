from __future__ import annotations

from typing import Any


_TEXT_KEYS = ("value", "text", "name", "label", "product_name", "message", "detail", "reason")
_TEXT_FIELDS = (
    "product_name", "brand", "quantity", "barcode", "expiry_date", "expiry_type",
    "package_type", "unit_name", "category", "generic_name", "photo_request",
    "photo_reason", "photo_instruction", "photo_target", "photo_button_label",
)


def _scalar_text(value: Any, depth: int = 0) -> str | None:
    if value is None:
        return None
    if isinstance(value, str):
        text = value.strip()
        return text or None
    if isinstance(value, (int, float, bool)):
        return str(value)
    if depth > 3:
        return None
    if isinstance(value, list):
        parts = [_scalar_text(v, depth + 1) for v in value]
        parts = [p for p in parts if p]
        return ", ".join(parts) if parts else None
    if isinstance(value, dict):
        for key in _TEXT_KEYS:
            if key in value:
                text = _scalar_text(value.get(key), depth + 1)
                if text:
                    return text
        for child in value.values():
            text = _scalar_text(child, depth + 1)
            if text:
                return text
        return None
    return str(value).strip() or None


def _scalar_int(value: Any, default: int = 0) -> int:
    if isinstance(value, dict):
        for key in ("value", "number", "count", "confidence", "units", "units_per_package"):
            if key in value:
                return _scalar_int(value.get(key), default)
        return default
    if isinstance(value, list):
        return _scalar_int(value[0], default) if value else default
    try:
        return int(float(str(value).strip()))
    except (TypeError, ValueError):
        return default


def _scalar_bool(value: Any, default: bool = False) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, dict):
        for key in ("value", "enabled", "ready", "result", "bool"):
            if key in value:
                return _scalar_bool(value.get(key), default)
        return default
    if isinstance(value, list):
        return _scalar_bool(value[0], default) if value else default
    if isinstance(value, (int, float)):
        return bool(value)
    if isinstance(value, str):
        text = value.strip().casefold()
        if text in {"1", "true", "yes", "si", "sì", "vero"}:
            return True
        if text in {"0", "false", "no", "falso", ""}:
            return False
    return default


def _string_list(value: Any) -> list[str]:
    if value is None:
        return []
    values = value if isinstance(value, list) else [value]
    out: list[str] = []
    for item in values:
        text = _scalar_text(item)
        if text:
            out.append(text)
    return out


def normalize_scan_payload(data: dict[str, Any]) -> dict[str, Any]:
    """Normalize Gemini/API fields into primitive values expected by HomeStock."""
    if not isinstance(data, dict):
        return {}

    for field in _TEXT_FIELDS:
        if field in data:
            data[field] = _scalar_text(data.get(field))

    if "units_per_package" in data:
        data["units_per_package"] = max(1, _scalar_int(data.get("units_per_package"), 1))
    if "confidence" in data:
        data["confidence"] = max(0, min(100, _scalar_int(data.get("confidence"), 0)))
    if "inventory_ready" in data:
        data["inventory_ready"] = _scalar_bool(data.get("inventory_ready"), False)
    if "needs_more_photo" in data:
        data["needs_more_photo"] = _scalar_bool(data.get("needs_more_photo"), False)
    if "missing_fields" in data:
        data["missing_fields"] = _string_list(data.get("missing_fields"))

    # Gemini occasionally returns barcode as a nested structure or number.
    if data.get("barcode"):
        raw = "".join(ch for ch in str(data["barcode"]) if ch.isdigit())
        data["barcode"] = raw or None

    return data


def install_scan_payload_compat() -> None:
    from . import consumables_api, service

    if getattr(service, "__homestock_scan_payload_compat", False):
        return

    # Wrap the final food normalizer. This is intentionally installed after
    # product_family so generic_name is also protected.
    original_food_normalize = service._normalize_package_fields

    def normalize_food(food):
        normalize_scan_payload(food)
        original_food_normalize(food)
        normalize_scan_payload(food)

    service._normalize_package_fields = normalize_food

    # Consumables use a separate Gemini path. Normalize immediately after Gemini
    # so _analyze never sees dict/list values where scalar strings are expected.
    original_gemini_json = consumables_api._gemini_json

    async def normalized_gemini_json(hass, image_bytes, mime_type, prompt):
        data, model = await original_gemini_json(hass, image_bytes, mime_type, prompt)
        if isinstance(data, dict):
            normalize_scan_payload(data)
        return data, model

    consumables_api._gemini_json = normalized_gemini_json
    service.__homestock_scan_payload_compat = True
