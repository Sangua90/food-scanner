import './panel_v202.js?v=2.0.3-base';

const Panel = customElements.get('food-scanner-panel');
if (Panel) {
  const esc203 = (ctx, v) => ctx.esc ? ctx.esc(v) : String(v ?? '');

  // Keep the existing scanner/AI path, but replace the immediate success screen
  // with a short confirmation step. The archive id returned by Home Assistant is
  // retained so corrections can be applied to the exact scanned item.
  Panel.prototype.foodFile = async function(f) {
    const s = this._foodScan;
    if (!s?.location) return;
    s.status = 'loading';
    s.message = 'Analisi in corso…';
    this.render();
    try {
      const d = await this.fileData(f);
      const o = await this._hass.callApi('POST', 'food_scanner/dashboard_scan', {
        location: s.location,
        mime_type: d.mime,
        image_data: d.raw,
        review_id: s.reviewId || null,
      });
      if (o.status === 'archived') {
        s.status = 'confirm203';
        s.reviewId = null;
        s.detected203 = { ...o };
        s.edit203 = false;
        s.message = 'Controlla i dati prima di continuare.';
      } else {
        s.status = 'review';
        s.reviewId = o.review_id;
        s.message = o.photo_request || 'Serve un’altra foto dello stesso prodotto.';
        s.photoReason = o.photo_reason || '';
        s.photoInstruction = o.photo_instruction || '';
        s.photoButtonLabel = o.photo_button_label || '';
      }
      await this.load();
      this.render();
    } catch (e) {
      s.status = 'error';
      s.message = e?.message || String(e);
      this.render();
    }
  };

  Panel.prototype.foodConfirmDialog203 = function() {
    const s = this._foodScan;
    const d = s?.detected203;
    if (!s || s.status !== 'confirm203' || !d) return '';
    const editing = !!s.edit203;
    const name = d.product_name || 'Prodotto';
    const brand = d.brand || '—';
    const added = Number(d.added_units || d.units_per_package || 1);
    const unit = this.unit ? this.unit(d.unit_name) : (d.unit_name || 'Pezzi');
    const image = String(d.product_image_url || '').trim();
    const expiry = String(d.expiry_date || '');
    const locations = ['frigo','freezer','dispensa'];

    return `<div class="overlay hsConfirmOverlay203"><div class="modal hsConfirm203">
      <button type="button" class="close" id="foodConfirmClose203">×</button>
      <div class="hsConfirmHead203"><span class="eyebrow">HOMESTOCK</span><h2>Conferma prodotto</h2><p>Controlla i dati prima di continuare</p></div>
      ${image ? `<div class="hsConfirmImage203"><img src="${esc203(this,image)}" alt=""></div>` : ''}
      <div class="hsConfirmRows203">
        <label class="hsConfirmRow203"><span>Prodotto</span>${editing ? `<input id="foodConfirmName203" value="${esc203(this,name)}">` : `<b>${esc203(this,name)}</b>`}</label>
        <label class="hsConfirmRow203"><span>Marca</span>${editing ? `<input id="foodConfirmBrand203" value="${esc203(this,d.brand || '')}" placeholder="Marca">` : `<b class="muted203">${esc203(this,brand)}</b>`}</label>
        <div class="hsConfirmRow203"><span>Quantità</span><b>${added} ${esc203(this,unit)}</b></div>
        <div class="hsConfirmRow203 hsConfirmLocation203"><span>Posizione</span>${editing ? `<div class="hsConfirmLocs203">${locations.map(x=>`<button type="button" data-confirm-loc203="${x}" class="${s.location===x?'active':''}">${esc203(this,this.loc(x))}</button>`).join('')}</div>` : `<b>${esc203(this,this.loc(s.location))}</b>`}</div>
        <label class="hsConfirmRow203 expiry203"><span>Scadenza</span>${editing ? `<input id="foodConfirmExpiry203" type="date" value="${esc203(this,expiry)}">` : `<b>${expiry ? esc203(this,this.fmtDate(expiry)) : 'Nessuna scadenza'}</b>`}</label>
      </div>
      <div class="hsConfirmActions203">
        <button type="button" id="foodConfirmEdit203">${editing ? 'Annulla correzioni' : 'Correggi'}</button>
        <button type="button" id="foodConfirmSave203" class="primary">Salva</button>
      </div>
    </div></div>`;
  };

  const previousFoodScanDialog203 = Panel.prototype.foodScanDialog;
  Panel.prototype.foodScanDialog = function() {
    if (this._foodScan?.status === 'confirm203') return this.foodConfirmDialog203();
    return previousFoodScanDialog203 ? previousFoodScanDialog203.call(this) : '';
  };

  Panel.prototype.saveFoodConfirm203 = async function() {
    const s = this._foodScan;
    const d = s?.detected203;
    if (!s || !d) return;
    try {
      if (s.edit203 && d.archive_id) {
        const root = this.shadowRoot;
        const changes = {
          product_name: String(root.querySelector('#foodConfirmName203')?.value || d.product_name || '').trim(),
          brand: String(root.querySelector('#foodConfirmBrand203')?.value || '').trim(),
          location: s.location,
          expiry_date: root.querySelector('#foodConfirmExpiry203')?.value || null,
        };
        if (!changes.product_name) return alert('Inserisci il nome del prodotto.');
        await this._hass.callApi('POST','food_scanner/archive',{
          action:'update_item', id:d.archive_id, changes,
        });
        d.product_name = changes.product_name;
        d.brand = changes.brand;
        d.location = changes.location;
        d.expiry_date = changes.expiry_date;
      }
      await this.load();
      s.status = 'success';
      s.edit203 = false;
      s.message = '✓ ' + (d.product_name || 'Prodotto') + ' salvato.';
      this.render();
    } catch (e) {
      alert(e?.message || String(e));
    }
  };

  const previousBind203 = Panel.prototype.bind;
  Panel.prototype.bind = function() {
    previousBind203.call(this);
    const root = this.shadowRoot;
    const s = this._foodScan;
    if (!root || s?.status !== 'confirm203') return;

    root.querySelector('#foodConfirmClose203')?.addEventListener('click', () => {
      this._foodScan = null;
      this.render();
    });
    root.querySelector('#foodConfirmEdit203')?.addEventListener('click', () => {
      s.edit203 = !s.edit203;
      this.render();
    });
    root.querySelectorAll('[data-confirm-loc203]').forEach(btn => btn.addEventListener('click', () => {
      s.location = btn.dataset.confirmLoc203;
      root.querySelectorAll('[data-confirm-loc203]').forEach(x => x.classList.toggle('active', x === btn));
    }));
    root.querySelector('#foodConfirmSave203')?.addEventListener('click', () => this.saveFoodConfirm203());
  };

  const previousRender203 = Panel.prototype.render;
  Panel.prototype.render = function() {
    previousRender203.call(this);
    const root = this.shadowRoot;
    if (!root) return;
    const version = root.querySelector('.hsVersion165 b');
    if (version) version.textContent = 'v2.0.3';
    if (root.querySelector('#hsFoodConfirm203Style')) return;
    const style = document.createElement('style');
    style.id = 'hsFoodConfirm203Style';
    style.textContent = `
      .hsConfirm203{width:min(510px,100%);max-height:calc(100dvh - 28px);overflow:auto;padding:20px!important;border-radius:27px!important;background:radial-gradient(circle at 50% -10%,rgba(26,124,225,.12),rgba(9,16,24,.99) 42%)!important;border:1px solid rgba(85,164,242,.26)!important;box-shadow:0 24px 70px rgba(0,0,0,.58)!important}
      .hsConfirmHead203{text-align:center;padding:5px 38px 13px}.hsConfirmHead203 h2{margin:3px 0 2px!important;font-size:25px!important;letter-spacing:-.5px}.hsConfirmHead203 p{margin:0!important;color:#8394aa!important;font-size:11px!important}.hsConfirmHead203 .eyebrow{font-size:8px!important;color:#3da5ff!important;letter-spacing:.16em!important}
      .hsConfirmImage203{height:126px;margin:3px 0 12px;border-radius:20px;display:grid;place-items:center;overflow:hidden;background:radial-gradient(circle,rgba(37,124,211,.15),rgba(9,17,26,.75));border:1px solid rgba(82,156,229,.16)}.hsConfirmImage203 img{width:100%;height:100%;object-fit:contain;padding:8px;box-sizing:border-box;filter:drop-shadow(0 9px 14px rgba(0,0,0,.28))}
      .hsConfirmRows203{border-radius:19px;overflow:hidden;background:rgba(13,23,34,.82);border:1px solid rgba(122,169,218,.12)}.hsConfirmRow203{min-height:52px;display:grid;grid-template-columns:98px minmax(0,1fr);align-items:center;gap:10px;padding:0 13px;border-bottom:1px solid rgba(255,255,255,.055);box-sizing:border-box}.hsConfirmRow203:last-child{border-bottom:0}.hsConfirmRow203>span{font-size:10px;color:#8fa0b4;font-weight:650}.hsConfirmRow203>b{font-size:13px;color:#f2f7fd;min-width:0;overflow:hidden;text-overflow:ellipsis}.hsConfirmRow203 .muted203{color:#93a2b5;font-weight:600}.hsConfirmRow203 input{box-sizing:border-box;width:100%;height:37px;border-radius:11px;border:1px solid rgba(71,154,239,.22);background:#0b1520;color:#f4f8fc;padding:0 10px;outline:none;font-size:12px}.hsConfirmRow203.expiry203 b{display:flex;align-items:center;justify-content:center;min-height:36px;padding:0 11px;border-radius:11px;background:rgba(26,127,230,.14);border:1px solid rgba(49,151,255,.25);color:#70baff!important;font-size:14px!important;font-weight:850!important}
      .hsConfirmLocation203{min-height:58px}.hsConfirmLocs203{display:grid;grid-template-columns:repeat(3,1fr);gap:5px}.hsConfirmLocs203 button{min-width:0;height:34px;padding:0 5px!important;border-radius:10px!important;background:#111d29!important;border:1px solid rgba(255,255,255,.07)!important;color:#91a1b4!important;font-size:9px!important;font-weight:750!important}.hsConfirmLocs203 button.active{background:rgba(26,137,242,.16)!important;border-color:rgba(45,155,255,.42)!important;color:#79c2ff!important}
      .hsConfirmActions203{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:13px}.hsConfirmActions203 button{min-height:47px;border-radius:15px!important;font-size:13px!important;font-weight:800!important}.hsConfirmActions203>button:first-child{background:#131e2a!important;border:1px solid rgba(132,172,219,.2)!important;color:#e7eef7!important}.hsConfirmActions203 .primary{background:linear-gradient(180deg,#299cff,#0879e6)!important;border:1px solid #47aeff!important;color:#fff!important;box-shadow:0 8px 22px rgba(10,122,229,.25)!important}
      @media(max-width:760px){.hsConfirm203{width:calc(100vw - 20px);padding:16px!important;border-radius:24px!important}.hsConfirmHead203 h2{font-size:22px!important}.hsConfirmImage203{height:104px}.hsConfirmRow203{grid-template-columns:84px minmax(0,1fr);min-height:48px;padding:0 11px}.hsConfirmRow203>span{font-size:9px}.hsConfirmRow203>b{font-size:12px}.hsConfirmRow203.expiry203 b{font-size:13px!important}.hsConfirmActions203 button{min-height:45px}}
    `;
    root.appendChild(style);
  };
}
