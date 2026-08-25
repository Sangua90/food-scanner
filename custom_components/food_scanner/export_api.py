from __future__ import annotations

import csv
import io
import json
from datetime import datetime

from aiohttp import web
from homeassistant.components.http import KEY_HASS
from homeassistant.components.http.view import HomeAssistantView

from .archive import get_archive
from .history import get_history


class FoodScannerExportView(HomeAssistantView):
    """Esporta magazzino e backup senza esporre credenziali."""

    url = "/api/food_scanner/export"
    name = "api:food_scanner:export"
    requires_auth = True

    async def get(self, request: web.Request) -> web.Response:
        hass = request.app[KEY_HASS]
        fmt = str(request.query.get("format") or "csv").strip().lower()
        stamp = datetime.now().strftime("%Y%m%d_%H%M")
        archive = get_archive(hass)
        items = archive.items_sorted("expiry")

        if fmt == "json":
            payload = {
                "format": "food_scanner_backup_v1",
                "created_at": datetime.now().astimezone().isoformat(),
                "archive": items,
                "history": get_history(hass).events(limit=500),
                "stats": get_history(hass).stats(),
            }
            body = json.dumps(payload, ensure_ascii=False, indent=2)
            return web.Response(
                text=body,
                content_type="application/json",
                headers={"Content-Disposition": f'attachment; filename="food_scanner_backup_{stamp}.json"'},
            )

        output = io.StringIO()
        fields = [
            "product_name", "brand", "category", "quantity", "barcode",
            "expiry_date", "expiry_type", "location", "package_type",
            "units_per_package", "unit_name", "stock_units", "added_at", "updated_at",
        ]
        writer = csv.DictWriter(output, fieldnames=fields, extrasaction="ignore")
        writer.writeheader()
        for item in items:
            writer.writerow(item)

        return web.Response(
            text="\ufeff" + output.getvalue(),
            content_type="text/csv",
            charset="utf-8",
            headers={"Content-Disposition": f'attachment; filename="food_scanner_magazzino_{stamp}.csv"'},
        )
