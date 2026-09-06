import './panel_v174.js?v=1.6.30-base';

const HomeStockPanel = customElements.get('food-scanner-panel');

if (HomeStockPanel) {
  const prevLoad175 = HomeStockPanel.prototype.load;
  HomeStockPanel.prototype.load = async function() {
    await prevLoad175.call(this);
    if (!this._hass) return;
    try {
      const data = await this._hass.callApi('GET', 'food_scanner/shopping');
      this._hsShopping175 = Array.isArray(data?.items) ? data.items : [];
    } catch (_) {
      this._hsShopping175 = this._hsShopping175 || [];
    }
  };

  HomeStockPanel.prototype.openLists175 = function(view = '') {
    this._hsListsPage175 = true;
    this._hsListsView175 = view;
    this._hsSettingsPage = false;
    this._hsQuickAddOpen = false;
    this.render();
  };

  HomeStockPanel.prototype.closeLists175 = function() {
    this._hsListsPage175 = false;
    this._hsListsView175 = '';
    this.render();
  };

  HomeStockPanel.prototype.hsActiveFoods175 = function(items) {
    return (items || []).filter(x => Number(x?.stock_units || 0) > 0);
  };

  HomeStockPanel.prototype.hsRebuyGroups175 = function() {
    const food = (this.foodLowGroups?.() || []).map(g => ({...g, kind:'food'}));
    const cons = (this.consLowFamilyGroups?.() || []).map(g => ({...g, kind:'cons'}));
    return [...food, ...cons].sort((a,b) => String(a.name || '').localeCompare(String(b.name || ''), 'it', {sensitivity:'base'}));
  };

  HomeStockPanel.prototype.hsListCard175 = function(id, icon, title, subtitle, count, tone = 'blue') {
    return `<button class="hsListCard175 ${tone}" data-list-view="${id}">
      <span class="hsListIcon175">${icon}</span>
      <span class="hsListCopy175"><b>${this.esc(title)}</b><small>${this.esc(subtitle)}</small></span>
      ${count === null ? '' : `<strong>${Number(count || 0)}</strong>`}<em>›</em>
    </button>`;
  };

  HomeStockPanel.prototype.hsListsHome175 = function() {
    const soon = this.hsActiveFoods175(this.foodUpcomingItems?.(7) || []);
    const expired = this.hsActiveFoods175(this.foodExpiredByAge?.(null) || []);
    const foodLow = this.foodLowGroups?.() || [];
    const consLow = this.consLowFamilyGroups?.() || [];
    const rebuy = this.hsRebuyGroups175();
    const reviews = this._reviews || [];
    const manual = (this._hsShopping175 || []).filter(x => !x.checked);
    return `<section class="hsModePage hsListsPage175">
      <div class="hsListsHead175"><span class="eyebrow">LISTE</span><h2>Tutto quello che ti serve</h2><p>Scadenze, scorte e spesa in un'unica vista</p></div>
      <div class="hsListStack175">
        ${this.hsListCard175('rebuy','🛒','Da ricomprare','Alimenti e consumabili finiti o sotto soglia',rebuy.length + manual.length,'blue')}
        ${this.hsListCard175('soon','◷','In scadenza','Prodotti in scadenza a breve',soon.length,'blue')}
        ${this.hsListCard175('expired','!','Scaduti','Prodotti già scaduti',expired.length,'red')}
        ${this.hsListCard175('low','▣','Scorte basse','Prodotti con quantità sotto soglia',foodLow.length + consLow.length,'amber')}
        ${this.hsListCard175('complete','▤','Da completare','Prodotti con informazioni mancanti',reviews.length,'green')}
        ${this.hsListCard175('manual','≡','Lista spesa manuale','Aggiungi prodotti che non sono ancora in HomeStock',manual.length,'blue')}
      </div>
    </section>`;
  };

  HomeStockPanel.prototype.hsListSubHead175 = function(title, subtitle) {
    return `<div class="hsListSubHead175"><button id="hsListsBack175">‹</button><div><span class="eyebrow">LISTE</span><h2>${this.esc(title)}</h2><p>${this.esc(subtitle)}</p></div></div>`;
  };

  HomeStockPanel.prototype.hsFamilyRow175 = function(g) {
    const isCons = g.kind === 'cons';
    const glyph = isCons ? '🧴' : '🍎';
    const meta = isCons ? 'Consumabile' : 'Alimento';
    const units = Math.max(0, Number(g.units || 0));
    const threshold = Math.max(0, Number(g.threshold ?? this.foodLowThreshold?.() ?? 0));
    return `<div class="hsFamilyRow175"><span>${glyph}</span><div><b>${this.esc(g.name || 'Prodotto')}</b><small>${meta} · ${units} disponibili · soglia ${threshold}</small></div><strong class="${units===0?'zero':''}">${units===0?'Finito':'Scorta bassa'}</strong></div>`;
  };

  HomeStockPanel.prototype.hsListsView175 = function() {
    const view = this._hsListsView175 || '';
    if (!view) return this.hsListsHome175();

    if (view === 'soon') {
      const items = this.hsActiveFoods175(this.foodUpcomingItems?.(30) || []);
      return `<section class="hsModePage hsListsPage175">${this.hsListSubHead175('In scadenza','Prodotti che richiedono attenzione')}
        <div class="neoFoodList hsListsFood175">${items.map(x => this.foodMainCard(x)).join('') || '<div class="empty">Nessun prodotto in scadenza</div>'}</div></section>`;
    }
    if (view === 'expired') {
      const items = this.hsActiveFoods175(this.foodExpiredByAge?.(null) || []);
      return `<section class="hsModePage hsListsPage175">${this.hsListSubHead175('Scaduti','Prodotti già scaduti da gestire')}
        <div class="neoFoodList hsListsFood175">${items.map(x => this.foodMainCard(x)).join('') || '<div class="empty">Nessun prodotto scaduto</div>'}</div></section>`;
    }
    if (view === 'low') {
      const groups = this.hsRebuyGroups175();
      return `<section class="hsModePage hsListsPage175">${this.hsListSubHead175('Scorte basse','Controlla cosa sta per finire')}
        <div class="hsFamilyList175">${groups.map(g => this.hsFamilyRow175(g)).join('') || '<div class="empty">Nessuna scorta bassa</div>'}</div></section>`;
    }
    if (view === 'rebuy') {
      const groups = this.hsRebuyGroups175();
      const manual = (this._hsShopping175 || []).filter(x => !x.checked);
      return `<section class="hsModePage hsListsPage175">${this.hsListSubHead175('Da ricomprare','Prodotti finiti o sotto soglia')}
        <div class="hsFilterChips175"><button class="active">Tutti</button><button>Alimenti</button><button>Consumabili</button></div>
        <div class="hsFamilyList175">${groups.map(g => this.hsFamilyRow175(g)).join('')}</div>
        ${manual.length ? `<div class="hsManualBlock175"><b>Aggiunti manualmente</b>${manual.map(x => `<div class="hsManualRow175"><span>☐</span><div>${this.esc(x.name)}</div></div>`).join('')}</div>` : ''}
        <button id="hsOpenManual175" class="hsManualAdd175">＋ Aggiungi alla lista manualmente</button>
      </section>`;
    }
    if (view === 'complete') {
      const reviews = this._reviews || [];
      return `<section class="hsModePage hsListsPage175">${this.hsListSubHead175('Da completare','Scansioni con informazioni mancanti')}
        <div class="hsFamilyList175">${reviews.map(r => { const f=r.food||{}; return `<div class="hsFamilyRow175"><span>▤</span><div><b>${this.esc(f.product_name || 'Prodotto da completare')}</b><small>${this.esc((f.missing_fields || []).join(', ') || 'Controlla i dati del prodotto')}</small></div><strong>Da completare</strong></div>`; }).join('') || '<div class="empty">Nessuna verifica da completare</div>'}</div></section>`;
    }

    const shopping = this._hsShopping175 || [];
    return `<section class="hsModePage hsListsPage175">${this.hsListSubHead175('Lista spesa manuale','Aggiungi qualsiasi cosa ti serva')}
      <div class="hsManualComposer175"><input id="hsManualInput175" placeholder="Es. pile AA, sale, sacchi pattumiera"><button id="hsManualAddBtn175">Aggiungi</button></div>
      <div class="hsManualList175">${shopping.map(x => `<div class="hsManualItem175 ${x.checked?'checked':''}"><button data-shop-toggle="${x.id}">${x.checked?'✓':'○'}</button><span>${this.esc(x.name)}</span><button data-shop-remove="${x.id}">×</button></div>`).join('') || '<div class="empty">La lista manuale è vuota</div>'}</div>
      ${shopping.some(x=>x.checked) ? '<button id="hsClearChecked175" class="hsClearChecked175">Rimuovi elementi spuntati</button>' : ''}
    </section>`;
  };

  const prevRenderFood175 = HomeStockPanel.prototype.renderFood;
  const prevRenderCons175 = HomeStockPanel.prototype.renderCons;
  HomeStockPanel.prototype.renderFood = function() {
    if (this._hsListsPage175) return this.hsListsView175();
    return prevRenderFood175.call(this);
  };
  HomeStockPanel.prototype.renderCons = function() {
    if (this._hsListsPage175) return this.hsListsView175();
    return prevRenderCons175.call(this);
  };

  HomeStockPanel.prototype.hsShoppingPost175 = async function(payload) {
    const data = await this._hass.callApi('POST','food_scanner/shopping',payload);
    this._hsShopping175 = Array.isArray(data?.items) ? data.items : [];
    this.render();
  };

  HomeStockPanel.prototype.installNav175 = function() {
    const root = this.shadowRoot;
    const nav = root?.querySelector('.hsBottomNav163');
    if (!nav) return;
    nav.innerHTML = `
      <button type="button" id="hsNavFood175"><span class="hsNavIcon">♧</span><small>Alimenti</small></button>
      <button type="button" id="hsNavCons175"><span class="hsNavIcon">♙</span><small>Consumabili</small></button>
      <button type="button" id="hsNavPlus175" class="hsNavPlus" aria-label="Aggiungi">+</button>
      <button type="button" id="hsNavLists175"><span class="hsNavIcon">▤</span><small>Liste</small></button>
      <button type="button" id="hsNavSettings175"><span class="hsNavIcon">⚙</span><small>Impostazioni</small></button>`;

    nav.querySelector('#hsNavFood175')?.addEventListener('click', () => { this._hsListsPage175=false; this._hsSettingsPage=false; this._mode='food'; this._foodNeoMenu=''; this._foodNeoSearch=''; this.render(); });
    nav.querySelector('#hsNavCons175')?.addEventListener('click', () => { this._hsListsPage175=false; this._hsSettingsPage=false; this._mode='cons'; this.render(); });
    nav.querySelector('#hsNavPlus175')?.addEventListener('click', () => { this._hsListsPage175=false; this._hsSettingsPage=false; this.openQuickAdd163?.(); });
    nav.querySelector('#hsNavLists175')?.addEventListener('click', () => this.openLists175());
    nav.querySelector('#hsNavSettings175')?.addEventListener('click', () => { this._hsListsPage175=false; this.openInternalSettings165?.(); });

    nav.querySelectorAll('button').forEach(x => x.classList.remove('active'));
    if (this._hsSettingsPage) nav.querySelector('#hsNavSettings175')?.classList.add('active');
    else if (this._hsListsPage175) nav.querySelector('#hsNavLists175')?.classList.add('active');
    else if (this._mode === 'cons') nav.querySelector('#hsNavCons175')?.classList.add('active');
    else nav.querySelector('#hsNavFood175')?.classList.add('active');
  };

  const prevBind175 = HomeStockPanel.prototype.bind;
  HomeStockPanel.prototype.bind = function() {
    prevBind175.call(this);
    const root = this.shadowRoot;
    if (!root) return;

    root.querySelectorAll('[data-list-view]').forEach(btn => btn.addEventListener('click', () => this.openLists175(btn.dataset.listView || '')));
    root.querySelector('#hsListsBack175')?.addEventListener('click', () => this.openLists175());
    root.querySelector('#hsOpenManual175')?.addEventListener('click', () => this.openLists175('manual'));
    root.querySelector('#hsManualAddBtn175')?.addEventListener('click', async () => {
      const input = root.querySelector('#hsManualInput175');
      const name = String(input?.value || '').trim();
      if (!name) return;
      await this.hsShoppingPost175({action:'add',name});
    });
    root.querySelector('#hsManualInput175')?.addEventListener('keydown', e => { if (e.key === 'Enter') root.querySelector('#hsManualAddBtn175')?.click(); });
    root.querySelectorAll('[data-shop-toggle]').forEach(btn => btn.addEventListener('click', () => this.hsShoppingPost175({action:'toggle',id:btn.dataset.shopToggle})));
    root.querySelectorAll('[data-shop-remove]').forEach(btn => btn.addEventListener('click', () => this.hsShoppingPost175({action:'remove',id:btn.dataset.shopRemove})));
    root.querySelector('#hsClearChecked175')?.addEventListener('click', () => this.hsShoppingPost175({action:'clear_checked'}));
  };

  const prevRender175 = HomeStockPanel.prototype.render;
  HomeStockPanel.prototype.render = function() {
    prevRender175.call(this);
    const root = this.shadowRoot;
    if (!root) return;
    this.installNav175();
    const version = root.querySelector('.hsVersion165 b');
    if (version) version.textContent = 'v1.6.30';
    if (root.querySelector('#homeStockLists1630')) return;
    const style = document.createElement('style');
    style.id = 'homeStockLists1630';
    style.textContent = `
      .hsListsPage175{max-width:900px;margin:0 auto;color:#f7f9fc;padding-bottom:150px}.hsListsHead175{margin:10px 2px 20px}.hsListsHead175 h2{margin:4px 0 4px;font-size:30px;letter-spacing:-.7px}.hsListsHead175 p{margin:0;color:#8394aa;font-size:12px}
      .hsListStack175{display:grid;gap:11px}.hsListCard175{width:100%;min-height:96px;display:grid;grid-template-columns:62px minmax(0,1fr) 44px 18px;gap:14px;align-items:center;text-align:left;padding:14px 16px!important;border-radius:22px!important;background:linear-gradient(145deg,#111c29,#09111a)!important;border:1px solid rgba(132,172,219,.18)!important;color:#fff!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.025),0 10px 28px rgba(0,0,0,.16)!important}.hsListIcon175{width:58px;height:58px;border-radius:18px;display:grid;place-items:center;font-size:25px;background:rgba(22,137,255,.14);color:#6fc2ff}.hsListCard175.red .hsListIcon175{background:rgba(239,68,68,.12);color:#fca5a5}.hsListCard175.amber .hsListIcon175{background:rgba(245,158,11,.12);color:#fbbf24}.hsListCard175.green .hsListIcon175{background:rgba(34,197,94,.11);color:#86efac}.hsListCopy175 b{display:block;font-size:17px}.hsListCopy175 small{display:block;margin-top:4px;color:#8394a9!important;font-size:11px!important;line-height:1.35}.hsListCard175 strong{min-width:38px;height:34px;border-radius:11px;display:grid;place-items:center;background:rgba(255,255,255,.055);font-size:13px}.hsListCard175 em{font-style:normal;font-size:28px;color:#9eb4cb}
      .hsListSubHead175{display:grid;grid-template-columns:52px minmax(0,1fr);gap:13px;align-items:center;margin:7px 0 18px}.hsListSubHead175>button{width:48px;height:48px;border-radius:16px!important;background:#111c29!important;border:1px solid rgba(132,172,219,.18)!important;color:#c9d7e7!important;font-size:31px!important}.hsListSubHead175 h2{margin:3px 0 2px;font-size:28px}.hsListSubHead175 p{margin:0;color:#8495aa;font-size:11px}.hsListsFood175{margin-bottom:20px}.hsFamilyList175{display:grid;gap:9px}.hsFamilyRow175{min-height:78px;display:grid;grid-template-columns:48px minmax(0,1fr) auto;gap:12px;align-items:center;padding:11px 13px;border-radius:19px;background:linear-gradient(145deg,#111b28,#0a1119);border:1px solid rgba(132,172,219,.16)}.hsFamilyRow175>span{width:44px;height:44px;border-radius:14px;display:grid;place-items:center;background:rgba(30,137,255,.11);font-size:21px}.hsFamilyRow175 b{display:block;font-size:14px}.hsFamilyRow175 small{display:block;margin-top:4px;color:#8393a6!important;font-size:9px!important}.hsFamilyRow175 strong{padding:7px 9px;border-radius:10px;background:rgba(245,158,11,.11);color:#fbbf24;font-size:9px;white-space:nowrap}.hsFamilyRow175 strong.zero{background:rgba(239,68,68,.1);color:#fca5a5}
      .hsFilterChips175{display:flex;gap:7px;margin-bottom:12px}.hsFilterChips175 button{min-height:36px;padding:0 14px;border-radius:13px!important;background:#111a24!important;border:1px solid rgba(132,172,219,.16)!important;color:#9dafc3!important}.hsFilterChips175 button.active{background:#157fe8!important;color:#fff!important;border-color:#3da3ff!important}.hsManualBlock175{margin-top:16px;padding:13px;border-radius:18px;background:#0d1621;border:1px solid rgba(132,172,219,.14)}.hsManualBlock175>b{display:block;margin-bottom:8px;font-size:12px}.hsManualRow175{display:grid;grid-template-columns:28px 1fr;gap:8px;padding:8px 0;border-top:1px solid rgba(255,255,255,.05)}.hsManualRow175:first-of-type{border-top:0}.hsManualAdd175{width:100%;margin-top:12px;min-height:44px;border-radius:15px!important;background:#101c29!important;border:1px solid rgba(41,149,255,.25)!important;color:#6dbbff!important;font-weight:800!important}
      .hsManualComposer175{display:grid;grid-template-columns:1fr auto;gap:8px;margin-bottom:14px}.hsManualComposer175 input{min-height:48px;border-radius:15px;border:1px solid rgba(132,172,219,.18);background:#0e1722;color:#fff;padding:0 13px;font-size:14px;outline:none}.hsManualComposer175 button{padding:0 16px;border-radius:15px!important;background:#147fe9!important;border:1px solid #48a9ff!important;color:#fff!important;font-weight:800!important}.hsManualList175{display:grid;gap:8px}.hsManualItem175{min-height:58px;display:grid;grid-template-columns:38px 1fr 38px;align-items:center;gap:8px;padding:8px 10px;border-radius:16px;background:#101923;border:1px solid rgba(132,172,219,.14)}.hsManualItem175 button{width:34px;height:34px;border-radius:11px!important;background:#162332!important;border:0!important;color:#7cc4ff!important;font-size:18px!important}.hsManualItem175.checked span{text-decoration:line-through;opacity:.45}.hsClearChecked175{width:100%;margin-top:12px;min-height:42px;border-radius:14px!important;background:rgba(239,68,68,.06)!important;border:1px solid rgba(239,68,68,.2)!important;color:#fca5a5!important}
      .hsBottomNav163{grid-template-columns:1fr 1fr 90px 1fr 1fr!important}.hsBottomNav163>button:not(.hsNavPlus).active{color:#2da1ff!important}
      @media(max-width:760px){.hsListsPage175{padding-bottom:140px}.hsListsHead175 h2{font-size:24px}.hsListCard175{min-height:86px;grid-template-columns:54px minmax(0,1fr) 38px 16px;gap:10px;padding:11px 12px!important;border-radius:19px!important}.hsListIcon175{width:50px;height:50px;border-radius:16px;font-size:22px}.hsListCopy175 b{font-size:15px}.hsListCopy175 small{font-size:9px!important}.hsListCard175 strong{min-width:34px;height:31px;font-size:11px}.hsListSubHead175 h2{font-size:24px}.hsFamilyRow175{grid-template-columns:44px minmax(0,1fr) auto;padding:10px}.hsFamilyRow175>span{width:40px;height:40px}.hsFamilyRow175 b{font-size:13px}.hsManualComposer175{grid-template-columns:1fr}.hsManualComposer175 button{min-height:44px}}
    `;
    root.appendChild(style);
  };
}
