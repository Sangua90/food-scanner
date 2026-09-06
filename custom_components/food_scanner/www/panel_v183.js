import './panel_v182.js?v=1.6.38-base';

const HomeStockPanel = customElements.get('food-scanner-panel');

if (HomeStockPanel) {
  const prevConsScanDialog183 = HomeStockPanel.prototype.consScanDialog;

  HomeStockPanel.prototype.consScanDialog = function() {
    const s = this._consScan;
    if (!s) return '';
    if (s.status !== 'photo' && s.status !== 'fallback') return prevConsScanDialog183.call(this);

    const locs = [
      ['magazzino', 'Magazzino'],
      ['bagno', 'Bagno'],
      ['cucina', 'Cucina'],
      ['lavanderia', 'Lavanderia'],
      ['dispensa', 'Dispensa'],
      ['stalla', 'Stalla'],
    ];

    const subtitle = s.status === 'fallback'
      ? (s.message || 'Riconoscimento non riuscito. Riprova con una foto più chiara.')
      : 'Scegli dove lo riponi e scatta una foto della confezione.';

    return `<div class="overlay"><div class="modal scanModal foodScanModal hsConsFoodTwin183">
      <button class="close" id="consSimpleX" aria-label="Chiudi">×</button>
      <div class="scanHead">
        <div class="scanIcon">⌁</div>
        <div><h2>Scansiona consumabile</h2><p>${this.esc(subtitle)}</p></div>
      </div>
      <div class="scanSectionLabel">Dove lo metti?</div>
      <div class="choiceRow scanLocations hsConsLocations183">
        ${locs.map(([key,label]) => `<button type="button" data-cons-scan-loc183="${key}" class="choice ${key} ${s.location === key ? 'selected' : ''}">${this.esc(label)}</button>`).join('')}
      </div>
      <input id="consProductFile" type="file" accept="image/*,.heic,.heif" capture="environment" hidden>
      <button id="consProductPhoto" type="button" class="scanPhotoButton">
        <span class="cameraGlyph">◉</span>
        <span><b>${s.status === 'fallback' ? 'Riprova foto' : 'Scatta foto'}</b><small>Apri la fotocamera</small></span>
      </button>
      ${s.status === 'fallback' ? `<div class="scanHint"><b>Riconoscimento non riuscito</b><span>${this.esc(s.message || 'Riprova con una foto più chiara.')}</span></div>` : ''}
    </div></div>`;
  };

  const prevBind183 = HomeStockPanel.prototype.bind;
  HomeStockPanel.prototype.bind = function() {
    prevBind183.call(this);
    const root = this.shadowRoot;
    const s = this._consScan;
    if (!root || !s || (s.status !== 'photo' && s.status !== 'fallback')) return;

    root.querySelectorAll('[data-cons-scan-loc183]').forEach((btn) => {
      btn.addEventListener('click', () => {
        root.querySelectorAll('[data-cons-scan-loc183]').forEach(x => x.classList.remove('selected'));
        btn.classList.add('selected');
        s.location = btn.dataset.consScanLoc183 || 'magazzino';
      });
    });
  };

  const prevRender183 = HomeStockPanel.prototype.render;
  HomeStockPanel.prototype.render = function() {
    prevRender183.call(this);
    const root = this.shadowRoot;
    if (!root) return;

    const version = root.querySelector('.hsVersion165 b');
    if (version) version.textContent = 'v1.6.38';

    if (root.querySelector('#homeStockConsFoodTwin1638')) return;
    const style = document.createElement('style');
    style.id = 'homeStockConsFoodTwin1638';
    style.textContent = `
      /* Consumabili usa volutamente lo stesso layout e le stesse classi della scansione Alimenti. */
      .hsConsFoodTwin183{width:min(560px,100%)!important}
      .hsConsFoodTwin183 .scanLocations{grid-template-columns:repeat(3,1fr)!important}
      .hsConsFoodTwin183 .scanLocations .choice.selected{
        background:rgba(47,140,255,.13)!important;
        border-color:rgba(47,140,255,.48)!important;
        color:#bcd9ff!important;
        outline:none!important;
      }
      @media(max-width:760px){
        .hsConsFoodTwin183 .scanLocations{grid-template-columns:repeat(3,1fr)!important}
      }
    `;
    root.appendChild(style);
  };
}
