from __future__ import annotations

from http import HTTPStatus

from aiohttp import web
from homeassistant.components.http import KEY_HASS
from homeassistant.components.http.view import HomeAssistantView

from .archive import get_archive

VALID_SORTS = {"expiry", "name", "added"}
VALID_LOCATIONS = {"frigo", "freezer", "dispensa"}


class FoodScannerArchiveView(HomeAssistantView):
    """API autenticata per consultare e modificare l'archivio."""

    url = "/api/food_scanner/archive"
    name = "api:food_scanner:archive"
    requires_auth = True

    async def get(self, request: web.Request) -> web.Response:
        hass = request.app[KEY_HASS]
        archive = get_archive(hass)

        sort = (request.query.get("sort") or "expiry").strip().lower()
        if sort not in VALID_SORTS:
            sort = "expiry"
        location = (request.query.get("location") or "").strip().lower() or None
        if location not in VALID_LOCATIONS:
            location = None
        search = (request.query.get("search") or "").strip() or None

        items = archive.items_sorted(sort=sort, location=location, search=search)
        total_units = sum(int(item.get("stock_units", 1)) for item in items)
        return self.json(
            {
                "count": len(items),
                "total_units": total_units,
                "sort": sort,
                "location": location,
                "items": items,
            }
        )

    async def post(self, request: web.Request) -> web.Response:
        hass = request.app[KEY_HASS]
        archive = get_archive(hass)
        try:
            data = await request.json()
        except ValueError:
            return self.json_message("JSON non valido", status_code=HTTPStatus.BAD_REQUEST)

        action = str(data.get("action") or "").strip().lower()
        product_id = str(data.get("id") or "").strip()
        if not product_id:
            return self.json_message("Parametro id mancante", status_code=HTTPStatus.BAD_REQUEST)

        try:
            amount = int(data.get("amount", 1))
        except (TypeError, ValueError):
            return self.json_message("Quantità non valida", status_code=HTTPStatus.BAD_REQUEST)

        try:
            if action == "consume":
                result = await archive.async_consume(product_id, amount)
            elif action == "set_stock":
                result = await archive.async_set_units(product_id, amount)
            else:
                return self.json_message(
                    "Azione non valida: usa consume o set_stock",
                    status_code=HTTPStatus.BAD_REQUEST,
                )
        except ValueError as err:
            return self.json_message(str(err), status_code=HTTPStatus.BAD_REQUEST)

        if result is None:
            return self.json_message("Prodotto non trovato", status_code=HTTPStatus.NOT_FOUND)

        return self.json({"success": True, "item": result})

    async def delete(self, request: web.Request) -> web.Response:
        hass = request.app[KEY_HASS]
        product_id = (request.query.get("id") or "").strip()
        if not product_id:
            return self.json_message(
                "Parametro id mancante",
                status_code=HTTPStatus.BAD_REQUEST,
            )

        archive = get_archive(hass)
        removed = await archive.async_remove(product_id)
        if not removed:
            return self.json_message(
                "Prodotto non trovato",
                status_code=HTTPStatus.NOT_FOUND,
            )

        return self.json({"success": True, "removed_id": product_id})
