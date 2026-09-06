import './panel_v171.js?v=1.6.27-base';

const HomeStockPanel = customElements.get('food-scanner-panel');

if (HomeStockPanel) {
  const previousDialog172 = HomeStockPanel.prototype.consScanDialog;

  const cameraSvg172 = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l1.2-2h3.6L15 5h3a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3h3zm3 3.3a4.2 4.2 0 1 0 0 8.4 4.2 4.2 0 0 0 0-8.4zm0 1.8a2.4 2.4 0 1 1 0 4.8 2.4 2.4 0 0 1 0-4.8z"/></svg>`;

  HomeStockPanel.prototype.consScanDialog = function() {
    const s = this._consScan;
    if (!s) return '';
    if (s.status !== 'photo' && s.status !== 'fallback') {
      return previousDialog172.call(this);
    }

    return `<div class="overlay"><div class="modal consSimpleModal consPhotoModal hsConsScan172">
      <button class="close" id="consSimpleX">×</button>
      <div class="hsConsScanHead172">
        <span class="hsConsGlyph172">${cameraSvg172}</span>
        <div class="hsConsHeadText172">
          <h2>Scansiona consumabile</h2>
          <p>Fai una foto chiara del prodotto. Posizione, quantità e negozio li scegli dopo il riconoscimento.</p>
        </div>
      </div>

      <input id="consProductFile" type="file" accept="image/*,.heic,.heif" capture="environment" hidden>
      <label for="consProductFile" class="hsConsPhotoButton172">
        <span class="hsConsPhotoGlyph172">${cameraSvg172}</span>
        <span class="hsConsPhotoText172">
          <b>Scatta foto prodotto</b>
          <small>Apri la fotocamera</small>
        </span>
      </label>
      ${s.status === 'fallback' ? `<div class="scanHint"><b>Riconoscimento non riuscito</b><span>${this.esc(s.message || 'Riprova con una foto più chiara.')}</span></div>` : ''}
    </div></div>`;
  };

  const previousRender172 = HomeStockPanel.prototype.render;
  HomeStockPanel.prototype.render = function() {
    previousRender172.call(this);
    const root = this.shadowRoot;
    if (!root) return;
    const version = root.querySelector('.hsVersion165 b');
    if (version) version.textContent = 'v1.6.27';

    if (!root.querySelector('#homeStockConsScan1627')) {
      const style = document.createElement('style');
      style.id = 'homeStockConsScan1627';
      style.textContent = `
        #consProductFile{display:none!important;position:absolute!important;width:0!important;height:0!important;opacity:0!important;pointer-events:none!important}
        .hsConsScan172{width:min(590px,calc(100vw - 28px))!important;padding:22px!important}
        .hsConsScanHead172{display:grid!important;grid-template-columns:58px minmax(0,1fr)!important;gap:14px!important;align-items:center!important;padding:4px 4px 16px!important}
        .hsConsHeadText172{display:block!important;min-width:0!important}
        .hsConsScanHead172 h2{display:block!important;margin:0 0 8px!important;font-size:25px!important;line-height:1.15!important;letter-spacing:-.35px!important}
        .hsConsScanHead172 p{display:block!important;margin:0!important;color:#a8b2c3!important;font-size:14px!important;line-height:1.45!important}
        .hsConsGlyph172,.hsConsPhotoGlyph172{display:grid!important;place-items:center!important;background:rgba(63,164,255,.13)!important;border:1px solid rgba(91,177,255,.24)!important;color:#7dd3fc!important}
        .hsConsGlyph172{width:56px!important;height:56px!important;border-radius:17px!important}
        .hsConsGlyph172 svg{width:29px!important;height:29px!important;fill:currentColor!important}
        .hsConsPhotoButton172{box-sizing:border-box!important;width:100%!important;min-height:82px!important;margin-top:8px!important;display:grid!important;grid-template-columns:54px minmax(0,1fr)!important;align-items:center!important;gap:14px!important;padding:13px 15px!important;border-radius:19px!important;border:1px solid rgba(74,166,255,.34)!important;background:linear-gradient(145deg,rgba(30,113,186,.20),rgba(16,23,34,.98))!important;cursor:pointer!important;-webkit-tap-highlight-color:transparent!important;text-decoration:none!important}
        .hsConsPhotoGlyph172{width:50px!important;height:50px!important;border-radius:15px!important}
        .hsConsPhotoGlyph172 svg{width:26px!important;height:26px!important;fill:currentColor!important}
        .hsConsPhotoText172{display:flex!important;flex-direction:column!important;align-items:flex-start!important;justify-content:center!important;min-width:0!important;text-align:left!important;line-height:1.2!important}
        .hsConsPhotoText172 b{display:block!important;width:100%!important;color:#fff!important;font-size:17px!important;line-height:1.2!important;white-space:normal!important}
        .hsConsPhotoText172 small{display:block!important;width:100%!important;margin-top:5px!important;color:#8fa0b6!important;font-size:13px!important;line-height:1.2!important;white-space:normal!important}
        @media(max-width:760px){
          .hsConsScan172{padding:18px!important;border-radius:23px!important}
          .hsConsScanHead172{grid-template-columns:50px minmax(0,1fr)!important;gap:12px!important}
          .hsConsGlyph172{width:48px!important;height:48px!important;border-radius:15px!important}
          .hsConsGlyph172 svg{width:25px!important;height:25px!important}
          .hsConsScanHead172 h2{font-size:23px!important}
          .hsConsScanHead172 p{font-size:13px!important}
          .hsConsPhotoButton172{min-height:76px!important;grid-template-columns:50px minmax(0,1fr)!important;padding:11px 13px!important}
          .hsConsPhotoGlyph172{width:46px!important;height:46px!important}
          .hsConsPhotoText172 b{font-size:16px!important}
          .hsConsPhotoText172 small{font-size:12px!important}
        }
      `;
      root.appendChild(style);
    }
  };
}
