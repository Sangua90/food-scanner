import './panel_v157.js?v=1.6.10-base';

const HomeStockPanel = customElements.get('food-scanner-panel');

if (HomeStockPanel) {
  HomeStockPanel.prototype.openConsScan = function() {
    this._consScan = {
      location: this._consLocation || 'magazzino',
      status: 'photo',
      message: 'Scatta una foto del prodotto da riconoscere.',
      detected: null,
      barcode: null,
      purchaseStore: '',
      minStock: 0,
      qty: 1,
    };
    this.render();
  };

  HomeStockPanel.prototype.consScanDialog = function() {
    const s = this._consScan;
    if (!s) return '';

    if (s.status === 'success') {
      return `<div class="overlay"><div class="modal consSimpleModal">
        <button class="close" id="consSimpleX">×</button>
        <div class="consSimpleHead success"><span>✓</span><div><h2>Consumabile aggiunto</h2><p>${this.esc(s.message || 'Prodotto salvato.')}</p></div></div>
        <div class="modalActions"><button id="consSimpleNext" class="primary">Scansiona prossimo</button><button id="consSimpleDone">Fine</button></div>
      </div></div>`;
    }

    if (s.status === 'gemini_loading') {
      return `<div class="overlay"><div class="modal consSimpleModal">
        <button class="close" id="consSimpleX">×</button>
        <div class="consSimpleHead"><span class="consCameraGlyph">◉</span><div><h2>Riconoscimento prodotto</h2><p>Analizzo la foto e preparo i dati del consumabile.</p></div></div>
        <div class="consSimpleLoading"><span class="scanPulse"></span><div><b>Analisi in corso</b><small>Gemini sta riconoscendo prodotto e confezione</small></div></div>
      </div></div>`;
    }

    if (s.status === 'preview' && s.detected) {
      const d = s.detected;
      const qty = Number(s.qty || d.units_per_package || 1);
      const unit = this.unit(d.unit_name);
      const locations = [
        ['magazzino','Magazzino'],['bagno','Bagno'],['cucina','Cucina'],
        ['lavanderia','Lavanderia'],['dispensa','Dispensa'],['stalla','Stalla']
      ];
      const units = ['Pezzi','Bottiglie','Lattine','Vasetti','Confezioni'];
      return `<div class="overlay"><div class="modal consSimpleModal consConfirmModal">
        <button class="close" id="consSimpleX">×</button>
        <div class="consSimpleHead"><span class="consRecognized">✓</span><div><h2>Prodotto riconosciuto</h2><p>Controlla i dati e completa dove lo riponi.</p></div></div>

        <div class="consRecognizedCard">
          <label>Prodotto<input id="csName" type="text" value="${this.esc(d.product_name || '')}"></label>
          <div class="consRecognizedMeta">${this.esc([d.brand,d.quantity,d.category].filter(Boolean).join(' · ') || 'Consumabile')}</div>
        </div>

        <div class="consConfirmSection">
          <div class="consConfirmTitle">Quanti pezzi aggiungi?</div>
          <div class="step consQtyStep"><button id="csQtyMinus">−</button><b id="csQty">${qty}</b><button id="csQtyPlus">+</button></div>
          <div class="consUnitChoices">${units.map(x => `<button data-unit="${x}" class="choice ${unit===x?'selected':''}">${x}</button>`).join('')}</div>
        </div>

        <div class="consConfirmSection">
          <div class="consConfirmTitle">Dove lo metti?</div>
          <div class="consLocationChoices">${locations.map(([key,label]) => `<button data-ploc="${key}" class="choice ${s.location===key?'selected':''}">${label}</button>`).join('')}</div>
        </div>

        <div class="consConfirmSection">
          <label class="consStoreLabel">Supermercato / bar / negozio <small>(facoltativo)</small>
            <input id="consStoreScan" type="text" placeholder="Es. Lidl, Esselunga, Tigotà…" value="${this.esc(s.purchaseStore || '')}">
          </label>
        </div>

        <div class="consConfirmSection compact">
          <div class="consConfirmTitle">Soglia minima <small>(facoltativa)</small></div>
          <div class="step consThresholdStep"><button id="csThresholdMinus">−</button><b id="csThreshold">${Number(s.minStock || 0) > 0 ? Number(s.minStock) : 'Auto 2'}</b><button id="csThresholdPlus">+</button></div>
        </div>

        <button id="saveDetected" class="primary full consSaveButton">Aggiungi a HomeStock</button>
      </div></div>`;
    }

    return `<div class="overlay"><div class="modal consSimpleModal consPhotoModal">
      <button class="close" id="consSimpleX">×</button>
      <div class="consSimpleHero">
        <div class="consSimpleCamera">◉</div>
        <h2>Scansiona consumabile</h2>
        <p>Fai una foto chiara del prodotto. Posizione, quantità e negozio li scegli dopo il riconoscimento.</p>
      </div>
      <input id="consProductFile" type="file" accept="image/*,.heic,.heif" capture="environment" hidden>
      <button id="consProductPhoto" class="consPhotoButton"><span>◉</span><div><b>Scatta foto prodotto</b><small>Apri la fotocamera</small></div></button>
      ${s.status === 'fallback' ? `<div class="scanHint"><b>Riconoscimento non riuscito</b><span>${this.esc(s.message || 'Riprova con una foto più chiara.')}</span></div>` : ''}
    </div></div>`;
  };

  HomeStockPanel.prototype.saveConsDetected = async function() {
    const s = this._consScan;
    const d = s?.detected;
    const r = this.shadowRoot;
    if (!s || !d || !r) return;

    const name = r.querySelector('#csName')?.value?.trim();
    if (!name) {
      alert('Inserisci il nome del prodotto.');
      return;
    }
    const qty = Math.max(1, Number(r.querySelector('#csQty')?.textContent || s.qty || 1));
    const location = r.querySelector('[data-ploc].selected')?.dataset.ploc || s.location || 'magazzino';
    const unitName = r.querySelector('[data-unit].selected')?.dataset.unit || this.unit(d.unit_name);
    const store = r.querySelector('#consStoreScan')?.value?.trim() || '';
    s.location = location;
    s.purchaseStore = store;
    s.qty = qty;

    const changes = {
      ...d,
      product_name: name,
      stock_units: qty,
      unit_name: unitName,
      location,
      min_stock: Number(s.minStock || 0),
      purchase_store: store || null,
    };

    try {
      await this.consPost({action:'add_manual',changes});
      s.status = 'success';
      s.detected = null;
      s.message = `✓ ${name} aggiunto · ${qty} ${unitName} · ${this.loc(location)}${store ? ` · ${store}` : ''}`;
      this.render();
    } catch (e) {
      alert(e?.message || String(e));
    }
  };

  const originalBind158 = HomeStockPanel.prototype.bind;
  HomeStockPanel.prototype.bind = function() {
    originalBind158.call(this);
    const r = this.shadowRoot;
    const s = this._consScan;
    if (!r || !s) return;

    const close = () => { this._consScan = null; this.render(); };
    r.querySelector('#consSimpleX')?.addEventListener('click', close);
    r.querySelector('#consSimpleDone')?.addEventListener('click', close);
    r.querySelector('#consSimpleNext')?.addEventListener('click', () => this.openConsScan());

    r.querySelector('#consProductPhoto')?.addEventListener('click', () => r.querySelector('#consProductFile')?.click());
    r.querySelector('#consProductFile')?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (file) this.geminiFile(file);
    });

    if (s.status === 'preview') {
      r.querySelectorAll('[data-ploc]').forEach(btn => btn.addEventListener('click', () => {
        r.querySelectorAll('[data-ploc]').forEach(x => x.classList.remove('selected'));
        btn.classList.add('selected');
        s.location = btn.dataset.ploc;
      }));
      r.querySelectorAll('[data-unit]').forEach(btn => btn.addEventListener('click', () => {
        r.querySelectorAll('[data-unit]').forEach(x => x.classList.remove('selected'));
        btn.classList.add('selected');
      }));

      const qtyLabel = r.querySelector('#csQty');
      r.querySelector('#csQtyMinus')?.addEventListener('click', () => {
        s.qty = Math.max(1, Number(qtyLabel?.textContent || s.qty || 1) - 1);
        if (qtyLabel) qtyLabel.textContent = s.qty;
      });
      r.querySelector('#csQtyPlus')?.addEventListener('click', () => {
        s.qty = Number(qtyLabel?.textContent || s.qty || 1) + 1;
        if (qtyLabel) qtyLabel.textContent = s.qty;
      });

      const threshold = r.querySelector('#csThreshold');
      r.querySelector('#csThresholdMinus')?.addEventListener('click', () => {
        s.minStock = Math.max(0, Number(s.minStock || 0) - 1);
        if (threshold) threshold.textContent = s.minStock > 0 ? s.minStock : 'Auto 2';
      });
      r.querySelector('#csThresholdPlus')?.addEventListener('click', () => {
        s.minStock = Number(s.minStock || 0) + 1;
        if (threshold) threshold.textContent = s.minStock;
      });

      r.querySelector('#consStoreScan')?.addEventListener('input', e => { s.purchaseStore = e.target.value; });
      const save = r.querySelector('#saveDetected');
      if (save) save.onclick = () => this.saveConsDetected();
    }
  };

  const originalRender158 = HomeStockPanel.prototype.render;
  HomeStockPanel.prototype.render = function() {
    originalRender158.call(this);
    const root = this.shadowRoot;
    if (!root || root.querySelector('#homeStockConsumablesFlow1610')) return;
    const style = document.createElement('style');
    style.id = 'homeStockConsumablesFlow1610';
    style.textContent = `
      .consSimpleModal{width:min(560px,100%);border-radius:26px!important;background:radial-gradient(circle at top left,rgba(255,255,255,.055),rgba(14,17,23,.985) 52%)!important;border:1px solid rgba(255,255,255,.085)!important;padding:21px!important}
      .consSimpleHero{text-align:center;padding:13px 8px 8px}.consSimpleHero h2{font-size:24px;margin:10px 0 5px}.consSimpleHero p{max-width:410px;margin:0 auto;color:#8f98aa!important;font-size:13px;line-height:1.45}
      .consSimpleCamera{width:72px;height:72px;margin:0 auto;border-radius:23px;display:grid;place-items:center;font-size:32px;color:#7dd3fc;background:radial-gradient(circle,rgba(56,189,248,.2),rgba(56,189,248,.07));border:1px solid rgba(125,211,252,.2);box-shadow:0 10px 30px rgba(0,0,0,.2)}
      .consPhotoButton{width:100%;margin-top:18px;display:grid;grid-template-columns:52px 1fr;align-items:center;gap:12px;text-align:left;padding:14px!important;border-radius:18px!important;border:1px solid rgba(47,140,255,.25)!important;background:linear-gradient(145deg,rgba(47,140,255,.18),rgba(20,27,38,.98))!important;color:#fff!important}
      .consPhotoButton>span{width:48px;height:48px;border-radius:15px;display:grid;place-items:center;font-size:23px;background:rgba(125,211,252,.12);color:#7dd3fc}.consPhotoButton b{display:block;font-size:16px}.consPhotoButton small{display:block;color:#8f98aa!important;margin-top:2px}
      .consSimpleHead{display:grid;grid-template-columns:50px 1fr;gap:12px;align-items:center;margin-bottom:16px;padding-right:35px}.consSimpleHead>span{width:48px;height:48px;border-radius:15px;display:grid;place-items:center;background:rgba(125,211,252,.1);color:#7dd3fc;font-size:22px}.consSimpleHead.success>span,.consRecognized{background:rgba(34,197,94,.12)!important;color:#86efac!important}.consSimpleHead h2{margin:0;font-size:21px}.consSimpleHead p{margin:3px 0 0;color:#8f98aa!important;font-size:12px}
      .consSimpleLoading{display:grid;grid-template-columns:42px 1fr;gap:11px;align-items:center;padding:16px;border-radius:17px;background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.07)}.consSimpleLoading b{display:block}.consSimpleLoading small{display:block;margin-top:3px;color:#8f98aa!important}
      .consRecognizedCard,.consConfirmSection{padding:13px;border-radius:17px;background:rgba(255,255,255,.028);border:1px solid rgba(255,255,255,.065);margin-top:9px}.consRecognizedCard label,.consStoreLabel{display:block;font-size:11px;color:#aeb7c5;font-weight:750}.consRecognizedCard input,.consStoreLabel input{box-sizing:border-box;width:100%;min-height:42px;margin-top:6px;border-radius:12px;border:1px solid rgba(255,255,255,.09);background:#10141b;color:#fff;padding:9px 10px;font-size:13px;outline:none}.consRecognizedMeta{font-size:11px;color:#7f8999;margin-top:7px}.consConfirmTitle{font-size:11px;color:#aeb7c5;font-weight:800;margin-bottom:9px}.consConfirmTitle small,.consStoreLabel small{font-weight:500;color:#747e8f}
      .consQtyStep,.consThresholdStep{margin:0!important}.consQtyStep b,.consThresholdStep b{min-width:80px;text-align:center}.consUnitChoices,.consLocationChoices{display:grid;gap:6px;margin-top:10px}.consUnitChoices{grid-template-columns:repeat(5,1fr)}.consLocationChoices{grid-template-columns:repeat(3,1fr)}.consUnitChoices .choice,.consLocationChoices .choice{min-height:39px;border-radius:11px!important;background:#121720!important;border:1px solid rgba(255,255,255,.075)!important;color:#b9c1ce!important;font-size:11px;padding:7px!important}.consUnitChoices .choice.selected,.consLocationChoices .choice.selected{border-color:rgba(47,140,255,.48)!important;background:rgba(47,140,255,.13)!important;color:#bcd9ff!important;outline:none!important}.consConfirmSection.compact{padding-bottom:10px}.consSaveButton{margin-top:12px;min-height:46px;border-radius:14px!important}
      @media(max-width:760px){.consSimpleModal{padding:17px!important;border-radius:22px!important}.consSimpleHero h2{font-size:21px}.consSimpleCamera{width:62px;height:62px;border-radius:20px}.consPhotoButton{margin-top:14px;padding:12px!important}.consUnitChoices{grid-template-columns:repeat(2,1fr)}.consLocationChoices{grid-template-columns:repeat(2,1fr)}.consRecognizedCard,.consConfirmSection{padding:11px}.consSimpleHead{grid-template-columns:43px 1fr}.consSimpleHead>span{width:42px;height:42px}}
    `;
    root.appendChild(style);
  };
}
