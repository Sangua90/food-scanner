import './panel_v183.js?v=1.6.39-base';

const HomeStockPanel = customElements.get('food-scanner-panel');

if (HomeStockPanel) {
  const prevBind184 = HomeStockPanel.prototype.bind;

  HomeStockPanel.prototype.bind = function() {
    prevBind184.call(this);
    const root = this.shadowRoot;
    const s = this._consScan;
    if (!root || !s || (s.status !== 'photo' && s.status !== 'fallback')) return;

    // Strip every inherited listener from the consumable capture controls.
    const oldButton = root.querySelector('#consProductPhoto');
    const oldInput = root.querySelector('#consProductFile');
    if (!oldButton || !oldInput) return;

    const button = oldButton.cloneNode(true);
    const input = oldInput.cloneNode(true);
    oldButton.replaceWith(button);
    oldInput.replaceWith(input);

    // Exactly one native camera activation, kept synchronous with the user tap.
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      input.click();
    }, { once: false });

    // Exactly one file handler. From here the existing Gemini flow takes over.
    input.addEventListener('change', (event) => {
      const file = event.target?.files?.[0];
      if (!file) return;
      try {
        this.geminiFile(file);
      } catch (err) {
        if (this._consScan) {
          this._consScan.status = 'fallback';
          this._consScan.message = err?.message || String(err) || 'Riconoscimento non riuscito.';
          this.render();
        }
      }
    }, { once: false });
  };

  const prevRender184 = HomeStockPanel.prototype.render;
  HomeStockPanel.prototype.render = function() {
    prevRender184.call(this);
    const root = this.shadowRoot;
    if (!root) return;
    const version = root.querySelector('.hsVersion165 b');
    if (version) version.textContent = 'v1.6.39';
  };
}
