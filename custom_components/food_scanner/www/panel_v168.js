import './panel_v167.js?v=1.6.19-base';

const HomeStockPanel = customElements.get('food-scanner-panel');

if (HomeStockPanel) {
  const originalEsc168 = HomeStockPanel.prototype.esc;

  HomeStockPanel.prototype.displayText168 = function(value, depth = 0) {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
    if (depth > 2) return '';
    if (Array.isArray(value)) {
      return value.map(v => this.displayText168(v, depth + 1)).filter(Boolean).join(', ');
    }
    if (typeof value === 'object') {
      for (const key of ['message','error','detail','text','label','name','product_name','value','reason','photo_request']) {
        if (Object.prototype.hasOwnProperty.call(value, key)) {
          const text = this.displayText168(value[key], depth + 1);
          if (text) return text;
        }
      }
      const primitive = Object.values(value)
        .map(v => this.displayText168(v, depth + 1))
        .filter(Boolean);
      if (primitive.length) return primitive.slice(0, 3).join(' · ');
      return '';
    }
    return String(value);
  };

  HomeStockPanel.prototype.esc = function(value) {
    const safeValue = (value && typeof value === 'object') ? this.displayText168(value) : value;
    return originalEsc168.call(this, safeValue);
  };

  HomeStockPanel.prototype.hasBlockingDialog168 = function() {
    const root = this.shadowRoot;
    return Boolean(
      this._foodScan || this._consScan || this._manual || this._adjust || this._edit ||
      root?.querySelector('.overlay:not(.hsQuickOverlay163)')
    );
  };

  const previousRender168 = HomeStockPanel.prototype.render;
  HomeStockPanel.prototype.render = function() {
    previousRender168.call(this);
    const root = this.shadowRoot;
    if (!root) return;

    const nav = root.querySelector('.hsBottomNav163');
    const dialogOpen = this.hasBlockingDialog168();
    if (nav) {
      nav.classList.toggle('hsNavHidden168', dialogOpen);
      nav.setAttribute('aria-hidden', dialogOpen ? 'true' : 'false');
    }

    root.querySelector('.page')?.classList.toggle('hsDialogOpen168', dialogOpen);

    const version = root.querySelector('.hsVersion165 b');
    if (version) version.textContent = 'v1.6.19';

    if (root.querySelector('#homeStockSafeArea1619')) return;
    const style = document.createElement('style');
    style.id = 'homeStockSafeArea1619';
    style.textContent = `
      :host{--hs-nav-clearance:150px;--hs-safe-bottom:env(safe-area-inset-bottom,0px)}

      /* The fixed bottom navigation never covers the last inventory row. */
      .hsModePage,.neoFoodPage,.hsConsPage166,.hsSettings165{
        padding-bottom:calc(var(--hs-nav-clearance) + var(--hs-safe-bottom))!important;
        box-sizing:border-box!important;
      }
      .neoFoodList,.hsConsList166,.hsProducts,.neoLowGroups{
        margin-bottom:calc(24px + var(--hs-safe-bottom))!important;
      }
      .foodMissingTray{
        bottom:calc(102px + var(--hs-safe-bottom))!important;
      }

      /* During scan/edit/quantity flows the navigation disappears completely. */
      .hsBottomNav163.hsNavHidden168{
        display:none!important;
        pointer-events:none!important;
        visibility:hidden!important;
      }
      .page.hsDialogOpen168 .hsModePage,
      .page.hsDialogOpen168 .neoFoodPage,
      .page.hsDialogOpen168 .hsConsPage166{
        padding-bottom:24px!important;
      }

      /* Full usable scan area on iPhone and especially iPad. */
      .overlay:not(.hsQuickOverlay163){
        box-sizing:border-box!important;
        padding-top:max(14px,env(safe-area-inset-top,0px))!important;
        padding-right:max(14px,env(safe-area-inset-right,0px))!important;
        padding-bottom:max(18px,env(safe-area-inset-bottom,0px))!important;
        padding-left:max(14px,env(safe-area-inset-left,0px))!important;
        overflow:auto!important;
        overscroll-behavior:contain!important;
      }
      .overlay:not(.hsQuickOverlay163)>.modal{
        box-sizing:border-box!important;
        max-height:calc(100dvh - max(28px,env(safe-area-inset-top,0px)) - max(30px,env(safe-area-inset-bottom,0px)))!important;
        overflow-y:auto!important;
        overscroll-behavior:contain!important;
        -webkit-overflow-scrolling:touch!important;
        padding-bottom:calc(22px + env(safe-area-inset-bottom,0px))!important;
      }
      .scanModal,.foodScanModal{
        width:min(680px,100%)!important;
      }
      .modalActions{
        padding-bottom:max(2px,env(safe-area-inset-bottom,0px))!important;
      }

      @media(max-width:760px){
        :host{--hs-nav-clearance:138px}
        .hsModePage,.neoFoodPage,.hsConsPage166,.hsSettings165{
          padding-bottom:calc(var(--hs-nav-clearance) + var(--hs-safe-bottom))!important;
        }
      }
      @media(min-width:761px){
        :host{--hs-nav-clearance:160px}
        .overlay:not(.hsQuickOverlay163){align-items:center!important}
        .overlay:not(.hsQuickOverlay163)>.modal{
          max-height:calc(100dvh - 48px - env(safe-area-inset-top,0px) - env(safe-area-inset-bottom,0px))!important;
        }
      }
    `;
    root.appendChild(style);
  };
}
