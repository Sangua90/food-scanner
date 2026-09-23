"""Voice regressions with real aiohttp HTTP responses and a minimal HA boundary.

Run: python -m unittest discover -s tests -v (requires aiohttp).
No Home Assistant installation or external Gemini account is needed.
"""
import asyncio
import base64
import importlib
import json
from pathlib import Path
import sys
from types import ModuleType, SimpleNamespace
import unittest
from unittest.mock import AsyncMock, patch

from aiohttp import web
from aiohttp.test_utils import TestClient, TestServer

ROOT = Path(__file__).resolve().parents[1]


def module(name, **attrs):
    value = ModuleType(name)
    value.__dict__.update(attrs)
    sys.modules[name] = value
    return value


class HomeAssistantError(Exception):
    pass


class View:
    def json(self, data, status_code=200):
        return web.json_response(data, status=status_code)

    def json_message(self, message, status_code=200):
        return self.json({"message": message}, status_code)


# Import the real voice modules without executing integration setup.
module("homeassistant", __path__=[])
module("homeassistant.core", HomeAssistant=object)
module("homeassistant.exceptions", HomeAssistantError=HomeAssistantError)
module("homeassistant.components", __path__=[])
module("homeassistant.components.http", KEY_HASS="hass")
module("homeassistant.components.http.view", HomeAssistantView=View)
module("homeassistant.helpers", __path__=[])
module("homeassistant.helpers.aiohttp_client", async_get_clientsession=lambda hass: hass.session)
module("custom_components", __path__=[str(ROOT / "custom_components")])
PACKAGE = "custom_components.food_scanner"
module(PACKAGE, __path__=[str(ROOT / "custom_components/food_scanner")])
module(PACKAGE + ".archive", get_archive=lambda hass: hass.store)
module(PACKAGE + ".consumables", get_consumables=lambda hass: hass.store)
voice = importlib.import_module(PACKAGE + ".voice_consume")
api = importlib.import_module(PACKAGE + ".voice_consume_api")
transcribe = importlib.import_module(PACKAGE + ".voice_transcribe")
engine = importlib.import_module(PACKAGE + ".engine_client")
compat = importlib.import_module(PACKAGE + ".gemini_compat")


class VoiceTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.items = [
            {"id": "pizza", "product_name": "Pizza", "stock_units": 5},
            {"id": "tonno", "product_name": "Tonno", "brand": "Migros", "stock_units": 3},
        ]
        self.store = SimpleNamespace(items_sorted=lambda **kw: self.items, items=lambda: self.items)
        self.hass = SimpleNamespace(data={"food_scanner": {"entry": SimpleNamespace(data={"api_key": "test"}, options={})}}, store=self.store)
        app = web.Application()
        app["hass"] = self.hass
        app.router.add_post(api.HomeStockVoiceConsumeView.url, api.HomeStockVoiceConsumeView().post)
        self.client = TestClient(TestServer(app))
        await self.client.start_server()

    async def asyncTearDown(self):
        await self.client.close()

    async def post(self, data):
        response = await self.client.post(api.HomeStockVoiceConsumeView.url, json=data)
        return response.status, await response.json()

    async def test_multiple_products_are_local_without_network(self):
        with patch.object(voice, "_gemini_parse", AsyncMock(side_effect=AssertionError("network called"))):
            for text in ["Una pizza e due scatolette di tonno Migros", "pizza, tonno Migros", "pizza; poi tonno Migros"]:
                status, out = await self.post({"text": text})
                self.assertEqual(status, 200)
                self.assertEqual([op["id"] for op in out["operations"]], ["pizza", "tonno"])
            self.assertEqual(self.hass.data[voice.RUNTIME_KEY]["last_ai_backend"], "local_fast_match")

    async def test_partial_match_never_calls_ai(self):
        with patch.object(voice, "_gemini_parse", AsyncMock(side_effect=AssertionError("network called"))):
            status, out = await self.post({"text": "pizza e prodotto sconosciuto"})
        self.assertEqual(status, 200)
        self.assertEqual(out["matched_count"], 1)
        self.assertEqual(out["unresolved_count"], 1)
        self.assertTrue(out["can_confirm"])

    async def test_quantities_and_consume_all(self):
        _, out = await self.post({"text": "due pizza e finito tonno Migros", "kind": "cons"})
        self.assertEqual([op["amount"] for op in out["operations"]], [2, 3])
        self.assertEqual(out["kind"], "cons")

    async def test_unknown_calls_ai(self):
        mock = AsyncMock(return_value={"requests": []})
        with patch.object(voice, "_gemini_parse", mock):
            status, _ = await self.post({"text": "sconosciuto"})
        self.assertEqual(status, 200)
        mock.assert_awaited_once()

    async def test_preview_timeout_is_json_not_gateway(self):
        async def stalled(*args):
            await asyncio.sleep(5)
        with patch.object(voice, "_gemini_parse", stalled), patch.object(api, "PREVIEW_TIMEOUT", .01):
            status, out = await self.post({"text": "sconosciuto"})
        self.assertEqual(status, 200)
        self.assertEqual(out["code"], "voice_timeout")

    async def test_all_model_attempts_share_one_budget(self):
        async def slow_error(*args):
            await asyncio.sleep(.015)
            raise HomeAssistantError("model unavailable")
        calls = AsyncMock(side_effect=slow_error)
        with patch.object(voice, "VOICE_AI_TIMEOUT", .025), patch.object(voice, "async_engine_gemini_json", AsyncMock(return_value=None)), patch.object(voice, "_candidate_models", AsyncMock(return_value=["one", "two", "three"])), patch.object(voice, "_call_voice_model", calls):
            status, out = await self.post({"text": "sconosciuto"})
        self.assertEqual(status, 200)
        self.assertEqual(out["code"], "voice_timeout")
        self.assertLessEqual(calls.await_count, 2)

    async def test_transcription_total_budget_cancels_provider(self):
        cancelled = asyncio.Event()
        async def stalled(*args):
            try:
                await asyncio.sleep(5)
            finally:
                cancelled.set()
        with patch.object(transcribe, "async_engine_transcribe", AsyncMock(return_value=None)), patch.object(transcribe, "_candidate_models", AsyncMock(return_value=["test"])), patch.object(transcribe, "_call_transcribe_model", stalled), patch.object(api, "TRANSCRIBE_TIMEOUT", .01):
            status, out = await self.post({"action": "transcribe", "audio_data": "YQ==", "mime_type": "audio/mp4"})
        self.assertEqual(status, 200)
        self.assertEqual(out["code"], "voice_timeout")
        self.assertTrue(cancelled.is_set())

    async def test_engine_budget_includes_discovery(self):
        async def stalled(*args):
            await asyncio.sleep(5)
        with patch.object(engine, "_healthy_hostname", stalled):
            self.assertIsNone(await engine.async_engine_gemini_json(self.hass, api_key="test", prompt="test", models=["test"], timeout=.01))
            self.assertIsNone(await engine.async_engine_transcribe(self.hass, api_key="test", audio_data="YQ==", mime_type="audio/mp4", timeout=.01))

    async def test_outer_cancellation_is_not_swallowed_by_engine(self):
        async def stalled(*args):
            await asyncio.sleep(5)
        with patch.object(engine, "_healthy_hostname", stalled):
            with self.assertRaises(TimeoutError):
                async with asyncio.timeout(.01):
                    await engine.async_engine_transcribe(self.hass, api_key="test", audio_data="YQ==", mime_type="audio/mp4", timeout=1)

    async def test_discovery_timeout_has_candidates(self):
        entry = next(iter(self.hass.data["food_scanner"].values()))
        with patch.object(compat, "_list_flash_models", AsyncMock(side_effect=TimeoutError)):
            self.assertTrue(await compat._candidate_models(self.hass, entry, "test", discovery_timeout=.01))

    async def test_manual_model_is_respected(self):
        entry = next(iter(self.hass.data["food_scanner"].values()))
        entry.options = {"model_mode": "manual", "model": "chosen-model"}
        mock = AsyncMock(return_value=({"requests": []}, "chosen-model"))
        with patch.object(voice, "async_engine_gemini_json", mock):
            await voice._gemini_parse(self.hass, "sconosciuto", [], "food")
        self.assertEqual(mock.call_args.kwargs["models"], ["chosen-model"])

    async def test_audio_payload_reaches_engine_with_normalized_mime(self):
        for mime in ["audio/mp4;codecs=mp4a.40.2", "audio/webm;codecs=opus"]:
            mock = AsyncMock(return_value={"success": True, "text": "pizza"})
            with patch.object(transcribe, "async_engine_transcribe", mock):
                status, out = await self.post({"action": "transcribe", "audio_data": "YQ==", "mime_type": mime})
            self.assertEqual(status, 200)
            self.assertEqual(out["text"], "pizza")
            self.assertEqual(mock.call_args.kwargs["mime_type"], mime.split(";")[0])
            self.assertEqual(mock.call_args.kwargs["audio_data"], "YQ==")

    async def test_invalid_audio_and_json_are_client_errors(self):
        for data in [[], None, {"action": "transcribe", "mime_type": "audio/mp4", "audio_data": "!bad"}, {"action": "transcribe", "mime_type": "video/mp4", "audio_data": "YQ=="}, {"action": "transcribe", "mime_type": "audio/mp4", "audio_data": ""}]:
            status, _ = await self.post(data)
            self.assertEqual(status, 400)

    async def test_size_limit_checked_before_decode(self):
        with patch.object(transcribe, "MAX_AUDIO_BYTES", 2):
            with self.assertRaises(HomeAssistantError):
                transcribe.decode_audio(base64.b64encode(b"large").decode(), "audio/mp4")

    async def test_duplicate_operations_do_not_overconsume(self):
        self.store.async_consume = AsyncMock(return_value={"stock_units": 1})
        operations = [{"id": "pizza", "amount": 4}, {"id": "pizza", "amount": 4}]
        out = await voice.async_voice_consume_apply(self.hass, operations)
        self.assertEqual(out["applied_count"], 1)
        self.assertEqual(out["skipped_count"], 1)
        self.store.async_consume.assert_awaited_once_with("pizza", 4)


if __name__ == "__main__":
    unittest.main()
