from __future__ import annotations

from http import HTTPStatus

from aiohttp import web
from homeassistant.components.http import KEY_HASS
from homeassistant.components.http.view import HomeAssistantView

from .archive import get_archive


class FoodScannerArchiveView(HomeAssistantView):
    """API autenticata per consultare e modificare l'archivio."""

    url = "/api/food_scanner/archive"
    name = "api:food_scanner:archive"
    requires_auth = True

    async def get(self, request: web.Request) -> web.Response:
        hass = request.app[KEY_HASS]
        archive = get_archive(hass)
        items = archive.items_sorted_by_expiry()
        return self.json({"count": len(items), "items": items})

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
