import './panel_v184.js?v=1.6.40-base';

const HomeStockPanel = customElements.get('food-scanner-panel');

if (HomeStockPanel) {
  const previousDialog185 = HomeStockPanel.prototype.consScanDialog;

  HomeStockPanel.prototype.consScanDialog = function() {
    const s = this._consScan;
    if (!s) return '';
    if (s.status !== 'photo' && s.status !== 'fallback') return previousDialog185.call(this);

    const locs = [
      ['magazzino','Magazzino'],
      ['bagno','Bagno'],
      ['cucina','Cucina'],
      ['lavanderia','Lavanderia'],
      ['dispensa','Dispensa'],
      ['stalla','Stalla'],
    ];

    const subtitle = s.status === 'fallback'
      ? (s.message || 'Riconoscimento non riuscito. Riprova con una foto più chiara.')
      : 'Scegli dove lo riponi e scatta una foto della confezione.';

    return `<div class="overlay hsConsTouchOverlay185">
      <div class="modal scanModal foodScanModal hsConsTouchModal185">
        <button type="button" class="close hsConsClose185" id="hsConsClose185" aria-label="Chiudi">×</button>
        <div class="scanHead">
          <div class="scanIcon">⌁</div>
          <div><h2>Scansiona consumabile</h2><p>${this.esc(subtitle)}</p></div>
        </div>
        <div class="scanSectionLabel">Dove lo metti?</div>
        <div class="choiceRow scanLocations hsConsLocations185">
          ${locs.map(([key,label]) => `<button type="button" data-hs-cons-loc185="${key}" class="choice ${key} ${s.location===key?'selected':''}">${this.esc(label)}</button>`).join('')}
        </div>
        <input id="hsConsNativeFile185" type="file" accept="image/*,.heic,.heif" capture="environment" style="position:absolute;width:1px;height:1px;opacity:0;pointer-events:none;overflow:hidden">
        <label for="hsConsNativeFile185" class="scanPhotoButton hsConsNativeLabel185" role="button" tabindex="0">
          <span class="cameraGlyph">◉</span>
          <span><b>${s.status==='fallback'?'Riprova foto':'Scatta foto'}</b><small>Apri la fotocamera</small></span>
        </label>
        ${s.status === 'fallback' ? `<div class="scanHint"><b>Riconoscimento non riuscito</b><span>${this.esc(s.message || 'Riprova con una foto più chiara.')}</span></div>` : ''}
      </div>
    </div>`;
  };

  const previousBind185 = HomeStockPanel.prototype.bind;
  HomeStockPanel.prototype.bind = function() {
    previousBind185.call(this);
    const root = this.shadowRoot;
    const s = this._consScan;
    if (!root || !s || (s.status !== 'photo' && s.status !== 'fallback')) return;

    const close = root.querySelector('#hsConsClose185');
    if (close) close.onclick = (event) => {
      event.preventDefault();
      event.stopPropagation();
      this._consScan = null;
      this.render();
    };

    root.querySelectorAll('[data-hs-cons-loc185]').forEach((button) => {
      button.onclick = (event) => {
        event.preventDefault();
        event.stopPropagation();
        root.querySelectorAll('[data-hs-cons-loc185]').forEach(x => x.classList.remove('selected'));
        button.classList.add('selected');
        s.location = button.dataset.hsConsLoc185 || 'magazzino';
      };
    });

    const input = root.querySelector('#hsConsNativeFile185');
    if (input) input.onchange = (event) => {
      const file = event.target?.files?.[0];
      if (!file) return;
      try {
        this.geminiFile(file);
      } catch (err) {
        if (this._consScan) {
          this._consScan.status = 'fallback';
          this._consScan.message = err?.message || String(err) || 'Riconoscimento non riuscito.';
          this.render();
        }
      }
    };
  };

  const previousRender185 = HomeStockPanel.prototype.render;
  HomeStockPanel.prototype.render = function() {
    previousRender185.call(this);
    const root = this.shadowRoot;
    if (!root) return;

    const version = root.querySelector('.hsVersion165 b');
    if (version) version.textContent = 'v1.6.40';

    if (root.querySelector('#homeStockConsTouch1640')) return;
    const style = document.createElement('style');
    style.id = 'homeStockConsTouch1640';
    style.textContent = `
      .hsConsTouchOverlay185{
        position:fixed!important;inset:0!important;z-index:2147483000!important;
        display:flex!important;align-items:center!important;justify-content:center!important;
        pointer-events:auto!important;touch-action:manipulation!important;
        background:rgba(0,0,0,.72)!important;
      }
      .hsConsTouchModal185{
        position:relative!important;z-index:2147483001!important;
        pointer-events:auto!important;touch-action:manipulation!important;
        width:min(560px,calc(100vw - 28px))!important;
      }
      .hsConsTouchModal185 button,.hsConsTouchModal185 label,.hsConsTouchModal185 input{
        pointer-events:auto!important;touch-action:manipulation!important;
      }
      .hsConsNativeLabel185{box-sizing:border-box!important;cursor:pointer!important;-webkit-tap-highlight-color:transparent!important}
      .hsConsLocations185{grid-template-columns:repeat(3,1fr)!important}
      .hsConsLocations185 .choice.selected{background:rgba(47,140,255,.13)!important;border-color:rgba(47,140,255,.48)!important;color:#bcd9ff!important;outline:none!important}
      @media(max-width:760px){
        .hsConsTouchOverlay185{padding:max(14px,env(safe-area-inset-top,0px)) 14px max(18px,env(safe-area-inset-bottom,0px))!important}
        .hsConsTouchModal185{width:100%!important}
        .hsConsLocations185{grid-template-columns:repeat(3,1fr)!important}
      }
    `;
    root.appendChild(style);
  };
}
