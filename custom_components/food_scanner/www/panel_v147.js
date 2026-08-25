import './panel_v146.js?v=1.4.7-base';

const HomeStockPanel = customElements.get('food-scanner-panel');

if (HomeStockPanel) {
  const originalOpenFoodScan147 = HomeStockPanel.prototype.openFoodScan;
  HomeStockPanel.prototype.openFoodScan = function() {
    originalOpenFoodScan147.call(this);
    if (this._foodScan) {
      this._foodScan.photoButtonLabel = 'Scatta foto';
      this._foodScan.photoTarget = null;
      this._foodScan.photoReason = null;
      this._foodScan.photoInstruction = null;
    }
    this.render();
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
      if (o.status === 'archived') {
        s.status = 'success';
        s.reviewId = null;
        s.photoButtonLabel = 'Scatta foto';
        s.photoTarget = null;
        s.photoReason = null;
        s.photoInstruction = null;
        s.message = '✓ ' + (o.product_name || 'Prodotto') + ' aggiunto.';
      } else {
        s.status = 'review';
        s.reviewId = o.review_id;
        s.photoTarget = o.photo_target || 'details';
        s.photoReason = o.photo_reason || null;
        s.photoInstruction = o.photo_instruction || null;
        s.photoButtonLabel = o.photo_button_label || 'Seconda foto';
        s.message = o.photo_request || 'Manca un dato necessario. Fotografa più da vicino la parte della confezione non leggibile.';
      }
      await this.load();
    } catch (e) {
      s.status = 'error';
      s.message = e?.message || String(e);
      this.render();
    }
  };

  const originalFoodScanDialog147 = HomeStockPanel.prototype.foodScanDialog;
  HomeStockPanel.prototype.foodScanDialog = function() {
    let html = originalFoodScanDialog147.call(this);
    const s = this._foodScan;
    if (!s) return html;

    if (s.status === 'review') {
      const label = this.esc(s.photoButtonLabel || 'Seconda foto');
      html = html.replace('📷 Rifai foto', `📷 ${label}`);
      html = html.replace(
        `<p>${this.esc(s.message || '')}</p>`,
        `<div style="margin:12px 0;padding:14px;border-radius:16px;background:#211b0d;border:1px solid #6b541f"><div style="font-weight:800;color:#fde68a;margin-bottom:7px">Perché serve un'altra foto?</div><div style="color:#fff;line-height:1.45">${this.esc(s.photoReason || s.message || '')}</div>${s.photoInstruction ? `<div style="margin-top:8px;color:#cbd5e1;line-height:1.45"><b>Cosa fotografare:</b> ${this.esc(s.photoInstruction)}</div>` : ''}</div>`
      );
    }
    return html;
  };

  const originalBind147 = HomeStockPanel.prototype.bind;
  HomeStockPanel.prototype.bind = function() {
    originalBind147.call(this);
    const r = this.shadowRoot;
    r.querySelector('#foodNext')?.addEventListener('click', () => {
      if (!this._foodScan) return;
      this._foodScan.photoButtonLabel = 'Scatta foto';
      this._foodScan.photoTarget = null;
      this._foodScan.photoReason = null;
      this._foodScan.photoInstruction = null;
    });
  };
}
