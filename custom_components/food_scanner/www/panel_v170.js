import './panel_v169.js?v=1.6.23-base';

const HomeStockPanel = customElements.get('food-scanner-panel');

if (HomeStockPanel) {
  HomeStockPanel.prototype.foodFile = async function(f) {
    const s = this._foodScan;
    if (!s?.location) return;
    s.status = 'loading';
    s.message = 'Analisi in corso…';
    this.render();
    try {
      const d = await this.fileData(f);
      const o = await this._hass.callApi('POST', 'food_scanner/dashboard_scan', {
        location: s.location,
        mime_type: d.mime,
        image_data: d.raw,
        review_id: s.reviewId || null,
      });
      if (o?.success === false) throw new Error(o.error || o.message || 'Errore scansione HomeStock');
      if (o?.status === 'archived') {
        s.status = 'success';
        s.reviewId = null;
        s.message = `✓ ${o.product_name || 'Prodotto'} aggiunto.`;
      } else if (o?.status === 'review' || o?.review_id) {
        s.status = 'review';
        s.reviewId = o.review_id || null;
        s.message = o.photo_request || o.message || 'Serve un’altra foto dello stesso prodotto.';
      } else {
        throw new Error(`Risposta scansione inattesa: ${this.scanErrorText169?.(o) || JSON.stringify(o)}`);
      }
      await this.load();
    } catch (e) {
      s.status = 'error';
      s.message = this.scanErrorText169?.(e) || e?.message || String(e);
      this.render();
    }
  };

  HomeStockPanel.prototype.geminiFile = async function(f) {
    const s = this._consScan;
    if (!s) return;
    s.status = 'gemini_loading';
    s.message = 'Riconoscimento con Gemini…';
    this.render();
    try {
      const d = await this.fileData(f);
      const o = await this.consPostNoReload({action:'scan_preview',location:s.location,mime_type:d.mime,image_data:d.raw});
      if (o?.success === false) throw new Error(o.error || o.message || 'Errore scansione consumabile');
      if (!o?.detected || typeof o.detected !== 'object') throw new Error(`Prodotto non riconosciuto: ${this.scanErrorText169?.(o) || JSON.stringify(o)}`);
      s.detected = o.detected;
      s.status = 'preview';
      s.message = 'Controlla i dati prima di aggiungere.';
      this.render();
    } catch (e) {
      s.status = 'fallback';
      s.message = this.scanErrorText169?.(e) || e?.message || String(e);
      this.render();
    }
  };

  const prevRender170 = HomeStockPanel.prototype.render;
  HomeStockPanel.prototype.render = function() {
    prevRender170.call(this);
    const version = this.shadowRoot?.querySelector('.hsVersion165 b');
    if (version) version.textContent = 'v1.6.23';
  };
}
