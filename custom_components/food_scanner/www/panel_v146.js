import './panel_v145.js?v=1.4.6-base';

const HomeStockPanel = customElements.get('food-scanner-panel');

if (HomeStockPanel) {
  HomeStockPanel.prototype.effectiveThreshold = function(item) {
    const custom = Number(item?.min_stock || 0);
    return custom > 0 ? custom : 2;
  };

  HomeStockPanel.prototype.lowStock = function() {
    return this._cons
      .filter((x) => Number(x.stock_units || 0) <= this.effectiveThreshold(x))
      .slice()
      .sort((a, b) => Number(a.stock_units || 0) - Number(b.stock_units || 0));
  };

  HomeStockPanel.prototype.consVisible = function() {
    let out = this._cons.filter((x) => !this._consLocation || x.location === this._consLocation);
    if (this._lowOnly) out = out.filter((x) => Number(x.stock_units || 0) <= this.effectiveThreshold(x));
    return out;
  };

  HomeStockPanel.prototype.lowBanner = function() {
    const list = this.lowStock();
    const preview = list.slice(0, 10);
    return `<button id="lowBanner" class="bigBanner lowBanner ${this._lowOnly ? 'selectedBanner' : ''}"><div class="bannerHead"><div><strong>🛒 Quasi finiti / Da ricomprare</strong><span>${list.length} ${list.length === 1 ? 'prodotto alla soglia minima' : 'prodotti alla soglia minima'}</span></div><b>${list.length}</b></div><div class="bannerItems">${preview.length ? preview.map(x => `<span class="mini ${x.location}">${this.esc(x.product_name || 'Prodotto')} · ${Number(x.stock_units || 0)} ${this.unit(x.unit_name)} · soglia ${this.effectiveThreshold(x)}</span>`).join('') : '<span>Nessun consumabile quasi finito</span>'}</div><small>${this._lowOnly ? 'Tocca per mostrare tutti' : 'Soglia personalizzata se impostata, altrimenti 2'}</small></button>`;
  };

  const originalOpenManual146 = HomeStockPanel.prototype.openManual;
  HomeStockPanel.prototype.openManual = function() {
    originalOpenManual146.call(this);
    if (this._manual) this._manual.minStock = 0;
    this.render();
  };

  const originalManualDialog146 = HomeStockPanel.prototype.manualDialog;
  HomeStockPanel.prototype.manualDialog = function() {
    let html = originalManualDialog146.call(this);
    if (!this._manual || this._manual.status !== 'edit') return html;
    const value = Number(this._manual.minStock || 0);
    const block = `<div class="fieldTitle">Soglia minima <small>(facoltativa)</small></div><div class="step"><button id="mThresholdMinus">−</button><b id="mThreshold">${value > 0 ? value : 'Auto 2'}</b><button id="mThresholdPlus">+</button></div><small>Se non la imposti, HomeStock segnala il prodotto quando restano 2 unità.</small>`;
    return html.replace('<button id="manualSave" class="primary full">Aggiungi</button>', `${block}<button id="manualSave" class="primary full">Aggiungi</button>`);
  };

  HomeStockPanel.prototype.saveManual = async function() {
    const m = this._manual, r = this.shadowRoot;
    m.name = r.querySelector('#mName').value.trim();
    if (!m.name) { alert('Inserisci il nome'); return; }
    m.qty = Number(r.querySelector('#mQty').textContent || 1);
    m.unit = r.querySelector('[data-munit].selected')?.dataset.munit || 'Pezzi';
    m.location = r.querySelector('[data-mloc].selected')?.dataset.mloc || 'magazzino';
    const minStock = Number(m.minStock || 0);
    await this.consPost({action:'add_manual',changes:{product_name:m.name,stock_units:m.qty,unit_name:m.unit,location:m.location,category:'Altro',min_stock:minStock}});
    m.status = 'success';
    this.render();
  };

  const originalConsScanDialog146 = HomeStockPanel.prototype.consScanDialog;
  HomeStockPanel.prototype.consScanDialog = function() {
    let html = originalConsScanDialog146.call(this);
    const s = this._consScan;
    if (!s || s.status !== 'preview' || !s.detected) return html;
    if (s.minStock === undefined) s.minStock = 0;
    const value = Number(s.minStock || 0);
    const block = `<div class="fieldTitle">Soglia minima <small>(facoltativa)</small></div><div class="step"><button id="csThresholdMinus">−</button><b id="csThreshold">${value > 0 ? value : 'Auto 2'}</b><button id="csThresholdPlus">+</button></div><small>0 = automatica: avviso quando restano 2 unità.</small>`;
    return html.replace('<button id="saveDetected" class="primary full">Aggiungi</button>', `${block}<button id="saveDetected" class="primary full">Aggiungi</button>`);
  };

  HomeStockPanel.prototype.saveConsDetected = async function() {
    const s = this._consScan, d = s?.detected, r = this.shadowRoot;
    if (!s || !d) return;
    const qty = Number(r.querySelector('#csQty').textContent || 1);
    const changes = {
      ...d,
      product_name: r.querySelector('#csName').value,
      stock_units: qty,
      unit_name: r.querySelector('[data-unit].selected')?.dataset.unit || this.unit(d.unit_name),
      location: r.querySelector('[data-ploc].selected')?.dataset.ploc || s.location,
      min_stock: Number(s.minStock || 0),
    };
    await this.consPost({action:'add_manual',changes});
    s.status='success'; s.location=changes.location; s.detected=null; s.minStock=0;
    s.message='✓ Prodotto aggiunto. Puoi continuare con il prossimo.';
    this.render();
  };

  const originalRenderCons146 = HomeStockPanel.prototype.renderCons;
  HomeStockPanel.prototype.renderCons = function() {
    let html = originalRenderCons146.call(this);
    for (const item of this._cons) {
      const custom = Number(item.min_stock || 0);
      const oldText = `<small>Soglia minima: ${custom}</small>`;
      const newText = `<small>Soglia minima: ${custom > 0 ? custom : 'Automatica (2)'}</small>`;
      html = html.replace(oldText, newText);
    }
    return html;
  };

  const originalBind146 = HomeStockPanel.prototype.bind;
  HomeStockPanel.prototype.bind = function() {
    originalBind146.call(this);
    const r = this.shadowRoot;

    if (this._manual && this._manual.status === 'edit') {
      const label = r.querySelector('#mThreshold');
      r.querySelector('#mThresholdMinus')?.addEventListener('click', () => {
        this._manual.minStock = Math.max(0, Number(this._manual.minStock || 0) - 1);
        if (label) label.textContent = this._manual.minStock > 0 ? this._manual.minStock : 'Auto 2';
      });
      r.querySelector('#mThresholdPlus')?.addEventListener('click', () => {
        this._manual.minStock = Number(this._manual.minStock || 0) + 1;
        if (label) label.textContent = this._manual.minStock;
      });
      const manualSave = r.querySelector('#manualSave');
      if (manualSave) manualSave.onclick = () => this.saveManual();
    }

    if (this._consScan && this._consScan.status === 'preview') {
      const label = r.querySelector('#csThreshold');
      r.querySelector('#csThresholdMinus')?.addEventListener('click', () => {
        this._consScan.minStock = Math.max(0, Number(this._consScan.minStock || 0) - 1);
        if (label) label.textContent = this._consScan.minStock > 0 ? this._consScan.minStock : 'Auto 2';
      });
      r.querySelector('#csThresholdPlus')?.addEventListener('click', () => {
        this._consScan.minStock = Number(this._consScan.minStock || 0) + 1;
        if (label) label.textContent = this._consScan.minStock;
      });
      const saveDetected = r.querySelector('#saveDetected');
      if (saveDetected) saveDetected.onclick = () => this.saveConsDetected();
    }
  };
}
