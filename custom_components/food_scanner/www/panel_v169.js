import './panel_v168.js?v=1.6.22-base';

const HomeStockPanel = customElements.get('food-scanner-panel');

if (HomeStockPanel) {
  HomeStockPanel.prototype.scanErrorText169 = function(value, depth = 0) {
    if (value === null || value === undefined) return 'Errore sconosciuto';
    if (typeof value === 'string') return value.trim() || 'Errore sconosciuto';
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    if (depth > 4) {
      try { return JSON.stringify(value); } catch (_) { return String(value); }
    }
    if (Array.isArray(value)) {
      const parts = value.map(v => this.scanErrorText169(v, depth + 1)).filter(Boolean);
      return parts.join(' · ') || 'Errore sconosciuto';
    }
    if (typeof value === 'object') {
      for (const key of ['message','error','detail','body','response','data','description','reason','code','statusText']) {
        if (Object.prototype.hasOwnProperty.call(value, key) && value[key] !== value) {
          const text = this.scanErrorText169(value[key], depth + 1);
          if (text && text !== 'Errore sconosciuto' && text !== '[object Object]') return text;
        }
      }
      try {
        const json = JSON.stringify(value);
        if (json && json !== '{}' && json !== '[]') return json;
      } catch (_) {}
    }
    const fallback = String(value);
    return fallback === '[object Object]' ? 'Errore API Home Assistant senza messaggio testuale' : fallback;
  };

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
      if (!o || typeof o !== 'object') throw new Error(`Risposta scansione non valida: ${this.scanErrorText169(o)}`);
      if (o.status === 'archived') {
        s.status = 'success'; s.reviewId = null;
        s.message = `✓ ${this.scanErrorText169(o.product_name || 'Prodotto')} aggiunto.`;
      } else if (o.status === 'review' || o.review_id) {
        s.status = 'review'; s.reviewId = o.review_id || null;
        s.message = this.scanErrorText169(o.photo_request || o.message || 'Serve un’altra foto dello stesso prodotto.');
      } else {
        throw new Error(`Risposta inattesa dalla scansione: ${this.scanErrorText169(o)}`);
      }
      await this.load();
    } catch (e) {
      s.status = 'error';
      s.message = this.scanErrorText169(e);
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
      if (!o || typeof o !== 'object') throw new Error(`Risposta consumabili non valida: ${this.scanErrorText169(o)}`);
      if (!o.detected || typeof o.detected !== 'object') throw new Error(`Prodotto non riconosciuto: ${this.scanErrorText169(o)}`);
      s.detected = o.detected;
      s.status = 'preview';
      s.message = 'Controlla i dati prima di aggiungere.';
      this.render();
    } catch (e) {
      s.status = 'fallback';
      s.message = this.scanErrorText169(e);
      this.render();
    }
  };

  const prevRender169 = HomeStockPanel.prototype.render;
  HomeStockPanel.prototype.render = function() {
    prevRender169.call(this);
    const version = this.shadowRoot?.querySelector('.hsVersion165 b');
    if (version) version.textContent = 'v1.6.22';
  };
}
