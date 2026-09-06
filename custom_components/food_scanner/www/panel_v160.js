import './panel_v159.js?v=1.6.12-base';

const HomeStockPanel = customElements.get('food-scanner-panel');

if (HomeStockPanel) {
  HomeStockPanel.prototype.foodGenericName = function(item) {
    let name = String(item?.product_name || 'Prodotto').trim();
    const brand = String(item?.brand || '').trim();
    if (brand) {
      const escaped = brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      name = name.replace(new RegExp(`\\b${escaped}\\b`, 'ig'), ' ').trim();
    }
    name = name
      .replace(/\b\d+\s*[x×]\s*\d+(?:[.,]\d+)?\s*(?:g|kg|ml|cl|l)?\b/ig, ' ')
      .replace(/\b\d+(?:[.,]\d+)?\s*(?:g|kg|ml|cl|l)\b/ig, ' ')
      .replace(/^\s*\d+\s+(?=[A-Za-zÀ-ÿ])/u, '')
      .replace(/[·|_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return name || String(item?.product_name || 'Prodotto').trim() || 'Prodotto';
  };

  HomeStockPanel.prototype.foodStockGroups = function() {
    const map = new Map();
    for (const item of (this._items || [])) {
      const generic = this.foodGenericName(item);
      const key = generic.toLocaleLowerCase('it-IT');
      const category = String(item.category || 'Altro').trim() || 'Altro';
      const units = Math.max(0, Number(item.stock_units || 0));
      let group = map.get(key);
      if (!group) {
        group = { key, name: generic, category, units: 0, items: [] };
        map.set(key, group);
      }
      group.units += units;
      group.items.push(item);
      if (group.category === 'Altro' && category !== 'Altro') group.category = category;
    }
    return [...map.values()].sort((a,b) => a.name.localeCompare(b.name, 'it', {sensitivity:'base'}));
  };

  HomeStockPanel.prototype.foodLowGroups = function() {
    return this.foodStockGroups().filter(g => g.units <= 3).sort((a,b) => {
      const c = a.category.localeCompare(b.category, 'it', {sensitivity:'base'});
      return c || a.name.localeCompare(b.name, 'it', {sensitivity:'base'});
    });
  };

  const originalFoodVisible160 = HomeStockPanel.prototype.foodVisible;
  HomeStockPanel.prototype.foodVisible = function() {
    let out = originalFoodVisible160.call(this);
    const q = String(this._foodSearch || '').trim().toLocaleLowerCase('it-IT');
    if (q) {
      out = out.filter(item => {
        const text = [
          item.product_name,
          item.brand,
          item.category,
          item.barcode,
          this.foodGenericName(item),
        ].filter(Boolean).join(' ').toLocaleLowerCase('it-IT');
        return text.includes(q);
      });
    }

    if (this._foodLowOnly) {
      const lowKeys = new Set(this.foodLowGroups().map(g => g.key));
      out = out.filter(item => lowKeys.has(this.foodGenericName(item).toLocaleLowerCase('it-IT')));
    }

    if (!this._expiryView) {
      out = out.slice().sort((a,b) => {
        const an = this.foodGenericName(a);
        const bn = this.foodGenericName(b);
        const c = an.localeCompare(bn, 'it', {sensitivity:'base'});
        if (c) return c;
        return String(a.brand || '').localeCompare(String(b.brand || ''), 'it', {sensitivity:'base'});
      });
    }
    return out;
  };

  const renderLowStockPanel = (panel) => {
    const groups = panel.foodLowGroups();
    const byCategory = new Map();
    for (const g of groups) {
      const cat = g.category || 'Altro';
      if (!byCategory.has(cat)) byCategory.set(cat, []);
      byCategory.get(cat).push(g);
    }
    const categoryHtml = [...byCategory.entries()].map(([cat, list]) => `
      <div class="foodLowCategory">
        <span>${panel.esc(cat)}</span>
        <div>${list.map(g => `<button type="button" data-food-low-name="${panel.esc(g.key)}"><b>${panel.esc(g.name)}</b><small>${g.units}</small></button>`).join('')}</div>
      </div>`).join('');

    return `<section class="foodStockPanel ${panel._foodLowOnly ? 'active' : ''}">
      <button type="button" id="foodLowToggle" class="foodStockHead">
        <span class="foodStockIcon">↓</span>
        <span><b>Scorte basse</b><small>3 unità o meno · marche raggruppate</small></span>
        <strong>${groups.length}</strong>
      </button>
      ${groups.length ? `<div class="foodLowCategories">${categoryHtml}</div>` : '<div class="foodLowEmpty">Nessuna scorta bassa</div>'}
    </section>`;
  };

  const originalRender160 = HomeStockPanel.prototype.render;
  HomeStockPanel.prototype.render = function() {
    originalRender160.call(this);
    const root = this.shadowRoot;
    if (!root || this._mode !== 'food') return;
    const page = root.querySelector('.hsModePage');
    if (!page) return;

    if (!root.querySelector('#foodStockPanel')) {
      const holder = document.createElement('div');
      holder.id = 'foodStockPanel';
      holder.innerHTML = renderLowStockPanel(this);
      const alerts = page.querySelector('.hsAlerts');
      const zones = page.querySelector('.foodZones');
      (alerts || zones)?.insertAdjacentElement('afterend', holder);

      holder.querySelector('#foodLowToggle')?.addEventListener('click', () => {
        this._foodLowOnly = !this._foodLowOnly;
        this._expiryView = '';
        this.render();
      });
      holder.querySelectorAll('[data-food-low-name]').forEach(btn => btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this._foodSearch = btn.querySelector('b')?.textContent || '';
        this._foodLowOnly = false;
        this._expiryView = '';
        this.render();
      }));
    }

    if (!root.querySelector('#foodSearchBar')) {
      const listHead = page.querySelector('.hsListHead');
      if (listHead) {
        const wrap = document.createElement('div');
        wrap.id = 'foodSearchBar';
        wrap.className = 'foodSearchBar';
        wrap.innerHTML = `<span>⌕</span><input type="search" placeholder="Cerca alimento, categoria, marca o barcode" value="${this.esc(this._foodSearch || '')}"><button type="button" ${this._foodSearch ? '' : 'hidden'}>×</button>`;
        listHead.insertAdjacentElement('beforebegin', wrap);
        const input = wrap.querySelector('input');
        const clear = wrap.querySelector('button');
        input?.addEventListener('input', e => {
          this._foodSearch = e.target.value;
          this.render();
          requestAnimationFrame(() => {
            const next = this.shadowRoot?.querySelector('#foodSearchBar input');
            next?.focus();
            if (next) next.setSelectionRange(next.value.length, next.value.length);
          });
        });
        clear?.addEventListener('click', () => {
          this._foodSearch = '';
          this.render();
        });
      }
    }

    const listHead = page.querySelector('.hsListHead b');
    if (listHead && this._foodLowOnly) listHead.textContent = 'Alimenti con scorte basse';

    if (!root.querySelector('#homeStockFoodStock1612')) {
      const style = document.createElement('style');
      style.id = 'homeStockFoodStock1612';
      style.textContent = `
        .foodStockPanel{margin-top:8px;border:1px solid rgba(255,255,255,.075);background:#10141b;border-radius:17px;overflow:hidden}.foodStockPanel.active{border-color:rgba(245,158,11,.34);box-shadow:0 0 0 2px rgba(245,158,11,.05)}
        .foodStockHead{display:grid;grid-template-columns:36px 1fr auto;align-items:center;gap:9px;width:100%;padding:11px 12px;border:0!important;background:transparent!important;color:#fff!important;text-align:left}.foodStockIcon{width:32px;height:32px;border-radius:10px;display:grid;place-items:center;background:rgba(245,158,11,.11);color:#fbbf24;font-weight:900}.foodStockHead b{display:block;font-size:13px}.foodStockHead small{display:block;margin-top:2px;color:#7f8999!important;font-size:10px}.foodStockHead strong{font-size:20px}
        .foodLowCategories{padding:0 10px 10px}.foodLowCategory{padding-top:8px;border-top:1px solid rgba(255,255,255,.055)}.foodLowCategory>span{display:block;margin-bottom:6px;color:#788394;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.1em}.foodLowCategory>div{display:flex;flex-wrap:wrap;gap:6px}.foodLowCategory button{display:flex;align-items:center;gap:7px;border:1px solid rgba(255,255,255,.07)!important;background:#151a22!important;color:#d5dbe5!important;border-radius:999px!important;padding:6px 8px 6px 10px!important}.foodLowCategory button b{font-size:10px}.foodLowCategory button small{min-width:20px;height:20px;border-radius:999px;display:grid;place-items:center;background:rgba(245,158,11,.11);color:#fbbf24!important;font-size:9px}.foodLowEmpty{padding:0 12px 11px;color:#778192;font-size:11px}
        .foodSearchBar{display:grid;grid-template-columns:26px 1fr 30px;align-items:center;gap:4px;margin:13px 0 8px;padding:5px 7px;border-radius:14px;border:1px solid rgba(255,255,255,.075);background:#0f131a}.foodSearchBar>span{display:grid;place-items:center;color:#7f8a9a;font-size:18px}.foodSearchBar input{width:100%;min-width:0;border:0;background:transparent;color:#fff;outline:none;padding:7px 3px;font-size:12px}.foodSearchBar input::placeholder{color:#687385}.foodSearchBar button{width:28px;height:28px;border-radius:9px!important;border:0!important;background:rgba(255,255,255,.05)!important;color:#aab3c0!important;font-size:17px}.foodSearchBar button[hidden]{visibility:hidden}
        @media(max-width:760px){.foodStockHead{padding:10px}.foodStockHead b{font-size:12px}.foodStockHead small{font-size:9px!important}.foodLowCategories{padding:0 8px 8px}.foodLowCategory button{padding:6px 8px!important}.foodSearchBar{margin:10px 0 7px}.foodSearchBar input{font-size:12px}}
      `;
      root.appendChild(style);
    }
  };
}
