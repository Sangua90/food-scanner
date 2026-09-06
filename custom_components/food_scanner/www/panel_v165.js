import './panel_v164.js?v=1.6.17-base';

const HomeStockPanel = customElements.get('food-scanner-panel');

if (HomeStockPanel) {
  const prevFood165 = HomeStockPanel.prototype.renderFood;
  const prevCons165 = HomeStockPanel.prototype.renderCons;
  const prevRender165 = HomeStockPanel.prototype.render;

  HomeStockPanel.prototype.loadInternalSettings165 = async function() {
    if (!this._hass) return;
    try {
      const data = await this._hass.callApi('GET', 'food_scanner/archive?sort=expiry');
      this._hsSettingsData = { ...(data?.settings || {}) };
      const raw = Number(this._hsSettingsData.food_low_stock_threshold);
      if (Number.isFinite(raw)) this._foodLowThreshold = Math.max(0, Math.trunc(raw));
      this._hsSettingsError = '';
    } catch (e) {
      this._hsSettingsError = e?.message || String(e);
    }
  };

  HomeStockPanel.prototype.openInternalSettings165 = async function() {
    this._hsSettingsPage = true;
    this._hsQuickAddOpen = false;
    this._mode = 'food';
    this._foodNeoMenu = '';
    this.render();
    await this.loadInternalSettings165();
    this.render();
  };

  HomeStockPanel.prototype.closeInternalSettings165 = function(mode = 'food') {
    this._hsSettingsPage = false;
    this._mode = mode;
    this._foodNeoMenu = '';
    this._foodNeoSearch = '';
    this.render();
  };

  HomeStockPanel.prototype.saveInternalSetting165 = async function(changes) {
    try {
      const response = await this._hass.callApi('POST', 'food_scanner/archive', {
        action: 'update_settings',
        ...changes,
      });
      this._hsSettingsData = { ...(this._hsSettingsData || {}), ...(response?.settings || {}), ...changes };
      if (Object.prototype.hasOwnProperty.call(changes, 'food_low_stock_threshold')) {
        this._foodLowThreshold = Math.max(0, Math.trunc(Number(changes.food_low_stock_threshold) || 0));
      }
      this._hsSettingsSaved = 'Salvato';
      this.render();
      clearTimeout(this._hsSettingsSavedTimer);
      this._hsSettingsSavedTimer = setTimeout(() => {
        this._hsSettingsSaved = '';
        if (this._hsSettingsPage) this.render();
      }, 1800);
    } catch (e) {
      alert(e?.message || String(e));
    }
  };

  HomeStockPanel.prototype.internalSettingsView165 = function() {
    const s = this._hsSettingsData || {};
    const expiryOn = s.expiry_notify !== false;
    const expiryDays = Math.max(0, Number(s.expiry_notify_days ?? 3) || 0);
    const low = this.foodLowThreshold ? this.foodLowThreshold() : Math.max(0, Number(s.food_low_stock_threshold ?? 3) || 0);
    const model = String(s.model || 'Automatico');
    const foodFamilies = new Set((this._items || []).map(x => String(this.foodGenericName?.(x) || x.product_name || '').trim().toLocaleLowerCase('it-IT')).filter(Boolean)).size;
    const consFamilies = this.consFamilyGroups ? this.consFamilyGroups().length : new Set((this._cons || []).map(x => String(x.generic_name || x.product_name || '').trim().toLocaleLowerCase('it-IT')).filter(Boolean)).size;
    const activeFood = (this._items || []).filter(x => Number(x.stock_units || 0) > 0).length;
    const activeCons = (this._cons || []).filter(x => Number(x.stock_units || 0) > 0).length;

    return `<section class="hsModePage hsSettings165">
      <div class="hsSettingsHead165">
        <div><span class="eyebrow">HOMESTOCK</span><h2>Impostazioni</h2><p>Configura il comportamento dell'app</p></div>
        ${this._hsSettingsSaved ? `<span class="hsSaved165">✓ ${this.esc(this._hsSettingsSaved)}</span>` : ''}
      </div>
      ${this._hsSettingsError ? `<div class="hsSettingsError165">${this.esc(this._hsSettingsError)}</div>` : ''}

      <div class="hsSettingsGrid165">
        <section class="hsSettingCard165 ai">
          <div class="hsSettingTitle165"><span>✦</span><div><b>Intelligenza artificiale</b><small>Riconoscimento prodotti con Gemini</small></div></div>
          <label class="hsField165"><span>Modello configurato</span><input id="hsSetModel" type="text" value="${this.esc(model)}" autocomplete="off" spellcheck="false"></label>
          <button class="hsInlineSave165" id="hsSaveModel">Salva modello</button>
          <p class="hsSettingNote165">La selezione automatica di HomeStock continuerà a usare il miglior modello compatibile quando è attiva nella configurazione dell'integrazione.</p>
        </section>

        <section class="hsSettingCard165 expiry">
          <div class="hsSettingTitle165"><span>◷</span><div><b>Scadenze</b><small>Avvisi prima che un alimento scada</small></div></div>
          <div class="hsSettingRow165"><div><b>Notifiche scadenza</b><small>${expiryOn ? 'Attive' : 'Disattivate'}</small></div><button id="hsExpiryToggle" class="hsSwitch165 ${expiryOn ? 'on' : ''}" aria-label="Notifiche scadenza"><i></i></button></div>
          <div class="hsSettingRow165"><div><b>Giorni di preavviso</b><small>Quanto prima ricevere l'avviso</small></div><div class="hsMiniStep165"><button id="hsExpiryMinus" ${expiryDays <= 0 ? 'disabled' : ''}>−</button><strong>${expiryDays}</strong><button id="hsExpiryPlus">+</button></div></div>
        </section>

        <section class="hsSettingCard165 stock">
          <div class="hsSettingTitle165"><span>▣</span><div><b>Scorte basse · Alimenti</b><small>Soglia globale per la lista della spesa</small></div></div>
          <div class="hsSettingRow165"><div><b>Soglia</b><small>${low === 0 ? 'Mostra solo i prodotti finiti' : `Mostra ${low} unità o meno`}</small></div><div class="hsMiniStep165 amber"><button id="hsLowMinus" ${low <= 0 ? 'disabled' : ''}>−</button><strong>${low}</strong><button id="hsLowPlus">+</button></div></div>
          <p class="hsSettingNote165">I prodotti a zero restano memorizzati ma sono nascosti dall'inventario normale.</p>
        </section>

        <section class="hsSettingCard165 family">
          <div class="hsSettingTitle165"><span>◎</span><div><b>Famiglie prodotto</b><small>Raggruppamento automatico indipendente dalla marca</small></div></div>
          <div class="hsFamilyStats165"><div><strong>${foodFamilies}</strong><span>Famiglie alimenti</span><small>${activeFood} articoli attivi</small></div><div><strong>${consFamilies}</strong><span>Famiglie consumabili</span><small>${activeCons} articoli attivi</small></div></div>
          <div class="hsFamilyStatus165"><span>✓</span><div><b>Raggruppamento automatico attivo</b><small>Marca, barcode, formato e scadenza restano separati nei singoli articoli.</small></div></div>
        </section>

        <section class="hsSettingCard165 data">
          <div class="hsSettingTitle165"><span>⇩</span><div><b>Archivio e dati</b><small>Esporta una copia dei dati di HomeStock</small></div></div>
          <div class="hsDataButtons165"><button id="hsBackupJson"><b>Backup JSON</b><small>Copia completa per ripristino</small></button><button id="hsBackupCsv"><b>Esporta CSV</b><small>Inventario leggibile</small></button></div>
        </section>

        <section class="hsSettingCard165 advanced">
          <div class="hsSettingTitle165"><span>⚙</span><div><b>Avanzate</b><small>Configurazione tecnica Home Assistant</small></div></div>
          <button id="hsAdvancedHa" class="hsAdvancedButton165"><span><b>Apri integrazione HomeStock</b><small>API key, opzioni tecniche e diagnostica</small></span><em>›</em></button>
        </section>
      </div>

      <div class="hsVersion165"><span>HomeStock</span><b>v1.6.17</b></div>
    </section>`;
  };

  HomeStockPanel.prototype.renderFood = function() {
    if (this._hsSettingsPage) return this.internalSettingsView165();
    return prevFood165.call(this);
  };
  HomeStockPanel.prototype.renderCons = function() {
    if (this._hsSettingsPage) return this.internalSettingsView165();
    return prevCons165.call(this);
  };

  HomeStockPanel.prototype.bindInternalSettings165 = function() {
    const root = this.shadowRoot;
    if (!root || !this._hsSettingsPage) return;
    const s = this._hsSettingsData || {};
    const expiryDays = Math.max(0, Number(s.expiry_notify_days ?? 3) || 0);
    const low = this.foodLowThreshold ? this.foodLowThreshold() : 3;

    root.querySelector('#hsSaveModel')?.addEventListener('click', () => {
      const value = String(root.querySelector('#hsSetModel')?.value || '').trim();
      if (!value) return alert('Inserisci un modello Gemini valido.');
      this.saveInternalSetting165({ model: value });
    });
    root.querySelector('#hsExpiryToggle')?.addEventListener('click', () => this.saveInternalSetting165({ expiry_notify: s.expiry_notify === false }));
    root.querySelector('#hsExpiryMinus')?.addEventListener('click', () => this.saveInternalSetting165({ expiry_notify_days: Math.max(0, expiryDays - 1) }));
    root.querySelector('#hsExpiryPlus')?.addEventListener('click', () => this.saveInternalSetting165({ expiry_notify_days: Math.min(365, expiryDays + 1) }));
    root.querySelector('#hsLowMinus')?.addEventListener('click', () => this.saveInternalSetting165({ food_low_stock_threshold: Math.max(0, low - 1) }));
    root.querySelector('#hsLowPlus')?.addEventListener('click', () => this.saveInternalSetting165({ food_low_stock_threshold: Math.min(999, low + 1) }));
    root.querySelector('#hsBackupJson')?.addEventListener('click', () => this._download?.('json'));
    root.querySelector('#hsBackupCsv')?.addEventListener('click', () => this._download?.('csv'));
    root.querySelector('#hsAdvancedHa')?.addEventListener('click', () => {
      history.pushState(null, '', '/config/integrations/integration/food_scanner');
      window.dispatchEvent(new Event('location-changed'));
    });
  };

  HomeStockPanel.prototype.rebindBottomNav165 = function() {
    const root = this.shadowRoot;
    const nav = root?.querySelector('.hsBottomNav163');
    if (!nav || nav.dataset.settings165 === '1') return;
    const clean = nav.cloneNode(true);
    clean.dataset.settings165 = '1';
    nav.replaceWith(clean);

    clean.querySelector('#hsNavHome')?.addEventListener('click', () => {
      this._hsSettingsPage = false;
      this.goHome163?.();
    });
    clean.querySelector('#hsNavFood')?.addEventListener('click', () => {
      this._hsSettingsPage = false;
      this._mode = 'food'; this._foodNeoMenu = ''; this._foodNeoSearch = ''; this._hsQuickAddOpen = false; this.render();
    });
    clean.querySelector('#hsNavPlus')?.addEventListener('click', () => {
      this._hsSettingsPage = false;
      this.openQuickAdd163?.();
    });
    clean.querySelector('#hsNavCons')?.addEventListener('click', () => {
      this._hsSettingsPage = false;
      this._mode = 'cons'; this._hsQuickAddOpen = false; this.render();
    });
    clean.querySelector('#hsNavSettings')?.addEventListener('click', () => this.openInternalSettings165());
  };

  HomeStockPanel.prototype.render = function() {
    prevRender165.call(this);
    const root = this.shadowRoot;
    if (!root) return;
    this.rebindBottomNav165();

    const nav = root.querySelector('.hsBottomNav163');
    if (nav) {
      nav.querySelectorAll('button').forEach(b => b.classList.remove('active'));
      if (this._hsSettingsPage) nav.querySelector('#hsNavSettings')?.classList.add('active');
      else if (this._mode === 'cons') nav.querySelector('#hsNavCons')?.classList.add('active');
      else nav.querySelector('#hsNavFood')?.classList.add('active');
    }

    this.bindInternalSettings165();
    if (root.querySelector('#homeStockSettings1617')) return;
    const style = document.createElement('style');
    style.id = 'homeStockSettings1617';
    style.textContent = `
      .hsSettings165{max-width:940px;margin:0 auto;color:#f4f8ff;padding-bottom:125px}.hsSettingsHead165{display:flex;align-items:flex-start;justify-content:space-between;margin:10px 2px 18px}.hsSettingsHead165 h2{margin:3px 0 2px;font-size:30px;letter-spacing:-.7px}.hsSettingsHead165 p{margin:0;color:#8394aa;font-size:12px}.hsSaved165{padding:8px 11px;border-radius:12px;background:rgba(34,197,94,.1);border:1px solid rgba(34,197,94,.22);color:#86efac;font-size:11px;font-weight:800}.hsSettingsError165{padding:10px 12px;margin-bottom:12px;border-radius:14px;background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.2);color:#fca5a5;font-size:11px}.hsSettingsGrid165{display:grid;grid-template-columns:1fr 1fr;gap:12px}.hsSettingCard165{padding:16px;border-radius:23px;background:linear-gradient(145deg,rgba(17,28,42,.98),rgba(8,15,24,.99));border:1px solid rgba(132,172,219,.18);box-shadow:inset 0 1px 0 rgba(255,255,255,.025),0 12px 30px rgba(0,0,0,.16)}.hsSettingCard165.family,.hsSettingCard165.data{grid-column:1/-1}.hsSettingTitle165{display:flex;gap:11px;align-items:center;margin-bottom:15px}.hsSettingTitle165>span{width:44px;height:44px;display:grid;place-items:center;border-radius:15px;background:rgba(27,137,255,.12);color:#59b3ff;font-size:21px}.hsSettingTitle165 b{display:block;font-size:15px}.hsSettingTitle165 small{display:block;margin-top:3px;color:#8395aa!important;font-size:9px!important}.hsSettingCard165.expiry .hsSettingTitle165>span{background:rgba(59,130,246,.12);color:#7cc2ff}.hsSettingCard165.stock .hsSettingTitle165>span{background:rgba(245,158,11,.1);color:#fbbf24}.hsSettingCard165.family .hsSettingTitle165>span{background:rgba(139,92,246,.1);color:#c4b5fd}.hsSettingCard165.data .hsSettingTitle165>span{background:rgba(34,197,94,.1);color:#86efac}.hsSettingCard165.advanced .hsSettingTitle165>span{background:rgba(148,163,184,.1);color:#cbd5e1}.hsField165 span{display:block;margin-bottom:6px;color:#9eb0c5;font-size:10px;font-weight:700}.hsField165 input{box-sizing:border-box;width:100%;height:42px;border-radius:13px;border:1px solid rgba(129,169,213,.18);background:#0b141f;color:#e8f2ff;padding:0 11px;outline:none;font-size:12px}.hsField165 input:focus{border-color:rgba(30,144,255,.48)}.hsInlineSave165{width:100%;height:38px;margin-top:8px;border-radius:12px!important;background:linear-gradient(180deg,#178fff,#0874db)!important;color:#fff!important;border:0!important;font-size:11px!important;font-weight:800!important}.hsSettingNote165{margin:10px 0 0;color:#718399;font-size:9px;line-height:1.4}.hsSettingRow165{min-height:56px;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 0;border-top:1px solid rgba(255,255,255,.055)}.hsSettingRow165:first-of-type{border-top:0}.hsSettingRow165 b{display:block;font-size:12px}.hsSettingRow165 small{display:block;margin-top:3px;color:#7e90a6!important;font-size:9px!important}.hsSwitch165{width:48px!important;height:29px!important;padding:3px!important;border-radius:30px!important;background:#263342!important;border:1px solid rgba(255,255,255,.06)!important}.hsSwitch165 i{display:block;width:21px;height:21px;border-radius:50%;background:#8797aa;transition:.18s}.hsSwitch165.on{background:#0c7de8!important}.hsSwitch165.on i{transform:translateX(19px);background:#fff}.hsMiniStep165{display:grid;grid-template-columns:30px 38px 30px;align-items:center;gap:4px}.hsMiniStep165 button{width:30px;height:30px;border-radius:10px!important;border:1px solid rgba(255,255,255,.07)!important;background:#172332!important;color:#dce8f6!important;font-size:17px!important}.hsMiniStep165 button:disabled{opacity:.3}.hsMiniStep165 strong{text-align:center;color:#60b8ff;font-size:14px}.hsMiniStep165.amber strong{color:#fbbf24}.hsFamilyStats165{display:grid;grid-template-columns:1fr 1fr;gap:9px}.hsFamilyStats165>div{padding:13px;border-radius:16px;background:#0d1722;border:1px solid rgba(255,255,255,.055)}.hsFamilyStats165 strong{display:block;font-size:24px;color:#b99cff}.hsFamilyStats165 span{display:block;margin-top:2px;font-size:11px;font-weight:750}.hsFamilyStats165 small{display:block;margin-top:3px;color:#78899e!important;font-size:8px!important}.hsFamilyStatus165{display:flex;gap:10px;align-items:center;margin-top:10px;padding:11px;border-radius:15px;background:rgba(34,197,94,.055);border:1px solid rgba(34,197,94,.12)}.hsFamilyStatus165>span{width:30px;height:30px;border-radius:10px;display:grid;place-items:center;background:rgba(34,197,94,.1);color:#86efac}.hsFamilyStatus165 b{display:block;font-size:10px}.hsFamilyStatus165 small{display:block;margin-top:2px;color:#7e9489!important;font-size:8px!important}.hsDataButtons165{display:grid;grid-template-columns:1fr 1fr;gap:9px}.hsDataButtons165 button,.hsAdvancedButton165{padding:12px!important;border-radius:16px!important;background:#0e1925!important;border:1px solid rgba(126,166,211,.14)!important;color:#eef5ff!important;text-align:left}.hsDataButtons165 b,.hsAdvancedButton165 b{display:block;font-size:11px}.hsDataButtons165 small,.hsAdvancedButton165 small{display:block;margin-top:3px;color:#7e90a5!important;font-size:8px!important}.hsAdvancedButton165{width:100%;display:flex;align-items:center;justify-content:space-between}.hsAdvancedButton165 em{font-style:normal;font-size:25px;color:#92aac3}.hsVersion165{display:flex;justify-content:center;gap:7px;margin:16px 0 2px;color:#65768b;font-size:9px}.hsVersion165 b{color:#7f93aa}.hsBottomNav163 #hsNavSettings.active{color:#2da1ff!important}
      @media(max-width:760px){.hsSettings165{padding-bottom:112px}.hsSettingsHead165 h2{font-size:24px}.hsSettingsGrid165{grid-template-columns:1fr;gap:10px}.hsSettingCard165.family,.hsSettingCard165.data{grid-column:auto}.hsSettingCard165{padding:14px;border-radius:20px}.hsSettingTitle165{margin-bottom:12px}.hsSettingTitle165>span{width:40px;height:40px;border-radius:13px;font-size:18px}.hsDataButtons165{grid-template-columns:1fr}.hsFamilyStats165{gap:7px}.hsFamilyStats165 strong{font-size:20px}}
    `;
    root.appendChild(style);
  };
}
