import "/food_scanner_static/panel_v110.js?v=1.1.0";

const Panel = customElements.get("food-scanner-panel");
if (Panel) {
  Panel.prototype._download = async function(format) {
    try {
      const data = await this._hass.callApi(
        "GET",
        `food_scanner/export_data?format=${encodeURIComponent(format)}`
      );
      const blob = new Blob([data.content], { type: data.mime || "application/octet-stream" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = data.filename || (format === "json" ? "food_scanner_backup.json" : "food_scanner_magazzino.csv");
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    } catch (err) {
      alert(`Esportazione fallita: ${err?.message || err}`);
    }
  };
}
