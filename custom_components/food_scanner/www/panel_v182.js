import './panel_v181.js?v=1.6.37-base';

const HomeStockPanel = customElements.get('food-scanner-panel');

if (HomeStockPanel) {
  const prevConsScanDialog182 = HomeStockPanel.prototype.consScanDialog;

  HomeStockPanel.prototype.consScanDialog = function() {
    const s = this._consScan;
    if (!s) return '';
    if (s.status !== 'photo' && s.status !== 'fallback') return prevConsScanDialog182.call(this);

    return `<div class="overlay hsConsScanOverlay182">
      <div class="modal hsConsScanModal182">
        <button type="button" class="hsConsScanClose182" id="hsConsClose182" aria-label="Chiudi">×</button>

        <div class="hsConsScanHead182">
          <span class="hsConsScanGlyph182">⌁</span>
          <div>
            <h2>Scansiona consumabile</h2>
            <p>Scatta una foto chiara del prodotto. Posizione, quantità e negozio li scegli dopo il riconoscimento.</p>
          </div>
        </div>

        <input id="hsConsFile182" type="file" accept="image/*,.heic,.heif" capture="environment" hidden>
        <button id="hsConsCapture182" type="button" class="hsConsCapture182">
          <span class="hsConsCamera182">◎</span>
          <span class="hsConsCaptureCopy182">
            <b>Scatta foto prodotto</b>
            <small>Apri la fotocamera</small>
          </span>
          <span class="hsConsCaptureArrow182">›</span>
        </button>

        ${s.status === 'fallback' ? `<div class="hsConsFallback182"><b>Riconoscimento non riuscito</b><span>${this.esc(s.message || 'Riprova con una foto più chiara.')}</span></div>` : ''}
      </div>
    </div>`;
  };

  const prevBind182 = HomeStockPanel.prototype.bind;
  HomeStockPanel.prototype.bind = function() {
    prevBind182.call(this);
    const root = this.shadowRoot;
    if (!root || !this._consScan) return;

    const close = root.querySelector('#hsConsClose182');
    if (close) close.onclick = () => {
      this._consScan = null;
      this.render();
    };

    const capture = root.querySelector('#hsConsCapture182');
    const input = root.querySelector('#hsConsFile182');
    if (capture && input) {
      capture.onclick = () => input.click();
      input.onchange = async (event) => {
        const file = event.target?.files?.[0];
        if (!file) return;
        capture.disabled = true;
        capture.classList.add('loading');
        const label = capture.querySelector('.hsConsCaptureCopy182 b');
        if (label) label.textContent = 'Analisi in corso…';
        try {
          await Promise.resolve(this.geminiFile(file));
        } catch (err) {
          if (this._consScan) {
            this._consScan.status = 'fallback';
            this._consScan.message = err?.message || String(err) || 'Riconoscimento non riuscito.';
            this.render();
          }
        }
      };
    }
  };

  const prevRender182 = HomeStockPanel.prototype.render;
  HomeStockPanel.prototype.render = function() {
    prevRender182.call(this);
    const root = this.shadowRoot;
    if (!root) return;

    const version = root.querySelector('.hsVersion165 b');
    if (version) version.textContent = 'v1.6.37';

    if (root.querySelector('#homeStockConsScan1637')) return;
    const style = document.createElement('style');
    style.id = 'homeStockConsScan1637';
    style.textContent = `
      .hsConsScanOverlay182{align-items:center!important;justify-content:center!important;padding:18px!important;background:rgba(0,0,0,.72)!important;backdrop-filter:blur(8px)!important;-webkit-backdrop-filter:blur(8px)!important}
      .hsConsScanModal182{position:relative!important;box-sizing:border-box!important;width:min(520px,100%)!important;max-height:none!important;overflow:visible!important;padding:22px!important;border-radius:28px!important;background:linear-gradient(145deg,#151b25,#0c1118)!important;border:1px solid rgba(148,176,210,.24)!important;box-shadow:0 24px 80px rgba(0,0,0,.48)!important}
      .hsConsScanClose182{position:absolute!important;top:16px!important;right:16px!important;width:44px!important;height:44px!important;min-height:44px!important;padding:0!important;border-radius:50%!important;border:1px solid rgba(159,190,226,.24)!important;background:#1b2230!important;color:#fff!important;font-size:31px!important;line-height:1!important;z-index:2!important}
      .hsConsScanHead182{display:grid!important;grid-template-columns:54px minmax(0,1fr)!important;gap:14px!important;align-items:start!important;padding-right:52px!important;margin-bottom:18px!important}
      .hsConsScanGlyph182{width:54px!important;height:54px!important;display:grid!important;place-items:center!important;border-radius:18px!important;background:linear-gradient(145deg,rgba(29,145,255,.24),rgba(29,145,255,.08))!important;border:1px solid rgba(70,163,255,.24)!important;color:#8bc7ff!important;font-size:25px!important}
      .hsConsScanHead182 h2{margin:1px 0 7px!important;font-size:25px!important;line-height:1.08!important;letter-spacing:-.45px!important;color:#fff!important}
      .hsConsScanHead182 p{margin:0!important;color:#98a7ba!important;font-size:14px!important;line-height:1.42!important}
      .hsConsCapture182{box-sizing:border-box!important;width:100%!important;min-height:86px!important;display:grid!important;grid-template-columns:58px minmax(0,1fr) 24px!important;gap:13px!important;align-items:center!important;text-align:left!important;padding:14px 16px!important;border-radius:21px!important;border:1px solid rgba(48,156,255,.38)!important;background:linear-gradient(145deg,rgba(25,111,196,.24),rgba(13,23,34,.98))!important;color:#fff!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.03)!important}
      .hsConsCapture182:active{transform:scale(.992)!important}.hsConsCapture182.loading{opacity:.72!important;pointer-events:none!important}
      .hsConsCamera182{width:54px!important;height:54px!important;display:grid!important;place-items:center!important;border-radius:17px!important;background:rgba(38,154,255,.16)!important;color:#8ed0ff!important;font-size:28px!important}
      .hsConsCaptureCopy182{display:block!important;min-width:0!important}.hsConsCaptureCopy182 b{display:block!important;font-size:18px!important;line-height:1.15!important}.hsConsCaptureCopy182 small{display:block!important;margin-top:5px!important;color:#90a2b8!important;font-size:13px!important;line-height:1.2!important}
      .hsConsCaptureArrow182{font-size:28px!important;color:#82bfff!important;text-align:right!important}
      .hsConsFallback182{margin-top:12px!important;padding:11px 12px!important;border-radius:15px!important;border:1px solid rgba(248,113,113,.18)!important;background:rgba(239,68,68,.07)!important}.hsConsFallback182 b{display:block!important;color:#fecaca!important;font-size:13px!important}.hsConsFallback182 span{display:block!important;margin-top:4px!important;color:#aab5c3!important;font-size:11px!important;line-height:1.35!important}
      @media(max-width:760px){
        .hsConsScanOverlay182{padding:max(14px,env(safe-area-inset-top,0px)) 14px max(18px,env(safe-area-inset-bottom,0px))!important}
        .hsConsScanModal182{width:100%!important;padding:20px 18px 18px!important;border-radius:25px!important}
        .hsConsScanClose182{top:14px!important;right:14px!important;width:42px!important;height:42px!important;min-height:42px!important;font-size:29px!important}
        .hsConsScanHead182{grid-template-columns:48px minmax(0,1fr)!important;gap:12px!important;padding-right:48px!important;margin-bottom:16px!important}
        .hsConsScanGlyph182{width:48px!important;height:48px!important;border-radius:16px!important;font-size:22px!important}
        .hsConsScanHead182 h2{font-size:22px!important}.hsConsScanHead182 p{font-size:13px!important}
        .hsConsCapture182{min-height:80px!important;grid-template-columns:52px minmax(0,1fr) 20px!important;gap:11px!important;padding:13px 14px!important;border-radius:19px!important}
        .hsConsCamera182{width:50px!important;height:50px!important;border-radius:16px!important;font-size:25px!important}.hsConsCaptureCopy182 b{font-size:17px!important}.hsConsCaptureCopy182 small{font-size:12px!important}
      }
    `;
    root.appendChild(style);
  };
}
