import './panel_v204.js?v=2.0.5-base';

const Panel = customElements.get('food-scanner-panel');
if (Panel) {
  const previousRender205 = Panel.prototype.render;

  Panel.prototype.render = function() {
    previousRender205.call(this);
    const root = this.shadowRoot;
    if (!root) return;

    const version = root.querySelector('.hsVersion165 b');
    if (version) version.textContent = 'v2.0.5';

    if (!root.__hsFoodLocation205) {
      root.__hsFoodLocation205 = true;
      root.addEventListener('click', (event) => {
        const btn = event.target?.closest?.('[data-fsloc]');
        if (!btn || !this._foodScan) return;

        event.preventDefault();
        event.stopPropagation();

        const location = String(btn.dataset.fsloc || '').trim();
        if (!['frigo', 'freezer', 'dispensa'].includes(location)) return;

        this._foodScan.location = location;
        root.querySelectorAll('[data-fsloc]').forEach((node) => {
          node.classList.toggle('selected', node === btn);
        });
      }, true);
    }
  };
}
