from __future__ import annotations

from aiohttp import web
from homeassistant.components.http import KEY_HASS
from homeassistant.components.http.view import HomeAssistantView

from .engine_client import async_engine_health


class HomeStockEngineView(HomeAssistantView):
    url = "/api/food_scanner/engine"
    name = "api:food_scanner:engine"
    requires_auth = True

    async def get(self, request: web.Request) -> web.Response:
        hass = request.app[KEY_HASS]
        return self.json(await async_engine_health(hass))
