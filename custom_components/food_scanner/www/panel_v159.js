import './panel_v158.js?v=1.6.11-base';

const HomeStockPanel = customElements.get('food-scanner-panel');

if (HomeStockPanel) {
  const originalOpenFoodManualComplete159 = HomeStockPanel.prototype.openFoodManualComplete;
  HomeStockPanel.prototype.openFoodManualComplete = function() {
    originalOpenFoodManualComplete159.call(this);
    const root = this.shadowRoot;
    const s = this._foodScan;
    const overlay = root?.querySelector('#foodManualCompleteOverlay');
    if (!root || !overlay || !s?.reviewId || overlay.querySelector('#fmcDelete')) return;

    const actions = overlay.querySelector('.modalActions');
    if (!actions) return;

    const deleteBtn = document.createElement('button');
    deleteBtn.id = 'fmcDelete';
    deleteBtn.type = 'button';
    deleteBtn.className = 'fmcDelete';
    deleteBtn.textContent = 'Elimina prodotto';
    actions.insertBefore(deleteBtn, actions.firstChild);

    deleteBtn.addEventListener('click', async () => {
      const review = (this._reviews || []).find(x => x.id === s.reviewId);
      const name = review?.food?.product_name || 'questo prodotto';
      if (!confirm(`Eliminare ${name} dalla lista Da completare?`)) return;

      deleteBtn.disabled = true;
      deleteBtn.textContent = 'Eliminazione…';
      try {
        await this._hass.callApi('POST', 'food_scanner/dashboard_scan', {
          action: 'delete_review',
          review_id: s.reviewId,
        });
        overlay.remove();
        this._foodScan = null;
        await this.load();
      } catch (e) {
        alert(e?.message || String(e));
        deleteBtn.disabled = false;
        deleteBtn.textContent = 'Elimina prodotto';
      }
    });

    if (!root.querySelector('#homeStockDeleteReview1611')) {
      const style = document.createElement('style');
      style.id = 'homeStockDeleteReview1611';
      style.textContent = `
        .foodManualCompleteModal .modalActions{display:grid;grid-template-columns:1fr 1fr 1.2fr;gap:8px}
        .fmcDelete{border:1px solid rgba(239,68,68,.32)!important;background:rgba(239,68,68,.1)!important;color:#fca5a5!important;font-weight:800!important;border-radius:12px!important}
        .fmcDelete:hover{background:rgba(239,68,68,.16)!important}
        @media(max-width:760px){.foodManualCompleteModal .modalActions{grid-template-columns:1fr 1fr}.fmcDelete{grid-column:1/-1;grid-row:2}}
      `;
      root.appendChild(style);
    }
  };
}
