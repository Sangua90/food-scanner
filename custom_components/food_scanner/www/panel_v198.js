import './panel_v197.js?v=2.0.0-beta.1-base';

const Panel = customElements.get('food-scanner-panel');
if (Panel) {
  const previousRender = Panel.prototype.render;
  Panel.prototype.render = function() {
    previousRender.call(this);
    const root = this.shadowRoot;
    if (!root) return;
    const version = root.querySelector('.hsVersion165 b');
    if (version) version.textContent = 'v2.0.0-beta.1';
  };
}
