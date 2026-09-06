import './panel_v177.js?v=1.6.33-base';

const HomeStockPanel = customElements.get('food-scanner-panel');

if (HomeStockPanel) {
  const prevRender178 = HomeStockPanel.prototype.render;
  HomeStockPanel.prototype.render = function() {
    prevRender178.call(this);
    const root = this.shadowRoot;
    if (!root) return;

    const version = root.querySelector('.hsVersion165 b');
    if (version) version.textContent = 'v1.6.33';

    const note = root.querySelector('.hsExpirySchedule177');
    if (note) {
      note.textContent = 'Invio quotidiano alle 11:30 e alle 18:30, dal numero di giorni impostato fino al giorno della scadenza.';
    }
  };
}
