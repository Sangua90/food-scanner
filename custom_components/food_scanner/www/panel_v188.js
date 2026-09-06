import './panel_v187.js?v=1.6.43-base';

const HomeStockPanel = customElements.get('food-scanner-panel');

if (HomeStockPanel) {
  const CONS_LOCS_1643 = [
    ['magazzino','Magazzino'],['bagno','Bagno'],['cucina','Cucina'],
    ['lavanderia','Lavanderia'],['dispensa','Dispensa'],['stalla','Stalla'],
  ];
  const CONS_UNITS_1643 = ['Pezzi','Bottiglie','Lattine','Vasetti','Confezioni'];

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

    if (s.status === 'gemini_loading') {
      return `<div class="overlay"><div class="modal scanModal foodScanModal hsConsStable1643">
        <button class="close" id="consSimpleX">×</button>
        <div class="scanHead"><div class="scanIcon">⌁</div><div><h2>Scansiona consumabile</h2><p>Sto analizzando la foto della confezione.</p></div></div>
        <div class="scanProgress"><span class="scanPulse"></span><div><b>Analisi in corso</b><small>Sto riconoscendo prodotto, confezione e quantità</small></div></div>
      </div></div>`;
    }

    if (s.status === 'preview' && s.detected) {
      const d = s.detected;
      const qty = Math.max(1, Number(s.qty || d.units_per_package || 1));
      const selectedUnit = this.unit(d.unit_name || 'Pezzi');
      return `<div class="overlay"><div class="modal scanModal foodScanModal hsConsStable1643 hsConsStablePreview1643">
        <button class="close" id="consSimpleX">×</button>
        <div class="scanHead"><div class="scanIcon hsConsOk1643">✓</div><div><h2>Prodotto riconosciuto</h2><p>Controlla i dati prima di aggiungerlo.</p></div></div>

        <div class="hsConsField1643"><label>Prodotto<input id="csName" type="text" value="${this.esc(d.product_name || '')}"></label><small>${this.esc([d.brand,d.quantity,d.category].filter(Boolean).join(' · ') || 'Consumabile')}</small></div>

        <div class="scanSectionLabel">Quanti ne aggiungi?</div>
        <div class="hsConsStep1643"><button id="csQtyMinus">−</button><b id="csQty">${qty}</b><button id="csQtyPlus">+</button></div>

        <div class="scanSectionLabel">Unità</div>
        <div class="choiceRow hsConsUnits1643">${CONS_UNITS_1643.map(u => `<button type="button" data-unit="${u}" class="choice ${u===selectedUnit?'selected':''}">${u}</button>`).join('')}</div>

        <div class="scanSectionLabel">Dove lo metti?</div>
        <div class="choiceRow scanLocations hsConsLocs1643">${CONS_LOCS_1643.map(([k,l]) => `<button type="button" data-ploc="${k}" class="choice ${k} ${s.location===k?'selected':''}">${l}</button>`).join('')}</div>

        <div class="hsConsField1643"><label>Supermercato / negozio <small>(facoltativo)</small><input id="consStoreScan" type="text" placeholder="Es. Lidl, Esselunga, Tigotà…" value="${this.esc(s.purchaseStore || '')}"></label></div>

        <div class="scanSectionLabel">Soglia minima <small>(0 = automatica)</small></div>
        <div class="hsConsStep1643"><button id="csThresholdMinus">−</button><b id="csThreshold">${Math.max(0,Number(s.minStock||0))}</b><button id="csThresholdPlus">+</button></div>

        <button id="saveDetected" class="primary full hsConsSave1643">Aggiungi a HomeStock</button>
      </div></div>`;
    }

    if (s.status === 'success') {
      return `<div class="overlay"><div class="modal scanModal foodScanModal hsConsStable1643">
        <button class="close" id="consSimpleX">×</button>
        <div class="scanHead"><div class="scanIcon hsConsOk1643">✓</div><div><h2>Consumabile aggiunto</h2><p>${this.esc(s.message || 'Prodotto salvato.')}</p></div></div>
        <div class="scanSuccess"><span>✓</span><div><b>${this.esc(s.message || 'Prodotto aggiunto')}</b><small>Puoi continuare con il prossimo consumabile.</small></div></div>
        <div class="modalActions"><button id="consSimpleNext" class="primary">Scansiona prossimo</button><button id="consSimpleDone">Fine</button></div>
      </div></div>`;
    }

    const failed = s.status === 'fallback';
    return `<div class="overlay"><div class="modal scanModal foodScanModal hsConsStable1643">
      <button class="close" id="consSimpleX">×</button>
      <div class="scanHead"><div class="scanIcon">⌁</div><div><h2>Scansiona consumabile</h2><p>${failed ? this.esc(s.message || 'Riprova con una foto più chiara.') : 'Scegli dove lo riponi e scatta una foto della confezione.'}</p></div></div>
      <div class="scanSectionLabel">Dove lo metti?</div>
      <div class="choiceRow scanLocations hsConsLocs1643">${CONS_LOCS_1643.map(([k,l]) => `<button type="button" data-ploc="${k}" class="choice ${k} ${s.location===k?'selected':''}">${l}</button>`).join('')}</div>
      <input id="consProductFile" type="file" accept="image/*,.heic,.heif" capture="environment" hidden style="display:none!important">
      <button id="consProductPhoto" type="button" class="scanPhotoButton"><span class="cameraGlyph">◉</span><span><b>${failed?'Riprova foto':'Scatta foto'}</b><small>Apri la fotocamera</small></span></button>
      ${failed ? `<div class="scanHint"><b>Riconoscimento non riuscito</b><span>${this.esc(s.message || 'Riprova con una foto più chiara.')}</span></div>` : ''}
    </div></div>`;
  };

  HomeStockPanel.prototype.saveConsDetected = async function() {
    const s = this._consScan;
    const d = s?.detected;
    const r = this.shadowRoot;
    if (!s || !d || !r) return;
    const name = r.querySelector('#csName')?.value?.trim();
    if (!name) return alert('Inserisci il nome del prodotto.');
    const qty = Math.max(1, Number(r.querySelector('#csQty')?.textContent || s.qty || 1));
    const location = r.querySelector('[data-ploc].selected')?.dataset.ploc || s.location || 'magazzino';
    const unitName = r.querySelector('[data-unit].selected')?.dataset.unit || this.unit(d.unit_name);
    const store = r.querySelector('#consStoreScan')?.value?.trim() || '';
    s.location = location;
    s.purchaseStore = store;
    s.qty = qty;
    const save = r.querySelector('#saveDetected');
    if (save) { save.disabled = true; save.textContent = 'Salvataggio…'; }
    try {
      await this.consPost({action:'add_manual',changes:{...d,product_name:name,stock_units:qty,unit_name:unitName,location,min_stock:Number(s.minStock||0),purchase_store:store||null}});
      if (!this._consScan) return;
      s.status = 'success';
      s.detected = null;
      s.message = `✓ ${name} aggiunto · ${qty} ${unitName} · ${this.loc(location)}${store ? ` · ${store}` : ''}`;
      this.render();
    } catch (e) {
      alert(e?.message || String(e));
      if (save) { save.disabled = false; save.textContent = 'Aggiungi a HomeStock'; }
    }
  };

  const previousBind1643 = HomeStockPanel.prototype.bind;
  HomeStockPanel.prototype.bind = function() {
    previousBind1643.call(this);
    const r = this.shadowRoot;
    const s = this._consScan;
    if (!r || !s) return;

    const cleanId = (id) => {
      const old = r.querySelector('#'+id);
      if (!old) return null;
      const fresh = old.cloneNode(true);
      old.replaceWith(fresh);
      return fresh;
    };
    const cleanSelectorAll = (selector) => {
      return [...r.querySelectorAll(selector)].map(old => {
        const fresh = old.cloneNode(true);
        old.replaceWith(fresh);
        return fresh;
      });
    };

    const close = cleanId('consSimpleX');
    if (close) close.onclick = () => { this._consScan = null; this.render(); };
    const done = cleanId('consSimpleDone');
    if (done) done.onclick = () => { this._consScan = null; this.render(); };
    const next = cleanId('consSimpleNext');
    if (next) next.onclick = () => this.openConsScan();

    const locButtons = cleanSelectorAll('[data-ploc]');
    locButtons.forEach(btn => btn.onclick = () => {
      r.querySelectorAll('[data-ploc]').forEach(x => x.classList.remove('selected'));
      btn.classList.add('selected');
      s.location = btn.dataset.ploc || 'magazzino';
    });

    const oldPhoto = r.querySelector('#consProductPhoto');
    const oldFile = r.querySelector('#consProductFile');
    if (oldPhoto && oldFile) {
      const photo = oldPhoto.cloneNode(true);
      const file = oldFile.cloneNode(true);
      oldPhoto.replaceWith(photo);
      oldFile.replaceWith(file);
      photo.onclick = () => file.click();
      file.onchange = (e) => {
        const picked = e.target?.files?.[0];
        if (picked) this.geminiFile(picked);
      };
    }

    if (s.status === 'preview') {
      const unitButtons = cleanSelectorAll('[data-unit]');
      unitButtons.forEach(btn => btn.onclick = () => {
        r.querySelectorAll('[data-unit]').forEach(x => x.classList.remove('selected'));
        btn.classList.add('selected');
      });
      const qtyLabel = r.querySelector('#csQty');
      const minus = cleanId('csQtyMinus'); if (minus) minus.onclick = () => { s.qty=Math.max(1,Number(qtyLabel?.textContent||s.qty||1)-1); if(qtyLabel)qtyLabel.textContent=s.qty; };
      const plus = cleanId('csQtyPlus'); if (plus) plus.onclick = () => { s.qty=Number(qtyLabel?.textContent||s.qty||1)+1; if(qtyLabel)qtyLabel.textContent=s.qty; };
      const threshold = r.querySelector('#csThreshold');
      const tminus = cleanId('csThresholdMinus'); if (tminus) tminus.onclick = () => { s.minStock=Math.max(0,Number(s.minStock||0)-1); if(threshold)threshold.textContent=s.minStock; };
      const tplus = cleanId('csThresholdPlus'); if (tplus) tplus.onclick = () => { s.minStock=Number(s.minStock||0)+1; if(threshold)threshold.textContent=s.minStock; };
      const store = r.querySelector('#consStoreScan'); if (store) store.oninput = e => { s.purchaseStore=e.target.value; };
      const save = cleanId('saveDetected'); if (save) save.onclick = () => this.saveConsDetected();
    }
  };

  const previousRender1643 = HomeStockPanel.prototype.render;
  HomeStockPanel.prototype.render = function() {
    previousRender1643.call(this);
    const root = this.shadowRoot;
    if (!root) return;
    const version = root.querySelector('.hsVersion165 b');
    if (version) version.textContent = 'v1.6.43';
    if (root.querySelector('#homeStockConsStable1643')) return;
    const style = document.createElement('style');
    style.id = 'homeStockConsStable1643';
    style.textContent = `
      .hsConsStable1643{width:min(560px,100%)!important}
      .hsConsLocs1643{grid-template-columns:repeat(3,1fr)!important;margin-bottom:16px!important}
      .hsConsLocs1643 .choice.selected,.hsConsUnits1643 .choice.selected{background:rgba(47,140,255,.13)!important;border-color:rgba(47,140,255,.48)!important;color:#bcd9ff!important;outline:none!important}
      .hsConsUnits1643{grid-template-columns:repeat(5,1fr)!important;margin-bottom:16px!important}
      .hsConsField1643{margin:0 0 16px;padding:13px;border-radius:17px;background:rgba(255,255,255,.028);border:1px solid rgba(255,255,255,.065)}
      .hsConsField1643 label{display:block;color:#aeb7c5;font-size:11px;font-weight:750}.hsConsField1643 input{box-sizing:border-box;width:100%;min-height:42px;margin-top:6px;border-radius:12px;border:1px solid rgba(255,255,255,.09);background:#10141b;color:#fff;padding:9px 10px;font-size:13px;outline:none}.hsConsField1643>small{display:block;margin-top:7px;color:#7f8999!important;font-size:11px!important}
      .hsConsStep1643{display:grid;grid-template-columns:52px minmax(80px,1fr) 52px;gap:8px;align-items:center;margin:0 0 16px}.hsConsStep1643 button{min-height:46px;border-radius:14px!important}.hsConsStep1643 b{text-align:center;font-size:18px}.hsConsSave1643{min-height:48px;border-radius:15px!important}
      .hsConsOk1643{color:#86efac!important;background:rgba(34,197,94,.12)!important}
      @media(max-width:760px){.hsConsLocs1643{grid-template-columns:repeat(3,1fr)!important}.hsConsUnits1643{grid-template-columns:repeat(2,1fr)!important}}
    `;
    root.appendChild(style);
  };
}
