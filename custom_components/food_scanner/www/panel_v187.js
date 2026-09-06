import './panel_v186.js?v=1.6.42-base';

const HomeStockPanel = customElements.get('food-scanner-panel');

if (HomeStockPanel) {
  const CONS_LOCS_1642 = [
    ['magazzino','Magazzino'],['bagno','Bagno'],['cucina','Cucina'],
    ['lavanderia','Lavanderia'],['dispensa','Dispensa'],['stalla','Stalla'],
  ];
  const CONS_UNITS_1642 = ['Pezzi','Bottiglie','Lattine','Vasetti','Confezioni'];

  HomeStockPanel.prototype.hsConsReset1642 = function() {
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

  HomeStockPanel.prototype.openConsScan = function() {
    this.hsConsReset1642();
  };

  HomeStockPanel.prototype.hsConsAnalyze1642 = async function(file) {
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
      const imageData = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || '').split(',')[1] || '');
        reader.onerror = () => reject(reader.error || new Error('Lettura foto fallita'));
        reader.readAsDataURL(file);
      });
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

  HomeStockPanel.prototype.hsConsSave1642 = async function() {
    const s = this._consScan;
    const d = s?.detected;
    const root = this.shadowRoot;
    if (!s || !d || !root) return;

    const name = root.querySelector('#consTwinName1642')?.value?.trim();
    if (!name) { alert('Inserisci il nome del prodotto.'); return; }
    const unitName = root.querySelector('[data-cons-unit1642].selected')?.dataset.consUnit1642 || d.unit_name || 'Pezzi';
    const store = root.querySelector('#consTwinStore1642')?.value?.trim() || '';
    const save = root.querySelector('#consTwinSave1642');
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

  HomeStockPanel.prototype.consScanDialog = function() {
    const s = this._consScan;
    if (!s) return '';

    if (s.status === 'loading') {
      return `<div class="overlay"><div class="modal scanModal foodScanModal consFoodTwin1642">
        <button class="close" id="consTwinX1642">×</button>
        <div class="scanHead">
          <div class="scanIcon">⌁</div>
          <div><h2>Scansiona consumabile</h2><p>Sto analizzando la foto della confezione.</p></div>
        </div>
        <div class="scanProgress"><span class="scanPulse"></span><div><b>Analisi in corso</b><small>Sto riconoscendo prodotto, confezione e quantità</small></div></div>
      </div></div>`;
    }

    if (s.status === 'preview' && s.detected) {
      const d = s.detected;
      const selectedUnit = d.unit_name || 'Pezzi';
      return `<div class="overlay"><div class="modal scanModal foodScanModal consFoodTwin1642 consFoodTwinPreview1642">
        <button class="close" id="consTwinX1642">×</button>
        <div class="scanHead">
          <div class="scanIcon">✓</div>
          <div><h2>Prodotto riconosciuto</h2><p>Controlla i dati prima di aggiungerlo.</p></div>
        </div>

        <div class="consTwinField1642"><label>Prodotto<input id="consTwinName1642" type="text" value="${this.esc(d.product_name || '')}"></label><small>${this.esc([d.brand,d.quantity,d.category].filter(Boolean).join(' · ') || 'Consumabile')}</small></div>

        <div class="scanSectionLabel">Quanti ne aggiungi?</div>
        <div class="consTwinStep1642"><button id="consTwinMinus1642">−</button><b id="consTwinQty1642">${Math.max(1,Number(s.qty||1))}</b><button id="consTwinPlus1642">+</button></div>

        <div class="scanSectionLabel">Unità</div>
        <div class="choiceRow consTwinUnits1642">${CONS_UNITS_1642.map(u=>`<button type="button" data-cons-unit1642="${u}" class="choice ${u===selectedUnit?'selected':''}">${u}</button>`).join('')}</div>

        <div class="scanSectionLabel">Dove lo metti?</div>
        <div class="choiceRow scanLocations consTwinLocations1642">${CONS_LOCS_1642.map(([k,l])=>`<button type="button" data-cons-loc1642="${k}" class="choice ${k} ${s.location===k?'selected':''}">${l}</button>`).join('')}</div>

        <div class="consTwinField1642"><label>Supermercato / negozio <small>(facoltativo)</small><input id="consTwinStore1642" type="text" placeholder="Es. Lidl, Esselunga, Tigotà…" value="${this.esc(s.purchaseStore || '')}"></label></div>

        <div class="scanSectionLabel">Soglia minima <small>(0 = automatica)</small></div>
        <div class="consTwinStep1642"><button id="consTwinThresholdMinus1642">−</button><b id="consTwinThreshold1642">${Math.max(0,Number(s.minStock||0))}</b><button id="consTwinThresholdPlus1642">+</button></div>

        <button id="consTwinSave1642" class="primary full consTwinSave1642">Aggiungi a HomeStock</button>
      </div></div>`;
    }

    if (s.status === 'success') {
      return `<div class="overlay"><div class="modal scanModal foodScanModal consFoodTwin1642">
        <button class="close" id="consTwinX1642">×</button>
        <div class="scanHead"><div class="scanIcon">✓</div><div><h2>Consumabile aggiunto</h2><p>${this.esc(s.message || 'Prodotto salvato')}</p></div></div>
        <div class="scanSuccess"><span>✓</span><div><b>${this.esc(s.message || 'Prodotto aggiunto')}</b><small>Puoi continuare con il prossimo consumabile.</small></div></div>
        <div class="modalActions"><button id="consTwinNext1642" class="primary">Scansiona prossimo</button><button id="consTwinDone1642">Fine</button></div>
      </div></div>`;
    }

    const failed = s.status === 'fallback';
    return `<div class="overlay"><div class="modal scanModal foodScanModal consFoodTwin1642">
      <button class="close" id="consTwinX1642">×</button>
      <div class="scanHead">
        <div class="scanIcon">⌁</div>
        <div><h2>Scansiona consumabile</h2><p>${failed ? this.esc(s.message || 'Riprova con una foto più chiara.') : 'Scegli dove lo riponi e scatta una foto della confezione.'}</p></div>
      </div>
      <div class="scanSectionLabel">Dove lo metti?</div>
      <div class="choiceRow scanLocations consTwinLocations1642">${CONS_LOCS_1642.map(([k,l])=>`<button type="button" data-cons-loc1642="${k}" class="choice ${k} ${s.location===k?'selected':''}">${l}</button>`).join('')}</div>
      <input id="consTwinFile1642" type="file" accept="image/*,.heic,.heif" capture="environment" hidden style="display:none!important">
      <button id="consTwinPhoto1642" type="button" class="scanPhotoButton"><span class="cameraGlyph">◉</span><span><b>${failed?'Riprova foto':'Scatta foto'}</b><small>Apri la fotocamera</small></span></button>
      ${failed ? `<div class="scanHint"><b>Riconoscimento non riuscito</b><span>${this.esc(s.message || 'Riprova con una foto più chiara.')}</span></div>` : ''}
    </div></div>`;
  };

  const previousBind1642 = HomeStockPanel.prototype.bind;
  HomeStockPanel.prototype.bind = function() {
    previousBind1642.call(this);
    const root = this.shadowRoot;
    const s = this._consScan;
    if (!root || !s) return;

    const close = () => { this._consScan = null; this.render(); };
    root.querySelector('#consTwinX1642')?.addEventListener('click', close);
    root.querySelector('#consTwinDone1642')?.addEventListener('click', close);
    root.querySelector('#consTwinNext1642')?.addEventListener('click', () => this.hsConsReset1642());

    root.querySelectorAll('[data-cons-loc1642]').forEach(btn => btn.addEventListener('click', () => {
      root.querySelectorAll('[data-cons-loc1642]').forEach(x => x.classList.remove('selected'));
      btn.classList.add('selected');
      s.location = btn.dataset.consLoc1642 || 'magazzino';
    }));

    const photo = root.querySelector('#consTwinPhoto1642');
    const file = root.querySelector('#consTwinFile1642');
    if (photo && file) photo.onclick = () => file.click();
    if (file) file.onchange = (event) => {
      const picked = event.target?.files?.[0];
      if (picked) this.hsConsAnalyze1642(picked);
    };

    if (s.status === 'preview') {
      root.querySelectorAll('[data-cons-unit1642]').forEach(btn => btn.addEventListener('click', () => {
        root.querySelectorAll('[data-cons-unit1642]').forEach(x => x.classList.remove('selected'));
        btn.classList.add('selected');
      }));
      root.querySelector('#consTwinMinus1642')?.addEventListener('click', () => { s.qty=Math.max(1,Number(s.qty||1)-1); const x=root.querySelector('#consTwinQty1642'); if(x)x.textContent=s.qty; });
      root.querySelector('#consTwinPlus1642')?.addEventListener('click', () => { s.qty=Math.max(1,Number(s.qty||1)+1); const x=root.querySelector('#consTwinQty1642'); if(x)x.textContent=s.qty; });
      root.querySelector('#consTwinThresholdMinus1642')?.addEventListener('click', () => { s.minStock=Math.max(0,Number(s.minStock||0)-1); const x=root.querySelector('#consTwinThreshold1642'); if(x)x.textContent=s.minStock; });
      root.querySelector('#consTwinThresholdPlus1642')?.addEventListener('click', () => { s.minStock=Math.max(0,Number(s.minStock||0)+1); const x=root.querySelector('#consTwinThreshold1642'); if(x)x.textContent=s.minStock; });
      root.querySelector('#consTwinStore1642')?.addEventListener('input', e => { s.purchaseStore=e.target.value; });
      root.querySelector('#consTwinSave1642')?.addEventListener('click', () => this.hsConsSave1642());
    }
  };

  const previousRender1642 = HomeStockPanel.prototype.render;
  HomeStockPanel.prototype.render = function() {
    previousRender1642.call(this);
    const root = this.shadowRoot;
    if (!root) return;
    const version = root.querySelector('.hsVersion165 b');
    if (version) version.textContent = 'v1.6.42';
    if (root.querySelector('#homeStockConsTwin1642')) return;
    const style = document.createElement('style');
    style.id = 'homeStockConsTwin1642';
    style.textContent = `
      .consFoodTwin1642{width:min(560px,100%)!important}
      .consTwinLocations1642{grid-template-columns:repeat(3,1fr)!important;margin-bottom:16px!important}
      .consTwinLocations1642 .choice.selected,.consTwinUnits1642 .choice.selected{background:rgba(47,140,255,.13)!important;border-color:rgba(47,140,255,.48)!important;color:#bcd9ff!important;outline:none!important}
      .consTwinUnits1642{grid-template-columns:repeat(5,1fr)!important;margin-bottom:16px!important}
      .consTwinField1642{margin:0 0 16px;padding:13px;border-radius:17px;background:rgba(255,255,255,.028);border:1px solid rgba(255,255,255,.065)}
      .consTwinField1642 label{display:block;color:#aeb7c5;font-size:11px;font-weight:750}.consTwinField1642 input{box-sizing:border-box;width:100%;min-height:42px;margin-top:6px;border-radius:12px;border:1px solid rgba(255,255,255,.09);background:#10141b;color:#fff;padding:9px 10px;font-size:13px;outline:none}.consTwinField1642>small{display:block;margin-top:7px;color:#7f8999!important;font-size:11px!important}
      .consTwinStep1642{display:grid;grid-template-columns:52px minmax(80px,1fr) 52px;gap:8px;align-items:center;margin:0 0 16px}.consTwinStep1642 button{min-height:46px;border-radius:14px!important;background:#171c25!important;border:1px solid rgba(255,255,255,.08)!important;color:#fff!important;font-size:22px!important}.consTwinStep1642 b{text-align:center;font-size:20px}
      .consTwinSave1642{width:100%;min-height:46px;border-radius:15px!important;margin-top:2px}
      @media(max-width:760px){.consTwinLocations1642{grid-template-columns:repeat(3,1fr)!important;gap:7px!important}.consTwinUnits1642{grid-template-columns:repeat(2,1fr)!important;gap:7px!important}.consTwinField1642{padding:11px;margin-bottom:13px}.consTwinStep1642{margin-bottom:13px}}
    `;
    root.appendChild(style);
  };
}
