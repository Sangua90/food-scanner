import './panel_v178.js?v=1.6.34-base';

const HomeStockPanel = customElements.get('food-scanner-panel');

if (HomeStockPanel) {
  const prevLoad179 = HomeStockPanel.prototype.load;
  HomeStockPanel.prototype.load = async function() {
    await prevLoad179.call(this);
    try {
      const data = await this._hass.callApi('GET', 'food_scanner/archive?sort=expiry');
      this._hsSettingsData = { ...(this._hsSettingsData || {}), ...(data?.settings || {}) };
    } catch (_) {}
  };

  const prevConsFamilyGroups179 = HomeStockPanel.prototype.consFamilyGroups;
  HomeStockPanel.prototype.consFamilyGroups = function() {
    const groups = prevConsFamilyGroups179 ? prevConsFamilyGroups179.call(this) : [];
    const globalThreshold = Math.max(0, Number(this._hsSettingsData?.consumable_low_stock_threshold ?? 2) || 0);
    return groups.map(group => {
      const thresholds = (group.items || []).map(item => {
        const custom = Math.max(0, Number(item?.min_stock || 0));
        return custom > 0 ? custom : globalThreshold;
      });
      return { ...group, threshold: thresholds.length ? Math.max(...thresholds) : globalThreshold };
    });
  };

  HomeStockPanel.prototype.hsShoppingMatch179 = function(kind, key) {
    const sourceKey = `${kind}:${key}`;
    return (this._hsShopping175 || []).find(x => !x.checked && String(x.source_key || '') === sourceKey) || null;
  };

  HomeStockPanel.prototype.hsLowSelectRow179 = function(group, kind) {
    const selected = this.hsShoppingMatch179(kind, group.key);
    const units = Math.max(0, Number(group.units || 0));
    const threshold = Math.max(0, Number(group.threshold || 0));
    const label = kind === 'food' ? 'Alimento' : 'Consumabile';
    const glyph = kind === 'food' ? '🍎' : '🧴';
    return `<div class="hsLowSelectRow179">
      <span class="hsLowSelectGlyph179">${glyph}</span>
      <div class="hsLowSelectCopy179"><b>${this.esc(group.name || 'Prodotto')}</b><small>${label} · ${units} disponibili · soglia ${threshold}</small></div>
      <button class="hsLowSelectButton179 ${selected ? 'selected' : ''}" data-stock-select="${this.esc(group.key)}" data-stock-kind="${kind}" data-stock-name="${this.esc(group.name || 'Prodotto')}" data-shop-id="${selected?.id || ''}">${selected ? '✓ In lista' : '+ Lista spesa'}</button>
    </div>`;
  };

  HomeStockPanel.prototype.hsListsHome175 = function() {
    const soon = this.hsActiveFoods175(this.foodUpcomingItems?.(7) || []);
    const expired = this.hsActiveFoods175(this.foodExpiredByAge?.(null) || []);
    const foodLow = this.foodLowGroups?.() || [];
    const consLow = this.consLowFamilyGroups?.() || [];
    const shopping = (this._hsShopping175 || []).filter(x => !x.checked);
    const reviews = this._reviews || [];
    return `<section class="hsModePage hsListsPage175">
      <div class="hsListsHead175"><span class="eyebrow">LISTE</span><h2>Tutto quello che ti serve</h2><p>Scorte, spesa e scadenze in un'unica vista</p></div>
      <div class="hsListStack175">
        ${this.hsListCard175('low','▣','Scorte basse','Alimenti e consumabili sotto soglia',foodLow.length + consLow.length,'amber')}
        ${this.hsListCard175('shopping','🛒','Lista spesa','Solo i prodotti che hai scelto di rifornire',shopping.length,'blue')}
        ${this.hsListCard175('soon','◷','In scadenza','Prodotti in scadenza a breve',soon.length,'blue')}
        ${this.hsListCard175('expired','!','Scaduti','Prodotti già scaduti',expired.length,'red')}
        ${this.hsListCard175('complete','▤','Da completare','Prodotti con informazioni mancanti',reviews.length,'green')}
      </div>
    </section>`;
  };

  const prevListsView179 = HomeStockPanel.prototype.hsListsView175;
  HomeStockPanel.prototype.hsListsView175 = function() {
    const view = this._hsListsView175 || '';
    if (!view) return this.hsListsHome175();

    if (view === 'low') {
      const food = this.foodLowGroups?.() || [];
      const cons = this.consLowFamilyGroups?.() || [];
      return `<section class="hsModePage hsListsPage175">${this.hsListSubHead175('Scorte basse','Scegli cosa vuoi aggiungere alla lista spesa')}
        <section class="hsLowSection179"><div class="hsLowSectionTitle179"><span>🍎</span><div><b>Alimenti</b><small>${food.length} sotto soglia</small></div></div><div class="hsLowSelectList179">${food.map(g => this.hsLowSelectRow179(g,'food')).join('') || '<div class="empty">Nessun alimento sotto soglia</div>'}</div></section>
        <section class="hsLowSection179"><div class="hsLowSectionTitle179"><span>🧴</span><div><b>Consumabili</b><small>${cons.length} sotto soglia</small></div></div><div class="hsLowSelectList179">${cons.map(g => this.hsLowSelectRow179(g,'cons')).join('') || '<div class="empty">Nessun consumabile sotto soglia</div>'}</div></section>
      </section>`;
    }

    if (view === 'shopping') {
      const active = (this._hsShopping175 || []).filter(x => !x.checked);
      const checked = (this._hsShopping175 || []).filter(x => x.checked);
      const foods = active.filter(x => x.kind === 'food');
      const cons = active.filter(x => x.kind === 'cons');
      const legacy = active.filter(x => x.kind !== 'food' && x.kind !== 'cons');
      const rows = items => items.map(x => `<div class="hsManualItem175"><button data-shop-toggle="${x.id}">○</button><span>${this.esc(x.name)}</span><button data-shop-remove="${x.id}">×</button></div>`).join('');
      return `<section class="hsModePage hsListsPage175">${this.hsListSubHead175('Lista spesa','Prodotti scelti dalle scorte basse')}
        <section class="hsShoppingSection179"><div class="hsLowSectionTitle179"><span>🍎</span><div><b>Alimenti</b><small>${foods.length} da comprare</small></div></div><div class="hsManualList175">${rows(foods) || '<div class="empty">Nessun alimento selezionato</div>'}</div></section>
        <section class="hsShoppingSection179"><div class="hsLowSectionTitle179"><span>🧴</span><div><b>Consumabili</b><small>${cons.length} da comprare</small></div></div><div class="hsManualList175">${rows(cons) || '<div class="empty">Nessun consumabile selezionato</div>'}</div></section>
        ${legacy.length ? `<section class="hsShoppingSection179"><div class="hsLowSectionTitle179"><span>•</span><div><b>Elementi precedenti</b><small>${legacy.length}</small></div></div><div class="hsManualList175">${rows(legacy)}</div></section>` : ''}
        ${checked.length ? `<section class="hsShoppingDone179"><b>Già spuntati (${checked.length})</b><div class="hsManualList175">${checked.map(x => `<div class="hsManualItem175 checked"><button data-shop-toggle="${x.id}">✓</button><span>${this.esc(x.name)}</span><button data-shop-remove="${x.id}">×</button></div>`).join('')}</div><button id="hsClearChecked175" class="hsClearChecked175">Rimuovi elementi spuntati</button></section>` : ''}
      </section>`;
    }

    return prevListsView179.call(this);
  };

  const prevBind179 = HomeStockPanel.prototype.bind;
  HomeStockPanel.prototype.bind = function() {
    prevBind179.call(this);
    const root = this.shadowRoot;
    if (!root) return;
    root.querySelectorAll('[data-stock-select]').forEach(btn => btn.addEventListener('click', async () => {
      const currentId = String(btn.dataset.shopId || '');
      if (currentId) {
        await this.hsShoppingPost175({action:'remove', id:currentId});
        return;
      }
      const kind = String(btn.dataset.stockKind || '');
      const key = String(btn.dataset.stockSelect || '');
      const name = String(btn.dataset.stockName || '').trim();
      if (!name) return;
      await this.hsShoppingPost175({action:'add', name, kind, source_key:`${kind}:${key}`});
    }));
  };

  const prevRender179 = HomeStockPanel.prototype.render;
  HomeStockPanel.prototype.render = function() {
    prevRender179.call(this);
    const root = this.shadowRoot;
    if (!root) return;

    const version = root.querySelector('.hsVersion165 b');
    if (version) version.textContent = 'v1.6.34';

    const stockCard = root.querySelector('.hsSettingCard165.stock');
    if (stockCard && !root.querySelector('.hsConsStock179')) {
      const value = Math.max(0, Number(this._hsSettingsData?.consumable_low_stock_threshold ?? 2) || 0);
      const card = document.createElement('section');
      card.className = 'hsSettingCard165 stock hsConsStock179';
      card.innerHTML = `<div class="hsSettingTitle165"><span>▣</span><div><b>Scorte basse · Consumabili</b><small>Soglia globale predefinita</small></div></div>
        <div class="hsSettingRow165"><div><b>Soglia</b><small>${value === 0 ? 'Mostra solo i consumabili finiti' : `Mostra ${value} unità o meno`}</small></div><div class="hsMiniStep165 amber"><button id="hsConsLowMinus179" ${value <= 0 ? 'disabled' : ''}>−</button><strong>${value}</strong><button id="hsConsLowPlus179">+</button></div></div>
        <p class="hsSettingNote165">È il valore usato dai consumabili lasciati su Auto. Una soglia specifica del singolo prodotto continua ad avere priorità.</p>`;
      stockCard.insertAdjacentElement('afterend', card);
      card.querySelector('#hsConsLowMinus179')?.addEventListener('click', () => this.saveInternalSetting165({consumable_low_stock_threshold: Math.max(0, value - 1)}));
      card.querySelector('#hsConsLowPlus179')?.addEventListener('click', () => this.saveInternalSetting165({consumable_low_stock_threshold: Math.min(999, value + 1)}));
    }

    if (root.querySelector('#homeStockLists1634')) return;
    const style = document.createElement('style');
    style.id = 'homeStockLists1634';
    style.textContent = `
      .hsLowSection179,.hsShoppingSection179,.hsShoppingDone179{margin:0 0 14px;padding:14px;border-radius:22px;background:linear-gradient(145deg,rgba(17,28,42,.98),rgba(8,15,24,.99));border:1px solid rgba(132,172,219,.18)}
      .hsLowSectionTitle179{display:flex;gap:11px;align-items:center;margin-bottom:12px}.hsLowSectionTitle179>span{width:42px;height:42px;display:grid;place-items:center;border-radius:14px;background:rgba(22,137,255,.12);font-size:20px}.hsLowSectionTitle179 b{display:block;font-size:15px}.hsLowSectionTitle179 small{display:block;margin-top:3px;color:#8395aa!important;font-size:10px!important}
      .hsLowSelectList179{display:grid;gap:8px}.hsLowSelectRow179{display:grid;grid-template-columns:44px minmax(0,1fr) auto;gap:10px;align-items:center;padding:10px;border-radius:16px;background:#0d1620;border:1px solid rgba(255,255,255,.055)}.hsLowSelectGlyph179{width:42px;height:42px;display:grid;place-items:center;border-radius:13px;background:#131f2c;font-size:19px}.hsLowSelectCopy179 b{display:block;font-size:13px}.hsLowSelectCopy179 small{display:block;margin-top:3px;color:#8293a7!important;font-size:9px!important}.hsLowSelectButton179{min-height:38px;padding:0 12px!important;border-radius:13px!important;border:1px solid rgba(58,155,255,.32)!important;background:rgba(24,124,225,.12)!important;color:#8ecaff!important;font-size:10px!important;font-weight:800!important}.hsLowSelectButton179.selected{border-color:rgba(34,197,94,.3)!important;background:rgba(34,197,94,.1)!important;color:#86efac!important}
      .hsShoppingDone179{margin-top:18px}.hsShoppingDone179>b{display:block;margin-bottom:10px;color:#8fa1b6;font-size:12px}
      @media(max-width:760px){.hsLowSelectRow179{grid-template-columns:40px minmax(0,1fr);}.hsLowSelectButton179{grid-column:1/-1;width:100%}.hsLowSection179,.hsShoppingSection179,.hsShoppingDone179{padding:12px;border-radius:19px}}
    `;
    root.appendChild(style);
  };
}
