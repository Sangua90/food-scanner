# HomeStock development and maintenance

HomeStock is a Home Assistant custom integration. The public name is **HomeStock**, while the internal Home Assistant domain deliberately remains `food_scanner` for backward compatibility with existing config entries, services, entities and stored data.

## Architecture

- `custom_components/food_scanner/__init__.py` — setup, sidebar panel registration and runtime initialization.
- `archive.py` / `archive_api.py` — food inventory, lots, expiry dates, quantity corrections and dashboard API.
- `service.py` / `scan_api.py` — Gemini food recognition and food scan workflow.
- `review.py` — pending food scans requiring another photo.
- `expiry.py` — expiry notifications.
- `consumables.py` / `consumables_api.py` — household consumables, locations, thresholds, quantity history, barcode and Gemini fallback.
- `openfoodfacts.py` — Open Food Facts enrichment for food.
- `openproductsfacts.py` — Open Products Facts lookup for non-food products.
- `history.py` — persistent inventory history/statistics.
- `export_api.py` — CSV/JSON export.
- `diagnostics.py` — non-sensitive Home Assistant diagnostics.
- `www/panel_v*.js` — HomeStock sidebar UI. `PANEL_VERSION` in `__init__.py` must match the active frontend file/version to avoid stale browser cache.

## Persistent data

Storage is handled through Home Assistant `Store`. Never rename storage keys or the integration domain without an explicit migration. New fields should be added with safe defaults so existing installations continue to load.

Photos are processed transiently and are not intended to be stored as inventory data.

## Consumable scan flow

1. User selects a zone.
2. First photo is intended only for barcode recognition.
3. Home Assistant decodes the image server-side with `zxing-cpp`.
4. Barcode is queried against Open Products Facts.
5. If found, the UI shows a confirmation screen for name, quantity, unit and location.
6. If barcode cannot be read or the product is missing from the database, the user can take a second normal-quality photo for Gemini.
7. The product is stored only after user confirmation.

Do not make browser `BarcodeDetector` a required dependency: Safari/iOS support is inconsistent.

## Food scan flow

Food scans use Gemini because expiry/TMC is specific to the physical package. A scan is archived only when the required data is sufficiently reliable. Otherwise it enters the review queue and the next photo continues the same product.

## Compatibility rules

- Prefer public Home Assistant APIs.
- Avoid depending on undocumented frontend internals.
- Keep optional external-service failures isolated: Open Facts or Gemini failure must not prevent inventory pages from loading.
- CPU-heavy barcode decoding must run through `hass.async_add_executor_job`.
- Never expose the Gemini API key in diagnostics or logs.
- Changes to persistent structures require backward-compatible migration logic.
- Bump both `manifest.json` version and `PANEL_VERSION`/panel filename for frontend changes.

## Troubleshooting after a Home Assistant update

When reporting a future problem, provide:

1. Home Assistant Core version.
2. HomeStock version.
3. Exact error from **Settings → System → Logs**.
4. HomeStock diagnostics from the integration page when available.
5. What action caused the error (open dashboard, scan food, barcode, Gemini, consume, etc.).

With those items and this repository, a maintainer should be able to locate the affected module without needing the original ChatGPT conversation.

## Release checklist

Before publishing a release:

- update `manifest.json` version;
- update `PANEL_VERSION` and active panel filename if frontend changed;
- verify Python imports/setup;
- verify dashboard loads on desktop and Home Assistant Companion;
- test food scan success and review flow;
- test consumable barcode success, database miss and Gemini fallback;
- test quantity add/remove and location changes;
- ensure existing stored inventory is preserved;
- update `CHANGELOG.md`.
