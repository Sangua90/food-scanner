from __future__ import annotations

import json


def _message_from_response(response) -> str:
    raw = getattr(response, "text", None)
    if isinstance(raw, str) and raw.strip():
        text = raw.strip()
        try:
            data = json.loads(text)
        except Exception:
            return text
        if isinstance(data, dict):
            for key in ("message", "error", "detail", "description"):
                value = data.get(key)
                if value:
                    return str(value)
        return text
    return f"Errore HTTP {getattr(response, 'status', 'sconosciuto')}"


def install_scan_error_compat() -> None:
    from .scan_api import FoodScannerDashboardScanView
    from .consumables_api import FoodScannerConsumablesView

    if getattr(FoodScannerDashboardScanView, "__homestock_error_compat", False):
        return

    food_post = FoodScannerDashboardScanView.post
    cons_post = FoodScannerConsumablesView.post

    async def food_post_compat(self, request):
        try:
            response = await food_post(self, request)
        except Exception as err:
            return self.json({"success": False, "error": f"Errore interno scansione: {type(err).__name__}: {err}"})
        if getattr(response, "status", 200) >= 400:
            return self.json({"success": False, "error": _message_from_response(response), "http_status": response.status})
        return response

    async def cons_post_compat(self, request):
        try:
            response = await cons_post(self, request)
        except Exception as err:
            return self.json({"success": False, "error": f"Errore interno consumabili: {type(err).__name__}: {err}"})
        if getattr(response, "status", 200) >= 400:
            return self.json({"success": False, "error": _message_from_response(response), "http_status": response.status})
        return response

    FoodScannerDashboardScanView.post = food_post_compat
    FoodScannerConsumablesView.post = cons_post_compat
    FoodScannerDashboardScanView.__homestock_error_compat = True
    FoodScannerConsumablesView.__homestock_error_compat = True
