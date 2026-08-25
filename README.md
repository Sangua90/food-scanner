# Food Scanner for Home Assistant

Custom integration for Home Assistant that analyzes food-package photos with Google Gemini and extracts product name, brand, quantity, barcode and expiry date/TMC.

## Current status

Early test version. The integration currently analyzes an image already available on the Home Assistant filesystem via `food_scanner.scan_image`.

## HACS installation

1. Open HACS.
2. Go to Integrations.
3. Open the menu and choose **Custom repositories**.
4. Add `https://github.com/Sangua90/food-scanner` as an **Integration**.
5. Install **Food Scanner**.
6. Restart Home Assistant.
7. Go to **Settings → Devices & services → Add integration → Food Scanner**.
8. Enter your Gemini API key.

## Configuration

The Gemini model can be changed later from **Food Scanner → Configure** without deleting the integration or re-entering the API key.

Default model: `gemini-3.5-flash-lite`.

## Test action

```yaml
action: food_scanner.scan_image
data:
  image_path: /config/www/test_alimento.png
  notify: true
```

The latest result is exposed as `sensor.food_scanner_last_result`.

## Roadmap

- direct iPhone Shortcut upload
- persistent pantry/fridge database
- expiry notifications
- barcode lookup
- dashboard helpers
