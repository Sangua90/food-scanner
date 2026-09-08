import './panel_v196.js?v=1.6.53-base';

const Panel = customElements.get('food-scanner-panel');
if (Panel) {
  const previousRender = Panel.prototype.render;
  Panel.prototype.render = function() {
    previousRender.call(this);
    const root = this.shadowRoot;
    if (!root) return;
    const version = root.querySelector('.hsVersion165 b');
    if (version) version.textContent = 'v1.6.53';
  };
}
