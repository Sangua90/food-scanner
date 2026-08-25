import './panel_v144.js?v=1.4.5-base';

const HomeStockPanel = customElements.get('food-scanner-panel');

if (HomeStockPanel) {
  // Attention window: today through 2 days. Expired products have their own view.
  HomeStockPanel.prototype.expiringSoon = function() {
    return this._items
      .filter((x) => {
        const d = this.days(x.expiry_date);
        return d !== null && d >= 0 && d <= 2;
      })
      .slice()
      .sort((a, b) => String(a.expiry_date).localeCompare(String(b.expiry_date)));
  };

  HomeStockPanel.prototype.expiredItems = function() {
    return this._items
      .filter((x) => {
        const d = this.days(x.expiry_date);
        return d !== null && d < 0;
      })
      .slice()
      .sort((a, b) => String(a.expiry_date).localeCompare(String(b.expiry_date)));
  };

  // Fixed household threshold requested for consumables: 2 units or fewer.
  HomeStockPanel.prototype.lowStock = function() {
    return this._cons
      .filter((x) => Number(x.stock_units || 0) <= 2)
      .slice()
      .sort((a, b) => Number(a.stock_units || 0) - Number(b.stock_units || 0));
  };

  HomeStockPanel.prototype.consVisible = function() {
    let out = this._cons.filter((x) => !this._consLocation || x.location === this._consLocation);
    if (this._lowOnly) out = out.filter((x) => Number(x.stock_units || 0) <= 2);
    return out;
  };

  HomeStockPanel.prototype.foodVisible = function() {
    let out = this._items.slice();
    if (this._expiryView === 'soon') return this.expiringSoon();
    if (this._expiryView === 'expired') return this.expiredItems();
    if (this._location) out = out.filter((x) => x.location === this._location);
    return out;
  };

  HomeStockPanel.prototype.expiryBanner = function() {
    const list = this.expiringSoon();
    const preview = list.slice(0, 10);
    const selected = this._expiryView === 'soon';
    return `<div class="expiryBannerPair"><button id="expiryBanner" class="bigBanner expiryBanner ${selected ? 'selectedBanner' : ''}"><div class="bannerHead"><div><strong>🟠 Prossime scadenze</strong><span>${list.length} ${list.length === 1 ? 'prodotto da usare presto' : 'prodotti da usare presto'}</span></div><b>${list.length}</b></div><div class="bannerItems">${preview.length ? preview.map(x => `<span class="mini ${x.location}">${this.esc(x.product_name || 'Prodotto')} · ${this.fmtDate(x.expiry_date)}</span>`).join('') : '<span>Nessun prodotto in scadenza nei prossimi 2 giorni</span>'}</div><small>${selected ? 'Tocca per mostrare tutti' : 'Tocca per mostrare solo le prossime scadenze'}</small></button><button id="expiredBanner" class="bigBanner expiredBanner ${this._expiryView === 'expired' ? 'selectedBanner' : ''}">${this.expiredBannerInner()}</button></div>`;
  };

  HomeStockPanel.prototype.expiredBannerInner = function() {
    const list = this.expiredItems();
    const preview = list.slice(0, 10);
    const selected = this._expiryView === 'expired';
    return `<div class="bannerHead"><div><strong>🔴 Scaduti</strong><span>${list.length} ${list.length === 1 ? 'prodotto scaduto' : 'prodotti scaduti'}</span></div><b>${list.length}</b></div><div class="bannerItems">${preview.length ? preview.map(x => `<span class="mini ${x.location}">${this.esc(x.product_name || 'Prodotto')} · ${this.fmtDate(x.expiry_date)}</span>`).join('') : '<span>Nessun prodotto scaduto</span>'}</div><small>${selected ? 'Tocca per mostrare tutti' : 'Tocca per mostrare solo gli scaduti'}</small>`;
  };

  HomeStockPanel.prototype.lowBanner = function() {
    const list = this.lowStock();
    const preview = list.slice(0, 10);
    return `<button id="lowBanner" class="bigBanner lowBanner ${this._lowOnly ? 'selectedBanner' : ''}"><div class="bannerHead"><div><strong>🛒 Quasi finiti / Da ricomprare</strong><span>${list.length} ${list.length === 1 ? 'prodotto con 2 unità o meno' : 'prodotti con 2 unità o meno'}</span></div><b>${list.length}</b></div><div class="bannerItems">${preview.length ? preview.map(x => `<span class="mini ${x.location}">${this.esc(x.product_name || 'Prodotto')} · ${Number(x.stock_units || 0)} ${this.unit(x.unit_name)}</span>`).join('') : '<span>Nessun consumabile quasi finito</span>'}</div><small>${this._lowOnly ? 'Tocca per mostrare tutti' : 'Tocca per mostrare solo ciò che sta finendo'}</small></button>`;
  };

  const originalRenderFood145 = HomeStockPanel.prototype.renderFood;
  HomeStockPanel.prototype.renderFood = function() {
    let html = originalRenderFood145.call(this);
    if (this._expiryView) {
      const label = this._expiryView === 'expired' ? 'Filtro attivo: prodotti scaduti' : 'Filtro attivo: prossime scadenze (0–2 giorni)';
      html = html.replace(/<div style="margin:10px 0;padding:10px 12px;border-radius:14px;background:#251a08;border:1px solid #6b4d12;color:#fde68a;font-size:13px">Filtro attivo: prodotti ordinati per scadenza<\/div>/g, '');
      html = html.replace('<div class="tools">', `<div style="margin:10px 0;padding:10px 12px;border-radius:14px;background:#251a08;border:1px solid #6b4d12;color:#fde68a;font-size:13px">${label}</div><div class="tools">`);
    }
    return html;
  };

  const originalBind145 = HomeStockPanel.prototype.bind;
  HomeStockPanel.prototype.bind = function() {
    originalBind145.call(this);
    const r = this.shadowRoot;
    const soon = r.querySelector('#expiryBanner');
    if (soon) soon.onclick = () => {
      this._expiryView = this._expiryView === 'soon' ? '' : 'soon';
      this._expiryOnly = false;
      if (this._expiryView) this._location = '';
      this.render();
    };
    const expired = r.querySelector('#expiredBanner');
    if (expired) expired.onclick = () => {
      this._expiryView = this._expiryView === 'expired' ? '' : 'expired';
      this._expiryOnly = false;
      if (this._expiryView) this._location = '';
      this.render();
    };
  };
}
