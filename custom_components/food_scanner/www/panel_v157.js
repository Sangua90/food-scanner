import './panel_v156.js?v=1.6.9-base';

const HomeStockPanel = customElements.get('food-scanner-panel');

if (HomeStockPanel) {
  HomeStockPanel.prototype.openFoodManualComplete = function() {
    const s = this._foodScan;
    if (!s?.reviewId) return;
    const review = (this._reviews || []).find(x => x.id === s.reviewId);
    const food = review?.food || {};
    const root = this.shadowRoot;
    if (!root || root.querySelector('#foodManualCompleteOverlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'foodManualCompleteOverlay';
    overlay.className = 'overlay';
    overlay.innerHTML = `<div class="modal foodManualCompleteModal">
      <button class="close" id="fmcClose">×</button>
      <div class="scanHead">
        <div class="scanIcon">✎</div>
        <div><h2>Completa manualmente</h2><p>Correggi i dati letti da Gemini oppure lascia vuoto ciò che non è disponibile.</p></div>
      </div>

      <div class="fmcGrid">
        <label>Nome prodotto <span>*</span><input id="fmcName" type="text" value="${this.esc(food.product_name || '')}" placeholder="Nome prodotto"></label>
        <label>Marca<input id="fmcBrand" type="text" value="${this.esc(food.brand || '')}" placeholder="Facoltativa"></label>
        <label>Quantità / formato<input id="fmcQuantity" type="text" value="${this.esc(food.quantity || '')}" placeholder="Es. 500 g, 6 x 125 g"></label>
        <label>Barcode<input id="fmcBarcode" type="text" inputmode="numeric" value="${this.esc(food.barcode || '')}" placeholder="Facoltativo"></label>
        <label>Scadenza<input id="fmcExpiry" type="date" value="${this.esc(food.expiry_date || '')}"></label>
        <label>Tipo scadenza<select id="fmcExpiryType">
          <option value="" ${!food.expiry_type ? 'selected' : ''}>Nessuno</option>
          <option value="scadenza" ${food.expiry_type === 'scadenza' ? 'selected' : ''}>Scadenza</option>
          <option value="TMC" ${food.expiry_type === 'TMC' ? 'selected' : ''}>TMC</option>
        </select></label>
        <label>Unità per confezione<input id="fmcUnits" type="number" min="1" step="1" value="${Number(food.units_per_package || 1)}"></label>
        <label>Unità di misura<input id="fmcUnitName" type="text" value="${this.esc(food.unit_name || 'unità')}" placeholder="Es. vasetti, pezzi"></label>
        <label>Tipo confezione<input id="fmcPackage" type="text" value="${this.esc(food.package_type || 'confezione')}" placeholder="Es. vasetto, scatola"></label>
        <label>Categoria<input id="fmcCategory" type="text" value="${this.esc(food.category || 'Altro')}" placeholder="Categoria"></label>
      </div>

      <div class="fmcNote">Puoi salvare anche senza scadenza, barcode, marca o quantità commerciale. Il nome prodotto resta obbligatorio.</div>
      <div class="modalActions">
        <button id="fmcCancel">Annulla</button>
        <button id="fmcSave" class="primary">Salva prodotto</button>
      </div>
    </div>`;
    root.appendChild(overlay);

    const close = () => overlay.remove();
    root.querySelector('#fmcClose')?.addEventListener('click', close);
    root.querySelector('#fmcCancel')?.addEventListener('click', close);
    root.querySelector('#fmcSave')?.addEventListener('click', async () => {
      const name = root.querySelector('#fmcName')?.value?.trim();
      if (!name) {
        alert('Inserisci almeno il nome del prodotto.');
        return;
      }
      const btn = root.querySelector('#fmcSave');
      if (btn) { btn.disabled = true; btn.textContent = 'Salvataggio…'; }
      try {
        const o = await this._hass.callApi('POST', 'food_scanner/dashboard_scan', {
          action: 'complete_manual',
          review_id: s.reviewId,
          location: s.location,
          changes: {
            product_name: name,
            brand: root.querySelector('#fmcBrand')?.value || '',
            quantity: root.querySelector('#fmcQuantity')?.value || '',
            barcode: root.querySelector('#fmcBarcode')?.value || '',
            expiry_date: root.querySelector('#fmcExpiry')?.value || '',
            expiry_type: root.querySelector('#fmcExpiryType')?.value || '',
            units_per_package: Number(root.querySelector('#fmcUnits')?.value || 1),
            unit_name: root.querySelector('#fmcUnitName')?.value || 'unità',
            package_type: root.querySelector('#fmcPackage')?.value || 'confezione',
            category: root.querySelector('#fmcCategory')?.value || 'Altro',
          },
        });
        overlay.remove();
        s.status = 'success';
        s.reviewId = null;
        s.photoButtonLabel = 'Scatta foto';
        s.photoTarget = null;
        s.photoReason = null;
        s.photoInstruction = null;
        s.message = '✓ ' + (o.product_name || name) + ' salvato.';
        await this.load();
      } catch (e) {
        alert(e?.message || String(e));
        if (btn) { btn.disabled = false; btn.textContent = 'Salva prodotto'; }
      }
    });
  };

  const originalRender157 = HomeStockPanel.prototype.render;
  HomeStockPanel.prototype.render = function() {
    originalRender157.call(this);
    const root = this.shadowRoot;
    const s = this._foodScan;
    if (!root) return;

    if (s?.status === 'review' && s.reviewId && !root.querySelector('#foodManualComplete')) {
      const hint = root.querySelector('.foodScanModal .scanHint');
      const photoButton = root.querySelector('.foodScanModal #foodPhoto');
      const skipWrap = root.querySelector('.foodScanModal .skipExpiryWrap');
      const anchor = skipWrap || hint || photoButton;
      if (anchor) {
        const wrap = document.createElement('div');
        wrap.className = 'foodManualCompleteWrap';
        wrap.innerHTML = `<button id="foodManualComplete" type="button" class="foodManualCompleteButton">✎ Completa manualmente</button><small>Controlla i dati già letti e compila solo quello che sai.</small>`;
        anchor.insertAdjacentElement('afterend', wrap);
        root.querySelector('#foodManualComplete')?.addEventListener('click', () => this.openFoodManualComplete());
      }
    }

    if (!root.querySelector('#homeStockManualReview169')) {
      const style = document.createElement('style');
      style.id = 'homeStockManualReview169';
      style.textContent = `
        .foodManualCompleteWrap{margin-top:10px;padding:11px 12px;border-radius:15px;background:rgba(47,140,255,.055);border:1px solid rgba(47,140,255,.16)}
        .foodManualCompleteButton{width:100%;min-height:43px;border-radius:13px!important;border:1px solid rgba(47,140,255,.26)!important;background:rgba(47,140,255,.12)!important;color:#a9d0ff!important;font-weight:800!important}
        .foodManualCompleteWrap small{display:block;margin-top:7px;color:#8f98aa!important;font-size:11px!important;line-height:1.35}
        .foodManualCompleteModal{width:min(680px,100%);max-height:92vh;overflow:auto}
        .fmcGrid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:8px}
        .fmcGrid label{display:block;color:#aeb7c5;font-size:11px;font-weight:700}
        .fmcGrid label span{color:#f87171}
        .fmcGrid input,.fmcGrid select{box-sizing:border-box;width:100%;min-height:42px;margin-top:5px;border-radius:12px;border:1px solid rgba(255,255,255,.09);background:#10141b;color:#fff;padding:9px 10px;font-size:13px;outline:none}
        .fmcGrid input:focus,.fmcGrid select:focus{border-color:rgba(47,140,255,.55);box-shadow:0 0 0 3px rgba(47,140,255,.08)}
        .fmcNote{margin-top:11px;padding:10px 11px;border-radius:13px;background:rgba(255,255,255,.035);color:#8f98aa;font-size:11px;line-height:1.4}
        @media(max-width:760px){.foodManualCompleteModal{max-height:95vh}.fmcGrid{grid-template-columns:1fr}.fmcGrid input,.fmcGrid select{min-height:40px;font-size:12px}}
      `;
      root.appendChild(style);
    }
  };
}
