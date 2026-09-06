import './panel_v155.js?v=1.6.8-base';

const HomeStockPanel = customElements.get('food-scanner-panel');

if (HomeStockPanel) {
  const originalConsPost156 = HomeStockPanel.prototype.consPost;
  HomeStockPanel.prototype.consPost = async function(payload) {
    if (payload?.action === 'add_manual' && payload.changes) {
      const store = this._consScan?.purchaseStore ?? this._manual?.purchaseStore;
      if (store !== undefined) payload.changes.purchase_store = String(store || '').trim() || null;
    }
    if (payload?.action === 'update' && payload.changes && this._edit?.type === 'cons') {
      const store = this._edit?.item?.purchase_store;
      if (store !== undefined) payload.changes.purchase_store = String(store || '').trim() || null;
    }
    return await originalConsPost156.call(this, payload);
  };

  const originalConsPostNoReload156 = HomeStockPanel.prototype.consPostNoReload;
  HomeStockPanel.prototype.consPostNoReload = async function(payload) {
    if (payload?.action === 'add_manual' && payload.changes) {
      const store = this._consScan?.purchaseStore ?? this._manual?.purchaseStore;
      if (store !== undefined) payload.changes.purchase_store = String(store || '').trim() || null;
    }
    return await originalConsPostNoReload156.call(this, payload);
  };

  const originalOpenConsScan156 = HomeStockPanel.prototype.openConsScan;
  HomeStockPanel.prototype.openConsScan = function() {
    originalOpenConsScan156.call(this);
    if (this._consScan && this._consScan.purchaseStore === undefined) this._consScan.purchaseStore = '';
    this.render();
  };

  const originalOpenManual156 = HomeStockPanel.prototype.openManual;
  HomeStockPanel.prototype.openManual = function() {
    originalOpenManual156.call(this);
    if (this._manual && this._manual.purchaseStore === undefined) this._manual.purchaseStore = '';
    this.render();
  };

  const originalOpenEdit156 = HomeStockPanel.prototype.openEdit;
  HomeStockPanel.prototype.openEdit = function(item, type) {
    originalOpenEdit156.call(this, item, type);
    if (type === 'cons' && this._edit?.item) {
      this._edit.item.purchase_store = item?.purchase_store || '';
      this.render();
    }
  };

  const addStoreField = (panel, modal, state, id) => {
    if (!modal || !state || modal.querySelector(`#${id}`)) return;
    const wrap = document.createElement('div');
    wrap.className = 'hsStoreField';
    wrap.innerHTML = `<label for="${id}">Supermercato / negozio <small>(facoltativo)</small></label><input id="${id}" type="text" placeholder="Es. Esselunga, Lidl, Tigotà…" value="${panel.esc(state.purchaseStore ?? state.purchase_store ?? '')}">`;
    const actions = modal.querySelector('.modalActions');
    const save = modal.querySelector('#saveDetected, #manualSave, #edSave');
    const anchor = save || actions;
    if (anchor) anchor.insertAdjacentElement('beforebegin', wrap); else modal.appendChild(wrap);
    const input = wrap.querySelector('input');
    input?.addEventListener('input', () => {
      if ('purchaseStore' in state || state === panel._consScan || state === panel._manual) state.purchaseStore = input.value;
      else state.purchase_store = input.value;
    });
  };

  const reviewSummary = (panel, review) => {
    const food = review?.food || {};
    const name = food.product_name || 'Prodotto da completare';
    const reason = food.photo_reason || food.photo_request || 'Manca un dato necessario.';
    return { food, name, reason };
  };

  const originalRender156 = HomeStockPanel.prototype.render;
  HomeStockPanel.prototype.render = function() {
    originalRender156.call(this);
    const root = this.shadowRoot;
    if (!root) return;

    if (this._consScan) {
      const modal = root.querySelector('#csName')?.closest('.modal') || root.querySelector('#foodFile')?.closest('.modal') || root.querySelector('.overlay .modal');
      addStoreField(this, modal, this._consScan, 'consStoreScan');
    }

    if (this._manual) {
      const modal = root.querySelector('#mName')?.closest('.modal');
      addStoreField(this, modal, this._manual, 'consStoreManual');
    }

    if (this._edit?.type === 'cons') {
      const modal = root.querySelector('#edName')?.closest('.modal');
      addStoreField(this, modal, this._edit.item, 'consStoreEdit');
    }

    for (const item of (this._cons || [])) {
      if (!item.purchase_store) continue;
      const card = root.querySelector(`[data-edit-cons="${item.id}"]`);
      if (!card || card.querySelector('.hsPurchaseStore')) continue;
      const mainText = card.querySelector('.hsProductMain > div') || card;
      const line = document.createElement('p');
      line.className = 'hsPurchaseStore';
      line.textContent = `Acquistato: ${item.purchase_store}`;
      mainText.appendChild(line);
    }

    if (this._mode === 'food' && Array.isArray(this._reviews) && this._reviews.length) {
      const page = root.querySelector('.hsModePage');
      if (page && !root.querySelector('#foodMissingTray')) {
        const first = this._reviews[0];
        const info = reviewSummary(this, first);
        const tray = document.createElement('button');
        tray.id = 'foodMissingTray';
        tray.className = 'foodMissingTray';
        tray.type = 'button';
        tray.innerHTML = `<span class="foodMissingIcon">!</span><span class="foodMissingCopy"><b>Da completare · ${this._reviews.length}</b><small>${this.esc(info.name)} — ${this.esc(info.reason)}</small></span><span class="foodMissingArrow">›</span>`;
        tray.addEventListener('click', () => {
          const food = first.food || {};
          this._foodScan = {
            location: first.location || '',
            status: 'review',
            reviewId: first.id,
            message: food.photo_request || 'Manca un dato necessario.',
            photoTarget: food.photo_target || 'details',
            photoReason: food.photo_reason || null,
            photoInstruction: food.photo_instruction || null,
            photoButtonLabel: food.photo_button_label || 'Seconda foto',
          };
          this.render();
        });
        page.appendChild(tray);
      }
    }

    if (!root.querySelector('#homeStockEnhancements168')) {
      const style = document.createElement('style');
      style.id = 'homeStockEnhancements168';
      style.textContent = `
        .hsStoreField{margin:12px 0;padding:11px 12px;border-radius:15px;background:rgba(255,255,255,.025);border:1px solid rgba(255,255,255,.07)}
        .hsStoreField label{display:block;color:#cfd5df;font-size:12px;font-weight:700;margin-bottom:7px}.hsStoreField label small{color:#7f8999;font-weight:500}
        .hsStoreField input{box-sizing:border-box;width:100%;min-height:42px;border-radius:12px;border:1px solid rgba(255,255,255,.09);background:#10141b;color:#fff;padding:9px 11px;font-size:13px;outline:none}
        .hsStoreField input:focus{border-color:rgba(47,140,255,.55);box-shadow:0 0 0 3px rgba(47,140,255,.08)}
        .hsPurchaseStore{color:#9fb6d0!important;font-size:10px!important;margin-top:4px!important}
        .foodMissingTray{display:grid;grid-template-columns:34px 1fr 20px;gap:9px;align-items:center;width:100%;margin:13px 0 4px;padding:10px 12px;border-radius:15px!important;border:1px solid rgba(245,158,11,.18)!important;background:rgba(245,158,11,.065)!important;color:#fff!important;text-align:left}
        .foodMissingIcon{width:30px;height:30px;border-radius:10px;display:grid;place-items:center;background:rgba(245,158,11,.12);color:#fbbf24;font-weight:900}
        .foodMissingCopy{min-width:0}.foodMissingCopy b{display:block;font-size:12px;color:#fde68a}.foodMissingCopy small{display:block;margin-top:3px;color:#a9b0bb!important;font-size:10px!important;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.foodMissingArrow{font-size:23px;color:#8b95a4}
        @media(max-width:760px){.hsStoreField{margin:9px 0;padding:9px 10px}.hsStoreField input{min-height:40px;font-size:12px}.foodMissingTray{position:sticky;bottom:8px;z-index:25;backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px)}}
      `;
      root.appendChild(style);
    }
  };
}
