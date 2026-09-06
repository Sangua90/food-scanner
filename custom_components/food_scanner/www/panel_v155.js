import './panel_v154.js?v=1.6.7-base';

const HomeStockPanel = customElements.get('food-scanner-panel');

if (HomeStockPanel) {
  HomeStockPanel.prototype.skipFoodExpiry = async function() {
    const s = this._foodScan;
    if (!s?.reviewId) return;
    s.status = 'loading';
    s.message = 'Salvataggio senza scadenza…';
    this.render();
    try {
      const o = await this._hass.callApi('POST', 'food_scanner/dashboard_scan', {
        action: 'skip_expiry',
        review_id: s.reviewId,
        location: s.location,
      });
      s.status = 'success';
      s.reviewId = null;
      s.photoButtonLabel = 'Scatta foto';
      s.photoTarget = null;
      s.photoReason = null;
      s.photoInstruction = null;
      s.message = '✓ ' + (o.product_name || 'Prodotto') + ' aggiunto senza scadenza.';
      await this.load();
    } catch (e) {
      s.status = 'review';
      s.message = e?.message || String(e);
      this.render();
    }
  };

  const originalRender155 = HomeStockPanel.prototype.render;
  HomeStockPanel.prototype.render = function() {
    originalRender155.call(this);
    const root = this.shadowRoot;
    const s = this._foodScan;
    if (!root || !s || s.status !== 'review' || s.photoTarget !== 'expiry') return;
    if (root.querySelector('#skipFoodExpiry')) return;

    const hint = root.querySelector('.foodScanModal .scanHint');
    const photoButton = root.querySelector('.foodScanModal #foodPhoto');
    const anchor = hint || photoButton;
    if (!anchor) return;

    const wrap = document.createElement('div');
    wrap.className = 'skipExpiryWrap';
    wrap.innerHTML = `
      <button id="skipFoodExpiry" type="button" class="skipExpiryButton">Salva senza scadenza</button>
      <small>Usa questa opzione se sulla confezione non è presente una data leggibile.</small>
    `;
    anchor.insertAdjacentElement('afterend', wrap);
    root.querySelector('#skipFoodExpiry')?.addEventListener('click', () => this.skipFoodExpiry());

    if (!root.querySelector('#homeStockSkipExpiry167')) {
      const style = document.createElement('style');
      style.id = 'homeStockSkipExpiry167';
      style.textContent = `
        .skipExpiryWrap{margin-top:10px;padding:11px 12px;border-radius:15px;background:rgba(255,255,255,.025);border:1px solid rgba(255,255,255,.07)}
        .skipExpiryButton{width:100%;min-height:43px;border-radius:13px!important;border:1px solid rgba(255,255,255,.12)!important;background:#171b23!important;color:#e7eaf0!important;font-weight:750!important}
        .skipExpiryWrap small{display:block;margin-top:7px;color:#8f98aa!important;font-size:11px!important;line-height:1.35}
      `;
      root.appendChild(style);
    }
  };
}
