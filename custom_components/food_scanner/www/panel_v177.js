import './panel_v176.js?v=1.6.32-base';

const HomeStockPanel = customElements.get('food-scanner-panel');

if (HomeStockPanel) {
  const prevRender177 = HomeStockPanel.prototype.render;
  HomeStockPanel.prototype.render = function() {
    prevRender177.call(this);
    const root = this.shadowRoot;
    if (!root) return;

    const version = root.querySelector('.hsVersion165 b');
    if (version) version.textContent = 'v1.6.32';

    const expiryCard = root.querySelector('.hsSettingCard165.expiry');
    if (expiryCard && !expiryCard.querySelector('.hsExpirySchedule177')) {
      const note = document.createElement('p');
      note.className = 'hsSettingNote165 hsExpirySchedule177';
      note.textContent = 'Invio quotidiano alle 18:30, dal numero di giorni impostato fino al giorno della scadenza.';
      expiryCard.appendChild(note);
    }
  };
}
