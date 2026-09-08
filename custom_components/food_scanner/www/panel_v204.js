import './panel_v203.js?v=2.0.4-base';

const Panel = customElements.get('food-scanner-panel');
if (Panel) {
  const previousBind204 = Panel.prototype.bind;

  Panel.prototype.bindFoodScanSafe204 = function() {
    const root = this.shadowRoot;
    const s = this._foodScan;
    if (!root || !s) return;

    const byId = (id) => root.querySelector(id);

    byId('#foodX')?.addEventListener('click', () => {
      this._foodScan = null;
      this.render();
    });

    root.querySelectorAll('[data-fsloc]').forEach((btn) => btn.addEventListener('click', () => {
      s.location = btn.dataset.fsloc || s.location;
      root.querySelectorAll('[data-fsloc]').forEach((x) => x.classList.toggle('selected', x === btn));
    }));

    byId('#foodPhoto')?.addEventListener('click', () => byId('#foodFile')?.click());
    byId('#foodFile')?.addEventListener('change', (e) => {
      const file = e.target?.files?.[0];
      if (file) this.foodFile(file);
    });

    byId('#foodNext')?.addEventListener('click', () => {
      const location = s.location || this._location || 'dispensa';
      this._foodScan = { location, status:'idle', reviewId:null, message:'Scegli dove va il prodotto.' };
      this.render();
    });

    byId('#foodDone')?.addEventListener('click', () => {
      this._foodScan = null;
      this.render();
    });

    // v2.0.3 confirmation screen: bind here too, so it remains usable even if
    // an older scanner binder expected an element that is not present.
    if (s.status === 'confirm203') {
      byId('#foodConfirmClose203')?.addEventListener('click', () => {
        this._foodScan = null;
        this.render();
      });
      byId('#foodConfirmEdit203')?.addEventListener('click', () => {
        s.edit203 = !s.edit203;
        this.render();
      });
      root.querySelectorAll('[data-confirm-loc203]').forEach((btn) => btn.addEventListener('click', () => {
        s.location = btn.dataset.confirmLoc203 || s.location;
        root.querySelectorAll('[data-confirm-loc203]').forEach((x) => x.classList.toggle('active', x === btn));
      }));
      byId('#foodConfirmSave203')?.addEventListener('click', () => this.saveFoodConfirm203?.());
    }
  };

  Panel.prototype.bind = function() {
    try {
      previousBind204.call(this);
    } catch (err) {
      // Some inherited scanner versions bind controls with direct .onclick
      // access. During newer modal states those controls can legitimately be
      // absent; do not let that break the entire scanner UI.
      if (!this._foodScan) throw err;
      console.warn('HomeStock: scanner bind compatibility fallback', err);
    }
    this.bindFoodScanSafe204();
  };

  const previousRender204 = Panel.prototype.render;
  Panel.prototype.render = function() {
    previousRender204.call(this);
    const root = this.shadowRoot;
    if (!root) return;
    const version = root.querySelector('.hsVersion165 b');
    if (version) version.textContent = 'v2.0.4';
  };
}
