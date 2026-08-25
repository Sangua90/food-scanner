import './panel_v143.js?v=1.4.4-base';

const HomeStockPanel = customElements.get('food-scanner-panel');

if (HomeStockPanel) {
  HomeStockPanel.prototype.expiryStatus = function(expiryDate) {
    const d = this.days(expiryDate);
    if (d === null) return { color: '#6b7280', label: 'Scadenza non disponibile' };
    if (d < 0) return { color: '#ef4444', label: `Scaduto da ${Math.abs(d)} ${Math.abs(d) === 1 ? 'giorno' : 'giorni'}` };
    if (d <= 2) return { color: '#eab308', label: d === 0 ? 'Scade oggi' : `Scade tra ${d} ${d === 1 ? 'giorno' : 'giorni'}` };
    if (d <= 14) return { color: '#22c55e', label: `Scade tra ${d} giorni` };
    return { color: '#38bdf8', label: `Scade tra ${d} giorni` };
  };

  HomeStockPanel.prototype.foodVisible = function() {
    let out = this._items.slice();
    if (this._expiryOnly) {
      out = out
        .filter((x) => Boolean(x.expiry_date))
        .sort((a, b) => String(a.expiry_date).localeCompare(String(b.expiry_date)));
      return out;
    }
    if (this._location) out = out.filter((x) => x.location === this._location);
    return out;
  };

  const originalRenderFood = HomeStockPanel.prototype.renderFood;
  HomeStockPanel.prototype.renderFood = function() {
    let html = originalRenderFood.call(this);

    for (const item of this._items) {
      const status = this.expiryStatus(item.expiry_date);
      const marker = `<span title="${this.esc(status.label)}" aria-label="${this.esc(status.label)}" style="display:inline-flex;align-items:center;gap:6px;margin-top:8px;font-size:12px;color:#cbd5e1"><span style="display:inline-block;width:13px;height:13px;border-radius:50%;background:${status.color};box-shadow:0 0 8px ${status.color}88;flex:0 0 auto"></span>${this.esc(status.label)}</span>`;
      const expiryText = `<small>Scadenza: ${this.fmtDate(item.expiry_date)}</small>`;
      if (html.includes(expiryText)) {
        html = html.replace(expiryText, `${expiryText}${marker}`);
      }
    }

    if (this._expiryOnly) {
      html = html.replace(
        '<div class="tools">',
        '<div style="margin:10px 0;padding:10px 12px;border-radius:14px;background:#251a08;border:1px solid #6b4d12;color:#fde68a;font-size:13px">Filtro attivo: prodotti ordinati per scadenza</div><div class="tools">'
      );
    }
    return html;
  };

  const originalBind = HomeStockPanel.prototype.bind;
  HomeStockPanel.prototype.bind = function() {
    originalBind.call(this);
    const r = this.shadowRoot;
    const banner = r.querySelector('#expiryBanner');
    if (banner) {
      banner.onclick = () => {
        this._expiryOnly = !this._expiryOnly;
        if (this._expiryOnly) this._location = '';
        this.render();
      };
    }
  };
}
