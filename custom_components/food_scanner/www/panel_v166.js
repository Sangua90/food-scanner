import './panel_v165.js?v=1.6.18-base';

const HomeStockPanel = customElements.get('food-scanner-panel');

if (HomeStockPanel) {
  const alpha166 = (a,b) => String(a||'').localeCompare(String(b||''), 'it', {sensitivity:'base'});

  HomeStockPanel.prototype.consVisual166 = function(item) {
    const url = String(item?.product_image_url || '').trim();
    if (url) {
      return `<span class="hsConsPhotoBg166"></span><img class="hsConsPhoto166" src="${this.esc(url)}" alt="" loading="lazy">`;
    }
    const text = `${item?.generic_name || ''} ${item?.product_name || ''} ${item?.category || ''}`.toLocaleLowerCase('it-IT');
    let icon = '🧴', cls = 'clean';
    if (/carta igien|fazzolett|carta.*cucina|rotol|tovagliol/.test(text)) { icon='🧻'; cls='paper'; }
    else if (/sapone.*mani|mani.*sapone|shampoo|bagnoschiuma|persona|igiene/.test(text)) { icon='🧼'; cls='care'; }
    else if (/piatti|lavastoviglie|capsul/.test(text)) { icon='🫧'; cls='dish'; }
    else if (/bucato|lavatrice|ammorbidente|detersivo.*panni/.test(text)) { icon='🧺'; cls='laundry'; }
    else if (/sacchett|monouso|pellicola|alluminio|carta forno/.test(text)) { icon='🛍️'; cls='bags'; }
    else if (/spugn|spray|pulizia|detergente|sgrassatore/.test(text)) { icon='🧽'; cls='clean'; }
    return `<span class="hsConsFallback166 ${cls}"><i>${icon}</i></span>`;
  };

  HomeStockPanel.prototype.consLocationVisual166 = function(location) {
    const data = {
      magazzino:['📦','Magazzino'], bagno:['🧴','Bagno'], cucina:['🧽','Cucina'],
      lavanderia:['🧺','Lavanderia'], dispensa:['🧻','Dispensa'], stalla:['🧹','Stalla']
    };
    const [icon,label] = data[location] || ['📦',this.loc(location)];
    return {icon,label};
  };

  HomeStockPanel.prototype.consCard166 = function(item) {
    const threshold = Number(item.effective_min_stock ?? item.min_stock ?? 2);
    const stock = Math.max(0, Number(item.stock_units || 0));
    const low = stock <= threshold;
    return `<article class="hsConsRow166 ${low?'low':''}" data-edit-cons="${item.id}">
      <div class="hsConsThumb166">${this.consVisual166(item)}</div>
      <div class="hsConsInfo166">
        <h3>${this.esc(item.product_name || 'Consumabile')}</h3>
        <p>${this.esc([item.brand,item.category].filter(Boolean).join(' · ') || this.consGenericName?.(item) || 'Consumabile')}</p>
        <div class="hsConsMeta166"><span class="loc ${item.location||''}">${this.esc(this.loc(item.location))}</span><span>${stock} ${this.esc(this.unit(item.unit_name))}</span></div>
      </div>
      <div class="hsConsSide166"><span class="${low?'warn':'ok'}">${low?'Da ricomprare':'Disponibile'}</span><small>Soglia ${threshold}</small><button data-cons-qty="${item.id}" aria-label="Modifica quantità">›</button></div>
    </article>`;
  };

  HomeStockPanel.prototype.renderCons = function() {
    if (this._hsSettingsPage) return this.internalSettingsView165();
    const q = String(this._consSearch166 || '').trim().toLocaleLowerCase('it-IT');
    const active = (this._cons || []).filter(x => Number(x.stock_units || 0) > 0);
    const lowFamilies = this.consLowFamilyGroups ? this.consLowFamilyGroups() : [];
    let items = this.consVisible ? this.consVisible() : active;
    if (q) items = items.filter(x => `${x.product_name||''} ${x.brand||''} ${x.category||''} ${x.generic_name||''}`.toLocaleLowerCase('it-IT').includes(q));
    items = items.slice().sort((a,b) => alpha166(this.consGenericName?.(a) || a.product_name, this.consGenericName?.(b) || b.product_name));

    const locations = ['magazzino','bagno','cucina','lavanderia','dispensa','stalla'];
    const locationCards = locations.map(loc => {
      const v = this.consLocationVisual166(loc);
      const count = active.filter(x => x.location === loc).length;
      return `<button class="hsConsZone166 ${this._consLocation===loc?'active':''}" data-czone="${loc}">
        <span class="art">${v.icon}</span><span><b>${this.esc(v.label)}</b><small>${count} ${count===1?'prodotto':'prodotti'}</small></span>
      </button>`;
    }).join('');

    const totalFamilies = this.consFamilyGroups ? this.consFamilyGroups().filter(g => g.units > 0).length : active.length;
    return `<section class="hsModePage hsConsPage166">
      <div class="hsConsHead166"><div><span class="eyebrow">CONSUMABILI</span><h2>Per la casa</h2></div><div class="hsTopActions"><button id="consScan" class="hsScan">⌁ <span>Scansiona</span></button><button id="manual" class="hsManual">＋</button></div></div>

      <div class="hsConsSearch166"><span>⌕</span><input id="hsConsSearch166" type="search" placeholder="Cerca consumabile" value="${this.esc(this._consSearch166||'')}"><button id="hsConsSearchClear166" ${q?'':'hidden'}>×</button></div>

      <div class="hsConsHero166">
        <button id="lowBanner" class="hsConsFeature166 low ${this._lowOnly?'active':''}"><span class="featureIcon">🛒</span><span><b>Da ricomprare</b><small>Famiglie sotto soglia</small></span><strong>${lowFamilies.length}</strong><em>›</em></button>
        <div class="hsConsFeature166 total"><span class="featureIcon">📦</span><span><b>Totale prodotti</b><small>${totalFamilies} famiglie attive</small></span><strong>${active.length}</strong></div>
      </div>

      <div class="hsConsSectionTitle166"><b>Posizioni</b><button data-czone="">Vedi tutte ›</button></div>
      <div class="hsConsZones166">${locationCards}</div>

      <div class="hsConsListTitle166"><div><span>▤</span><b>${this._lowOnly?'Da ricomprare':this._consLocation?this.loc(this._consLocation):'Tutti i consumabili'}</b></div><small>Ordine alfabetico</small></div>
      <div class="hsConsList166">${items.map(i => this.consCard166(i)).join('') || '<div class="empty">Nessun consumabile trovato</div>'}</div>
    </section>`;
  };

  const prevBind166 = HomeStockPanel.prototype.bind;
  HomeStockPanel.prototype.bind = function() {
    prevBind166.call(this);
    const root = this.shadowRoot;
    if (!root || this._mode !== 'cons' || this._hsSettingsPage) return;
    const search = root.querySelector('#hsConsSearch166');
    search?.addEventListener('input', e => {
      this._consSearch166 = e.target.value;
      this.render();
      requestAnimationFrame(() => {
        const n=this.shadowRoot?.querySelector('#hsConsSearch166'); n?.focus(); if(n) n.setSelectionRange(n.value.length,n.value.length);
      });
    });
    root.querySelector('#hsConsSearchClear166')?.addEventListener('click', () => { this._consSearch166=''; this.render(); });
  };

  const prevRender166 = HomeStockPanel.prototype.render;
  HomeStockPanel.prototype.render = function() {
    prevRender166.call(this);
    const root = this.shadowRoot;
    if (!root) return;

    // The bottom navigation now owns Alimenti / Consumabili, so the old top selector is redundant.
    root.querySelectorAll('.macro').forEach(el => el.style.display='none');

    if (root.querySelector('#homeStockConsumables1618')) return;
    const style = document.createElement('style');
    style.id='homeStockConsumables1618';
    style.textContent=`
      .macro{display:none!important}.hsConsPage166{color:#f5f8fc;padding-bottom:120px}.hsConsHead166{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:8px 0 12px}.hsConsHead166 h2{margin:3px 0 0;font-size:28px;letter-spacing:-.7px}.hsConsSearch166{height:60px;display:grid;grid-template-columns:34px 1fr 30px;align-items:center;gap:7px;margin-bottom:12px;padding:0 16px;border-radius:20px;background:linear-gradient(145deg,#111d2b,#0a121c);border:1px solid rgba(126,169,216,.2);box-shadow:inset 0 1px 0 rgba(255,255,255,.025)}.hsConsSearch166>span{font-size:24px;color:#93b2d5}.hsConsSearch166 input{width:100%;border:0;outline:0;background:transparent;color:#eff6ff;font-size:15px}.hsConsSearch166 input::placeholder{color:#71849a}.hsConsSearch166 button{border:0!important;background:transparent!important;color:#91a4ba!important;font-size:21px!important}
      .hsConsHero166{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-bottom:15px}.hsConsFeature166{min-height:88px;display:grid;grid-template-columns:50px 1fr auto 14px;align-items:center;gap:10px;padding:12px 14px;border-radius:21px;border:1px solid rgba(126,169,216,.18)!important;background:linear-gradient(145deg,#121c28,#09111a)!important;color:#fff!important;text-align:left}.hsConsFeature166.low{background:radial-gradient(circle at 15% 50%,rgba(239,68,68,.13),transparent 36%),linear-gradient(145deg,#151b25,#0a1119)!important}.hsConsFeature166.low.active{outline:1px solid rgba(248,113,113,.55)!important}.hsConsFeature166.total{grid-template-columns:50px 1fr auto}.featureIcon{width:48px;height:48px;border-radius:16px;display:grid;place-items:center;background:rgba(59,130,246,.11);font-size:23px}.hsConsFeature166.low .featureIcon{background:rgba(239,68,68,.13)}.hsConsFeature166 b{display:block;font-size:15px}.hsConsFeature166 small{display:block;margin-top:3px;color:#8394a9!important;font-size:9px!important}.hsConsFeature166 strong{min-width:36px;height:36px;display:grid;place-items:center;border-radius:12px;background:rgba(59,130,246,.1);border:1px solid rgba(59,130,246,.16);font-size:14px}.hsConsFeature166.low strong{color:#fca5a5;background:rgba(239,68,68,.09);border-color:rgba(239,68,68,.18)}.hsConsFeature166 em{font-style:normal;font-size:24px;color:#9db4cc}
      .hsConsSectionTitle166,.hsConsListTitle166{display:flex;align-items:center;justify-content:space-between;margin:12px 2px 8px}.hsConsSectionTitle166>b,.hsConsListTitle166 b{font-size:17px}.hsConsSectionTitle166 button{border:0!important;background:transparent!important;color:#2c9dff!important;font-size:11px!important}.hsConsZones166{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:15px}.hsConsZone166{position:relative;min-height:84px;display:grid;grid-template-columns:52px 1fr;align-items:center;gap:8px;text-align:left;overflow:hidden;padding:10px!important;border-radius:18px!important;border:1px solid rgba(128,167,210,.17)!important;background:linear-gradient(145deg,#111c29,#0b131d)!important;color:#f5f7fb!important}.hsConsZone166:before{content:'';position:absolute;inset:0;background:radial-gradient(circle at 12% 50%,rgba(38,139,255,.10),transparent 42%);pointer-events:none}.hsConsZone166.active{outline:1px solid rgba(52,157,255,.62)!important;box-shadow:0 0 20px rgba(31,133,234,.10)!important}.hsConsZone166 .art{width:50px;height:58px;border-radius:15px;display:grid;place-items:center;font-size:29px;background:linear-gradient(145deg,rgba(44,131,222,.14),rgba(255,255,255,.025));filter:drop-shadow(0 6px 7px rgba(0,0,0,.22))}.hsConsZone166 b{display:block;font-size:12px}.hsConsZone166 small{display:block;margin-top:4px;color:#8394a9!important;font-size:9px!important}.hsConsListTitle166>div{display:flex;align-items:center;gap:8px}.hsConsListTitle166>div>span{color:#26a1ff}.hsConsListTitle166>small{color:#239cff!important;font-size:10px!important}
      .hsConsList166{display:grid;gap:8px}.hsConsRow166{min-height:105px;display:grid;grid-template-columns:86px minmax(0,1fr) 120px;gap:12px;align-items:center;padding:9px 11px;border-radius:20px;border:1px solid rgba(130,170,214,.2);background:linear-gradient(145deg,#111c29,#09121b);box-shadow:inset 0 1px 0 rgba(255,255,255,.024),0 8px 22px rgba(0,0,0,.12)}.hsConsRow166.low{border-color:rgba(245,158,11,.22)}.hsConsThumb166{position:relative;width:86px;height:86px;overflow:hidden;border-radius:17px;background:radial-gradient(circle at 40% 35%,rgba(66,142,221,.18),rgba(11,19,29,.98));border:1px solid rgba(133,177,222,.12);display:grid;place-items:center;isolation:isolate}.hsConsPhotoBg166{position:absolute;inset:-10px;z-index:0;background:linear-gradient(145deg,rgba(50,120,190,.18),rgba(10,18,28,.96));filter:blur(10px)}.hsConsPhoto166{position:relative;z-index:1;width:100%;height:100%;object-fit:contain;padding:6px;box-sizing:border-box;filter:drop-shadow(0 7px 8px rgba(0,0,0,.25))}.hsConsFallback166{width:100%;height:100%;display:grid;place-items:center;position:relative;overflow:hidden}.hsConsFallback166:before{content:'';position:absolute;inset:0;background:radial-gradient(circle at 50% 40%,rgba(58,138,222,.22),transparent 64%)}.hsConsFallback166 i{position:relative;font-style:normal;font-size:43px;filter:drop-shadow(0 7px 8px rgba(0,0,0,.24))}.hsConsFallback166.paper:before{background:radial-gradient(circle,rgba(203,213,225,.16),transparent 65%)}.hsConsFallback166.care:before{background:radial-gradient(circle,rgba(125,211,252,.17),transparent 65%)}.hsConsFallback166.dish:before{background:radial-gradient(circle,rgba(74,222,128,.14),transparent 65%)}.hsConsFallback166.laundry:before{background:radial-gradient(circle,rgba(96,165,250,.18),transparent 65%)}
      .hsConsInfo166{min-width:0}.hsConsInfo166 h3{margin:0;font-size:16px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.hsConsInfo166 p{margin:4px 0 9px!important;color:#8495aa!important;font-size:10px!important;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.hsConsMeta166{display:flex;align-items:center;gap:8px}.hsConsMeta166>span{font-size:9px;color:#9aa9ba}.hsConsMeta166 .loc{padding:5px 8px;border-radius:9px;background:rgba(59,130,246,.09);color:#93c5fd;font-weight:750}.hsConsMeta166 .loc.cucina{background:rgba(245,158,11,.09);color:#fbbf24}.hsConsMeta166 .loc.bagno{background:rgba(14,165,233,.09);color:#7dd3fc}.hsConsMeta166 .loc.lavanderia{background:rgba(16,185,129,.09);color:#6ee7b7}.hsConsSide166{display:grid;grid-template-columns:1fr 23px;align-items:center;text-align:right}.hsConsSide166>span{grid-column:1;padding:7px 8px;border-radius:11px;font-size:9px;font-weight:800;justify-self:end}.hsConsSide166>span.ok{color:#6ee7b7;background:rgba(16,185,129,.09);border:1px solid rgba(16,185,129,.18)}.hsConsSide166>span.warn{color:#fbbf24;background:rgba(245,158,11,.09);border:1px solid rgba(245,158,11,.18)}.hsConsSide166 small{grid-column:1;color:#77879b!important;font-size:8px!important;margin-top:4px}.hsConsSide166 button{grid-column:2;grid-row:1/3;width:23px;height:42px;border:0!important;background:transparent!important;color:#b7c9de!important;font-size:28px!important;padding:0!important}
      @media(max-width:760px){.hsConsPage166{padding-bottom:112px}.hsConsHead166 h2{font-size:22px}.hsConsSearch166{height:54px;border-radius:18px}.hsConsHero166{grid-template-columns:1fr;gap:7px}.hsConsFeature166{min-height:76px}.hsConsZones166{grid-template-columns:1fr 1fr;gap:7px}.hsConsZone166{min-height:72px;grid-template-columns:45px 1fr;padding:8px!important;border-radius:15px!important}.hsConsZone166 .art{width:44px;height:50px;font-size:25px}.hsConsList166{gap:6px}.hsConsRow166{min-height:96px;grid-template-columns:76px minmax(0,1fr) 102px;gap:9px;padding:8px 9px;border-radius:17px}.hsConsThumb166{width:76px;height:76px;border-radius:15px}.hsConsInfo166 h3{font-size:13px}.hsConsInfo166 p{font-size:8px!important;margin:3px 0 7px!important}.hsConsMeta166{gap:5px}.hsConsMeta166>span{font-size:8px}.hsConsMeta166 .loc{padding:4px 6px}.hsConsSide166>span{font-size:8px;padding:6px}.hsConsSide166 small{font-size:7px!important}.hsConsSide166 button{font-size:25px}.hsConsSectionTitle166>b,.hsConsListTitle166 b{font-size:15px}}
    `;
    root.appendChild(style);
  };
}
