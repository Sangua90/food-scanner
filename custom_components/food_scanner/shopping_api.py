from __future__ import annotations

from http import HTTPStatus
from homeassistant.components.http import KEY_HASS
from homeassistant.components.http.view import HomeAssistantView

from .shopping import get_shopping


class HomeStockShoppingView(HomeAssistantView):
    url = "/api/food_scanner/shopping"
    name = "api:food_scanner:shopping"
    requires_auth = True

    async def get(self, request):
        return self.json({"items": get_shopping(request.app[KEY_HASS]).items()})

    async def post(self, request):
        hass = request.app[KEY_HASS]
        store = get_shopping(hass)
        try:
            data = await request.json()
        except ValueError:
            return self.json_message("JSON non valido", status_code=HTTPStatus.BAD_REQUEST)

        action = str(data.get("action") or "").strip().lower()
        try:
            if action == "add":
                item = await store.async_add(
                    data.get("name"),
                    kind=data.get("kind"),
                    source_key=data.get("source_key"),
                    purchase_store=data.get("purchase_store"),
                )
                return self.json({"success": True, "item": item, "items": store.items()})
            if action == "toggle":
                item = await store.async_toggle(str(data.get("id") or ""))
                if item is None:
                    return self.json_message("Voce non trovata", status_code=HTTPStatus.NOT_FOUND)
                return self.json({"success": True, "item": item, "items": store.items()})
            if action == "remove":
                ok = await store.async_remove(str(data.get("id") or ""))
                if not ok:
                    return self.json_message("Voce non trovata", status_code=HTTPStatus.NOT_FOUND)
                return self.json({"success": True, "items": store.items()})
            if action == "clear_checked":
                removed = await store.async_clear_checked()
                return self.json({"success": True, "removed": removed, "items": store.items()})
        except ValueError as err:
            return self.json_message(str(err), status_code=HTTPStatus.BAD_REQUEST)

        return self.json_message("Azione non valida", status_code=HTTPStatus.BAD_REQUEST)
