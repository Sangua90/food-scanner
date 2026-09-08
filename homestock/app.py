from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timezone
from pathlib import Path

from aiohttp import web

VERSION = "2.0.0-alpha.1"
ENGINE_NAME = "HomeStock Engine"
CONFIG_DIR = Path("/config")
STATE_FILE = CONFIG_DIR / "engine_state.json"


def _log_level() -> int:
    raw = os.environ.get("HOMESTOCK_LOG_LEVEL", "info").upper()
    return getattr(logging, raw, logging.INFO)


logging.basicConfig(
    level=_log_level(),
    format="%(asctime)s %(levelname)s homestock-engine: %(message)s",
)
LOGGER = logging.getLogger("homestock-engine")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _load_state() -> dict:
    try:
        if STATE_FILE.exists():
            data = json.loads(STATE_FILE.read_text(encoding="utf-8"))
            if isinstance(data, dict):
                return data
    except Exception as err:
        LOGGER.warning("Could not load state: %s", err)
    return {}


def _save_state(data: dict) -> None:
    try:
        CONFIG_DIR.mkdir(parents=True, exist_ok=True)
        STATE_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    except Exception as err:
        LOGGER.warning("Could not save state: %s", err)


STATE = _load_state()
STATE["last_start"] = _now()
STATE["version"] = VERSION
_save_state(STATE)


async def health(_: web.Request) -> web.Response:
    return web.json_response({
        "ok": True,
        "name": ENGINE_NAME,
        "version": VERSION,
        "started_at": STATE.get("last_start"),
    })


async def capabilities(_: web.Request) -> web.Response:
    return web.json_response({
        "ok": True,
        "version": VERSION,
        "capabilities": {
            "image_analysis": False,
            "audio_transcription": False,
            "voice_intent_parser": False,
            "background_jobs": False,
            "diagnostics": True,
        },
        "migration_phase": "bridge",
        "inventory_owner": "home_assistant_integration",
    })


async def diagnostics(_: web.Request) -> web.Response:
    return web.json_response({
        "engine": ENGINE_NAME,
        "version": VERSION,
        "state": STATE,
        "config_path": str(CONFIG_DIR),
        "status": "ready",
    })


async def index(_: web.Request) -> web.Response:
    html = f"""<!doctype html>
<html lang='it'>
<head>
<meta charset='utf-8'>
<meta name='viewport' content='width=device-width,initial-scale=1'>
<title>HomeStock Engine</title>
<style>
body{{margin:0;background:#07111d;color:#eef6ff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}}
main{{max-width:720px;margin:0 auto;padding:36px 22px}}
.card{{background:linear-gradient(145deg,#102238,#0a1522);border:1px solid #284663;border-radius:24px;padding:24px;box-shadow:0 18px 60px #0007}}
h1{{margin:0 0 8px;font-size:30px}}p{{color:#9fb3c8;line-height:1.5}}.pill{{display:inline-block;margin-top:14px;padding:7px 11px;border-radius:999px;background:#0c3d67;color:#7fc8ff;font-weight:700;font-size:12px}}
.grid{{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:20px}}.box{{background:#0a1725;border:1px solid #1f354b;border-radius:16px;padding:14px}}.box b{{display:block;font-size:13px}}.box span{{display:block;color:#7f93a8;font-size:11px;margin-top:5px}}
</style>
</head><body><main><div class='card'><h1>HomeStock Engine</h1><p>Il motore 2.0 è attivo. In questa prima fase resta separato dall'inventario stabile e viene usato per preparare la migrazione delle elaborazioni pesanti.</p><span class='pill'>v{VERSION} · bridge ready</span><div class='grid'><div class='box'><b>Inventario</b><span>Resta nell'integrazione Home Assistant</span></div><div class='box'><b>Diagnostica</b><span>Motore disponibile</span></div><div class='box'><b>Foto / AI</b><span>Migrazione successiva</span></div><div class='box'><b>Audio</b><span>Migrazione successiva</span></div></div></div></main></body></html>"""
    return web.Response(text=html, content_type="text/html")


app = web.Application(client_max_size=12 * 1024 * 1024)
app.router.add_get("/", index)
app.router.add_get("/health", health)
app.router.add_get("/v1/capabilities", capabilities)
app.router.add_get("/v1/diagnostics", diagnostics)

if __name__ == "__main__":
    LOGGER.info("Starting %s %s on port 8099", ENGINE_NAME, VERSION)
    web.run_app(app, host="0.0.0.0", port=8099, print=None)
