import './panel_v160.js?v=1.6.13-base';

const HomeStockPanel = customElements.get('food-scanner-panel');

if (HomeStockPanel) {
  const alpha = (a, b) => String(a || '').localeCompare(String(b || ''), 'it', { sensitivity: 'base' });

  HomeStockPanel.prototype.foodUpcomingItems = function(days = 7) {
    return (this._items || [])
      .filter(x => {
        const d = this.days(x.expiry_date);
        return d !== null && d >= 0 && d <= days;
      })
      .slice()
      .sort((a, b) => String(a.expiry_date || '').localeCompare(String(b.expiry_date || '')) || alpha(a.product_name, b.product_name));
  };

  HomeStockPanel.prototype.foodExpiredByAge = function(maxAge = null) {
    return (this._items || [])
      .filter(x => {
        const d = this.days(x.expiry_date);
        if (d === null || d >= 0) return false;
        return maxAge === null || Math.abs(d) <= maxAge;
      })
      .slice()
      .sort((a, b) => String(b.expiry_date || '').localeCompare(String(a.expiry_date || '')) || alpha(a.product_name, b.product_name));
  };

  HomeStockPanel.prototype.foodSearchMatch = function(item, query) {
    const q = String(query || '').trim().toLocaleLowerCase('it-IT');
    if (!q) return true;
    const text = [item.product_name, item.brand, item.category, item.barcode, this.foodGenericName?.(item)]
      .filter(Boolean).join(' ').toLocaleLowerCase('it-IT');
    return text.includes(q);
  };

  HomeStockPanel.prototype.foodImageHtml = function(item, fallback = '◫') {
    if (item?.product_image_url) {
      return `<img class="neoFoodImg" src="${this.esc(item.product_image_url)}" alt="">`;
    }
    return `<span class="neoFoodFallback">${fallback}</span>`;
  };

  HomeStockPanel.prototype.foodLocationBadge = function(item) {
    const icons = { frigo: '▣', freezer: '❄', dispensa: '▦' };
    return `<span class="neoLocation ${item.location || ''}"><i>${icons[item.location] || '⌂'}</i>${this.esc(this.loc(item.location))}</span>`;
  };

  HomeStockPanel.prototype.foodMainCard = function(item) {
    const d = this.days(item.expiry_date);
    let expiry = 'Nessuna scadenza';
    let expiryClass = 'neutral';
    if (d !== null) {
      expiry = d < 0 ? `Scaduto da ${Math.abs(d)} g` : d === 0 ? 'Scade oggi' : `Tra ${d} giorni`;
      expiryClass = d < 0 ? 'expired' : d <= 2 ? 'urgent' : d <= 7 ? 'warning' : 'ok';
    }
    return `<article class="neoFoodRow" data-edit-food="${item.id}">
      <div class="neoThumb">${this.foodImageHtml(item)}</div>
      <div class="neoFoodInfo">
        <h3>${this.esc(item.product_name || 'Prodotto')}</h3>
        <p>${this.esc([item.brand, item.category].filter(Boolean).join(' · ') || 'Alimento')}</p>
        <div class="neoMeta">${this.foodLocationBadge(item)}<span>${Number(item.stock_units || 0)} ${this.esc(this.unit(item.unit_name))}</span></div>
      </div>
      <div class="neoFoodSide"><span class="neoExpiry ${expiryClass}">${this.esc(expiry)}</span><small>${this.fmtDate(item.expiry_date)}</small><button data-food-qty="${item.id}" aria-label="Modifica quantità">›</button></div>
    </article>`;
  };

  HomeStockPanel.prototype.foodHomeView = function() {
    const soon = this.foodUpcomingItems(7);
    const expired = this.foodExpiredByAge(null);
    const low = this.foodLowGroups ? this.foodLowGroups() : [];
    const q = String(this._foodNeoSearch || '');
    let items = (this._items || []).filter(x => this.foodSearchMatch(x, q));
    if (this._location) items = items.filter(x => x.location === this._location);
    items = items.slice().sort((a, b) => alpha(this.foodGenericName?.(a) || a.product_name, this.foodGenericName?.(b) || b.product_name));

    const zones = [['','Tutti'],['frigo','Frigo'],['freezer','Freezer'],['dispensa','Dispensa']];
    return `<section class="hsModePage neoFoodPage">
      <div class="neoTopline"><div><span class="eyebrow">ALIMENTI</span><h2>La tua dispensa</h2></div><button id="foodScan" class="neoScan">⌁ <span>Scansiona</span></button></div>
      <div class="neoSearch"><span>⌕</span><input id="neoFoodSearch" type="search" placeholder="Cerca alimento" value="${this.esc(q)}"><button id="neoFoodSearchClear" ${q ? '' : 'hidden'}>×</button></div>
      <div class="neoMenuStack">
        <button id="neoOpenSoon" class="neoMenuCard soon"><span class="neoMenuIcon">◷</span><span><b>In scadenza</b><small>Prodotti vicini alla scadenza</small></span><strong>${soon.length} <i>prodotti</i></strong><em>›</em></button>
        <button id="neoOpenExpired" class="neoMenuCard expired"><span class="neoMenuIcon">!</span><span><b>Scaduti</b><small>Prodotti già scaduti</small></span><strong>${expired.length} <i>prodotti</i></strong><em>›</em></button>
        <button id="neoOpenLow" class="neoMenuCard low"><span class="neoMenuIcon">□</span><span><b>Scorte basse</b><small>Prodotti da valutare per la spesa</small></span><strong>${low.length} <i>prodotti</i></strong><em>›</em></button>
      </div>
      <div class="neoListTitle"><div><span class="neoAZ">A<br>Z</span><b>Tutti gli alimenti</b></div><span>Ordine alfabetico</span></div>
      <div class="neoZoneChips">${zones.map(([key,label]) => `<button data-zone="${key}" class="${this._location===key?'active':''}">${label}</button>`).join('')}</div>
      <div class="neoFoodList">${items.map(i => this.foodMainCard(i)).join('') || '<div class="empty">Nessun alimento trovato</div>'}</div>
    </section>`;
  };

  HomeStockPanel.prototype.foodSoonMenuView = function() {
    const range = Number(this._foodSoonRange || 7);
    const q = String(this._foodNeoSearch || '');
    const all7 = this.foodUpcomingItems(7);
    const todayCount = this.foodUpcomingItems(0).length;
    const d3 = this.foodUpcomingItems(3).length;
    let items = this.foodUpcomingItems(range).filter(x => this.foodSearchMatch(x, q));
    return `<section class="hsModePage neoFoodPage neoSubPage">
      <div class="neoSubHead"><button id="neoFoodBack">‹</button><div><h2>In scadenza</h2><p>Prodotti vicini alla scadenza</p></div></div>
      <div class="neoSearch"><span>⌕</span><input id="neoFoodSearch" type="search" placeholder="Cerca un prodotto…" value="${this.esc(q)}"><button id="neoFoodSearchClear" ${q ? '' : 'hidden'}>×</button></div>
      <div class="neoRangeChips"><button data-soon-range="7" class="${range===7?'active':''}">Tutti (${all7.length})</button><button data-soon-range="0" class="${range===0?'active':''}">Oggi (${todayCount})</button><button data-soon-range="3" class="${range===3?'active':''}">3 giorni (${d3})</button><button data-soon-range="7" class="${range===7?'active':''}">7 giorni (${all7.length})</button></div>
      <div class="neoFoodList">${items.map(i => this.foodMainCard(i)).join('') || '<div class="empty">Nessun prodotto in scadenza</div>'}</div>
      <div class="neoInfoFooter"><span>ⓘ</span><div><b>${all7.length} prodotti in scadenza</b><small>Controlla regolarmente le tue scorte</small></div></div>
    </section>`;
  };

  HomeStockPanel.prototype.foodExpiredMenuView = function() {
    const range = this._foodExpiredRange ?? null;
    const q = String(this._foodNeoSearch || '');
    const all = this.foodExpiredByAge(null);
    const today = this.foodExpiredByAge(1).length;
    const week = this.foodExpiredByAge(7).length;
    const month = this.foodExpiredByAge(30).length;
    let items = this.foodExpiredByAge(range).filter(x => this.foodSearchMatch(x, q));
    return `<section class="hsModePage neoFoodPage neoSubPage">
      <div class="neoSubHead"><button id="neoFoodBack">‹</button><div><h2>Scaduti</h2><p>Prodotti già scaduti</p></div></div>
      <div class="neoSearch"><span>⌕</span><input id="neoFoodSearch" type="search" placeholder="Cerca tra i prodotti scaduti…" value="${this.esc(q)}"><button id="neoFoodSearchClear" ${q ? '' : 'hidden'}>×</button></div>
      <div class="neoRangeChips expired"><button data-exp-range="all" class="${range===null?'active':''}">Tutti (${all.length})</button><button data-exp-range="1" class="${range===1?'active':''}">Oggi (${today})</button><button data-exp-range="7" class="${range===7?'active':''}">Settimana (${week})</button><button data-exp-range="30" class="${range===30?'active':''}">Mese (${month})</button></div>
      <div class="neoFoodList">${items.map(i => this.foodMainCard(i)).join('') || '<div class="empty">Nessun prodotto scaduto</div>'}</div>
      <div class="neoDangerFooter"><span>⌫</span><div><b>${all.length} prodotti scaduti</b><small>Valuta se rimuoverli dal tuo inventario.</small></div></div>
    </section>`;
  };

  HomeStockPanel.prototype.foodLowMenuView = function() {
    const q = String(this._foodNeoSearch || '').trim().toLocaleLowerCase('it-IT');
    let groups = this.foodLowGroups ? this.foodLowGroups() : [];
    if (q) groups = groups.filter(g => `${g.name} ${g.category}`.toLocaleLowerCase('it-IT').includes(q));
    const byCategory = new Map();
    for (const g of groups) {
      const cat = g.category || 'Altro';
      if (!byCategory.has(cat)) byCategory.set(cat, []);
      byCategory.get(cat).push(g);
    }
    const sections = [...byCategory.entries()].sort((a,b)=>alpha(a[0],b[0])).map(([cat,list]) => `<section class="neoLowGroup"><div class="neoLowHead"><b>${this.esc(cat)}</b><span>${list.length} prodotti</span></div>${list.map(g => `<button class="neoLowRow" data-low-search="${this.esc(g.name)}"><span class="neoLowGlyph">${this.esc((g.name || '?').slice(0,1).toUpperCase())}</span><span><b>${this.esc(g.name)}</b><small>Marca non importante</small></span><strong>${g.units} rimasti</strong><em>›</em></button>`).join('')}</section>`).join('');
    return `<section class="hsModePage neoFoodPage neoSubPage">
      <div class="neoSubHead"><button id="neoFoodBack">‹</button><div><h2>Scorte basse</h2><p>Prodotti da ricomprare</p></div></div>
      <div class="neoLowHero"><span>🛒</span><div><b>${groups.length} prodotti da valutare</b><small>Controlla cosa hai già prima di acquistare.</small></div></div>
      <div class="neoSearch"><span>⌕</span><input id="neoFoodSearch" type="search" placeholder="Cerca un prodotto…" value="${this.esc(this._foodNeoSearch || '')}"><button id="neoFoodSearchClear" ${this._foodNeoSearch ? '' : 'hidden'}>×</button></div>
      <div class="neoLowGroups">${sections || '<div class="empty">Nessuna scorta bassa</div>'}</div>
    </section>`;
  };

  HomeStockPanel.prototype.renderFood = function() {
    if (this._foodNeoMenu === 'soon') return this.foodSoonMenuView();
    if (this._foodNeoMenu === 'expired') return this.foodExpiredMenuView();
    if (this._foodNeoMenu === 'low') return this.foodLowMenuView();
    return this.foodHomeView();
  };

  const originalBind161 = HomeStockPanel.prototype.bind;
  HomeStockPanel.prototype.bind = function() {
    originalBind161.call(this);
    const r = this.shadowRoot;
    if (!r || this._mode !== 'food') return;

    r.querySelector('#neoOpenSoon')?.addEventListener('click', () => { this._foodNeoMenu='soon'; this._foodNeoSearch=''; this._foodSoonRange=7; this.render(); });
    r.querySelector('#neoOpenExpired')?.addEventListener('click', () => { this._foodNeoMenu='expired'; this._foodNeoSearch=''; this._foodExpiredRange=null; this.render(); });
    r.querySelector('#neoOpenLow')?.addEventListener('click', () => { this._foodNeoMenu='low'; this._foodNeoSearch=''; this.render(); });
    r.querySelector('#neoFoodBack')?.addEventListener('click', () => { this._foodNeoMenu=''; this._foodNeoSearch=''; this.render(); });

    const search = r.querySelector('#neoFoodSearch');
    search?.addEventListener('input', e => {
      this._foodNeoSearch = e.target.value;
      this.render();
      requestAnimationFrame(() => {
        const n = this.shadowRoot?.querySelector('#neoFoodSearch');
        n?.focus();
        if (n) n.setSelectionRange(n.value.length, n.value.length);
      });
    });
    r.querySelector('#neoFoodSearchClear')?.addEventListener('click', () => { this._foodNeoSearch=''; this.render(); });

    r.querySelectorAll('[data-soon-range]').forEach(btn => btn.addEventListener('click', () => { this._foodSoonRange=Number(btn.dataset.soonRange); this.render(); }));
    r.querySelectorAll('[data-exp-range]').forEach(btn => btn.addEventListener('click', () => { this._foodExpiredRange=btn.dataset.expRange==='all'?null:Number(btn.dataset.expRange); this.render(); }));
    r.querySelectorAll('[data-low-search]').forEach(btn => btn.addEventListener('click', () => { this._foodNeoMenu=''; this._foodNeoSearch=btn.dataset.lowSearch || ''; this.render(); }));
  };

  const originalRender161 = HomeStockPanel.prototype.render;
  HomeStockPanel.prototype.render = function() {
    originalRender161.call(this);
    const root = this.shadowRoot;
    if (!root || root.querySelector('#homeStockNeoFood1613')) return;
    const style = document.createElement('style');
    style.id = 'homeStockNeoFood1613';
    style.textContent = `
      .neoFoodPage{--neo:#0a0f16;--panel:#111923;--panel2:#0d151f;--line:rgba(159,190,226,.16);--blue:#1687ff;--muted:#91a0b6;color:#f7f9fc}.neoTopline{display:flex;align-items:center;justify-content:space-between;margin:12px 0}.neoTopline h2,.neoSubHead h2{margin:2px 0 0;font-size:25px;letter-spacing:-.7px}.neoScan{border:1px solid rgba(22,135,255,.3)!important;background:rgba(22,135,255,.13)!important;color:#8cc5ff!important;border-radius:14px!important;padding:10px 13px!important;font-weight:800!important}
      .neoSearch{display:grid;grid-template-columns:34px 1fr 32px;align-items:center;gap:4px;padding:6px 8px;margin:10px 0 12px;border:1px solid var(--line);background:linear-gradient(145deg,#111b27,#0b131d);border-radius:16px}.neoSearch>span{font-size:24px;color:#9eb6d4;text-align:center}.neoSearch input{min-width:0;width:100%;border:0;background:transparent;color:#fff;outline:none;font-size:14px;padding:10px 4px}.neoSearch input::placeholder{color:#7f91aa}.neoSearch button{width:30px;height:30px;border:0!important;border-radius:9px!important;background:rgba(255,255,255,.05)!important;color:#a9b6c9!important;font-size:18px}.neoSearch button[hidden]{visibility:hidden}
      .neoMenuStack{display:grid;gap:9px}.neoMenuCard{display:grid;grid-template-columns:54px 1fr auto 18px;align-items:center;gap:12px;width:100%;padding:14px 15px;border:1px solid var(--line)!important;border-radius:18px!important;background:linear-gradient(145deg,#121c27,#0d151f)!important;color:#fff!important;text-align:left}.neoMenuIcon{width:50px;height:50px;border-radius:50%;display:grid;place-items:center;font-size:23px;font-weight:900}.neoMenuCard.soon .neoMenuIcon{color:#21a1ff;background:rgba(22,135,255,.16);box-shadow:0 0 24px rgba(22,135,255,.15)}.neoMenuCard.expired .neoMenuIcon{color:#ff5757;background:rgba(239,68,68,.15)}.neoMenuCard.low .neoMenuIcon{color:#ffb020;background:rgba(245,158,11,.15)}.neoMenuCard b{display:block;font-size:17px}.neoMenuCard small{display:block;margin-top:3px;color:var(--muted)!important;font-size:11px}.neoMenuCard strong{font-size:12px;padding:7px 9px;border-radius:9px;font-weight:700}.neoMenuCard strong i{font-style:normal;font-weight:500}.neoMenuCard.soon strong{color:#3aa9ff;background:rgba(22,135,255,.08);border:1px solid rgba(22,135,255,.18)}.neoMenuCard.expired strong{color:#ff6b6b;background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.2)}.neoMenuCard.low strong{color:#ffb020;background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.2)}.neoMenuCard em{font-style:normal;font-size:27px;color:#9eb0c7}
      .neoListTitle{display:flex;align-items:center;justify-content:space-between;margin:18px 2px 9px}.neoListTitle>div{display:flex;align-items:center;gap:9px}.neoListTitle b{font-size:16px}.neoListTitle>span{font-size:11px;color:#2aa1ff}.neoAZ{font-size:11px;line-height:.75;color:#2aa1ff;font-weight:900}.neoZoneChips,.neoRangeChips{display:flex;gap:7px;overflow:auto;padding-bottom:4px}.neoZoneChips button,.neoRangeChips button{white-space:nowrap;border:1px solid var(--line)!important;background:#101925!important;color:#b7c5d8!important;border-radius:12px!important;padding:8px 12px!important;font-size:11px}.neoZoneChips button.active,.neoRangeChips button.active{background:linear-gradient(180deg,#1687ff,#0868d4)!important;border-color:#38a4ff!important;color:#fff!important;box-shadow:0 5px 16px rgba(22,135,255,.23)}.neoRangeChips.expired button.active{background:linear-gradient(180deg,#ef4444,#bf2929)!important;border-color:#ff6868!important}
      .neoFoodList{display:grid;gap:7px;margin-top:8px}.neoFoodRow{display:grid;grid-template-columns:72px minmax(0,1fr) auto;gap:11px;align-items:center;padding:10px 11px;border:1px solid var(--line);border-radius:17px;background:linear-gradient(145deg,#111b26,#0b131c)}.neoThumb{width:70px;height:70px;display:grid;place-items:center;border-radius:14px;background:rgba(255,255,255,.025);overflow:hidden}.neoFoodImg{max-width:64px;max-height:64px;object-fit:contain}.neoFoodFallback{font-size:25px;color:#68809d}.neoFoodInfo{min-width:0}.neoFoodInfo h3{margin:0;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.neoFoodInfo p{margin:3px 0 6px!important;color:#93a2b8!important;font-size:11px!important;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.neoMeta{display:flex;align-items:center;gap:8px;font-size:10px;color:#a8b5c7}.neoLocation{display:inline-flex;align-items:center;gap:5px;border-radius:8px;padding:5px 7px;background:rgba(22,135,255,.16);color:#3ca7ff}.neoLocation.dispensa{color:#ffb020;background:rgba(245,158,11,.13)}.neoLocation i{font-style:normal}.neoFoodSide{display:grid;grid-template-columns:auto 28px;align-items:center;justify-items:end;gap:4px 6px}.neoExpiry{grid-column:1/2;font-size:10px;border-radius:9px;padding:6px 8px;border:1px solid transparent}.neoExpiry.expired{color:#ff6666;background:rgba(239,68,68,.08);border-color:rgba(239,68,68,.3)}.neoExpiry.urgent{color:#ff6b6b;background:rgba(239,68,68,.08);border-color:rgba(239,68,68,.28)}.neoExpiry.warning{color:#ffb020;background:rgba(245,158,11,.08);border-color:rgba(245,158,11,.28)}.neoExpiry.ok{color:#7bd99a;background:rgba(34,197,94,.08);border-color:rgba(34,197,94,.2)}.neoExpiry.neutral{color:#9aa9bb;background:rgba(255,255,255,.04)}.neoFoodSide small{grid-column:1/2;color:#9aa9bb!important;font-size:9px!important}.neoFoodSide button{grid-column:2;grid-row:1/3;border:0!important;background:transparent!important;color:#a9bad0!important;font-size:28px!important;padding:0 2px!important}
      .neoSubHead{display:grid;grid-template-columns:46px 1fr;gap:12px;align-items:center;margin:8px 0 16px}.neoSubHead>button{width:44px;height:44px;border-radius:14px!important;border:1px solid var(--line)!important;background:#111b27!important;color:#dce7f5!important;font-size:31px!important;line-height:1!important}.neoSubHead p{margin:2px 0 0;color:#94a6bd;font-size:12px}.neoInfoFooter,.neoDangerFooter,.neoLowHero{display:grid;grid-template-columns:44px 1fr;gap:10px;align-items:center;margin-top:12px;padding:12px;border-radius:16px;border:1px solid var(--line);background:#101925}.neoInfoFooter>span{font-size:26px;color:#1d96ff}.neoInfoFooter b,.neoDangerFooter b,.neoLowHero b{display:block;font-size:12px}.neoInfoFooter small,.neoDangerFooter small,.neoLowHero small{display:block;margin-top:3px;color:#91a0b6!important;font-size:10px!important}.neoDangerFooter>span{width:38px;height:38px;border-radius:12px;display:grid;place-items:center;color:#ff5858;background:rgba(239,68,68,.12);font-size:20px}.neoLowHero>span{width:40px;height:40px;border-radius:50%;display:grid;place-items:center;background:rgba(245,158,11,.12);font-size:20px}.neoLowHero b{color:#ffd062}
      .neoLowGroups{display:grid;gap:10px}.neoLowGroup{border:1px solid var(--line);border-radius:17px;overflow:hidden;background:#0e1721}.neoLowHead{display:flex;justify-content:space-between;align-items:center;padding:11px 13px;border-bottom:1px solid rgba(159,190,226,.11)}.neoLowHead b{font-size:15px}.neoLowHead span{font-size:9px;color:#91a0b6}.neoLowRow{display:grid;grid-template-columns:42px 1fr auto 18px;align-items:center;gap:10px;width:100%;padding:10px 12px;border:0!important;border-bottom:1px solid rgba(159,190,226,.09)!important;background:transparent!important;color:#fff!important;text-align:left}.neoLowRow:last-child{border-bottom:0!important}.neoLowGlyph{width:36px;height:36px;border-radius:11px;display:grid;place-items:center;background:rgba(22,135,255,.08);color:#6db8ff;font-weight:900}.neoLowRow b{display:block;font-size:13px}.neoLowRow small{display:block;margin-top:2px;color:#8d9db2!important;font-size:9px!important}.neoLowRow strong{color:#ffb020;font-size:12px}.neoLowRow em{font-style:normal;font-size:22px;color:#9db0c8}
      @media(max-width:760px){.neoTopline h2,.neoSubHead h2{font-size:21px}.neoScan{padding:8px 10px!important;font-size:11px}.neoMenuCard{grid-template-columns:46px 1fr auto 14px;padding:11px!important;gap:9px}.neoMenuIcon{width:43px;height:43px;font-size:19px}.neoMenuCard b{font-size:15px}.neoMenuCard small{font-size:9px!important}.neoMenuCard strong{font-size:10px;padding:5px 6px}.neoMenuCard strong i{display:none}.neoFoodRow{grid-template-columns:58px minmax(0,1fr) auto;padding:8px;gap:8px;border-radius:15px}.neoThumb{width:56px;height:56px}.neoFoodImg{max-width:52px;max-height:52px}.neoFoodInfo h3{font-size:13px}.neoFoodInfo p{font-size:9px!important}.neoMeta{font-size:8px;gap:5px}.neoLocation{padding:4px 5px}.neoFoodSide{gap:2px 4px}.neoExpiry{font-size:8px;padding:5px 6px}.neoFoodSide small{font-size:7px!important}.neoFoodSide button{font-size:24px!important}.neoRangeChips button,.neoZoneChips button{padding:7px 9px!important;font-size:9px!important}.neoLowRow{grid-template-columns:36px 1fr auto 14px;padding:9px}.neoLowGlyph{width:32px;height:32px}.neoLowRow strong{font-size:10px}}
    `;
    root.appendChild(style);
  };
}
