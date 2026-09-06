import './panel_v180.js?v=1.6.36-base';

const HomeStockPanel = customElements.get('food-scanner-panel');

if (HomeStockPanel) {
  const alpha181 = (a,b) => String(a||'').localeCompare(String(b||''), 'it', {sensitivity:'base'});

  HomeStockPanel.prototype.hsGroupPurchaseStore181 = function(group) {
    const direct = String(group?.purchase_store || '').trim();
    if (direct) return direct;
    const items = Array.isArray(group?.items) ? group.items : [];
    const values = items.map(x => String(x?.purchase_store || '').trim()).filter(Boolean);
    if (!values.length) return '';
    const counts = new Map();
    for (const value of values) {
      const key = value.toLocaleLowerCase('it-IT');
      const current = counts.get(key) || {label:value,count:0};
      current.count += 1;
      counts.set(key,current);
    }
    return [...counts.values()].sort((a,b) => b.count-a.count || alpha181(a.label,b.label))[0]?.label || '';
  };

  HomeStockPanel.prototype.hsStoreForSource181 = function(kind, sourceKey) {
    const raw = String(sourceKey || '');
    const key = raw.includes(':') ? raw.slice(raw.indexOf(':') + 1) : raw;
    const groups = kind === 'food' ? (this.foodLowGroups?.() || []) : (this.consLowFamilyGroups?.() || []);
    const group = groups.find(g => String(g?.key || '') === key);
    return this.hsGroupPurchaseStore181(group);
  };

  HomeStockPanel.prototype.hsShoppingResolvedStore181 = function(item) {
    const saved = String(item?.purchase_store || '').trim();
    if (saved) return saved;
    const kind = String(item?.kind || '');
    const sourceKey = String(item?.source_key || '');
    if ((kind === 'food' || kind === 'cons') && sourceKey) {
      return this.hsStoreForSource181(kind, sourceKey);
    }
    return '';
  };

  const prevShoppingPost181 = HomeStockPanel.prototype.hsShoppingPost175;
  HomeStockPanel.prototype.hsShoppingPost175 = async function(payload) {
    const next = {...(payload || {})};
    if (next.action === 'add' && !next.purchase_store && next.kind && next.source_key) {
      next.purchase_store = this.hsStoreForSource181(String(next.kind), String(next.source_key));
    }
    return prevShoppingPost181.call(this, next);
  };

  HomeStockPanel.prototype.hsShoppingRow181 = function(item) {
    const glyph = item.kind === 'food' ? '🍎' : item.kind === 'cons' ? '🧴' : '•';
    const type = item.kind === 'food' ? 'Alimento' : item.kind === 'cons' ? 'Consumabile' : 'Prodotto';
    return `<div class="hsShopStoreRow181">
      <button class="hsShopCheck181" data-shop-toggle="${item.id}">○</button>
      <span class="hsShopType181">${glyph}</span>
      <div><b>${this.esc(item.name)}</b><small>${type}</small></div>
      <button class="hsShopRemove181" data-shop-remove="${item.id}">×</button>
    </div>`;
  };

  const prevListsView181 = HomeStockPanel.prototype.hsListsView175;
  HomeStockPanel.prototype.hsListsView175 = function() {
    const view = this._hsListsView175 || '';
    if (view !== 'shopping') return prevListsView181.call(this);

    const all = this._hsShopping175 || [];
    const active = all.filter(x => !x.checked);
    const checked = all.filter(x => x.checked);
    const grouped = new Map();
    for (const item of active) {
      const store = this.hsShoppingResolvedStore181(item);
      const key = store || '__unassigned__';
      if (!grouped.has(key)) grouped.set(key, {label: store || 'Da assegnare', items: []});
      grouped.get(key).items.push(item);
    }

    const sections = [...grouped.entries()]
      .sort((a,b) => {
        if (a[0] === '__unassigned__') return 1;
        if (b[0] === '__unassigned__') return -1;
        return alpha181(a[1].label,b[1].label);
      })
      .map(([,group]) => `<section class="hsShopStore181 ${group.label==='Da assegnare'?'unassigned':''}">
        <div class="hsShopStoreHead181"><span>${group.label==='Da assegnare'?'?':'🛒'}</span><div><b>${this.esc(group.label)}</b><small>${group.items.length} ${group.items.length===1?'prodotto':'prodotti'}</small></div></div>
        <div class="hsShopStoreList181">${group.items.sort((a,b)=>alpha181(a.name,b.name)).map(x=>this.hsShoppingRow181(x)).join('')}</div>
      </section>`).join('');

    return `<section class="hsModePage hsListsPage175">${this.hsListSubHead175('Lista spesa','Organizzata automaticamente per supermercato')}
      ${sections || '<div class="empty">Nessun prodotto nella lista spesa</div>'}
      ${checked.length ? `<section class="hsShoppingDone179 hsShopDone181"><b>Già spuntati (${checked.length})</b><div class="hsShopStoreList181">${checked.sort((a,b)=>alpha181(a.name,b.name)).map(x => `<div class="hsShopStoreRow181 checked"><button class="hsShopCheck181" data-shop-toggle="${x.id}">✓</button><span class="hsShopType181">${x.kind==='food'?'🍎':x.kind==='cons'?'🧴':'•'}</span><div><b>${this.esc(x.name)}</b><small>${this.esc(this.hsShoppingResolvedStore181(x) || 'Da assegnare')}</small></div><button class="hsShopRemove181" data-shop-remove="${x.id}">×</button></div>`).join('')}</div><button id="hsClearChecked175" class="hsClearChecked175">Rimuovi elementi spuntati</button></section>` : ''}
    </section>`;
  };

  const prevRender181 = HomeStockPanel.prototype.render;
  HomeStockPanel.prototype.render = function() {
    prevRender181.call(this);
    const root = this.shadowRoot;
    if (!root) return;
    const version = root.querySelector('.hsVersion165 b');
    if (version) version.textContent = 'v1.6.36';
    if (root.querySelector('#homeStockShoppingStores1636')) return;
    const style = document.createElement('style');
    style.id = 'homeStockShoppingStores1636';
    style.textContent = `
      .hsShopStore181{margin:0 0 14px;padding:14px;border-radius:22px;background:linear-gradient(145deg,rgba(17,28,42,.98),rgba(8,15,24,.99));border:1px solid rgba(132,172,219,.18)}
      .hsShopStore181.unassigned{border-color:rgba(245,158,11,.24)}
      .hsShopStoreHead181{display:flex;align-items:center;gap:11px;margin-bottom:12px}.hsShopStoreHead181>span{width:44px;height:44px;display:grid;place-items:center;border-radius:14px;background:rgba(22,137,255,.12);font-size:20px}.hsShopStore181.unassigned .hsShopStoreHead181>span{background:rgba(245,158,11,.12);color:#fbbf24}.hsShopStoreHead181 b{display:block;font-size:16px}.hsShopStoreHead181 small{display:block;margin-top:3px;color:#8395aa!important;font-size:10px!important}
      .hsShopStoreList181{display:grid;gap:8px}.hsShopStoreRow181{display:grid;grid-template-columns:38px 36px minmax(0,1fr) 34px;gap:8px;align-items:center;padding:10px;border-radius:16px;background:#0d1620;border:1px solid rgba(255,255,255,.055)}.hsShopStoreRow181.checked{opacity:.58}.hsShopStoreRow181 b{display:block;font-size:13px}.hsShopStoreRow181 small{display:block;margin-top:3px;color:#8293a7!important;font-size:9px!important}.hsShopCheck181,.hsShopRemove181{width:34px!important;height:34px!important;min-height:34px!important;padding:0!important;border-radius:11px!important;background:rgba(30,130,230,.10)!important;border:1px solid rgba(60,155,255,.20)!important;color:#8ecaff!important}.hsShopRemove181{background:transparent!important;border-color:rgba(255,255,255,.06)!important;color:#8191a5!important}.hsShopType181{width:34px;height:34px;display:grid;place-items:center;border-radius:11px;background:#131f2c;font-size:16px}.hsShopDone181{margin-top:20px}
      @media(max-width:760px){.hsShopStore181{padding:12px;border-radius:19px}.hsShopStoreRow181{grid-template-columns:36px 32px minmax(0,1fr) 32px;padding:9px}.hsShopType181{width:32px;height:32px}}
    `;
    root.appendChild(style);
  };
}
