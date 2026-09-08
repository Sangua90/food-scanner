from __future__ import annotations

from http import HTTPStatus

from aiohttp import web
from homeassistant.components.http import KEY_HASS
from homeassistant.components.http.view import HomeAssistantView
from homeassistant.exceptions import HomeAssistantError

from .voice_consume import async_voice_consume_apply, async_voice_consume_preview
from .voice_transcribe import async_transcribe_voice


class HomeStockVoiceConsumeView(HomeAssistantView):
    url = "/api/food_scanner/voice_consume"
    name = "api:food_scanner:voice_consume"
    requires_auth = True

    async def post(self, request: web.Request) -> web.Response:
        hass = request.app[KEY_HASS]
        try:
            data = await request.json()
        except ValueError:
            return self.json_message("JSON non valido", status_code=HTTPStatus.BAD_REQUEST)

        action = str(data.get("action") or "preview").strip().lower()
        kind = str(data.get("kind") or "food").strip().lower()
        try:
            if action == "transcribe":
                result = await async_transcribe_voice(
                    hass,
                    str(data.get("audio_data") or ""),
                    str(data.get("mime_type") or ""),
                )
                return self.json(result)
            if action == "preview":
                result = await async_voice_consume_preview(hass, str(data.get("text") or ""), kind)
                return self.json(result)
            if action == "apply":
                operations = data.get("operations")
                if not isinstance(operations, list):
                    return self.json_message("Operazioni mancanti", status_code=HTTPStatus.BAD_REQUEST)
                result = await async_voice_consume_apply(hass, operations, kind)
                return self.json(result)
        except HomeAssistantError as err:
            return self.json_message(str(err), status_code=HTTPStatus.BAD_REQUEST)

        return self.json_message("Azione non valida", status_code=HTTPStatus.BAD_REQUEST)
