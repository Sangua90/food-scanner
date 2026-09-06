import './panel_v185.js?v=1.6.41-base';

const HomeStockPanel = customElements.get('food-scanner-panel');

if (HomeStockPanel) {
  HomeStockPanel.prototype.hsConsFileB641 = async function(file) {
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || '').split(',')[1] || '');
      reader.onerror = () => reject(reader.error || new Error('Lettura foto fallita'));
      reader.readAsDataURL(file);
    });
  };

  HomeStockPanel.prototype.hsConsMime641 = function(file) {
    if (file?.type) return file.type;
    const name = String(file?.name || '');
    if (/\.heic$/i.test(name)) return 'image/heic';
    if (/\.heif$/i.test(name)) return 'image/heif';
    if (/\.png$/i.test(name)) return 'image/png';
    if (/\.webp$/i.test(name)) return 'image/webp';
    return 'image/jpeg';
  };

  HomeStockPanel.prototype.hsConsAnalyze641 = async function(file) {
    const s = this._consScan;
    if (!s || !file) return;
    if (file.size > 12 * 1024 * 1024) {
      s.status = 'fallback';
      s.message = 'Foto troppo grande: massimo 12 MB.';
      this.render();
      return;
    }

    s.status = 'gemini_loading';
    s.message = 'Analisi della foto in corso…';
    this.render();

    try {
      const imageData = await this.hsConsFileB641(file);
      const result = await this._hass.callApi('POST', 'food_scanner/consumables', {
        action: 'scan_preview',
        location: s.location || 'magazzino',
        mime_type: this.hsConsMime641(file),
        image_data: imageData,
      });
      if (!this._consScan) return;
      const detected = result?.detected;
      if (!detected?.product_name) throw new Error('Consumabile non identificato correttamente.');
      s.detected = detected;
      s.qty = Math.max(1, Number(detected.units_per_package || 1));
      s.status = 'preview';
      s.message = 'Prodotto riconosciuto.';
      this.render();
    } catch (err) {
      if (!this._consScan) return;
      s.status = 'fallback';
      s.message = err?.message || String(err) || 'Riconoscimento non riuscito.';
      this.render();
    }
  };

  HomeStockPanel.prototype.hsConsSave641 = async function() {
    const s = this._consScan;
    const d = s?.detected;
    const root = this.shadowRoot;
    if (!s || !d || !root) return;

    const name = root.querySelector('#hsCsName641')?.value?.trim();
    if (!name) return alert('Inserisci il nome del prodotto.');
    const qty = Math.max(1, Number(s.qty || 1));
    const unitName = root.querySelector('[data-hs-unit641].selected')?.dataset.hsUnit641 || d.unit_name || 'Pezzi';
    const store = root.querySelector('#hsCsStore641')?.value?.trim() || '';
    const location = s.location || 'magazzino';
    const minStock = Math.max(0, Number(s.minStock || 0));

    const save = root.querySelector('#hsCsSave641');
    if (save) { save.disabled = true; save.textContent = 'Salvataggio…'; }

    try {
      await this.consPost({
        action: 'add_manual',
        changes: {
          ...d,
          product_name: name,
          stock_units: qty,
          unit_name: unitName,
          location,
          min_stock: minStock,
          purchase_store: store || null,
        },
      });
      if (!this._consScan) return;
      s.status = 'success';
      s.detected = null;
      s.message = `✓ ${name} aggiunto · ${qty} ${unitName} · ${this.loc(location)}${store ? ` · ${store}` : ''}`;
      this.render();
    } catch (err) {
      alert(err?.message || String(err));
      if (save) { save.disabled = false; save.textContent = 'Aggiungi a HomeStock'; }
    }
  };

  HomeStockPanel.prototype.consScanDialog = function() {
    const s = this._consScan;
    if (!s) return '';
    const locs = [
      ['magazzino','Magazzino'],['bagno','Bagno'],['cucina','Cucina'],
      ['lavanderia','Lavanderia'],['dispensa','Dispensa'],['stalla','Stalla'],
    ];

    if (s.status === 'gemini_loading') {
      return `<div class="overlay hsCsOverlay641"><div class="modal scanModal foodScanModal hsCsModal641">
        <button type="button" class="close" id="hsCsClose641">×</button>
        <div class="scanHead"><div class="scanIcon">⌁</div><div><h2>Riconoscimento prodotto</h2><p>Analizzo la foto del consumabile.</p></div></div>
        <div class="hsCsLoading641"><span class="scanPulse"></span><div><b>Analisi in corso…</b><small>Gemini sta riconoscendo prodotto, confezione e quantità.</small></div></div>
      </div></div>`;
    }

    if (s.status === 'preview' && s.detected) {
      const d = s.detected;
      const units = ['Pezzi','Bottiglie','Lattine','Vasetti','Confezioni'];
      const selectedUnit = d.unit_name || 'Pezzi';
      return `<div class="overlay hsCsOverlay641"><div class="modal scanModal foodScanModal hsCsModal641 hsCsPreview641">
        <button type="button" class="close" id="hsCsClose641">×</button>
        <div class="scanHead"><div class="scanIcon hsCsOk641">✓</div><div><h2>Prodotto riconosciuto</h2><p>Controlla i dati prima di aggiungerlo.</p></div></div>
        <div class="hsCsCard641"><label>Prodotto<input id="hsCsName641" type="text" value="${this.esc(d.product_name || '')}"></label><small>${this.esc([d.brand,d.quantity,d.category].filter(Boolean).join(' · ') || 'Consumabile')}</small></div>
        <div class="hsCsBlock641"><b>Quanti ne aggiungi?</b><div class="hsCsStep641"><button id="hsCsMinus641">−</button><strong id="hsCsQty641">${Math.max(1,Number(s.qty||1))}</strong><button id="hsCsPlus641">+</button></div></div>
        <div class="hsCsBlock641"><b>Unità</b><div class="hsCsChoices641">${units.map(u=>`<button type="button" data-hs-unit641="${u}" class="choice ${u===selectedUnit?'selected':''}">${u}</button>`).join('')}</div></div>
        <div class="hsCsBlock641"><b>Dove lo metti?</b><div class="choiceRow scanLocations hsCsLocations641">${locs.map(([k,l])=>`<button type="button" data-hs-loc641="${k}" class="choice ${k} ${s.location===k?'selected':''}">${l}</button>`).join('')}</div></div>
        <div class="hsCsBlock641"><label>Supermercato / negozio <small>(facoltativo)</small><input id="hsCsStore641" type="text" placeholder="Es. Lidl, Esselunga, Tigotà…" value="${this.esc(s.purchaseStore || '')}"></label></div>
        <div class="hsCsBlock641"><b>Soglia minima <small>(0 = automatica)</small></b><div class="hsCsStep641"><button id="hsCsThresholdMinus641">−</button><strong id="hsCsThreshold641">${Math.max(0,Number(s.minStock||0))}</strong><button id="hsCsThresholdPlus641">+</button></div></div>
        <button id="hsCsSave641" type="button" class="primary full hsCsSave641">Aggiungi a HomeStock</button>
      </div></div>`;
    }

    if (s.status === 'success') {
      return `<div class="overlay hsCsOverlay641"><div class="modal scanModal foodScanModal hsCsModal641">
        <button type="button" class="close" id="hsCsClose641">×</button>
        <div class="scanHead"><div class="scanIcon hsCsOk641">✓</div><div><h2>Consumabile aggiunto</h2><p>${this.esc(s.message || 'Prodotto salvato.')}</p></div></div>
        <div class="scanSuccess"><span>✓</span><div><b>Salvataggio completato</b><small>Puoi continuare con un altro consumabile.</small></div></div>
        <div class="modalActions"><button id="hsCsNext641" class="primary">Scansiona prossimo</button><button id="hsCsDone641">Fine</button></div>
      </div></div>`;
    }

    const fallback = s.status === 'fallback';
    return `<div class="overlay hsCsOverlay641"><div class="modal scanModal foodScanModal hsCsModal641">
      <button type="button" class="close" id="hsCsClose641">×</button>
      <div class="scanHead"><div class="scanIcon">⌁</div><div><h2>Scansiona consumabile</h2><p>${fallback ? this.esc(s.message || 'Riprova con una foto più chiara.') : 'Scegli dove lo riponi e scatta una foto della confezione.'}</p></div></div>
      <div class="scanSectionLabel">Dove lo metti?</div>
      <div class="choiceRow scanLocations hsCsLocations641">${locs.map(([k,l])=>`<button type="button" data-hs-loc641="${k}" class="choice ${k} ${s.location===k?'selected':''}">${l}</button>`).join('')}</div>
      <input id="hsCsFile641" type="file" accept="image/*,.heic,.heif" capture="environment" class="hsCsHidden641">
      <label for="hsCsFile641" class="scanPhotoButton hsCsPhoto641"><span class="cameraGlyph">◉</span><span><b>${fallback?'Riprova foto':'Scatta foto'}</b><small>Apri la fotocamera</small></span></label>
      ${fallback ? `<div class="scanHint"><b>Riconoscimento non riuscito</b><span>${this.esc(s.message || 'Riprova con una foto più chiara.')}</span></div>` : ''}
    </div></div>`;
  };

  const prevBind186 = HomeStockPanel.prototype.bind;
  HomeStockPanel.prototype.bind = function() {
    prevBind186.call(this);
    const root = this.shadowRoot;
    const s = this._consScan;
    if (!root || !s) return;

    const close = () => { this._consScan = null; this.render(); };
    root.querySelector('#hsCsClose641')?.addEventListener('click', close);
    root.querySelector('#hsCsDone641')?.addEventListener('click', close);
    root.querySelector('#hsCsNext641')?.addEventListener('click', () => this.openConsScan());

    root.querySelectorAll('[data-hs-loc641]').forEach(btn => btn.addEventListener('click', () => {
      root.querySelectorAll('[data-hs-loc641]').forEach(x => x.classList.remove('selected'));
      btn.classList.add('selected');
      s.location = btn.dataset.hsLoc641 || 'magazzino';
    }));

    const file = root.querySelector('#hsCsFile641');
    if (file) file.onchange = (event) => {
      const picked = event.target?.files?.[0];
      if (picked) this.hsConsAnalyze641(picked);
    };

    if (s.status === 'preview') {
      root.querySelectorAll('[data-hs-unit641]').forEach(btn => btn.addEventListener('click', () => {
        root.querySelectorAll('[data-hs-unit641]').forEach(x => x.classList.remove('selected'));
        btn.classList.add('selected');
      }));
      root.querySelector('#hsCsMinus641')?.addEventListener('click', () => { s.qty=Math.max(1,Number(s.qty||1)-1); root.querySelector('#hsCsQty641').textContent=s.qty; });
      root.querySelector('#hsCsPlus641')?.addEventListener('click', () => { s.qty=Math.max(1,Number(s.qty||1)+1); root.querySelector('#hsCsQty641').textContent=s.qty; });
      root.querySelector('#hsCsThresholdMinus641')?.addEventListener('click', () => { s.minStock=Math.max(0,Number(s.minStock||0)-1); root.querySelector('#hsCsThreshold641').textContent=s.minStock; });
      root.querySelector('#hsCsThresholdPlus641')?.addEventListener('click', () => { s.minStock=Math.max(0,Number(s.minStock||0)+1); root.querySelector('#hsCsThreshold641').textContent=s.minStock; });
      root.querySelector('#hsCsStore641')?.addEventListener('input', e => { s.purchaseStore=e.target.value; });
      root.querySelector('#hsCsSave641')?.addEventListener('click', () => this.hsConsSave641());
    }
  };

  const prevRender186 = HomeStockPanel.prototype.render;
  HomeStockPanel.prototype.render = function() {
    prevRender186.call(this);
    const root = this.shadowRoot;
    if (!root) return;
    const version = root.querySelector('.hsVersion165 b');
    if (version) version.textContent = 'v1.6.41';
    if (root.querySelector('#homeStockConsFlow1641')) return;
    const style = document.createElement('style');
    style.id = 'homeStockConsFlow1641';
    style.textContent = `
      .hsCsOverlay641{position:fixed!important;inset:0!important;z-index:2147483000!important;pointer-events:auto!important;display:flex!important;align-items:center!important;justify-content:center!important;background:rgba(0,0,0,.72)!important}
      .hsCsModal641{position:relative!important;z-index:2147483001!important;pointer-events:auto!important;width:min(560px,calc(100vw - 28px))!important;max-height:calc(100dvh - 36px)!important;overflow:auto!important}
      .hsCsModal641 button,.hsCsModal641 label,.hsCsModal641 input{pointer-events:auto!important;touch-action:manipulation!important}
      .hsCsHidden641{position:absolute!important;width:1px!important;height:1px!important;opacity:0!important;overflow:hidden!important;pointer-events:none!important}
      .hsCsPhoto641{box-sizing:border-box!important;cursor:pointer!important}
      .hsCsLocations641{grid-template-columns:repeat(3,1fr)!important}.hsCsLocations641 .choice.selected,.hsCsChoices641 .choice.selected{background:rgba(47,140,255,.13)!important;border-color:rgba(47,140,255,.48)!important;color:#bcd9ff!important;outline:none!important}
      .hsCsLoading641{display:grid;grid-template-columns:48px 1fr;gap:12px;align-items:center;padding:16px;border-radius:18px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07)}.hsCsLoading641 b{display:block;font-size:16px}.hsCsLoading641 small{display:block;margin-top:4px;color:#8f98aa!important;font-size:12px!important}
      .hsCsOk641{color:#86efac!important;background:rgba(34,197,94,.12)!important}.hsCsCard641,.hsCsBlock641{padding:13px;border-radius:17px;background:rgba(255,255,255,.028);border:1px solid rgba(255,255,255,.065);margin-top:9px}.hsCsCard641 label,.hsCsBlock641 label{display:block;font-size:11px;color:#aeb7c5;font-weight:750}.hsCsCard641 input,.hsCsBlock641 input{box-sizing:border-box;width:100%;min-height:42px;margin-top:6px;border-radius:12px;border:1px solid rgba(255,255,255,.09);background:#10141b;color:#fff;padding:9px 10px;font-size:13px;outline:none}.hsCsCard641>small{display:block;margin-top:7px;color:#7f8999!important}.hsCsBlock641>b{display:block;font-size:11px;color:#aeb7c5;margin-bottom:9px}.hsCsBlock641 b small{font-weight:500;color:#747e8f}.hsCsStep641{display:grid;grid-template-columns:48px 1fr 48px;gap:8px;align-items:center}.hsCsStep641 button{min-height:42px;border-radius:12px!important}.hsCsStep641 strong{text-align:center;font-size:18px}.hsCsChoices641{display:grid;grid-template-columns:repeat(5,1fr);gap:6px}.hsCsChoices641 .choice{min-height:39px;border-radius:11px!important;background:#121720!important;border:1px solid rgba(255,255,255,.075)!important;color:#b9c1ce!important;font-size:11px;padding:7px!important}.hsCsSave641{width:100%!important;min-height:48px!important;margin-top:12px!important;border-radius:14px!important}
      @media(max-width:760px){.hsCsOverlay641{padding:max(14px,env(safe-area-inset-top,0px)) 14px max(18px,env(safe-area-inset-bottom,0px))!important}.hsCsModal641{width:100%!important;max-height:calc(100dvh - 32px)!important}.hsCsLocations641{grid-template-columns:repeat(3,1fr)!important;gap:7px!important}.hsCsChoices641{grid-template-columns:repeat(2,1fr)}}
    `;
    root.appendChild(style);
  };
}
