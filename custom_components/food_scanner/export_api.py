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


def _build_export(hass, fmt: str) -> tuple[str, str, str]:
    stamp = datetime.now().strftime("%Y%m%d_%H%M")
    items = get_archive(hass).items_sorted("expiry")

    if fmt == "json":
        payload = {
            "format": "food_scanner_backup_v1",
            "created_at": datetime.now().astimezone().isoformat(),
            "archive": items,
            "history": get_history(hass).events(limit=500),
            "stats": get_history(hass).stats(),
        }
        return (
            json.dumps(payload, ensure_ascii=False, indent=2),
            "application/json",
            f"food_scanner_backup_{stamp}.json",
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
    return (
        "\ufeff" + output.getvalue(),
        "text/csv",
        f"food_scanner_magazzino_{stamp}.csv",
    )


class FoodScannerExportView(HomeAssistantView):
    url = "/api/food_scanner/export"
    name = "api:food_scanner:export"
    requires_auth = True

    async def get(self, request: web.Request) -> web.Response:
        hass = request.app[KEY_HASS]
        fmt = str(request.query.get("format") or "csv").strip().lower()
        content, mime, filename = _build_export(hass, fmt)
        return web.Response(
            text=content,
            content_type=mime,
            charset="utf-8",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )


class FoodScannerExportDataView(HomeAssistantView):
    """Versione JSON usabile da hass.callApi nel pannello Companion/web."""

    url = "/api/food_scanner/export_data"
    name = "api:food_scanner:export_data"
    requires_auth = True

    async def get(self, request: web.Request) -> web.Response:
        hass = request.app[KEY_HASS]
        fmt = str(request.query.get("format") or "csv").strip().lower()
        content, mime, filename = _build_export(hass, fmt)
        return self.json({
            "success": True,
            "format": fmt,
            "mime": mime,
            "filename": filename,
            "content": content,
        })
