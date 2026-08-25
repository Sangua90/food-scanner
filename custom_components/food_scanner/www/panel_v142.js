import './panel_v140.js?v=1.4.2-base';

const HomeStockPanel = customElements.get('food-scanner-panel');

if (HomeStockPanel) {
  HomeStockPanel.prototype.openConsScan = function() {
    this._consScan = {
      location: this._consLocation || 'magazzino',
      status: 'barcode',
      message: 'Scatta una foto del prodotto. HomeStock userà Gemini e, se legge il barcode, completerà i dati dal database.',
      detected: null,
      barcode: null,
    };
    this.render();
  };

  HomeStockPanel.prototype.barcodeFile = async function(file) {
    const s = this._consScan;
    if (!s) return;
    s.status = 'gemini_loading';
    s.message = 'Riconoscimento prodotto in corso…';
    this.render();
    try {
      const d = await this.fileData(file);
      const o = await this.consPostNoReload({
        action: 'scan_preview',
        location: s.location,
        mime_type: d.mime,
        image_data: d.raw,
      });
      s.detected = o.detected;
      s.barcode = o.detected?.barcode || null;
      s.status = 'preview';
      s.message = s.barcode
        ? 'Prodotto riconosciuto. Barcode letto e database consultato quando disponibile.'
        : 'Prodotto riconosciuto con Gemini. Controlla i dati prima di aggiungere.';
      this.render();
    } catch (e) {
      s.status = 'fallback';
      s.message = e?.message || String(e);
      this.render();
    }
  };

  const originalDialog = HomeStockPanel.prototype.consScanDialog;
  HomeStockPanel.prototype.consScanDialog = function() {
    let html = originalDialog.call(this);
    html = html
      .replace('▥ Foto barcode', '📷 Foto prodotto')
      .replace('Lettura barcode…', 'Analisi del prodotto…')
      .replace('▥ Riprova barcode', '📷 Riprova foto')
      .replace('✨ Seconda foto con Gemini', '✨ Riprova con Gemini');
    return html;
  };
}
