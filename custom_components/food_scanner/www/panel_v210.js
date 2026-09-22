import './panel_v209.js?v=2.0.15';

const Panel = customElements.get('food-scanner-panel');

if (Panel) {
  const esc210 = (ctx, value) => ctx.esc ? ctx.esc(value) : String(value ?? '');

  const previousFoodFile210 = Panel.prototype.foodFile;
  Panel.prototype.foodFile = async function(file) {
    await previousFoodFile210.call(this, file);
    const s = this._foodScan;
    if (s?.status === 'confirm203') {
      s.packageCount210 = 1;
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
    const unitsPerPackage = Math.max(1, Number(d.added_units || d.units_per_package || 1));
    const unit = this.unit ? this.unit(d.unit_name) : (d.unit_name || 'Pezzi');
    const image = String(d.product_image_url || '').trim();
    const expiry = String(d.expiry_date || '');
    const locations = ['frigo','freezer','dispensa'];
    const packageCount = Math.max(1, Number(s.packageCount210 || 1));
    const totalUnits = packageCount * unitsPerPackage;

    return `<div class="overlay hsConfirmOverlay203"><div class="modal hsConfirm203 hsConfirm210">
      <button type="button" class="close" id="foodConfirmClose203">×</button>
      <div class="hsConfirmHead203"><span class="eyebrow">HOMESTOCK</span><h2>Conferma prodotto</h2><p>Controlla i dati prima di continuare</p></div>
      ${image ? `<div class="hsConfirmImage203"><img src="${esc210(this,image)}" alt=""></div>` : ''}
      <div class="hsConfirmRows203">
        <label class="hsConfirmRow203"><span>Prodotto</span>${editing ? `<input id="foodConfirmName203" value="${esc210(this,name)}">` : `<b>${esc210(this,name)}</b>`}</label>
        <label class="hsConfirmRow203"><span>Marca</span>${editing ? `<input id="foodConfirmBrand203" value="${esc210(this,d.brand || '')}" placeholder="Marca">` : `<b class="muted203">${esc210(this,brand)}</b>`}</label>
        <div class="hsConfirmRow203"><span>Per confezione</span><b>${unitsPerPackage} ${esc210(this,unit)}</b></div>
        <div class="hsConfirmRow203 hsPackagesRow210">
          <span>Confezioni uguali</span>
          <div class="hsPackageStep210"><button type="button" id="foodPkgMinus210">−</button><b id="foodPkgCount210">${packageCount}</b><button type="button" id="foodPkgPlus210">+</button></div>
        </div>
        <div class="hsConfirmRow203 hsTotalRow210"><span>Totale aggiunto</span><b id="foodPkgTotal210">${totalUnits} ${esc210(this,unit)}</b></div>
        <div class="hsConfirmRow203 hsConfirmLocation203"><span>Posizione</span>${editing ? `<div class="hsConfirmLocs203">${locations.map(x=>`<button type="button" data-confirm-loc203="${x}" class="${s.location===x?'active':''}">${esc210(this,this.loc(x))}</button>`).join('')}</div>` : `<b>${esc210(this,this.loc(s.location))}</b>`}</div>
        <label class="hsConfirmRow203 expiry203"><span>Scadenza</span>${editing ? `<input id="foodConfirmExpiry203" type="date" value="${esc210(this,expiry)}">` : `<b>${expiry ? esc210(this,this.fmtDate(expiry)) : 'Nessuna scadenza'}</b>`}</label>
      </div>
      <div class="hsConfirmActions203">
        <button type="button" id="foodConfirmEdit203">${editing ? 'Annulla correzioni' : 'Correggi'}</button>
        <button type="button" id="foodConfirmSave203" class="primary">Salva</button>
      </div>
    </div></div>`;
  };

  Panel.prototype.saveFoodConfirm203 = async function() {
    const s = this._foodScan;
    const d = s?.detected203;
    if (!s || !d) return;

    try {
      let archiveId = d.archive_id;

      if (s.edit203 && archiveId) {
        const root = this.shadowRoot;
        const changes = {
          product_name: String(root.querySelector('#foodConfirmName203')?.value || d.product_name || '').trim(),
          brand: String(root.querySelector('#foodConfirmBrand203')?.value || '').trim(),
          location: s.location,
          expiry_date: root.querySelector('#foodConfirmExpiry203')?.value || null,
        };
        if (!changes.product_name) return alert('Inserisci il nome del prodotto.');
        const updated = await this._hass.callApi('POST','food_scanner/archive',{
          action:'update_item', id:archiveId, changes,
        });
        archiveId = updated?.item?.id || archiveId;
        d.archive_id = archiveId;
        d.product_name = changes.product_name;
        d.brand = changes.brand;
        d.location = changes.location;
        d.expiry_date = changes.expiry_date;
      }

      const packageCount = Math.max(1, Number(s.packageCount210 || 1));
      const unitsPerPackage = Math.max(1, Number(d.added_units || d.units_per_package || 1));

      if (packageCount > 1 && archiveId) {
        const current = (this._items || []).find(x => String(x.id) === String(archiveId));
        let currentStock = current ? Number(current.stock_units || 0) : NaN;

        if (!Number.isFinite(currentStock)) {
          const snapshot = await this._hass.callApi('GET','food_scanner/archive?sort=expiry');
          const item = (snapshot?.items || []).find(x => String(x.id) === String(archiveId));
          currentStock = Number(item?.stock_units || 0);
        }

        if (!Number.isFinite(currentStock) || currentStock < 0) {
          throw new Error('Non riesco a leggere la quantità attuale del prodotto.');
        }

        const extraUnits = (packageCount - 1) * unitsPerPackage;
        await this._hass.callApi('POST','food_scanner/archive',{
          action:'set_stock', id:archiveId, amount:currentStock + extraUnits,
        });
      }

      await this.load();
      s.status = 'success';
      s.edit203 = false;
      s.message = '✓ ' + (d.product_name || 'Prodotto') + (packageCount > 1 ? ` · ${packageCount} confezioni salvate.` : ' salvato.');
      this.render();
    } catch (e) {
      alert(e?.message || String(e));
    }
  };

  const previousBind210 = Panel.prototype.bind;
  Panel.prototype.bind = function() {
    previousBind210.call(this);
    const root = this.shadowRoot;
    const s = this._foodScan;
    if (!root || s?.status !== 'confirm203') return;

    const refreshPackageCount = () => {
      const d = s.detected203 || {};
      const unitsPerPackage = Math.max(1, Number(d.added_units || d.units_per_package || 1));
      const unit = this.unit ? this.unit(d.unit_name) : (d.unit_name || 'Pezzi');
      const count = Math.max(1, Number(s.packageCount210 || 1));
      const countEl = root.querySelector('#foodPkgCount210');
      const totalEl = root.querySelector('#foodPkgTotal210');
      if (countEl) countEl.textContent = String(count);
      if (totalEl) totalEl.textContent = `${count * unitsPerPackage} ${unit}`;
    };

    root.querySelector('#foodPkgMinus210')?.addEventListener('click', () => {
      s.packageCount210 = Math.max(1, Number(s.packageCount210 || 1) - 1);
      refreshPackageCount();
    });
    root.querySelector('#foodPkgPlus210')?.addEventListener('click', () => {
      s.packageCount210 = Math.min(99, Number(s.packageCount210 || 1) + 1);
      refreshPackageCount();
    });
  };

  const previousRender210 = Panel.prototype.render;
  Panel.prototype.render = function() {
    previousRender210.call(this);
    const root = this.shadowRoot;
    if (!root) return;
    const version = root.querySelector('.hsVersion165 b');
    if (version) version.textContent = 'v2.0.10';
    if (root.querySelector('#hsFoodPackages210Style')) return;
    const style = document.createElement('style');
    style.id = 'hsFoodPackages210Style';
    style.textContent = `
      .hsPackagesRow210{min-height:60px!important}.hsPackageStep210{display:grid;grid-template-columns:40px 48px 40px;gap:6px;align-items:center;justify-content:end}.hsPackageStep210 button{height:38px!important;min-height:38px!important;border-radius:11px!important;background:#111e2b!important;border:1px solid rgba(76,159,239,.2)!important;color:#dcebfa!important;font-size:20px!important;font-weight:700!important;padding:0!important}.hsPackageStep210 b{display:grid;place-items:center;height:38px;border-radius:11px;background:rgba(29,139,239,.12);border:1px solid rgba(54,157,255,.24);color:#81c7ff!important;font-size:15px!important}.hsTotalRow210 b{color:#86efac!important;font-size:13px!important}.hsConfirm210 .hsConfirmRows203{overflow:visible!important}
      @media(max-width:760px){.hsPackageStep210{grid-template-columns:36px 42px 36px}.hsPackageStep210 button,.hsPackageStep210 b{height:36px!important;min-height:36px!important}.hsPackagesRow210{min-height:56px!important}}
    `;
    root.appendChild(style);
  };
}
