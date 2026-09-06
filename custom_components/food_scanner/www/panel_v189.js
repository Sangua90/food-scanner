import './panel_v188.js?v=1.6.44-base';

const HomeStockPanel = customElements.get('food-scanner-panel');

if (HomeStockPanel) {
  const inheritedBind1644 = HomeStockPanel.prototype.bind;

  const LOCS1644 = [
    ['magazzino','Magazzino'],['bagno','Bagno'],['cucina','Cucina'],
    ['lavanderia','Lavanderia'],['dispensa','Dispensa'],['stalla','Stalla'],
  ];
  const UNITS1644 = ['Pezzi','Bottiglie','Lattine','Vasetti','Confezioni'];

  HomeStockPanel.prototype.openConsScan = function() {
    this._consScan = {
      location: this._consLocation || 'magazzino',
      status: 'photo',
      message: '',
      detected: null,
      purchaseStore: '',
      minStock: 0,
      qty: 1,
    };
    this.render();
  };

  HomeStockPanel.prototype.hsConsRead1644 = async function(file) {
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || '').split(',')[1] || '');
      reader.onerror = () => reject(reader.error || new Error('Lettura foto fallita'));
      reader.readAsDataURL(file);
    });
  };

  HomeStockPanel.prototype.hsConsAnalyze1644 = async function(file) {
    const s = this._consScan;
    if (!s || !file) return;
    if (file.size > 12 * 1024 * 1024) {
      s.status = 'fallback';
      s.message = 'Foto troppo grande: massimo 12 MB.';
      this.render();
      return;
    }

    s.status = 'loading';
    s.message = 'Analisi in corso';
    this.render();

    try {
      const imageData = await this.hsConsRead1644(file);
      const name = String(file.name || '');
      const mime = file.type || (/\.heic$/i.test(name) ? 'image/heic' : /\.heif$/i.test(name) ? 'image/heif' : /\.png$/i.test(name) ? 'image/png' : /\.webp$/i.test(name) ? 'image/webp' : 'image/jpeg');
      const out = await this._hass.callApi('POST', 'food_scanner/consumables', {
        action: 'scan_preview',
        location: s.location || 'magazzino',
        mime_type: mime,
        image_data: imageData,
      });
      if (!this._consScan) return;
      const detected = out?.detected;
      if (!detected?.product_name) throw new Error('Consumabile non identificato correttamente.');
      s.detected = detected;
      s.qty = Math.max(1, Number(detected.units_per_package || 1));
      s.status = 'preview';
      s.message = 'Prodotto riconosciuto';
      this.render();
    } catch (err) {
      if (!this._consScan) return;
      s.status = 'fallback';
      s.message = err?.message || String(err) || 'Riconoscimento non riuscito.';
      this.render();
    }
  };

  HomeStockPanel.prototype.hsConsSave1644 = async function() {
    const s = this._consScan;
    const d = s?.detected;
    const r = this.shadowRoot;
    if (!s || !d || !r) return;

    const name = r.querySelector('#cons1644Name')?.value?.trim();
    if (!name) return alert('Inserisci il nome del prodotto.');
    const unitName = r.querySelector('[data-cons1644-unit].selected')?.dataset.cons1644Unit || d.unit_name || 'Pezzi';
    const store = r.querySelector('#cons1644Store')?.value?.trim() || '';
    const save = r.querySelector('#cons1644Save');
    if (save) { save.disabled = true; save.textContent = 'Salvataggio…'; }

    try {
      await this.consPost({
        action: 'add_manual',
        changes: {
          ...d,
          product_name: name,
          stock_units: Math.max(1, Number(s.qty || 1)),
          unit_name: unitName,
          location: s.location || 'magazzino',
          min_stock: Math.max(0, Number(s.minStock || 0)),
          purchase_store: store || null,
        },
      });
      if (!this._consScan) return;
      s.status = 'success';
      s.detected = null;
      s.message = `✓ ${name} aggiunto`;
      this.render();
    } catch (err) {
      alert(err?.message || String(err));
      if (save) { save.disabled = false; save.textContent = 'Aggiungi a HomeStock'; }
    }
  };

  // Deliberately mirrors the food scanner markup/classes.
  HomeStockPanel.prototype.consScanDialog = function() {
    const s = this._consScan;
    if (!s) return '';

    if (s.status === 'loading') {
      return `<div class="overlay"><div class="modal scanModal foodScanModal cons1644Modal">
        <button class="close" id="cons1644X">×</button>
        <div class="scanHead"><div class="scanIcon">⌁</div><div><h2>Scansiona consumabile</h2><p>Sto analizzando la foto della confezione.</p></div></div>
        <div class="scanProgress"><span class="scanPulse"></span><div><b>Analisi in corso</b><small>Sto riconoscendo prodotto, confezione e quantità</small></div></div>
      </div></div>`;
    }

    if (s.status === 'preview' && s.detected) {
      const d = s.detected;
      const selectedUnit = d.unit_name || 'Pezzi';
      return `<div class="overlay"><div class="modal scanModal foodScanModal cons1644Modal cons1644Preview">
        <button class="close" id="cons1644X">×</button>
        <div class="scanHead"><div class="scanIcon cons1644Ok">✓</div><div><h2>Prodotto riconosciuto</h2><p>Controlla i dati prima di aggiungerlo.</p></div></div>
        <div class="cons1644Field"><label>Prodotto<input id="cons1644Name" type="text" value="${this.esc(d.product_name || '')}"></label><small>${this.esc([d.brand,d.quantity,d.category].filter(Boolean).join(' · ') || 'Consumabile')}</small></div>
        <div class="scanSectionLabel">Quanti ne aggiungi?</div>
        <div class="cons1644Step"><button id="cons1644Minus">−</button><b id="cons1644Qty">${Math.max(1,Number(s.qty||1))}</b><button id="cons1644Plus">+</button></div>
        <div class="scanSectionLabel">Unità</div>
        <div class="choiceRow cons1644Units">${UNITS1644.map(u=>`<button type="button" data-cons1644-unit="${u}" class="choice ${u===selectedUnit?'selected':''}">${u}</button>`).join('')}</div>
        <div class="scanSectionLabel">Dove lo metti?</div>
        <div class="choiceRow scanLocations cons1644Locations">${LOCS1644.map(([k,l])=>`<button type="button" data-cons1644-loc="${k}" class="choice ${k} ${s.location===k?'selected':''}">${l}</button>`).join('')}</div>
        <div class="cons1644Field"><label>Supermercato / negozio <small>(facoltativo)</small><input id="cons1644Store" type="text" placeholder="Es. Lidl, Esselunga, Tigotà…" value="${this.esc(s.purchaseStore || '')}"></label></div>
        <div class="scanSectionLabel">Soglia minima <small>(0 = automatica)</small></div>
        <div class="cons1644Step"><button id="cons1644ThresholdMinus">−</button><b id="cons1644Threshold">${Math.max(0,Number(s.minStock||0))}</b><button id="cons1644ThresholdPlus">+</button></div>
        <button id="cons1644Save" class="primary full cons1644Save">Aggiungi a HomeStock</button>
      </div></div>`;
    }

    if (s.status === 'success') {
      return `<div class="overlay"><div class="modal scanModal foodScanModal cons1644Modal">
        <button class="close" id="cons1644X">×</button>
        <div class="scanHead"><div class="scanIcon cons1644Ok">✓</div><div><h2>Consumabile aggiunto</h2><p>${this.esc(s.message || 'Prodotto salvato.')}</p></div></div>
        <div class="scanSuccess"><span>✓</span><div><b>${this.esc(s.message || 'Prodotto aggiunto')}</b><small>Puoi continuare con il prossimo consumabile.</small></div></div>
        <div class="modalActions"><button id="cons1644Next" class="primary">Scansiona prossimo</button><button id="cons1644Done">Fine</button></div>
      </div></div>`;
    }

    const failed = s.status === 'fallback';
    return `<div class="overlay"><div class="modal scanModal foodScanModal cons1644Modal">
      <button class="close" id="cons1644X">×</button>
      <div class="scanHead"><div class="scanIcon">⌁</div><div><h2>Scansiona consumabile</h2><p>${failed ? this.esc(s.message || 'Riprova con una foto più chiara.') : 'Scegli dove lo riponi e scatta una foto della confezione.'}</p></div></div>
      <div class="scanSectionLabel">Dove lo metti?</div>
      <div class="choiceRow scanLocations cons1644Locations">${LOCS1644.map(([k,l])=>`<button type="button" data-cons1644-loc="${k}" class="choice ${k} ${s.location===k?'selected':''}">${l}</button>`).join('')}</div>
      <input id="cons1644File" type="file" accept="image/*,.heic,.heif" capture="environment" hidden>
      <button id="cons1644Photo" class="scanPhotoButton"><span class="cameraGlyph">◉</span><span><b>${failed?'Riprova foto':'Scatta foto'}</b><small>Apri la fotocamera</small></span></button>
      ${failed ? `<div class="scanHint"><b>Riconoscimento non riuscito</b><span>${this.esc(s.message || 'Riprova con una foto più chiara.')}</span></div>` : ''}
    </div></div>`;
  };

  // Critical fix: while the consumable scanner is open, do not execute ANY inherited bind chain.
  HomeStockPanel.prototype.bind = function() {
    if (!this._consScan) {
      inheritedBind1644.call(this);
      return;
    }

    const r = this.shadowRoot;
    const s = this._consScan;
    if (!r || !s) return;

    const close = () => { this._consScan = null; this.render(); };
    r.querySelector('#cons1644X')?.addEventListener('click', close);
    r.querySelector('#cons1644Done')?.addEventListener('click', close);
    r.querySelector('#cons1644Next')?.addEventListener('click', () => this.openConsScan());

    r.querySelectorAll('[data-cons1644-loc]').forEach(btn => btn.addEventListener('click', () => {
      r.querySelectorAll('[data-cons1644-loc]').forEach(x => x.classList.remove('selected'));
      btn.classList.add('selected');
      s.location = btn.dataset.cons1644Loc || 'magazzino';
    }));

    const photo = r.querySelector('#cons1644Photo');
    const file = r.querySelector('#cons1644File');
    if (photo && file) photo.addEventListener('click', () => file.click());
    if (file) file.addEventListener('change', e => {
      const picked = e.target?.files?.[0];
      if (picked) this.hsConsAnalyze1644(picked);
    });

    if (s.status === 'preview') {
      r.querySelectorAll('[data-cons1644-unit]').forEach(btn => btn.addEventListener('click', () => {
        r.querySelectorAll('[data-cons1644-unit]').forEach(x => x.classList.remove('selected'));
        btn.classList.add('selected');
      }));
      r.querySelector('#cons1644Minus')?.addEventListener('click', () => { s.qty=Math.max(1,Number(s.qty||1)-1); const x=r.querySelector('#cons1644Qty'); if(x)x.textContent=s.qty; });
      r.querySelector('#cons1644Plus')?.addEventListener('click', () => { s.qty=Math.max(1,Number(s.qty||1)+1); const x=r.querySelector('#cons1644Qty'); if(x)x.textContent=s.qty; });
      r.querySelector('#cons1644ThresholdMinus')?.addEventListener('click', () => { s.minStock=Math.max(0,Number(s.minStock||0)-1); const x=r.querySelector('#cons1644Threshold'); if(x)x.textContent=s.minStock; });
      r.querySelector('#cons1644ThresholdPlus')?.addEventListener('click', () => { s.minStock=Math.max(0,Number(s.minStock||0)+1); const x=r.querySelector('#cons1644Threshold'); if(x)x.textContent=s.minStock; });
      r.querySelector('#cons1644Store')?.addEventListener('input', e => { s.purchaseStore=e.target.value; });
      r.querySelector('#cons1644Save')?.addEventListener('click', () => this.hsConsSave1644());
    }
  };

  const prevRender1644 = HomeStockPanel.prototype.render;
  HomeStockPanel.prototype.render = function() {
    prevRender1644.call(this);
    const root = this.shadowRoot;
    if (!root) return;
    const version = root.querySelector('.hsVersion165 b');
    if (version) version.textContent = 'v1.6.44';
    if (root.querySelector('#homeStockCons1644')) return;
    const style = document.createElement('style');
    style.id = 'homeStockCons1644';
    style.textContent = `
      .cons1644Modal{width:min(560px,100%)!important}
      .cons1644Locations{grid-template-columns:repeat(3,1fr)!important;margin-bottom:16px!important}
      .cons1644Locations .choice.selected,.cons1644Units .choice.selected{background:rgba(47,140,255,.13)!important;border-color:rgba(47,140,255,.48)!important;color:#bcd9ff!important;outline:none!important}
      .cons1644Units{grid-template-columns:repeat(5,1fr)!important;margin-bottom:16px!important}
      .cons1644Field{margin:0 0 16px;padding:13px;border-radius:17px;background:rgba(255,255,255,.028);border:1px solid rgba(255,255,255,.065)}
      .cons1644Field label{display:block;color:#aeb7c5;font-size:11px;font-weight:750}.cons1644Field input{box-sizing:border-box;width:100%;min-height:42px;margin-top:6px;border-radius:12px;border:1px solid rgba(255,255,255,.09);background:#10141b;color:#fff;padding:9px 10px;font-size:13px;outline:none}.cons1644Field>small{display:block;margin-top:7px;color:#7f8999!important;font-size:11px!important}
      .cons1644Step{display:grid;grid-template-columns:52px minmax(80px,1fr) 52px;gap:8px;align-items:center;margin:0 0 16px}.cons1644Step button{min-height:46px;border-radius:14px!important}.cons1644Step b{text-align:center;font-size:18px}.cons1644Save{min-height:48px;border-radius:15px!important}.cons1644Ok{color:#86efac!important;background:rgba(34,197,94,.12)!important}
      @media(max-width:760px){.cons1644Locations{grid-template-columns:repeat(3,1fr)!important}.cons1644Units{grid-template-columns:repeat(2,1fr)!important}}
    `;
    root.appendChild(style);
  };
}
