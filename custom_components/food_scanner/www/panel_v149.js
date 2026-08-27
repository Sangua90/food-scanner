import './panel_v148.js?v=1.4.9-base';

const HomeStockPanel = customElements.get('food-scanner-panel');

if (HomeStockPanel) {
  HomeStockPanel.prototype.expiryBanner = function() {
    const soon = this.expiringSoon ? this.expiringSoon() : [];
    const expired = this.expiredItems ? this.expiredItems() : [];
    const soonSelected = this._expiryView === 'soon';
    const expiredSelected = this._expiryView === 'expired';

    const soonPreview = soon.slice(0, 5).map((x) => {
      const d = this.days(x.expiry_date);
      const when = d === 0 ? 'oggi' : d === 1 ? 'domani' : `tra ${d} gg`;
      return `<span class="expiryChip"><span class="expiryChipName">${this.esc(x.product_name || 'Prodotto')}</span><span class="expiryChipWhen">${when}</span></span>`;
    }).join('');

    const expiredPreview = expired.slice(0, 5).map((x) => {
      const d = Math.abs(this.days(x.expiry_date) || 0);
      return `<span class="expiryChip expired"><span class="expiryChipName">${this.esc(x.product_name || 'Prodotto')}</span><span class="expiryChipWhen">${d === 1 ? '1 giorno fa' : `${d} gg fa`}</span></span>`;
    }).join('');

    return `<div class="expiryOverview">
      <button id="expiryBanner" class="expiryPanel soon ${soonSelected ? 'selectedBanner' : ''}">
        <div class="expiryPanelTop">
          <div class="expiryIcon">↗</div>
          <div class="expiryCopy"><strong>In scadenza</strong><span>Da consumare entro 2 giorni</span></div>
          <div class="expiryCount">${soon.length}</div>
        </div>
        <div class="expiryChips">${soonPreview || '<span class="expiryEmpty">Nessuna scadenza imminente</span>'}</div>
      </button>
      <button id="expiredBanner" class="expiryPanel expired ${expiredSelected ? 'selectedBanner' : ''}">
        <div class="expiryPanelTop">
          <div class="expiryIcon">!</div>
          <div class="expiryCopy"><strong>Scaduti</strong><span>Prodotti da controllare</span></div>
          <div class="expiryCount">${expired.length}</div>
        </div>
        <div class="expiryChips">${expiredPreview || '<span class="expiryEmpty">Nessun prodotto scaduto</span>'}</div>
      </button>
    </div>`;
  };

  const originalFoodScanDialog149 = HomeStockPanel.prototype.foodScanDialog;
  HomeStockPanel.prototype.foodScanDialog = function() {
    const s = this._foodScan;
    if (!s) return '';

    const title = s.status === 'review' ? 'Serve un dettaglio in più' : s.status === 'success' ? 'Prodotto aggiunto' : 'Scansiona alimento';
    const subtitle = s.status === 'idle' ? 'Scegli dove lo riponi e scatta una foto della confezione.' : (s.message || '');
    const locs = ['frigo', 'freezer', 'dispensa'];

    return `<div class="overlay"><div class="modal scanModal foodScanModal">
      <button class="close" id="foodX">×</button>
      <div class="scanHead">
        <div class="scanIcon">⌁</div>
        <div><h2>${this.esc(title)}</h2><p>${this.esc(subtitle)}</p></div>
      </div>
      <div class="scanSectionLabel">Dove lo metti?</div>
      <div class="choiceRow scanLocations">${locs.map((x) => `<button data-fsloc="${x}" class="choice ${x} ${s.location === x ? 'selected' : ''}">${this.loc(x)}</button>`).join('')}</div>
      <input id="foodFile" type="file" accept="image/*,.heic,.heif" capture="environment" hidden>
      ${s.status !== 'loading' && s.status !== 'success' ? `<button id="foodPhoto" class="scanPhotoButton"><span class="cameraGlyph">◉</span><span><b>${this.esc(s.photoButtonLabel || (s.status === 'review' ? 'Seconda foto' : 'Scatta foto'))}</b><small>Apri la fotocamera</small></span></button>` : ''}
      ${s.status === 'loading' ? '<div class="scanProgress"><span class="scanPulse"></span><div><b>Analisi in corso</b><small>Sto leggendo prodotto e scadenza</small></div></div>' : ''}
      ${s.status === 'review' ? `<div class="scanHint"><b>Serve un'altra foto</b><span>${this.esc(s.photoReason || s.message || '')}</span>${s.photoInstruction ? `<small>${this.esc(s.photoInstruction)}</small>` : ''}</div>` : ''}
      ${s.status === 'success' ? `<div class="scanSuccess"><span>✓</span><div><b>${this.esc(s.message || 'Prodotto aggiunto')}</b><small>Puoi continuare con il prossimo alimento.</small></div></div><div class="modalActions"><button id="foodNext" class="primary">Scansiona prossimo</button><button id="foodDone">Fine</button></div>` : ''}
    </div></div>`;
  };

  const originalRender149 = HomeStockPanel.prototype.render;
  HomeStockPanel.prototype.render = function() {
    originalRender149.call(this);
    const root = this.shadowRoot;
    if (!root || root.querySelector('#homeStockVisual149')) return;

    const style = document.createElement('style');
    style.id = 'homeStockVisual149';
    style.textContent = `
      .expiryOverview{display:grid;grid-template-columns:1.35fr .65fr;gap:12px;margin:14px 0}
      .expiryPanel{width:100%;text-align:left;border:1px solid rgba(255,255,255,.08)!important;background:radial-gradient(circle at top left,rgba(255,255,255,.055),rgba(14,16,22,.97) 55%)!important;border-radius:22px!important;padding:16px!important;color:#fff;box-shadow:0 12px 28px rgba(0,0,0,.18);overflow:hidden}
      .expiryPanel.soon{border-left:1px solid rgba(255,255,255,.08)!important}.expiryPanel.expired{border-left:1px solid rgba(255,255,255,.08)!important}
      .expiryPanelTop{display:grid;grid-template-columns:42px 1fr auto;gap:11px;align-items:center}
      .expiryIcon{width:42px;height:42px;border-radius:14px;display:grid;place-items:center;background:rgba(255,255,255,.07);font-size:20px;font-weight:800}
      .expiryPanel.soon .expiryIcon{background:rgba(245,158,11,.12);color:#fbbf24}.expiryPanel.expired .expiryIcon{background:rgba(239,68,68,.12);color:#f87171}
      .expiryCopy strong{display:block;font-size:18px;letter-spacing:-.2px}.expiryCopy span{display:block;color:#8f98aa;font-size:12px;margin-top:2px}
      .expiryCount{font-size:28px;font-weight:800;letter-spacing:-1px}
      .expiryChips{display:flex;gap:7px;overflow:auto;margin-top:14px;padding-bottom:1px;scrollbar-width:none}.expiryChips::-webkit-scrollbar{display:none}
      .expiryChip{display:inline-flex;align-items:center;gap:8px;white-space:nowrap;padding:7px 10px;border-radius:999px;background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.13);font-size:12px}
      .expiryChip.expired{background:rgba(239,68,68,.08);border-color:rgba(239,68,68,.12)}.expiryChipName{color:#e8ebf2}.expiryChipWhen{color:#fbbf24;font-weight:700}.expiryChip.expired .expiryChipWhen{color:#f87171}
      .expiryEmpty{color:#7f8797;font-size:12px;padding:7px 0}
      .selectedBanner{outline:1px solid rgba(255,255,255,.65)!important;box-shadow:0 0 0 3px rgba(255,255,255,.05)!important}

      .card small + span{display:inline-flex!important;align-items:center!important;gap:7px!important;margin-top:9px!important;padding:6px 9px!important;border-radius:999px!important;background:rgba(255,255,255,.045)!important;border:1px solid rgba(255,255,255,.07)!important;font-size:12px!important;color:#b9c0cc!important}
      .card small + span>span{width:7px!important;height:7px!important;box-shadow:none!important}

      .scanModal{width:min(560px,100%);background:radial-gradient(circle at top left,rgba(255,255,255,.055),rgba(15,17,23,.98) 50%)!important;border:1px solid rgba(255,255,255,.09)!important;box-shadow:0 24px 70px rgba(0,0,0,.55)!important;border-radius:28px!important;padding:22px!important}
      .scanHead{display:grid;grid-template-columns:54px 1fr;gap:14px;align-items:center;padding-right:42px;margin-bottom:18px}.scanHead h2{margin:0!important;padding:0!important;font-size:24px;letter-spacing:-.4px}.scanHead p{margin:4px 0 0!important;line-height:1.4;font-size:13px;color:#919aaa!important}
      .scanIcon{width:54px;height:54px;border-radius:18px;display:grid;place-items:center;background:linear-gradient(145deg,rgba(255,255,255,.13),rgba(255,255,255,.035));border:1px solid rgba(255,255,255,.08);font-size:28px}
      .scanSectionLabel{font-size:12px;color:#7f8797;text-transform:uppercase;letter-spacing:.08em;font-weight:700;margin-bottom:8px}
      .scanLocations{grid-template-columns:repeat(3,1fr)!important;margin:0 0 16px!important}.scanLocations .choice{min-height:48px;border-radius:15px!important;background:#141820!important;border:1px solid rgba(255,255,255,.07)!important;color:#cfd5df!important;font-weight:700}
      .scanLocations .choice.frigo.selected{background:rgba(34,197,94,.12)!important;border-color:rgba(34,197,94,.42)!important;color:#bbf7d0!important;outline:none!important}.scanLocations .choice.freezer.selected{background:rgba(59,130,246,.12)!important;border-color:rgba(59,130,246,.45)!important;color:#bfdbfe!important;outline:none!important}.scanLocations .choice.dispensa.selected{background:rgba(234,179,8,.12)!important;border-color:rgba(234,179,8,.4)!important;color:#fde68a!important;outline:none!important}
      .scanPhotoButton{width:100%;display:grid;grid-template-columns:56px 1fr;gap:13px;align-items:center;text-align:left;padding:15px!important;border-radius:20px!important;border:1px solid rgba(125,211,252,.22)!important;background:radial-gradient(circle at left,rgba(56,189,248,.16),rgba(18,23,31,.98) 52%)!important;color:#fff!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.04)}
      .scanPhotoButton .cameraGlyph{width:52px;height:52px;border-radius:17px;display:grid;place-items:center;background:rgba(125,211,252,.13);color:#7dd3fc;font-size:24px}.scanPhotoButton b{display:block;font-size:17px}.scanPhotoButton small{display:block;color:#8e98a8!important;margin-top:2px}
      .scanProgress,.scanSuccess{display:grid;grid-template-columns:46px 1fr;gap:12px;align-items:center;padding:15px;border-radius:18px;margin-top:10px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07)}.scanProgress b,.scanSuccess b{display:block}.scanProgress small,.scanSuccess small{display:block;margin-top:3px;color:#8f98aa!important}
      .scanPulse{width:14px;height:14px;border-radius:50%;background:#7dd3fc;box-shadow:0 0 0 0 rgba(125,211,252,.35);animation:homeStockPulse 1.4s infinite;justify-self:center}@keyframes homeStockPulse{70%{box-shadow:0 0 0 12px rgba(125,211,252,0)}100%{box-shadow:0 0 0 0 rgba(125,211,252,0)}}
      .scanSuccess span{width:42px;height:42px;border-radius:14px;display:grid;place-items:center;background:rgba(34,197,94,.12);color:#86efac;font-size:20px;font-weight:900}
      .scanHint{margin-top:12px;padding:14px 15px;border-radius:18px;background:rgba(245,158,11,.07);border:1px solid rgba(245,158,11,.15)}.scanHint b{display:block;color:#fde68a;margin-bottom:5px}.scanHint span,.scanHint small{display:block;line-height:1.45;color:#c7cdd7!important}.scanHint small{margin-top:6px;color:#929baa!important}
      .foodScanModal .modalActions{margin-top:14px}.foodScanModal .modalActions button{min-height:46px;border-radius:15px!important}

      @media(max-width:760px){.expiryOverview{grid-template-columns:1fr}.expiryPanel.expired{display:block}.scanModal{padding:18px!important;border-radius:24px!important}.scanHead{grid-template-columns:46px 1fr;gap:11px}.scanIcon{width:46px;height:46px;border-radius:15px}.scanHead h2{font-size:21px}.scanLocations{grid-template-columns:repeat(3,1fr)!important;gap:7px!important}.scanLocations .choice{padding:11px 7px!important;font-size:13px}}
    `;
    root.appendChild(style);
  };
}
