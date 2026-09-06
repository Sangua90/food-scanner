import './panel_v162.js?v=1.6.15-base';

const HomeStockPanel = customElements.get('food-scanner-panel');

if (HomeStockPanel) {
  const originalLoad163 = HomeStockPanel.prototype.load;
  HomeStockPanel.prototype.load = async function() {
    await originalLoad163.call(this);
    if (!this._hass || this._foodLowThresholdLoaded) return;
    try {
      const data = await this._hass.callApi('GET', 'food_scanner/archive?sort=expiry');
      const raw = Number(data?.settings?.food_low_stock_threshold);
      this._foodLowThreshold = Number.isFinite(raw) ? Math.max(0, Math.trunc(raw)) : 3;
    } catch (_) {
      this._foodLowThreshold = 3;
    }
    this._foodLowThresholdLoaded = true;
    this.render();
  };

  HomeStockPanel.prototype.foodLowThreshold = function() {
    const value = Number(this._foodLowThreshold);
    return Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 3;
  };

  HomeStockPanel.prototype.foodLowGroups = function() {
    const threshold = this.foodLowThreshold();
    return (this.foodStockGroups ? this.foodStockGroups() : [])
      .filter(group => Number(group.units || 0) <= threshold)
      .sort((a, b) => {
        const category = String(a.category || '').localeCompare(String(b.category || ''), 'it', { sensitivity: 'base' });
        return category || String(a.name || '').localeCompare(String(b.name || ''), 'it', { sensitivity: 'base' });
      });
  };

  HomeStockPanel.prototype.saveFoodLowThreshold = async function(value) {
    const threshold = Math.max(0, Math.min(999, Math.trunc(Number(value) || 0)));
    this._foodLowThreshold = threshold;
    this.render();
    try {
      await this._hass.callApi('POST', 'food_scanner/archive', {
        action: 'update_settings',
        food_low_stock_threshold: threshold,
      });
    } catch (e) {
      alert(e?.message || String(e));
    }
  };

  const originalLowMenu163 = HomeStockPanel.prototype.foodLowMenuView;
  HomeStockPanel.prototype.foodLowMenuView = function() {
    let html = originalLowMenu163.call(this);
    const threshold = this.foodLowThreshold();
    const text = threshold === 0
      ? 'Mostra solo i prodotti finiti'
      : `Mostra i prodotti con ${threshold} unità o meno`;
    const control = `<div class="neoLowThreshold">
      <div><span>Soglia scorte basse</span><small>${this.esc(text)}</small></div>
      <div class="neoThresholdStep">
        <button type="button" id="neoThresholdMinus" ${threshold <= 0 ? 'disabled' : ''}>−</button>
        <input id="neoThresholdInput" type="number" min="0" max="999" step="1" value="${threshold}" inputmode="numeric" aria-label="Soglia scorte basse">
        <button type="button" id="neoThresholdPlus">+</button>
      </div>
    </div>`;
    return html.replace('<div class="neoSearch">', `${control}<div class="neoSearch">`);
  };

  const originalBind163 = HomeStockPanel.prototype.bind;
  HomeStockPanel.prototype.bind = function() {
    originalBind163.call(this);
    const root = this.shadowRoot;
    if (!root) return;

    const input = root.querySelector('#neoThresholdInput');
    root.querySelector('#neoThresholdMinus')?.addEventListener('click', () => {
      this.saveFoodLowThreshold(Math.max(0, this.foodLowThreshold() - 1));
    });
    root.querySelector('#neoThresholdPlus')?.addEventListener('click', () => {
      this.saveFoodLowThreshold(this.foodLowThreshold() + 1);
    });
    input?.addEventListener('change', () => {
      this.saveFoodLowThreshold(input.value);
    });
  };

  HomeStockPanel.prototype.openQuickAdd163 = function() {
    this._hsQuickAddOpen = true;
    this.render();
  };

  HomeStockPanel.prototype.closeQuickAdd163 = function() {
    this._hsQuickAddOpen = false;
    this.render();
  };

  HomeStockPanel.prototype.goHome163 = function() {
    this._mode = 'food';
    this._foodNeoMenu = '';
    this._foodNeoSearch = '';
    this._location = '';
    this._consLocation = '';
    this._hsQuickAddOpen = false;
    this.render();
    this.shadowRoot?.querySelector('.page')?.scrollTo?.({ top: 0, behavior: 'smooth' });
  };

  const bottomNavHtml = (panel) => `
    <nav class="hsBottomNav163" aria-label="Navigazione HomeStock">
      <button type="button" id="hsNavHome" class="${panel._mode === 'food' && !panel._foodNeoMenu ? 'active' : ''}">
        <span class="hsNavIcon">⌂</span><small>Home</small>
      </button>
      <button type="button" id="hsNavFood" class="${panel._mode === 'food' ? 'active' : ''}">
        <span class="hsNavIcon">♧</span><small>Alimenti</small>
      </button>
      <button type="button" id="hsNavPlus" class="hsNavPlus" aria-label="Aggiungi">+</button>
      <button type="button" id="hsNavCons" class="${panel._mode === 'cons' ? 'active' : ''}">
        <span class="hsNavIcon">♙</span><small>Consumabili</small>
      </button>
      <button type="button" id="hsNavSettings">
        <span class="hsNavIcon">⚙</span><small>Impostazioni</small>
      </button>
    </nav>`;

  const quickAddHtml = () => `
    <div class="hsQuickOverlay163" id="hsQuickOverlay">
      <div class="hsQuickSheet163">
        <div class="hsQuickHandle"></div>
        <div class="hsQuickTitle"><div><b>Aggiungi a HomeStock</b><small>Scegli cosa vuoi inserire</small></div><button type="button" id="hsQuickClose">×</button></div>
        <button type="button" id="hsQuickFood" class="hsQuickAction food"><span>🍎</span><div><b>Scansiona alimento</b><small>Frigo, freezer o dispensa</small></div><em>›</em></button>
        <button type="button" id="hsQuickCons" class="hsQuickAction cons"><span>🧴</span><div><b>Scansiona consumabile</b><small>Riconoscimento con foto</small></div><em>›</em></button>
        <button type="button" id="hsQuickManual" class="hsQuickAction manual"><span>＋</span><div><b>Aggiunta manuale</b><small>Inserisci un consumabile senza foto</small></div><em>›</em></button>
      </div>
    </div>`;

  const originalRender163 = HomeStockPanel.prototype.render;
  HomeStockPanel.prototype.render = function() {
    originalRender163.call(this);
    const root = this.shadowRoot;
    if (!root) return;

    if (!root.querySelector('.hsBottomNav163')) {
      const holder = document.createElement('div');
      holder.innerHTML = bottomNavHtml(this);
      root.appendChild(holder.firstElementChild);

      root.querySelector('#hsNavHome')?.addEventListener('click', () => this.goHome163());
      root.querySelector('#hsNavFood')?.addEventListener('click', () => {
        this._mode = 'food';
        this._foodNeoMenu = '';
        this._foodNeoSearch = '';
        this._hsQuickAddOpen = false;
        this.render();
      });
      root.querySelector('#hsNavPlus')?.addEventListener('click', () => this.openQuickAdd163());
      root.querySelector('#hsNavCons')?.addEventListener('click', () => {
        this._mode = 'cons';
        this._hsQuickAddOpen = false;
        this.render();
      });
      root.querySelector('#hsNavSettings')?.addEventListener('click', () => {
        history.pushState(null, '', '/config/integrations/integration/food_scanner');
        window.dispatchEvent(new Event('location-changed'));
      });
    }

    if (this._hsQuickAddOpen && !root.querySelector('#hsQuickOverlay')) {
      const holder = document.createElement('div');
      holder.innerHTML = quickAddHtml();
      root.appendChild(holder.firstElementChild);
      root.querySelector('#hsQuickClose')?.addEventListener('click', () => this.closeQuickAdd163());
      root.querySelector('#hsQuickOverlay')?.addEventListener('click', e => {
        if (e.target?.id === 'hsQuickOverlay') this.closeQuickAdd163();
      });
      root.querySelector('#hsQuickFood')?.addEventListener('click', () => {
        this._hsQuickAddOpen = false;
        this._mode = 'food';
        this.openFoodScan();
      });
      root.querySelector('#hsQuickCons')?.addEventListener('click', () => {
        this._hsQuickAddOpen = false;
        this._mode = 'cons';
        this.openConsScan();
      });
      root.querySelector('#hsQuickManual')?.addEventListener('click', () => {
        this._hsQuickAddOpen = false;
        this._mode = 'cons';
        this.openManual();
      });
    }

    if (!root.querySelector('#homeStockBottomNav1615')) {
      const style = document.createElement('style');
      style.id = 'homeStockBottomNav1615';
      style.textContent = `
        .page{padding-bottom:128px!important}.neoFoodPage{padding-bottom:118px!important}.hsModePage{padding-bottom:112px}
        .hsBottomNav163{position:fixed;left:50%;bottom:max(8px,env(safe-area-inset-bottom));transform:translateX(-50%);z-index:160;width:min(760px,calc(100vw - 24px));height:86px;display:grid;grid-template-columns:1fr 1fr 90px 1fr 1fr;align-items:center;padding:8px 13px;border-radius:30px;background:linear-gradient(180deg,rgba(12,25,39,.985),rgba(5,12,20,.99));border:1px solid rgba(123,171,222,.2);box-shadow:0 18px 55px rgba(0,0,0,.48),inset 0 1px 0 rgba(255,255,255,.035);backdrop-filter:blur(22px);-webkit-backdrop-filter:blur(22px)}
        .hsBottomNav163>button:not(.hsNavPlus){height:66px;border:0!important;background:transparent!important;color:#9cadc2!important;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;border-radius:17px!important;font-weight:650!important}.hsBottomNav163>button.active{color:#2da1ff!important}.hsNavIcon{font-size:24px;line-height:1}.hsBottomNav163 small{font-size:11px!important;color:inherit!important}.hsNavPlus{width:76px!important;height:76px!important;align-self:center;justify-self:center;border-radius:50%!important;border:1px solid #63c9ff!important;background:radial-gradient(circle at 42% 32%,#39c2ff,#087fff 58%,#075ccf)!important;color:#fff!important;font-size:45px!important;font-weight:280!important;line-height:1!important;box-shadow:0 0 0 7px rgba(20,139,255,.08),0 0 28px rgba(31,166,255,.55),0 14px 30px rgba(0,0,0,.35)!important;transform:translateY(-18px)}
        .hsQuickOverlay163{position:fixed;inset:0;z-index:210;background:rgba(2,6,12,.62);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);display:flex;align-items:flex-end;justify-content:center;padding:16px}.hsQuickSheet163{width:min(560px,100%);padding:10px 14px calc(14px + env(safe-area-inset-bottom));border-radius:28px;background:linear-gradient(180deg,#142235,#09121d);border:1px solid rgba(135,181,230,.23);box-shadow:0 -18px 60px rgba(0,0,0,.45)}.hsQuickHandle{width:42px;height:4px;border-radius:10px;background:rgba(255,255,255,.2);margin:2px auto 12px}.hsQuickTitle{display:flex;justify-content:space-between;align-items:center;padding:0 4px 9px}.hsQuickTitle b{display:block;font-size:18px}.hsQuickTitle small{display:block;margin-top:3px;color:#8698ad!important}.hsQuickTitle button{width:36px;height:36px;border-radius:12px!important;background:#172537!important;border:1px solid rgba(255,255,255,.08)!important;color:#b9c9db!important;font-size:22px}.hsQuickAction{width:100%;display:grid;grid-template-columns:48px 1fr 20px;align-items:center;gap:11px;text-align:left;margin-top:8px;padding:12px!important;border-radius:18px!important;background:#101d2b!important;border:1px solid rgba(137,177,218,.14)!important;color:#fff!important}.hsQuickAction>span{width:44px;height:44px;border-radius:14px;display:grid;place-items:center;background:rgba(35,145,255,.12);font-size:22px}.hsQuickAction b{display:block;font-size:14px}.hsQuickAction small{display:block;margin-top:3px;color:#8395aa!important}.hsQuickAction em{font-style:normal;font-size:25px;color:#9eb5ce}.hsQuickAction.cons>span{background:rgba(108,99,255,.12)}.hsQuickAction.manual>span{background:rgba(245,158,11,.12);color:#ffc456}
        .neoLowThreshold{display:flex;align-items:center;justify-content:space-between;gap:14px;margin:10px 0 13px;padding:13px 14px;border-radius:18px;background:linear-gradient(145deg,rgba(245,158,11,.08),rgba(14,23,34,.95));border:1px solid rgba(245,158,11,.18)}.neoLowThreshold>div:first-child span{display:block;font-size:13px;font-weight:800;color:#f4f7fb}.neoLowThreshold>div:first-child small{display:block;margin-top:4px;color:#9b8f76!important;font-size:10px!important}.neoThresholdStep{display:grid;grid-template-columns:36px 58px 36px;gap:6px;align-items:center}.neoThresholdStep button{width:36px;height:36px;border-radius:12px!important;background:#17202b!important;border:1px solid rgba(255,255,255,.08)!important;color:#e8edf4!important;font-size:20px!important}.neoThresholdStep button:disabled{opacity:.32}.neoThresholdStep input{box-sizing:border-box;width:58px;height:36px;text-align:center;border-radius:12px;border:1px solid rgba(245,158,11,.27);background:#0c131d;color:#ffc34e;font-size:15px;font-weight:850;outline:none;-moz-appearance:textfield}.neoThresholdStep input::-webkit-outer-spin-button,.neoThresholdStep input::-webkit-inner-spin-button{-webkit-appearance:none;margin:0}
        .foodMissingTray{bottom:104px!important}
        @media(max-width:760px){.page{padding-bottom:122px!important}.neoFoodPage{padding-bottom:116px!important}.hsBottomNav163{width:calc(100vw - 18px);height:78px;grid-template-columns:1fr 1fr 76px 1fr 1fr;padding:6px 8px;border-radius:25px}.hsBottomNav163>button:not(.hsNavPlus){height:59px;gap:3px}.hsNavIcon{font-size:21px}.hsBottomNav163 small{font-size:9px!important}.hsNavPlus{width:68px!important;height:68px!important;font-size:40px!important;transform:translateY(-16px)}.neoLowThreshold{padding:11px 12px;gap:9px}.neoLowThreshold>div:first-child span{font-size:12px}.neoLowThreshold>div:first-child small{font-size:9px!important}.neoThresholdStep{grid-template-columns:32px 50px 32px;gap:4px}.neoThresholdStep button{width:32px;height:32px}.neoThresholdStep input{width:50px;height:32px;font-size:14px}.foodMissingTray{bottom:94px!important}}
      `;
      root.appendChild(style);
    }
  };
}
