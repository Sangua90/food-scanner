import './panel_v179.js?v=1.6.35-base';

const HomeStockPanel = customElements.get('food-scanner-panel');

if (HomeStockPanel) {
  const alpha180 = (a,b) => String(a||'').localeCompare(String(b||''), 'it', {sensitivity:'base'});

  HomeStockPanel.prototype.renderCons = function() {
    if (this._hsSettingsPage) return this.internalSettingsView165();

    const q = String(this._consSearch166 || '').trim().toLocaleLowerCase('it-IT');
    const active = (this._cons || []).filter(x => Number(x.stock_units || 0) > 0);
    const lowFamilies = this.consLowFamilyGroups ? this.consLowFamilyGroups() : [];
    let items = this.consVisible ? this.consVisible() : active;
    if (q) {
      items = items.filter(x => `${x.product_name||''} ${x.brand||''} ${x.category||''} ${x.generic_name||''}`.toLocaleLowerCase('it-IT').includes(q));
    }
    items = items.slice().sort((a,b) => alpha180(this.consGenericName?.(a) || a.product_name, this.consGenericName?.(b) || b.product_name));

    const totalFamilies = this.consFamilyGroups ? this.consFamilyGroups().filter(g => g.units > 0).length : active.length;
    const zones = [
      ['', 'Tutti'],
      ['magazzino','Magazzino'],
      ['bagno','Bagno'],
      ['cucina','Cucina'],
      ['lavanderia','Lavanderia'],
      ['dispensa','Dispensa'],
      ['stalla','Stalla'],
    ];

    return `<section class="hsModePage hsConsPage166 hsConsUnified180">
      <div class="neoTopline">
        <div><span class="eyebrow">CONSUMABILI</span><h2>Per la casa</h2></div>
        <button id="consScan" class="neoScan">⌁ <span>Scansiona</span></button>
      </div>

      <div class="neoSearch hsConsSearchUnified180">
        <span>⌕</span><input id="hsConsSearch166" type="search" placeholder="Cerca consumabile" value="${this.esc(this._consSearch166||'')}"><button id="hsConsSearchClear166" ${q?'':'hidden'}>×</button>
      </div>

      <div class="neoMenuStack hsConsSummary180">
        <button id="lowBanner" class="neoMenuCard low ${this._lowOnly?'active':''}">
          <span class="neoMenuIcon">□</span><span><b>Scorte basse</b><small>Consumabili sotto soglia</small></span><strong>${lowFamilies.length} <i>prodotti</i></strong><em>›</em>
        </button>
        <div class="neoMenuCard hsConsTotal180">
          <span class="neoMenuIcon">▣</span><span><b>Totale prodotti</b><small>${totalFamilies} famiglie attive</small></span><strong>${active.length} <i>prodotti</i></strong>
        </div>
      </div>

      <div class="neoListTitle hsConsListTitle180">
        <div><span class="neoAZ">A<br>Z</span><b>${this._lowOnly?'Scorte basse':this._consLocation?this.loc(this._consLocation):'Tutti i consumabili'}</b></div><span>Ordine alfabetico</span>
      </div>
      <div class="neoZoneChips hsConsZoneChips180">
        ${zones.map(([key,label]) => `<button data-czone="${key}" class="${this._consLocation===key?'active':''}">${label}</button>`).join('')}
      </div>
      <div class="hsConsList166 hsConsListUnified180">${items.map(i => this.consCard166(i)).join('') || '<div class="empty">Nessun consumabile trovato</div>'}</div>
    </section>`;
  };

  const prevRender180 = HomeStockPanel.prototype.render;
  HomeStockPanel.prototype.render = function() {
    prevRender180.call(this);
    const root = this.shadowRoot;
    if (!root) return;

    const version = root.querySelector('.hsVersion165 b');
    if (version) version.textContent = 'v1.6.35';

    if (root.querySelector('#homeStockUnified1635')) return;
    const style = document.createElement('style');
    style.id = 'homeStockUnified1635';
    style.textContent = `
      .hsConsUnified180 .neoTopline{margin:12px 0!important}
      .hsConsUnified180 .neoTopline h2{font-size:28px!important;letter-spacing:-.7px!important}
      .hsConsUnified180 .neoScan{min-width:0!important}
      .hsConsSearchUnified180{margin-bottom:14px!important}
      .hsConsSummary180{margin-bottom:18px!important}
      .hsConsTotal180{cursor:default!important}
      .hsConsTotal180 em{display:none!important}
      .hsConsListTitle180{margin-top:18px!important}
      .hsConsZoneChips180{display:flex!important;gap:8px!important;overflow-x:auto!important;padding-bottom:3px!important;scrollbar-width:none!important}
      .hsConsZoneChips180::-webkit-scrollbar{display:none!important}
      .hsConsZoneChips180 button{flex:0 0 auto!important}
      .hsConsListUnified180{gap:10px!important}
      .hsConsUnified180 .hsConsRow166{min-height:116px!important;grid-template-columns:110px minmax(0,1fr) 132px!important;gap:12px!important;padding:10px!important;border-radius:24px!important;background:linear-gradient(145deg,#111923,#0d151f)!important;border:1px solid rgba(159,190,226,.16)!important}
      .hsConsUnified180 .hsConsThumb166{width:110px!important;height:96px!important;border-radius:20px!important}
      .hsConsUnified180 .hsConsInfo166 h3{font-size:18px!important;letter-spacing:-.25px!important}
      .hsConsUnified180 .hsConsInfo166 p{font-size:12px!important;color:#91a0b6!important}
      .hsConsUnified180 .hsConsMeta166{font-size:10px!important}
      .hsConsUnified180 .hsConsSide166>span{border-radius:14px!important;padding:8px 10px!important}
      @media(max-width:760px){
        .hsConsUnified180 .hsConsRow166{grid-template-columns:104px minmax(0,1fr) 118px!important;min-height:112px!important}
        .hsConsUnified180 .hsConsThumb166{width:104px!important;height:92px!important}
        .hsConsUnified180 .hsConsInfo166 h3{font-size:17px!important}
      }
    `;
    root.appendChild(style);
  };
}
