import './panel_v211.js?v=2.0.15';

const Panel = customElements.get('food-scanner-panel');

if (Panel) {
  const previousConsDialog212 = Panel.prototype.consScanDialog;

  // Build the pre-recognition popup explicitly. Older frontend overrides decorate
  // the rendered modal afterwards, so filtering the returned HTML is not enough.
  Panel.prototype.consScanDialog = function() {
    const s = this._consScan;
    if (!s) return '';

    if (s.status !== 'photo' && s.status !== 'fallback') {
      return previousConsDialog212.call(this);
    }

    const failed = s.status === 'fallback';
    return `<div class="overlay"><div class="modal scanModal foodScanModal cons1644Modal cons212PreScan">
      <button class="close" id="cons1644X">×</button>
      <div class="scanHead">
        <div class="scanIcon">⌁</div>
        <div>
          <h2>Scansiona consumabile</h2>
          <p>${failed ? this.esc(s.message || 'Riprova con una foto più chiara.') : 'Scatta una foto chiara della confezione. Posizione, quantità e negozio li scegli dopo il riconoscimento.'}</p>
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

  const previousRender212 = Panel.prototype.render;
  Panel.prototype.render = function() {
    previousRender212.call(this);
    const root = this.shadowRoot;
    if (!root) return;

    const version = root.querySelector('.hsVersion165 b');
    if (version) version.textContent = 'v2.0.15';

    if (!this._consScan) return;
    const modal = root.querySelector('#cons1644X')?.closest('.modal')
      || root.querySelector('#cons1644File')?.closest('.modal')
      || root.querySelector('.cons1644Modal');
    if (!modal) return;

    // panel_v156 injects #consStoreScan after the dialog HTML has been rendered.
    // Remove only that legacy decoration. The preview field #cons1644Store stays
    // in place and remains wired by panel_v189's isolated consumable bind.
    modal.querySelectorAll('#consStoreScan').forEach(input => {
      const field = input.closest('.hsStoreField');
      if (field) field.remove();
      else input.remove();
    });

    // Defensive invariant: before recognition there must be no editable store
    // control even if another cached override supplied the modern field early.
    if (this._consScan.status !== 'preview') {
      modal.querySelectorAll('#cons1644Store').forEach(input => {
        const field = input.closest('.cons1644Field');
        if (field) field.remove();
        else input.remove();
      });
    }
  };
}
