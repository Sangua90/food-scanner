import './panel_v173.js?v=1.6.29-base';

const HomeStockPanel = customElements.get('food-scanner-panel');

if (HomeStockPanel) {
  const prevDialog174 = HomeStockPanel.prototype.consScanDialog;

  HomeStockPanel.prototype.consScanDialog = function() {
    const s = this._consScan;
    if (!s) return '';
    if (s.status !== 'photo' && s.status !== 'fallback') return prevDialog174.call(this);

    return `<div class="overlay"><div class="modal foodScanModal hsConsLikeFood174">
      <button class="close" id="consSimpleX">×</button>
      <div class="scanHead">
        <div class="scanIcon hsConsScanIcon174">⌁</div>
        <div>
          <h2>Scansiona consumabile</h2>
          <p>Fai una foto chiara del prodotto. Posizione, quantità e negozio li scegli dopo il riconoscimento.</p>
        </div>
      </div>

      <input id="consProductFile" type="file" accept="image/*,.heic,.heif" capture="environment" style="display:none!important">
      <label for="consProductFile" class="hsConsPhoto174">
        <span class="hsConsPhotoIcon174" aria-hidden="true"></span>
        <span class="hsConsPhotoCopy174">
          <b>Scatta foto prodotto</b>
          <small>Apri la fotocamera</small>
        </span>
      </label>
      ${s.status === 'fallback' ? `<div class="scanHint"><b>Riconoscimento non riuscito</b><span>${this.esc(s.message || 'Riprova con una foto più chiara.')}</span></div>` : ''}
    </div></div>`;
  };

  const prevBind174 = HomeStockPanel.prototype.bind;
  HomeStockPanel.prototype.bind = function() {
    prevBind174.call(this);
    const root = this.shadowRoot;
    if (!root) return;
    const close = root.querySelector('#consSimpleX');
    if (close) close.onclick = () => { this._consScan = null; this.render(); };
  };

  const prevRender174 = HomeStockPanel.prototype.render;
  HomeStockPanel.prototype.render = function() {
    prevRender174.call(this);
    const root = this.shadowRoot;
    if (!root) return;
    const version = root.querySelector('.hsVersion165 b');
    if (version) version.textContent = 'v1.6.29';
    if (root.querySelector('#homeStockConsLikeFood1629')) return;

    const style = document.createElement('style');
    style.id = 'homeStockConsLikeFood1629';
    style.textContent = `
      .hsConsLikeFood174{width:min(620px,calc(100vw - 28px))!important;padding:26px 24px 24px!important;border-radius:30px!important}
      .hsConsLikeFood174 .scanHead{display:grid!important;grid-template-columns:72px minmax(0,1fr)!important;gap:18px!important;align-items:start!important;padding-right:58px!important;margin-bottom:20px!important}
      .hsConsLikeFood174 .scanHead h2{margin:0 0 8px!important;font-size:28px!important;line-height:1.08!important;letter-spacing:-.5px!important}
      .hsConsLikeFood174 .scanHead p{margin:0!important;color:#9ca8ba!important;font-size:16px!important;line-height:1.45!important}
      .hsConsScanIcon174{width:64px!important;height:64px!important;border-radius:20px!important;display:grid!important;place-items:center!important;background:linear-gradient(145deg,rgba(255,255,255,.08),rgba(255,255,255,.035))!important;border:1px solid rgba(255,255,255,.11)!important;color:#d8e2ef!important;font-size:31px!important}
      .hsConsPhoto174{box-sizing:border-box;width:100%;min-height:132px;display:grid;grid-template-columns:88px minmax(0,1fr);align-items:center;gap:24px;padding:20px 24px;border-radius:27px;border:1px solid rgba(82,201,255,.42);background:linear-gradient(145deg,rgba(25,79,104,.48),rgba(14,22,31,.98));box-shadow:inset 0 1px 0 rgba(255,255,255,.03);cursor:pointer;-webkit-tap-highlight-color:transparent}
      .hsConsPhotoIcon174{width:76px;height:76px;border-radius:23px;display:grid;place-items:center;background:rgba(64,185,235,.2);position:relative}
      .hsConsPhotoIcon174:before{content:'';width:40px;height:40px;border-radius:50%;border:4px solid #7ddcff;box-shadow:0 0 0 8px rgba(125,220,255,.12)}
      .hsConsPhotoCopy174{display:block;text-align:left;min-width:0}
      .hsConsPhotoCopy174 b{display:block;color:#fff;font-size:25px;line-height:1.12;font-weight:850}
      .hsConsPhotoCopy174 small{display:block;margin-top:7px;color:#8fa2b7!important;font-size:17px;line-height:1.2}
      @media(max-width:760px){
        .hsConsLikeFood174{padding:22px 20px 20px!important;border-radius:26px!important}
        .hsConsLikeFood174 .scanHead{grid-template-columns:58px minmax(0,1fr)!important;gap:14px!important;padding-right:48px!important;margin-bottom:17px!important}
        .hsConsLikeFood174 .scanHead h2{font-size:24px!important}
        .hsConsLikeFood174 .scanHead p{font-size:14px!important}
        .hsConsScanIcon174{width:54px!important;height:54px!important;border-radius:17px!important;font-size:25px!important}
        .hsConsPhoto174{min-height:108px;grid-template-columns:66px minmax(0,1fr);gap:16px;padding:16px 18px;border-radius:23px}
        .hsConsPhotoIcon174{width:62px;height:62px;border-radius:19px}
        .hsConsPhotoIcon174:before{width:32px;height:32px;border-width:3px;box-shadow:0 0 0 6px rgba(125,220,255,.12)}
        .hsConsPhotoCopy174 b{font-size:20px}
        .hsConsPhotoCopy174 small{font-size:14px;margin-top:5px}
      }
    `;
    root.appendChild(style);
  };
}
