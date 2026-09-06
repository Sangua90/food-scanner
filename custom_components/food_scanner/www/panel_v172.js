import './panel_v171.js?v=1.6.26-base';

const HomeStockPanel = customElements.get('food-scanner-panel');

if (HomeStockPanel) {
  const previousDialog172 = HomeStockPanel.prototype.consScanDialog;

  HomeStockPanel.prototype.consScanDialog = function() {
    const s = this._consScan;
    if (!s) return '';
    if (s.status !== 'photo' && s.status !== 'fallback') {
      return previousDialog172.call(this);
    }

    return `<div class="overlay"><div class="modal consSimpleModal consPhotoModal hsConsScan172">
      <button class="close" id="consSimpleX">×</button>
      <div class="hsConsScanHead172">
        <div class="hsConsGlyph172" aria-hidden="true">📷</div>
        <div>
          <h2>Scansiona consumabile</h2>
          <p>Fai una foto chiara del prodotto. Posizione, quantità e negozio li scegli dopo il riconoscimento.</p>
        </div>
      </div>

      <input id="consProductFile" type="file" accept="image/*,.heic,.heif" capture="environment" style="display:none!important">
      <label for="consProductFile" class="hsConsPhotoButton172">
        <span class="hsConsPhotoGlyph172" aria-hidden="true">📷</span>
        <span class="hsConsPhotoText172"><b>Scatta foto prodotto</b><small>Apri la fotocamera</small></span>
      </label>
      ${s.status === 'fallback' ? `<div class="scanHint"><b>Riconoscimento non riuscito</b><span>${this.esc(s.message || 'Riprova con una foto più chiara.')}</span></div>` : ''}
    </div></div>`;
  };

  // Do not add another change listener here: the original consumables bind already
  // owns #consProductFile and calls geminiFile exactly once.

  const previousRender172 = HomeStockPanel.prototype.render;
  HomeStockPanel.prototype.render = function() {
    previousRender172.call(this);
    const root = this.shadowRoot;
    if (!root) return;
    const version = root.querySelector('.hsVersion165 b');
    if (version) version.textContent = 'v1.6.26';
    if (root.querySelector('#homeStockConsScan1626')) return;

    const style = document.createElement('style');
    style.id = 'homeStockConsScan1626';
    style.textContent = `
      .hsConsScan172{width:min(590px,calc(100vw - 28px))!important;padding:22px!important}
      .hsConsScanHead172{display:grid;grid-template-columns:58px minmax(0,1fr);gap:14px;align-items:start;padding:6px 4px 14px}
      .hsConsScanHead172 h2{margin:2px 0 7px;font-size:25px;line-height:1.15;letter-spacing:-.35px}
      .hsConsScanHead172 p{margin:0;color:#a8b2c3!important;font-size:14px;line-height:1.45}
      .hsConsGlyph172,.hsConsPhotoGlyph172{display:grid;place-items:center;background:rgba(63,164,255,.13);border:1px solid rgba(91,177,255,.24)}
      .hsConsGlyph172{width:56px;height:56px;border-radius:17px;font-size:27px}
      .hsConsPhotoButton172{box-sizing:border-box;width:100%;min-height:78px;margin-top:8px;display:grid;grid-template-columns:54px minmax(0,1fr);align-items:center;gap:13px;padding:12px 14px;border-radius:19px;border:1px solid rgba(74,166,255,.34);background:linear-gradient(145deg,rgba(30,113,186,.2),rgba(16,23,34,.98));cursor:pointer;-webkit-tap-highlight-color:transparent}
      .hsConsPhotoGlyph172{width:50px;height:50px;border-radius:15px;font-size:24px}
      .hsConsPhotoText172{display:block;min-width:0;text-align:left}
      .hsConsPhotoText172 b{display:block;color:#fff;font-size:17px;line-height:1.2}
      .hsConsPhotoText172 small{display:block;margin-top:4px;color:#8fa0b6!important;font-size:13px;line-height:1.2}
      @media(max-width:760px){
        .hsConsScan172{padding:18px!important;border-radius:23px!important}
        .hsConsScanHead172{grid-template-columns:50px minmax(0,1fr);gap:12px}
        .hsConsGlyph172{width:48px;height:48px;border-radius:15px;font-size:23px}
        .hsConsScanHead172 h2{font-size:23px}
        .hsConsScanHead172 p{font-size:13px}
        .hsConsPhotoButton172{min-height:74px;grid-template-columns:50px minmax(0,1fr);padding:11px 13px}
        .hsConsPhotoGlyph172{width:46px;height:46px}
      }
    `;
    root.appendChild(style);
  };
}
