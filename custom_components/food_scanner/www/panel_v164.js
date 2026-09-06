import './panel_v163.js?v=1.6.16-base';

const HomeStockPanel = customElements.get('food-scanner-panel');

if (HomeStockPanel) {
  const previousGenericName164 = HomeStockPanel.prototype.foodGenericName;
  HomeStockPanel.prototype.foodGenericName = function(item) {
    const stored = String(item?.generic_name || '').trim();
    if (stored) return stored;
    return previousGenericName164 ? previousGenericName164.call(this, item) : String(item?.product_name || 'Prodotto').trim();
  };

  const previousSearchMatch164 = HomeStockPanel.prototype.foodSearchMatch;
  HomeStockPanel.prototype.foodSearchMatch = function(item, query) {
    if (Number(item?.stock_units || 0) <= 0) return false;
    return previousSearchMatch164 ? previousSearchMatch164.call(this, item, query) : true;
  };

  const previousFoodStockGroups164 = HomeStockPanel.prototype.foodStockGroups;
  HomeStockPanel.prototype.foodStockGroups = function() {
    const groups = previousFoodStockGroups164 ? previousFoodStockGroups164.call(this) : [];
    return groups.map(group => {
      const stored = (group.items || []).map(x => String(x.generic_name || '').trim()).find(Boolean);
      return stored ? { ...group, name: stored, key: stored.toLocaleLowerCase('it-IT') } : group;
    });
  };

  HomeStockPanel.prototype.consGenericName = function(item) {
    const stored = String(item?.generic_name || '').trim();
    return stored || String(item?.product_name || 'Consumabile').trim() || 'Consumabile';
  };

  HomeStockPanel.prototype.consFamilyGroups = function() {
    const map = new Map();
    for (const item of (this._cons || [])) {
      const name = this.consGenericName(item);
      const key = name.toLocaleLowerCase('it-IT');
      let group = map.get(key);
      if (!group) {
        group = { key, name, units: 0, threshold: 0, category: item.category || 'Casa', items: [] };
        map.set(key, group);
      }
      group.units += Math.max(0, Number(item.stock_units || 0));
      group.threshold = Math.max(group.threshold, Number(item.effective_min_stock ?? item.min_stock ?? 2));
      group.items.push(item);
    }
    return [...map.values()].sort((a,b) => a.name.localeCompare(b.name, 'it', {sensitivity:'base'}));
  };

  HomeStockPanel.prototype.consLowFamilyGroups = function() {
    return this.consFamilyGroups().filter(g => g.units <= g.threshold);
  };

  HomeStockPanel.prototype.lowStock = function() {
    return this.consLowFamilyGroups();
  };

  HomeStockPanel.prototype.consVisible = function() {
    let out = (this._cons || []).slice();
    if (this._consLocation) out = out.filter(x => x.location === this._consLocation);
    if (this._lowOnly) {
      const lowKeys = new Set(this.consLowFamilyGroups().map(g => g.key));
      out = out.filter(x => lowKeys.has(this.consGenericName(x).toLocaleLowerCase('it-IT')));
    } else {
      out = out.filter(x => Number(x.stock_units || 0) > 0);
    }
    return out.sort((a,b) => {
      const fam = this.consGenericName(a).localeCompare(this.consGenericName(b), 'it', {sensitivity:'base'});
      if (fam) return fam;
      return String(a.product_name || '').localeCompare(String(b.product_name || ''), 'it', {sensitivity:'base'});
    });
  };

  const previousRenderCons164 = HomeStockPanel.prototype.renderCons;
  HomeStockPanel.prototype.renderCons = function() {
    let html = previousRenderCons164.call(this);
    if (!this._lowOnly) return html;
    const groups = this.consLowFamilyGroups();
    const summary = `<div class="consFamilySummary164">
      <div class="consFamilySummaryTitle"><b>Famiglie da ricomprare</b><span>${groups.length}</span></div>
      <div class="consFamilyChips164">${groups.map(g => `<span><b>${this.esc(g.name)}</b><small>${g.units} rimasti · soglia ${g.threshold}</small></span>`).join('') || '<span><b>Nessuna famiglia sotto soglia</b></span>'}</div>
    </div>`;
    return html.replace('<div class="hsProducts">', `${summary}<div class="hsProducts">`);
  };

  const previousRender164 = HomeStockPanel.prototype.render;
  HomeStockPanel.prototype.render = function() {
    previousRender164.call(this);
    const root = this.shadowRoot;
    if (!root || root.querySelector('#homeStockProductFamily1616')) return;
    const style = document.createElement('style');
    style.id = 'homeStockProductFamily1616';
    style.textContent = `
      .neoLowRow small{color:#8293a7!important}.neoLowRow strong{white-space:nowrap}
      .neoLowGroup .neoLowHead:after{content:'Raggruppato per tipologia';margin-left:auto;font-size:9px;color:#66778c;font-weight:600}
      .consFamilySummary164{margin:8px 0 10px;padding:12px;border-radius:16px;background:linear-gradient(145deg,rgba(37,99,235,.08),rgba(14,22,32,.96));border:1px solid rgba(96,165,250,.16)}
      .consFamilySummaryTitle{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}.consFamilySummaryTitle b{font-size:12px}.consFamilySummaryTitle span{min-width:27px;height:27px;border-radius:9px;display:grid;place-items:center;background:rgba(59,130,246,.12);color:#93c5fd;font-size:11px;font-weight:800}
      .consFamilyChips164{display:flex;gap:6px;flex-wrap:wrap}.consFamilyChips164>span{padding:7px 9px;border-radius:11px;background:#111a25;border:1px solid rgba(255,255,255,.06)}.consFamilyChips164 b{display:block;font-size:10px}.consFamilyChips164 small{display:block;margin-top:2px;color:#8190a3!important;font-size:8px!important}
      @media(max-width:760px){.neoLowGroup .neoLowHead:after{display:none}.consFamilySummary164{padding:10px}.consFamilyChips164{display:grid;grid-template-columns:1fr 1fr}}
    `;
    root.appendChild(style);
  };
}
