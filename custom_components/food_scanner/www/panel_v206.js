import './panel_v205.js?v=2.0.6-base';

const Panel = customElements.get('food-scanner-panel');
if (Panel) {
  const previousRender206 = Panel.prototype.render;

  Panel.prototype.render = function() {
    previousRender206.call(this);
    const root = this.shadowRoot;
    if (!root) return;

    const version = root.querySelector('.hsVersion165 b');
    if (version) version.textContent = 'v2.0.6';

    if (!root.__hsFoodScan206) {
      root.__hsFoodScan206 = true;

      root.addEventListener('click', (event) => {
        const locBtn = event.target?.closest?.('[data-fsloc]');
        if (locBtn && this._foodScan) {
          event.preventDefault();
          event.stopPropagation();
          const location = String(locBtn.dataset.fsloc || '').trim();
          if (['frigo','freezer','dispensa'].includes(location)) {
            this._foodScan.location = location;
            root.querySelectorAll('[data-fsloc]').forEach((node) => node.classList.toggle('selected', node === locBtn));
          }
          return;
        }

        const photoBtn = event.target?.closest?.('#foodPhoto');
        if (photoBtn && this._foodScan) {
          event.preventDefault();
          event.stopPropagation();
          root.querySelector('#foodFile')?.click();
        }
      }, true);

      root.addEventListener('change', (event) => {
        const input = event.target;
        if (!(input instanceof HTMLInputElement) || input.id !== 'foodFile' || !this._foodScan) return;
        const file = input.files?.[0];
        if (!file) return;
        event.stopPropagation();
        this.foodFile(file);
      }, true);
    }
  };
}
