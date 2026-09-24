from __future__ import annotations

import asyncio
import logging
from time import monotonic
from http import HTTPStatus

from aiohttp import web
from homeassistant.components.http import KEY_HASS
from homeassistant.components.http.view import HomeAssistantView
from homeassistant.exceptions import HomeAssistantError

from .voice_consume import async_voice_consume_apply, async_voice_consume_preview
from .voice_transcribe import async_transcribe_voice

_LOGGER = logging.getLogger(__name__)
TRANSCRIBE_TIMEOUT = 20
PREVIEW_TIMEOUT = 35


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

        if not isinstance(data, dict):
            return self.json_message("Il JSON deve essere un oggetto", status_code=HTTPStatus.BAD_REQUEST)

        action = str(data.get("action") or "preview").strip().lower()
        kind = str(data.get("kind") or "food").strip().lower()
        started = monotonic()
        try:
            if action == "transcribe":
                async with asyncio.timeout(TRANSCRIBE_TIMEOUT):
                    result = await async_transcribe_voice(
                        hass,
                        str(data.get("audio_data") or ""),
                        str(data.get("mime_type") or ""),
                    )
                return self.json(result)
            if action == "preview":
                async with asyncio.timeout(PREVIEW_TIMEOUT):
                    result = await async_voice_consume_preview(hass, str(data.get("text") or ""), kind)
                return self.json(result)
            if action == "apply":
                operations = data.get("operations")
                if not isinstance(operations, list):
                    return self.json_message("Operazioni mancanti", status_code=HTTPStatus.BAD_REQUEST)
                result = await async_voice_consume_apply(hass, operations, kind)
                return self.json(result)
        except TimeoutError:
            _LOGGER.warning("Voice action=%s application timeout after %.1fs", action, monotonic() - started)
            return self.json({
                "success": False,
                "code": "voice_timeout",
                "message": "Tempo disponibile esaurito. Scrivi o usa la dettatura della tastiera; riprova con un prodotto alla volta.",
            })
        except HomeAssistantError as err:
            return self.json_message(str(err), status_code=HTTPStatus.BAD_REQUEST)
        finally:
            _LOGGER.debug("Voice action=%s completed in %.3fs", action, monotonic() - started)

        return self.json_message("Azione non valida", status_code=HTTPStatus.BAD_REQUEST)
