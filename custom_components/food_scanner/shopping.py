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

    async def async_add(
        self,
        name: str,
        kind: str | None = None,
        source_key: str | None = None,
        purchase_store: str | None = None,
    ) -> dict:
        name = " ".join(str(name or "").split()).strip()
        if not name:
            raise ValueError("Inserisci il nome del prodotto.")
        kind = str(kind or "").strip().lower() or None
        source_key = str(source_key or "").strip() or None
        purchase_store = " ".join(str(purchase_store or "").split()).strip() or None
        async with self._lock:
            existing = next(
                (
                    x for x in self._items
                    if not x.get("checked") and (
                        (source_key and str(x.get("source_key") or "") == source_key)
                        or (
                            not source_key
                            and str(x.get("name") or "").casefold() == name.casefold()
                            and str(x.get("kind") or "") == str(kind or "")
                        )
                    )
                ),
                None,
            )
            if existing is not None:
                if purchase_store and not existing.get("purchase_store"):
                    existing["purchase_store"] = purchase_store
                    await self._save()
                return dict(existing)
            item = {
                "id": uuid.uuid4().hex,
                "name": name,
                "kind": kind,
                "source_key": source_key,
                "purchase_store": purchase_store,
                "checked": False,
                "created_at": dt_util.utcnow().isoformat(),
            }
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
