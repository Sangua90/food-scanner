from __future__ import annotations

import asyncio
import uuid
from homeassistant.core import HomeAssistant
from homeassistant.helpers.storage import Store
from homeassistant.util import dt as dt_util

STORAGE_VERSION = 1
STORAGE_KEY = "food_scanner.shopping"
RUNTIME_KEY = "food_scanner_runtime"


class ShoppingStore:
    def __init__(self, hass: HomeAssistant) -> None:
        self.hass = hass
        self.store = Store(hass, STORAGE_VERSION, STORAGE_KEY)
        self._items: list[dict] = []
        self._lock = asyncio.Lock()

    async def async_load(self) -> None:
        data = await self.store.async_load()
        self._items = [dict(x) for x in (data.get("items", []) if isinstance(data, dict) else []) if isinstance(x, dict)]

    async def _save(self) -> None:
        await self.store.async_save({"items": self._items})

    def items(self) -> list[dict]:
        return [dict(x) for x in self._items]

    async def async_add(self, name: str) -> dict:
        name = " ".join(str(name or "").split()).strip()
        if not name:
            raise ValueError("Inserisci il nome del prodotto.")
        item = {"id": uuid.uuid4().hex, "name": name, "checked": False, "created_at": dt_util.utcnow().isoformat()}
        async with self._lock:
            self._items.append(item)
            await self._save()
        return dict(item)

    async def async_toggle(self, item_id: str) -> dict | None:
        async with self._lock:
            item = next((x for x in self._items if x.get("id") == item_id), None)
            if item is None:
                return None
            item["checked"] = not bool(item.get("checked"))
            await self._save()
            return dict(item)

    async def async_remove(self, item_id: str) -> bool:
        async with self._lock:
            before = len(self._items)
            self._items = [x for x in self._items if x.get("id") != item_id]
            if len(self._items) == before:
                return False
            await self._save()
            return True

    async def async_clear_checked(self) -> int:
        async with self._lock:
            before = len(self._items)
            self._items = [x for x in self._items if not x.get("checked")]
            removed = before - len(self._items)
            if removed:
                await self._save()
            return removed


def get_shopping(hass: HomeAssistant) -> ShoppingStore:
    runtime = hass.data.setdefault(RUNTIME_KEY, {})
    store = runtime.get("shopping_store")
    if store is None:
        store = ShoppingStore(hass)
        runtime["shopping_store"] = store
    return store
