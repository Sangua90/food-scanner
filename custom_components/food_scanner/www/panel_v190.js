import './panel_v189.js?v=1.6.45-base';

const HomeStockPanel = customElements.get('food-scanner-panel');

if (HomeStockPanel) {
  const prevConsScanDialog1645 = HomeStockPanel.prototype.consScanDialog;

  HomeStockPanel.prototype.consScanDialog = function() {
    const s = this._consScan;
    if (!s) return '';

    if (s.status !== 'photo' && s.status !== 'fallback') {
      return prevConsScanDialog1645.call(this);
    }

    const failed = s.status === 'fallback';
    return `<div class="overlay"><div class="modal scanModal foodScanModal cons1644Modal">
      <button class="close" id="cons1644X">×</button>
      <div class="scanHead">
        <div class="scanIcon">⌁</div>
        <div>
          <h2>Scansiona consumabile</h2>
          <p>${failed ? this.esc(s.message || 'Riprova con una foto più chiara.') : 'Scatta una foto chiara della confezione. Posizione e negozio li scegli dopo il riconoscimento.'}</p>
        </div>
      </div>
      <input id="cons1644File" type="file" accept="image/*,.heic,.heif" capture="environment" hidden>
      <button id="cons1644Photo" class="scanPhotoButton">
        <span class="cameraGlyph">◉</span>
        <span><b>${failed ? 'Riprova foto' : 'Scatta foto'}</b><small>Apri la fotocamera</small></span>
      </button>
      ${failed ? `<div class="scanHint"><b>Riconoscimento non riuscito</b><span>${this.esc(s.message || 'Riprova con una foto più chiara.')}</span></div>` : ''}
    </div></div>`;
  };

  const prevRender1645 = HomeStockPanel.prototype.render;
  HomeStockPanel.prototype.render = function() {
    prevRender1645.call(this);
    const root = this.shadowRoot;
    if (!root) return;
    const version = root.querySelector('.hsVersion165 b');
    if (version) version.textContent = 'v1.6.45';
  };
}
