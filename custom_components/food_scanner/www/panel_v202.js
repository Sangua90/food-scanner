import './panel_v201.js?v=2.0.2-base';

const Panel = customElements.get('food-scanner-panel');
if (Panel) {
  const alpha202 = (a,b) => String(a||'').localeCompare(String(b||''), 'it', {sensitivity:'base'});
  const esc202 = (ctx,v) => ctx.esc ? ctx.esc(v) : String(v ?? '');

  Panel.prototype.hsFamilyGroups202 = function(kind = 'food') {
    const source = kind === 'cons' ? (this._cons || []) : (this._items || []);
    const map = new Map();
    for (const item of source) {
      const fallback = kind === 'cons'
        ? (this.consGenericName?.(item) || item.product_name || 'Da definire')
        : (this.foodGenericName?.(item) || item.product_name || 'Da definire');
      const family = String(item.generic_name || fallback || 'Da definire').trim() || 'Da definire';
      const key = family.toLocaleLowerCase('it-IT');
      if (!map.has(key)) map.set(key, {key, name:family, items:[], units:0});
      const group = map.get(key);
      group.items.push(item);
      group.units += Math.max(0, Number(item.stock_units || 0));
    }
    return [...map.values()]
      .map(g => ({...g, items:g.items.slice().sort((a,b)=>alpha202(a.product_name,b.product_name))}))
      .sort((a,b)=>alpha202(a.name,b.name));
  };

  Panel.prototype.hsFamilySettingsView202 = function() {
    const kind = this._hsFamilyKind202 === 'cons' ? 'cons' : 'food';
    const query = String(this._hsFamilySearch202 || '').trim().toLocaleLowerCase('it-IT');
    let groups = this.hsFamilyGroups202(kind);
    if (query) groups = groups.filter(g => `${g.name} ${(g.items||[]).map(x=>`${x.product_name||''} ${x.brand||''}`).join(' ')}`.toLocaleLowerCase('it-IT').includes(query));
    const totalItems = groups.reduce((n,g)=>n+(g.items?.length||0),0);
    const row = (item) => {
      const family = String(item.generic_name || (kind==='cons' ? this.consGenericName?.(item) : this.foodGenericName?.(item)) || item.product_name || '').trim();
      return `<div class="hsFamilyProduct202">
        <div class="hsFamilyProductCopy202"><b>${esc202(this,item.product_name || 'Prodotto')}</b><small>${esc202(this,[item.brand,item.category].filter(Boolean).join(' · ') || (kind==='cons'?'Consumabile':'Alimento'))}</small></div>
        <label><span>Famiglia</span><input data-family-input202="${esc202(this,item.id)}" value="${esc202(this,family)}" autocomplete="off" spellcheck="false"></label>
        <button type="button" data-family-save202="${esc202(this,item.id)}" data-family-kind202="${kind}">Salva</button>
      </div>`;
    };
    const cards = groups.map(g => `<details class="hsFamilyGroup202">
      <summary><div><b>${esc202(this,g.name)}</b><small>${g.items.length} ${g.items.length===1?'prodotto':'prodotti'} · ${g.units} unità totali</small></div><span>›</span></summary>
      <div class="hsFamilyProducts202">${g.items.map(row).join('')}</div>
    </details>`).join('');
    return `<section class="hsModePage hsFamilyPage202">
      <div class="hsFamilyHead202"><button type="button" id="hsFamilyBack202">‹</button><div><span class="eyebrow">IMPOSTAZIONI</span><h2>Famiglie prodotti</h2><p>Controlla e correggi i raggruppamenti usati per scorte basse e lista spesa.</p></div></div>
      <div class="hsFamilyTabs202"><button type="button" data-family-kindtab202="food" class="${kind==='food'?'active':''}">🍎 Alimenti</button><button type="button" data-family-kindtab202="cons" class="${kind==='cons'?'active':''}">🧴 Consumabili</button></div>
      <div class="hsFamilySearch202"><span>⌕</span><input id="hsFamilySearch202" type="search" placeholder="Cerca famiglia o prodotto" value="${esc202(this,this._hsFamilySearch202||'')}"><button type="button" id="hsFamilySearchClear202" ${query?'':'hidden'}>×</button></div>
      <div class="hsFamilySummary202"><div><strong>${groups.length}</strong><span>famiglie visibili</span></div><div><strong>${totalItems}</strong><span>prodotti</span></div></div>
      <div class="hsFamilyGroups202">${cards || '<div class="empty">Nessuna famiglia trovata</div>'}</div>
    </section>`;
  };

  const prevSettingsView202 = Panel.prototype.internalSettingsView165;
  if (prevSettingsView202) {
    Panel.prototype.internalSettingsView165 = function() {
      if (this._hsFamilyPage202) return this.hsFamilySettingsView202();
      return prevSettingsView202.call(this);
    };
  }

  Panel.prototype.hsSaveFamily202 = async function(kind,id,value) {
    const family = String(value || '').trim();
    if (!family) return alert('Inserisci il nome della famiglia.');
    try {
      if (kind === 'cons') {
        await this._hass.callApi('POST','food_scanner/consumables',{action:'update',id,changes:{generic_name:family}});
      } else {
        await this._hass.callApi('POST','food_scanner/archive',{action:'update_item',id,changes:{generic_name:family}});
      }
      await this.load();
      this._hsFamilySaved202 = id;
      this.render();
      clearTimeout(this._hsFamilySavedTimer202);
      this._hsFamilySavedTimer202 = setTimeout(()=>{this._hsFamilySaved202=''; if(this._hsFamilyPage202)this.render();},1400);
    } catch (e) {
      alert(e?.message || String(e));
    }
  };

  const prevRender202 = Panel.prototype.render;
  Panel.prototype.render = function() {
    prevRender202.call(this);
    const root = this.shadowRoot;
    if (!root) return;

    const version = root.querySelector('.hsVersion165 b');
    if (version) version.textContent = 'v2.0.2';

    // Settings -> Famiglie prodotti becomes an actual management page.
    if (this._hsSettingsPage && !this._hsFamilyPage202) {
      const card = root.querySelector('.hsSettingCard165.family');
      if (card) {
        card.classList.add('hsFamilyOpenCard202');
        card.setAttribute('role','button');
        card.setAttribute('tabindex','0');
        if (!card.querySelector('.hsFamilyOpenHint202')) {
          const hint = document.createElement('div');
          hint.className = 'hsFamilyOpenHint202';
          hint.innerHTML = '<span>Controlla e correggi le famiglie</span><b>Apri ›</b>';
          card.appendChild(hint);
        }
        card.onclick = () => { this._hsFamilyPage202=true; this._hsFamilyKind202='food'; this._hsFamilySearch202=''; this.render(); };
        card.onkeydown = (e) => { if(e.key==='Enter'||e.key===' '){e.preventDefault();card.click();} };
      }
    }

    if (this._hsFamilyPage202) {
      root.querySelector('#hsFamilyBack202')?.addEventListener('click',()=>{this._hsFamilyPage202=false;this._hsFamilySearch202='';this.render();});
      root.querySelectorAll('[data-family-kindtab202]').forEach(btn => btn.addEventListener('click',()=>{this._hsFamilyKind202=btn.dataset.familyKindtab202==='cons'?'cons':'food';this._hsFamilySearch202='';this.render();}));
      const search = root.querySelector('#hsFamilySearch202');
      search?.addEventListener('input',e=>{this._hsFamilySearch202=e.target.value;this.render();requestAnimationFrame(()=>{const n=this.shadowRoot?.querySelector('#hsFamilySearch202');n?.focus();if(n)n.setSelectionRange(n.value.length,n.value.length);});});
      root.querySelector('#hsFamilySearchClear202')?.addEventListener('click',()=>{this._hsFamilySearch202='';this.render();});
      root.querySelectorAll('[data-family-save202]').forEach(btn => btn.addEventListener('click',()=>{
        const id=String(btn.dataset.familySave202||'');
        const kind=String(btn.dataset.familyKind202||'food');
        const input=root.querySelector(`[data-family-input202="${CSS.escape(id)}"]`);
        this.hsSaveFamily202(kind,id,input?.value||'');
      }));
      root.querySelectorAll('[data-family-input202]').forEach(input=>input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();const id=input.dataset.familyInput202;root.querySelector(`[data-family-save202="${CSS.escape(id)}"]`)?.click();}}));
    }

    if (!root.querySelector('#hsPolish202')) {
      const style = document.createElement('style');
      style.id = 'hsPolish202';
      style.textContent = `
        /* Quantità: identical fixed control, always inside the card. */
        .neoFoodRow162{grid-template-columns:94px minmax(0,1fr) 126px!important}
        .neoFoodSide{width:126px!important;min-width:126px!important;max-width:126px!important;display:flex!important;flex-direction:column!important;align-items:stretch!important;justify-content:center!important;justify-self:end!important;box-sizing:border-box!important}
        .neoFoodSide .neoExpiry{align-self:stretch!important;text-align:center!important;box-sizing:border-box!important}
        .neoFoodSide>small{text-align:center!important}
        .neoFoodSide .hsQtyButton201{order:3!important;width:100%!important;min-width:0!important;max-width:100%!important;height:36px!important;min-height:36px!important;margin:7px 0 0!important}

        .hsConsUnified180 .hsConsRow166,.hsConsRow166{grid-template-columns:110px minmax(0,1fr) 118px!important}
        .hsConsSide166{width:118px!important;min-width:118px!important;max-width:118px!important;display:flex!important;flex-direction:column!important;align-items:stretch!important;justify-content:center!important;justify-self:end!important;box-sizing:border-box!important}
        .hsConsSide166>span{text-align:center!important;box-sizing:border-box!important}
        .hsConsSide166>small{text-align:center!important;margin-top:5px!important}
        .hsConsSide166 .hsQtyButton201{order:3!important;width:100%!important;min-width:0!important;max-width:100%!important;height:36px!important;min-height:36px!important;margin:7px 0 0!important}

        /* Food dashboard summary cards: noticeably more compact without reducing tapability. */
        .neoFoodPage .neoMenuStack{gap:8px!important}
        .neoFoodPage .neoMenuCard{width:calc(100% - 10px)!important;min-height:88px!important;margin-left:auto!important;margin-right:auto!important;padding:10px 14px!important;border-radius:21px!important;grid-template-columns:56px minmax(0,1fr) auto 16px!important;gap:11px!important}
        .neoFoodPage .neoMenuIcon{width:54px!important;height:54px!important;border-radius:18px!important;font-size:23px!important}
        .neoFoodPage .neoMenuCard b{font-size:17px!important}.neoFoodPage .neoMenuCard small{font-size:10px!important;margin-top:3px!important}.neoFoodPage .neoMenuCard strong{height:36px!important;min-width:40px!important;font-size:13px!important}.neoFoodPage .neoMenuCard em{font-size:26px!important}

        .hsFamilyOpenCard202{cursor:pointer!important;transition:border-color .16s ease,transform .16s ease}.hsFamilyOpenCard202:active{transform:scale(.992)}.hsFamilyOpenHint202{display:flex;align-items:center;justify-content:space-between;margin-top:13px;padding-top:11px;border-top:1px solid rgba(255,255,255,.06);color:#7e91a7;font-size:10px}.hsFamilyOpenHint202 b{color:#55b4ff;font-size:11px}
        .hsFamilyPage202{max-width:920px;margin:0 auto;color:#f5f8fc;padding-bottom:135px}.hsFamilyHead202{display:grid;grid-template-columns:50px 1fr;gap:12px;align-items:start;margin:8px 0 16px}.hsFamilyHead202>button{width:48px;height:48px;border-radius:16px!important;background:#111c29!important;border:1px solid rgba(141,177,219,.18)!important;color:#c8d8ea!important;font-size:31px!important}.hsFamilyHead202 h2{margin:3px 0 3px;font-size:28px;letter-spacing:-.6px}.hsFamilyHead202 p{margin:0;color:#8394aa;font-size:11px;line-height:1.45}
        .hsFamilyTabs202{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px}.hsFamilyTabs202 button{min-height:46px;border-radius:15px!important;background:#101a26!important;border:1px solid rgba(130,170,215,.18)!important;color:#9eb0c5!important;font-size:12px!important;font-weight:750!important}.hsFamilyTabs202 button.active{background:linear-gradient(180deg,rgba(26,144,255,.22),rgba(10,87,165,.14))!important;border-color:rgba(45,157,255,.5)!important;color:#8fd0ff!important}
        .hsFamilySearch202{height:52px;display:grid;grid-template-columns:32px 1fr 30px;align-items:center;gap:6px;padding:0 13px;margin-bottom:10px;border-radius:17px;background:#0e1824;border:1px solid rgba(132,172,219,.16)}.hsFamilySearch202>span{font-size:21px;color:#8ba6c3}.hsFamilySearch202 input{border:0;outline:0;background:transparent;color:#f5f8fc;font-size:14px}.hsFamilySearch202 button{border:0!important;background:transparent!important;color:#8093a8!important;font-size:20px!important}.hsFamilySummary202{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px}.hsFamilySummary202>div{padding:10px 12px;border-radius:15px;background:rgba(22,34,49,.72);border:1px solid rgba(132,172,219,.11)}.hsFamilySummary202 strong{display:block;font-size:17px;color:#7ac6ff}.hsFamilySummary202 span{font-size:9px;color:#7f91a6}
        .hsFamilyGroups202{display:grid;gap:8px}.hsFamilyGroup202{border-radius:18px;background:linear-gradient(145deg,#111c29,#09121b);border:1px solid rgba(132,172,219,.15);overflow:hidden}.hsFamilyGroup202 summary{list-style:none;cursor:pointer;display:flex;align-items:center;justify-content:space-between;padding:13px 14px}.hsFamilyGroup202 summary::-webkit-details-marker{display:none}.hsFamilyGroup202 summary b{display:block;font-size:14px}.hsFamilyGroup202 summary small{display:block;margin-top:3px;color:#7f91a5!important;font-size:9px!important}.hsFamilyGroup202 summary>span{font-size:23px;color:#8198b1;transition:transform .15s}.hsFamilyGroup202[open] summary>span{transform:rotate(90deg)}.hsFamilyProducts202{display:grid;gap:7px;padding:0 10px 10px}.hsFamilyProduct202{display:grid;grid-template-columns:minmax(0,1fr) minmax(150px,220px) 64px;gap:8px;align-items:end;padding:10px;border-radius:14px;background:#0c151f;border:1px solid rgba(255,255,255,.045)}.hsFamilyProductCopy202{align-self:center;min-width:0}.hsFamilyProductCopy202 b{display:block;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.hsFamilyProductCopy202 small{display:block;margin-top:3px;color:#77899e!important;font-size:8px!important;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.hsFamilyProduct202 label span{display:block;margin-bottom:4px;color:#8193a7;font-size:8px;font-weight:700}.hsFamilyProduct202 input{box-sizing:border-box;width:100%;height:36px;border-radius:11px;border:1px solid rgba(55,151,244,.22);background:#101c28;color:#eef6ff;padding:0 9px;font-size:11px;outline:none}.hsFamilyProduct202>button{height:36px!important;min-height:36px!important;border-radius:11px!important;border:1px solid rgba(42,151,255,.28)!important;background:rgba(25,125,224,.12)!important;color:#87caff!important;font-size:9px!important;font-weight:800!important;padding:0 9px!important}
        @media(max-width:760px){
          .neoFoodRow162{grid-template-columns:82px minmax(0,1fr) 110px!important}.neoFoodSide{width:110px!important;min-width:110px!important;max-width:110px!important}.neoFoodSide .hsQtyButton201{height:34px!important;min-height:34px!important;font-size:9px!important}
          .hsConsUnified180 .hsConsRow166,.hsConsRow166{grid-template-columns:104px minmax(0,1fr) 108px!important}.hsConsSide166{width:108px!important;min-width:108px!important;max-width:108px!important}.hsConsSide166 .hsQtyButton201{height:34px!important;min-height:34px!important;font-size:9px!important}
          .neoFoodPage .neoMenuCard{width:calc(100% - 6px)!important;min-height:82px!important;padding:9px 11px!important;grid-template-columns:50px minmax(0,1fr) auto 14px!important;gap:9px!important}.neoFoodPage .neoMenuIcon{width:48px!important;height:48px!important;border-radius:17px!important;font-size:21px!important}.neoFoodPage .neoMenuCard b{font-size:16px!important}.neoFoodPage .neoMenuCard small{font-size:9px!important}.neoFoodPage .neoMenuCard strong{height:34px!important;min-width:38px!important}
          .hsFamilyPage202{padding-bottom:120px}.hsFamilyHead202{grid-template-columns:44px 1fr;gap:9px}.hsFamilyHead202>button{width:42px;height:42px}.hsFamilyHead202 h2{font-size:24px}.hsFamilyProduct202{grid-template-columns:1fr 64px}.hsFamilyProductCopy202{grid-column:1/-1}.hsFamilyProduct202 label{min-width:0}.hsFamilyProduct202 input{font-size:12px}.hsFamilyGroup202 summary{padding:12px}.hsFamilyProducts202{padding:0 8px 8px}
        }
      `;
      root.appendChild(style);
    }
  };
}
