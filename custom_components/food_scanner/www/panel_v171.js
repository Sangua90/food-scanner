import './panel_v170.js?v=1.6.25-base';

const HomeStockPanel = customElements.get('food-scanner-panel');

if (HomeStockPanel) {
  const prevConsDialog171 = HomeStockPanel.prototype.consScanDialog;

  HomeStockPanel.prototype.consScanDialog = function() {
    const s = this._consScan;
    if (!s) return '';

    if (s.status !== 'photo' && s.status !== 'fallback') {
      return prevConsDialog171.call(this);
    }

    return `<div class="overlay"><div class="modal consSimpleModal consPhotoModal hsConsScan171">
      <button class="close" id="consSimpleX">×</button>
      <div class="hsConsScanHero171">
        <div class="hsConsCamera171" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M9 5l1.2-2h3.6L15 5h3a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3h3zm3 3.2a4.3 4.3 0 1 0 0 8.6 4.3 4.3 0 0 0 0-8.6zm0 1.8a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5z"/></svg>
        </div>
        <h2>Scansiona consumabile</h2>
        <p>Fai una foto chiara del prodotto. Posizione, quantità e negozio li scegli dopo il riconoscimento.</p>
      </div>

      <input id="consProductFile" class="hsFileInput171" type="file" accept="image/*,.heic,.heif" capture="environment">
      <label for="consProductFile" class="hsConsPhotoButton171">
        <span class="hsConsPhotoIcon171" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M9 5l1.2-2h3.6L15 5h3a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3h3zm3 3.2a4.3 4.3 0 1 0 0 8.6 4.3 4.3 0 0 0 0-8.6z"/></svg>
        </span>
        <span class="hsConsPhotoText171"><b>Scatta foto prodotto</b><small>Apri la fotocamera</small></span>
      </label>
      ${s.status === 'fallback' ? `<div class="scanHint"><b>Riconoscimento non riuscito</b><span>${this.esc(s.message || 'Riprova con una foto più chiara.')}</span></div>` : ''}
    </div></div>`;
  };

  const prevBind171 = HomeStockPanel.prototype.bind;
  HomeStockPanel.prototype.bind = function() {
    prevBind171.call(this);
    const r = this.shadowRoot;
    const s = this._consScan;
    if (!r || !s || (s.status !== 'photo' && s.status !== 'fallback')) return;

    const input = r.querySelector('#consProductFile');
    if (input && !input.dataset.hsBound171) {
      input.dataset.hsBound171 = '1';
      input.addEventListener('change', async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
          await this.geminiFile(file);
        } finally {
          try { e.target.value = ''; } catch (_) {}
        }
      });
    }
  };

  const prevRender171 = HomeStockPanel.prototype.render;
  HomeStockPanel.prototype.render = function() {
    prevRender171.call(this);
    const root = this.shadowRoot;
    if (!root) return;

    const version = root.querySelector('.hsVersion165 b');
    if (version) version.textContent = 'v1.6.25';

    if (root.querySelector('#homeStockConsScan1625')) return;
    const style = document.createElement('style');
    style.id = 'homeStockConsScan1625';
    style.textContent = `
      .hsConsScan171{width:min(620px,calc(100vw - 28px))!important;padding:24px!important}
      .hsConsScanHero171{text-align:center;padding:8px 10px 14px}
      .hsConsScanHero171 h2{margin:12px 0 8px;font-size:28px;line-height:1.1;letter-spacing:-.5px}
      .hsConsScanHero171 p{max-width:470px;margin:0 auto;color:#a8b2c3!important;font-size:15px;line-height:1.5}
      .hsConsCamera171{width:72px;height:72px;margin:0 auto;border-radius:22px;display:grid;place-items:center;background:linear-gradient(145deg,rgba(46,156,255,.2),rgba(46,156,255,.07));border:1px solid rgba(91,177,255,.28)}
      .hsConsCamera171 svg,.hsConsPhotoIcon171 svg{width:30px;height:30px;fill:#7dd3fc}
      .hsFileInput171{position:absolute!important;width:1px!important;height:1px!important;opacity:0!important;pointer-events:none!important;overflow:hidden!important;clip-path:inset(50%)!important}
      .hsConsPhotoButton171{box-sizing:border-box;width:100%;min-height:82px;margin-top:10px;display:grid;grid-template-columns:56px minmax(0,1fr);align-items:center;gap:14px;padding:13px 16px;border-radius:20px;border:1px solid rgba(74,166,255,.34);background:linear-gradient(145deg,rgba(30,113,186,.2),rgba(16,23,34,.98));cursor:pointer;-webkit-tap-highlight-color:transparent}
      .hsConsPhotoIcon171{width:54px;height:54px;border-radius:16px;display:grid;place-items:center;background:rgba(67,170,255,.13)}
      .hsConsPhotoText171{display:block;min-width:0;text-align:left}
      .hsConsPhotoText171 b{display:block;color:#fff;font-size:18px;line-height:1.2}
      .hsConsPhotoText171 small{display:block;margin-top:5px;color:#8fa0b6!important;font-size:13px;line-height:1.25}
      @media(max-width:760px){
        .hsConsScan171{padding:20px!important;border-radius:24px!important}
        .hsConsScanHero171 h2{font-size:25px}
        .hsConsScanHero171 p{font-size:14px}
        .hsConsPhotoButton171{min-height:78px;grid-template-columns:52px minmax(0,1fr);padding:12px 14px}
        .hsConsPhotoIcon171{width:50px;height:50px}
        .hsConsPhotoText171 b{font-size:17px}
      }
    `;
    root.appendChild(style);
  };
}
