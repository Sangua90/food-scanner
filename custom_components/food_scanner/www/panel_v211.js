import './panel_v210.js?v=2.0.11-base';

const Panel = customElements.get('food-scanner-panel');

if (Panel) {
  const previousConsDialog211 = Panel.prototype.consScanDialog;

  if (previousConsDialog211) {
    Panel.prototype.consScanDialog = function() {
      let html = previousConsDialog211.call(this);
      const status = this._consScan?.status;

      if (status === 'photo' || status === 'fallback') {
        html = html.replace(
          /<div class="cons1644Field">\s*<label>Supermercato\s*\/\s*negozio[\s\S]*?<\/div>/i,
          ''
        );
      }

      return html;
    };
  }

  const previousRender211 = Panel.prototype.render;
  Panel.prototype.render = function() {
    previousRender211.call(this);
    const root = this.shadowRoot;
    if (!root) return;
    const version = root.querySelector('.hsVersion165 b');
    if (version) version.textContent = 'v2.0.11';
  };
}
