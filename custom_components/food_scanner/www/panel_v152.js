import './panel_v150.js?v=1.5.2-base';

const HomeStockPanel = customElements.get('food-scanner-panel');

if (HomeStockPanel) {
  HomeStockPanel.prototype.renderFood = function() {
    const zones = [['frigo','Frigo','❄'],['freezer','Freezer','✦'],['dispensa','Dispensa','▦']];
    const soon = this.expiringSoon ? this.expiringSoon() : [];
    const expired = this.expiredItems ? this.expiredItems() : [];
    const items = this.foodVisible();

    const expiryCards = `
      <div class="hsAlerts">
        <button id="expiryBanner" class="hsAlert soon ${this._expiryView === 'soon' ? 'active' : ''}">
          <span class="hsAlertIcon">◷</span>
          <span><b>In scadenza</b><small>Entro 2 giorni</small></span>
          <strong>${soon.length}</strong>
        </button>
        <button id="expiredBanner" class="hsAlert expired ${this._expiryView === 'expired' ? 'active' : ''}">
          <span class="hsAlertIcon">!</span>
          <span><b>Scaduti</b><small>Da controllare</small></span>
          <strong>${expired.length}</strong>
        </button>
      </div>`;

    const zoneCards = `<div class="hsZones foodZones">
      ${zones.map(([key,label,icon]) => `<button data-zone="${key}" class="hsZone ${key} ${this._location===key?'active':''}"><span class="hsZoneIcon">${icon}</span><b>${this.foodCount(key)}</b><small>${label}</small></button>`).join('')}
    </div>`;

    const cards = items.map(i => {
      const status = this.expiryStatus ? this.expiryStatus(i.expiry_date) : {label:'Scadenza non disponibile',color:'#6b7280'};
      return `<article class="hsProduct ${i.location}" data-edit-food="${i.id}">
        <div class="hsProductMain">
          <div><h3>${this.esc(i.product_name || 'Prodotto')}</h3><p>${this.esc([i.brand,i.quantity].filter(Boolean).join(' · ')) || 'Alimento'}</p></div>
          <span class="hsLocation">${this.loc(i.location)}</span>
        </div>
        <div class="hsProductFoot">
          <div class="hsStock"><b>${Number(i.stock_units || 0)}</b><span>${this.unit(i.unit_name)}</span></div>
          <div class="hsExpiry"><span style="background:${status.color}"></span><small>${this.esc(status.label)}</small></div>
          <button class="hsQty" data-food-qty="${i.id}">Modifica quantità</button>
        </div>
      </article>`;
    }).join('');

    return `<section class="hsModePage">
      <div class="hsSectionHead"><div><span class="eyebrow">ALIMENTI</span><h2>La tua dispensa</h2></div><button id="foodScan" class="hsScan">⌁ <span>Scansiona</span></button></div>
      ${zoneCards}
      ${expiryCards}
      <div class="hsListHead"><b>${this._expiryView ? (this._expiryView === 'expired' ? 'Prodotti scaduti' : 'Prodotti in scadenza') : this._location ? this.loc(this._location) : 'Tutti gli alimenti'}</b><span>${items.length}</span></div>
      <div class="hsProducts">${cards || '<div class="empty">Nessun alimento</div>'}</div>
    </section>`;
  };

  HomeStockPanel.prototype.renderCons = function() {
    const zones = [['magazzino','Magazzino','▣'],['bagno','Bagno','◉'],['cucina','Cucina','⌂'],['lavanderia','Lavanderia','≈']];
    const low = this.lowStock ? this.lowStock() : [];
    const items = this.consVisible();

    const zoneCards = `<div class="hsZones consZones">
      ${zones.map(([key,label,icon]) => `<button data-czone="${key}" class="hsZone ${key} ${this._consLocation===key?'active':''}"><span class="hsZoneIcon">${icon}</span><b>${this.consCount(key)}</b><small>${label}</small></button>`).join('')}
    </div>`;

    const lowBanner = `<button id="lowBanner" class="hsLow ${this._lowOnly ? 'active' : ''}">
      <span class="hsAlertIcon">↓</span><span><b>Da ricomprare</b><small>Prodotti alla soglia minima</small></span><strong>${low.length}</strong>
    </button>`;

    const cards = items.map(i => `<article class="hsProduct ${i.location}" data-edit-cons="${i.id}">
      <div class="hsProductMain">
        <div><h3>${this.esc(i.product_name || 'Consumabile')}</h3><p>${this.esc([i.brand,i.category].filter(Boolean).join(' · ')) || 'Consumabile'}</p></div>
        <span class="hsLocation">${this.loc(i.location)}</span>
      </div>
      <div class="hsProductFoot">
        <div class="hsStock"><b>${Number(i.stock_units || 0)}</b><span>${this.unit(i.unit_name)}</span></div>
        <div class="hsThreshold"><small>Soglia ${this.effectiveThreshold ? this.effectiveThreshold(i) : Number(i.min_stock || 0)}</small></div>
        <button class="hsQty" data-cons-qty="${i.id}">Consumo / Aggiungi</button>
      </div>
    </article>`).join('');

    return `<section class="hsModePage">
      <div class="hsSectionHead"><div><span class="eyebrow">CONSUMABILI</span><h2>Scorte di casa</h2></div><div class="hsTopActions"><button id="consScan" class="hsScan">⌁ <span>Scansiona</span></button><button id="manual" class="hsManual">＋</button></div></div>
      ${zoneCards}
      ${lowBanner}
      <div class="hsListHead"><b>${this._lowOnly ? 'Da ricomprare' : this._consLocation ? this.loc(this._consLocation) : 'Tutti i consumabili'}</b><span>${items.length}</span></div>
      <div class="hsProducts">${cards || '<div class="empty">Nessun consumabile</div>'}</div>
    </section>`;
  };

  const originalRender152 = HomeStockPanel.prototype.render;
  HomeStockPanel.prototype.render = function() {
    originalRender152.call(this);
    const root = this.shadowRoot;
    if (!root || root.querySelector('#homeStockLayout152')) return;
    const style = document.createElement('style');
    style.id = 'homeStockLayout152';
    style.textContent = `
      :host{--hsPanel:#11141b;--hsPanel2:#171b24;--hsLine:rgba(255,255,255,.075);--hsText:#f5f7fb;--hsMuted:#8f98a8;--hsBlue:#2f8cff}
      .page{background:radial-gradient(circle at 50% -10%,#151922 0,#090b10 40%,#07090d 100%)!important}
      .shell{max-width:1100px!important}.hero{padding-right:58px}.hero h1{letter-spacing:-1.2px}.hero p{font-size:13px!important}
      .macro{background:#0d1016!important;border:1px solid var(--hsLine)!important;border-radius:16px!important;padding:4px!important;gap:4px!important}
      .macro button{border:0!important;background:transparent!important;border-radius:12px!important;padding:11px!important;color:#9aa4b5!important}
      .macro button.active{background:linear-gradient(180deg,#288eff,#0e69d8)!important;color:white!important;outline:0!important;box-shadow:0 6px 18px rgba(29,116,232,.28)!important}
      .hsModePage{display:block}.hsSectionHead{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:16px 0 10px}.hsSectionHead h2{margin:2px 0 0;font-size:22px;letter-spacing:-.5px}.eyebrow{font-size:10px;letter-spacing:.16em;color:#6f7b8d;font-weight:800}
      .hsTopActions{display:flex;gap:7px}.hsScan,.hsManual{border:1px solid rgba(47,140,255,.25)!important;background:rgba(47,140,255,.12)!important;color:#8bc0ff!important;border-radius:13px!important;padding:10px 13px!important;font-weight:750}.hsManual{width:42px;padding:0!important;font-size:20px}
      .hsZones{display:grid;gap:8px}.foodZones{grid-template-columns:repeat(3,1fr)}.consZones{grid-template-columns:repeat(4,1fr)}
      .hsZone{position:relative;min-height:96px;border:1px solid var(--hsLine)!important;background:linear-gradient(145deg,rgba(255,255,255,.035),rgba(255,255,255,.012))!important;border-radius:18px!important;padding:12px!important;color:#fff!important;text-align:left;overflow:hidden}
      .hsZone:after{content:'';position:absolute;inset:auto -30px -35px auto;width:90px;height:90px;border-radius:50%;filter:blur(7px);opacity:.12}.hsZone.frigo:after{background:#22c55e}.hsZone.freezer:after{background:#3b82f6}.hsZone.dispensa:after{background:#eab308}.hsZone.magazzino:after{background:#a855f7}.hsZone.bagno:after{background:#0ea5e9}.hsZone.cucina:after{background:#f97316}.hsZone.lavanderia:after{background:#10b981}
      .hsZone.active{outline:1px solid rgba(255,255,255,.75)!important;box-shadow:0 0 0 3px rgba(255,255,255,.04)!important}.hsZoneIcon{display:block;color:#8ea0b8;font-size:17px;margin-bottom:9px}.hsZone b{display:block;font-size:26px;line-height:1}.hsZone small{display:block;margin-top:5px;color:#9ca6b5!important;font-size:12px}
      .hsAlerts{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px}.hsAlert,.hsLow{display:grid;grid-template-columns:38px 1fr auto;align-items:center;gap:10px;width:100%;border:1px solid var(--hsLine)!important;background:var(--hsPanel)!important;border-radius:17px!important;padding:11px 13px!important;color:#fff!important;text-align:left}.hsAlert.active,.hsLow.active{outline:1px solid rgba(255,255,255,.65)!important}.hsAlertIcon{width:34px;height:34px;border-radius:11px;display:grid;place-items:center;background:rgba(255,255,255,.05);font-weight:800}.hsAlert.soon .hsAlertIcon{color:#fbbf24;background:rgba(245,158,11,.1)}.hsAlert.expired .hsAlertIcon{color:#f87171;background:rgba(239,68,68,.1)}.hsLow{margin-top:8px}.hsLow .hsAlertIcon{color:#f87171;background:rgba(239,68,68,.1)}.hsAlert b,.hsLow b{display:block;font-size:14px}.hsAlert small,.hsLow small{display:block;color:#7f8999!important;font-size:10px;margin-top:2px}.hsAlert strong,.hsLow strong{font-size:21px}
      .hsListHead{display:flex;justify-content:space-between;align-items:center;margin:17px 2px 8px;color:#dfe4ec}.hsListHead b{font-size:14px}.hsListHead span{font-size:11px;color:#7f8999;background:#12161e;border:1px solid var(--hsLine);padding:4px 8px;border-radius:999px}
      .hsProducts{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}.hsProduct{border:1px solid var(--hsLine);background:linear-gradient(145deg,#131720,#0f1218);border-radius:18px;padding:13px;min-width:0}.hsProductMain{display:flex;align-items:flex-start;justify-content:space-between;gap:8px}.hsProduct h3{margin:0;font-size:15px;letter-spacing:-.15px}.hsProduct p{margin:4px 0 0!important;font-size:11px;color:#7f8999!important;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:230px}.hsLocation{font-size:10px;padding:5px 7px;border-radius:999px;background:rgba(255,255,255,.045);color:#aeb7c5;white-space:nowrap}.hsProductFoot{display:grid;grid-template-columns:auto 1fr auto;align-items:end;gap:9px;margin-top:14px}.hsStock b{font-size:25px;line-height:1}.hsStock span{display:block;font-size:9px;color:#778192;margin-top:3px;text-transform:uppercase;letter-spacing:.06em}.hsExpiry,.hsThreshold{display:flex;align-items:center;gap:6px;min-width:0}.hsExpiry>span{width:7px;height:7px;border-radius:50%;flex:0 0 auto}.hsExpiry small,.hsThreshold small{font-size:10px!important;color:#8e98a8!important;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.hsQty{border:1px solid var(--hsLine)!important;background:#171c25!important;color:#cbd2dc!important;border-radius:10px!important;padding:8px!important;font-size:10px!important}
      .empty{grid-column:1/-1}
      @media(max-width:760px){
        .page{padding:8px!important}.hero{min-height:38px!important}.hero h1{font-size:22px!important}.macro{position:sticky!important;top:0!important;z-index:40!important;margin:6px 0 9px!important}.macro button{min-height:36px!important;padding:7px!important;font-size:13px!important}
        .hsSectionHead{margin:8px 0 7px}.hsSectionHead h2{font-size:17px}.eyebrow{font-size:8px}.hsScan{padding:8px 10px!important;font-size:11px}.hsManual{width:36px!important}
        .foodZones{grid-template-columns:repeat(3,1fr)!important}.consZones{grid-template-columns:repeat(2,1fr)!important}.hsZones{gap:6px}.hsZone{min-height:68px!important;padding:8px!important;border-radius:14px!important}.hsZoneIcon{font-size:13px;margin-bottom:5px}.hsZone b{font-size:20px}.hsZone small{font-size:10px!important;margin-top:3px}
        .hsAlerts{gap:6px;margin-top:6px}.hsAlert,.hsLow{grid-template-columns:29px 1fr auto;padding:8px!important;border-radius:14px!important;gap:7px}.hsAlertIcon{width:27px;height:27px;border-radius:9px;font-size:12px}.hsAlert b,.hsLow b{font-size:11px}.hsAlert small,.hsLow small{font-size:8px!important}.hsAlert strong,.hsLow strong{font-size:17px}
        .hsListHead{margin:11px 2px 6px}.hsProducts{grid-template-columns:1fr!important;gap:5px}.hsProduct{padding:9px 10px!important;border-radius:14px!important}.hsProduct h3{font-size:13px}.hsProduct p{font-size:9px!important;margin-top:2px!important}.hsLocation{font-size:8px;padding:4px 6px}.hsProductFoot{grid-template-columns:54px minmax(0,1fr) auto;gap:5px;margin-top:8px;align-items:center}.hsStock b{font-size:20px}.hsStock span{font-size:7px}.hsExpiry small,.hsThreshold small{font-size:8px!important}.hsQty{padding:7px!important;font-size:8px!important;border-radius:9px!important}
      }
      @media(min-width:761px) and (max-width:1100px){.hsProducts{grid-template-columns:repeat(2,1fr)}.consZones{grid-template-columns:repeat(4,1fr)}}
    `;
    root.appendChild(style);
  };
}
