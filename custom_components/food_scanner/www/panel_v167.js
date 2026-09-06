import './panel_v166.js?v=1.6.18-base';

const HomeStockPanel = customElements.get('food-scanner-panel');
if (HomeStockPanel) {
  const prevRender167 = HomeStockPanel.prototype.render;
  HomeStockPanel.prototype.render = function() {
    prevRender167.call(this);
    const version = this.shadowRoot?.querySelector('.hsVersion165 b');
    if (version) version.textContent = 'v1.6.18';
  };
}
