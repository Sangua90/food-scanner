import './panel_v206.js?v=2.0.9-base';

const Panel = customElements.get('food-scanner-panel');

if (Panel) {
  const esc209 = (ctx, value) => ctx.esc ? ctx.esc(value) : String(value ?? '');
  const alpha209 = (a, b) => String(a || '').localeCompare(String(b || ''), 'it', { sensitivity: 'base' });

  const foodMacro209 = (group) => {
    const family = String(group?.name || '').toLocaleLowerCase('it-IT');
    const category = String(group?.items?.[0]?.category || '').trim();
    if (/maionese|ketchup|senape|salsa|condiment/.test(family)) return 'Salse e condimenti';
    if (/latte|mozzarella|yogurt|burro|parmigiano|grana|uova/.test(family)) return 'Latticini e uova';
    if (/prosciutto|salame|carne|wurstel|mortadella|bresaola/.test(family)) return 'Carne e salumi';
    if (/tonno|salmone|sgombro|pesce/.test(family)) return 'Pesce';
    if (/passata|pelati|polpa|fagioli|ceci|lenticchie|piselli|mais|conserv/.test(family)) return 'Conserve e legumi';
    if (/pasta|riso|cereali/.test(family)) return 'Pasta, riso e cereali';
    if (/farina|zucchero|sale|olio/.test(family)) return 'Dispensa base';
    if (/biscott|fette biscottate|marmellata|confettura|crema spalmabile|caff[eè]/.test(family)) return 'Colazione e dolci';
    if (/pane|pizza|cracker|patatine/.test(family)) return 'Pane, forno e snack';
    if (/acqua|bibita|succo|bevanda/.test(family)) return 'Bevande';
    if (category) return category;
    return 'Altro';
  };

  const consMacro209 = (group) => {
    const family = String(group?.name || '').toLocaleLowerCase('it-IT');
    const category = String(group?.items?.[0]?.category || '').trim();
    if (/carta igienica|rotoli|scottex|tovagli|fazzolett|sacchett/.test(family)) return 'Carta e monouso';
    if (/sapone mani|shampoo|bagnoschiuma|dentifric|deodorante|igiene/.test(family)) return 'Igiene personale';
    if (/detersivo piatti|lavastoviglie|sgrassatore|candeggina|detergente|pulizia/.test(family)) return 'Pulizia casa';
    if (/lavatrice|ammorbidente|bucato|lavanderia/.test(family)) return 'Lavanderia';
    if (/animali|gatto|cane|lettiera/.test(family)) return 'Animali';
    if (category && category !== 'Altro') return category;
    return 'Altro';
  };

  Panel.prototype.hsMacroFamilyGroups209 = function(kind = 'food') {
    const groups = this.hsFamilyGroups202 ? this.hsFamilyGroups202(kind) : [];
    const macroMap = new Map();
    for (const group of groups) {
      const macro = kind === 'cons' ? consMacro209(group) : foodMacro209(group);
      const key = macro.toLocaleLowerCase('it-IT');
      if (!macroMap.has(key)) macroMap.set(key, { key, name: macro, families: [], units: 0, items: 0 });
      const target = macroMap.get(key);
      target.families.push(group);
      target.units += Number(group.units || 0);
      target.items += Number(group.items?.length || 0);
    }
    return [...macroMap.values()]
      .map(m => ({ ...m, families: m.families.slice().sort((a, b) => alpha209(a.name, b.name)) }))
      .sort((a, b) => alpha209(a.name, b.name));
  };

  Panel.prototype.hsFamilySettingsView202 = function() {
    const kind = this._hsFamilyKind202 === 'cons' ? 'cons' : 'food';
    const query = String(this._hsFamilySearch202 || '').trim().toLocaleLowerCase('it-IT');
    let macros = this.hsMacroFamilyGroups209(kind);

    if (query) {
      macros = macros.map(macro => {
        const macroMatches = macro.name.toLocaleLowerCase('it-IT').includes(query);
        const families = macro.families.filter(g => {
          const text = `${g.name} ${(g.items || []).map(x => `${x.product_name || ''} ${x.brand || ''} ${x.category || ''}`).join(' ')}`.toLocaleLowerCase('it-IT');
          return macroMatches || text.includes(query);
        });
        return { ...macro, families };
      }).filter(m => m.families.length);
    }

    const totalFamilies = macros.reduce((n, m) => n + m.families.length, 0);
    const totalItems = macros.reduce((n, m) => n + m.families.reduce((x, g) => x + (g.items?.length || 0), 0), 0);

    const productRow = (item) => {
      const family = String(item.generic_name || (kind === 'cons' ? this.consGenericName?.(item) : this.foodGenericName?.(item)) || item.product_name || '').trim();
      return `<div class="hsFamilyProduct202 hsFamilyProduct209">
        <div class="hsFamilyProductCopy202"><b>${esc209(this, item.product_name || 'Prodotto')}</b><small>${esc209(this, [item.brand, item.category].filter(Boolean).join(' · ') || (kind === 'cons' ? 'Consumabile' : 'Alimento'))}</small></div>
        <label><span>Sottocategoria</span><input data-family-input202="${esc209(this, item.id)}" value="${esc209(this, family)}" autocomplete="off" spellcheck="false"></label>
        <button type="button" data-family-save202="${esc209(this, item.id)}" data-family-kind202="${kind}">Salva</button>
      </div>`;
    };

    const macroCards = macros.map(macro => {
      const families = macro.families.map(group => `<details class="hsFamilyGroup202 hsSubFamily209">
        <summary><div><b>${esc209(this, group.name)}</b><small>${group.items.length} ${group.items.length === 1 ? 'prodotto' : 'prodotti'} · ${group.units} unità</small></div><span>›</span></summary>
        <div class="hsFamilyProducts202">${group.items.map(productRow).join('')}</div>
      </details>`).join('');
      const items = macro.families.reduce((n, g) => n + (g.items?.length || 0), 0);
      return `<details class="hsMacroGroup209">
        <summary class="hsMacroSummary209"><div><b>${esc209(this, macro.name)}</b><small>${macro.families.length} ${macro.families.length === 1 ? 'sottocategoria' : 'sottocategorie'} · ${items} prodotti</small></div><span>›</span></summary>
        <div class="hsMacroFamilies209">${families}</div>
      </details>`;
    }).join('');

    return `<section class="hsModePage hsFamilyPage202 hsFamilyPage209">
      <div class="hsFamilyHead202"><button type="button" id="hsFamilyBack202">‹</button><div><span class="eyebrow">IMPOSTAZIONI</span><h2>Famiglie prodotti</h2><p>Organizzate in macrofamiglie e sottocategorie per trovarle più facilmente.</p></div></div>
      <div class="hsFamilyTabs202"><button type="button" data-family-kindtab202="food" class="${kind === 'food' ? 'active' : ''}">🍎 Alimenti</button><button type="button" data-family-kindtab202="cons" class="${kind === 'cons' ? 'active' : ''}">🧴 Consumabili</button></div>
      <div class="hsFamilySearch202"><span>⌕</span><input id="hsFamilySearch202" type="search" placeholder="Cerca macrofamiglia, sottocategoria o prodotto" value="${esc209(this, this._hsFamilySearch202 || '')}"><button type="button" id="hsFamilySearchClear202" ${query ? '' : 'hidden'}>×</button></div>
      <div class="hsFamilySummary202 hsFamilySummary209"><div><strong>${macros.length}</strong><span>macrofamiglie</span></div><div><strong>${totalFamilies}</strong><span>sottocategorie</span></div><div><strong>${totalItems}</strong><span>prodotti</span></div></div>
      <div class="hsMacroGroups209">${macroCards || '<div class="empty">Nessuna famiglia trovata</div>'}</div>
    </section>`;
  };

  // Prima della foto dei consumabili non serve scegliere due volte la posizione:
  // il valore corrente resta interno e la scelta finale viene fatta nel riepilogo riconosciuto.
  const previousConsDialog209 = Panel.prototype.consScanDialog;
  if (previousConsDialog209) {
    Panel.prototype.consScanDialog = function() {
      let html = previousConsDialog209.call(this);
      const status = this._consScan?.status;
      if (status === 'photo' || status === 'fallback') {
        html = html.replace(
          /<div class="scanSectionLabel">Dove lo metti\?<\/div>\s*<div class="choiceRow scanLocations cons1644Locations">[\s\S]*?<\/div>\s*(?=<input id="cons1644File")/,
          ''
        );
        html = html.replace('Scegli dove lo riponi e scatta una foto della confezione.', 'Scatta una foto della confezione. Sceglierai dove riporlo dopo il riconoscimento.');
      }
      return html;
    };
  }

  // Una voce non riconosciuta non deve bloccare i prodotti riconosciuti.
  Panel.prototype.voiceCanConfirm = function() {
    const ops = this._voice?.ops || [];
    return ops.some(op => op?.status === 'matched' && op?.id && Number(op?.amount || 0) > 0);
  };

  const previousRender209 = Panel.prototype.render;
  Panel.prototype.render = function() {
    previousRender209.call(this);
    const root = this.shadowRoot;
    if (!root) return;
    const version = root.querySelector('.hsVersion165 b');
    if (version) version.textContent = 'v2.0.9';
    if (root.querySelector('#hsFamilyMacro209Style')) return;
    const style = document.createElement('style');
    style.id = 'hsFamilyMacro209Style';
    style.textContent = `
      .hsFamilySummary209{grid-template-columns:repeat(3,1fr)!important}.hsFamilySummary209>div{padding:8px 10px!important}.hsFamilySummary209 strong{font-size:15px!important}.hsFamilySummary209 span{font-size:8px!important}
      .hsMacroGroups209{display:grid;gap:8px}.hsMacroGroup209{border-radius:17px;background:linear-gradient(145deg,#111c29,#09121b);border:1px solid rgba(132,172,219,.16);overflow:hidden}.hsMacroSummary209{list-style:none;cursor:pointer;display:flex;align-items:center;justify-content:space-between;padding:11px 13px}.hsMacroSummary209::-webkit-details-marker{display:none}.hsMacroSummary209 b{display:block;font-size:13px;color:#eaf4ff}.hsMacroSummary209 small{display:block;margin-top:2px;color:#7890a9!important;font-size:8px!important}.hsMacroSummary209>span{font-size:21px;color:#7594b5;transition:transform .15s}.hsMacroGroup209[open]>.hsMacroSummary209>span{transform:rotate(90deg)}
      .hsMacroFamilies209{display:grid;gap:6px;padding:0 8px 8px}.hsSubFamily209{border-radius:13px!important;background:#0c151f!important;border-color:rgba(255,255,255,.055)!important}.hsSubFamily209>summary{padding:9px 10px!important}.hsSubFamily209>summary b{font-size:11px!important}.hsSubFamily209>summary small{font-size:8px!important}.hsSubFamily209>summary>span{font-size:18px!important}.hsSubFamily209 .hsFamilyProducts202{padding:0 7px 7px!important;gap:5px!important}
      .hsFamilyProduct209{padding:8px!important;grid-template-columns:minmax(0,1fr) minmax(128px,190px) 56px!important;gap:6px!important;border-radius:11px!important}.hsFamilyProduct209 .hsFamilyProductCopy202 b{font-size:10px!important}.hsFamilyProduct209 .hsFamilyProductCopy202 small{font-size:7px!important}.hsFamilyProduct209 label span{font-size:7px!important}.hsFamilyProduct209 input{min-height:32px!important;font-size:10px!important;padding:6px 7px!important}.hsFamilyProduct209>button{min-height:32px!important;font-size:9px!important;padding:0 7px!important}
      @media(max-width:760px){.hsFamilySummary209{grid-template-columns:repeat(3,1fr)!important}.hsFamilySummary209>div{padding:7px 8px!important}.hsMacroSummary209{padding:10px 11px}.hsFamilyProduct209{grid-template-columns:minmax(0,1fr) 118px 50px!important}.hsFamilyProduct209 .hsFamilyProductCopy202 small{display:none}.hsFamilyProduct209 input{font-size:9px!important}}
    `;
    root.appendChild(style);
  };
}
