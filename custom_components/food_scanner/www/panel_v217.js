import './panel_v216.js?v=2.0.27';

const Panel = customElements.get('food-scanner-panel');

if (Panel) {
  const previousRender217 = Panel.prototype.render;

  Panel.prototype.render = function() {
    previousRender217.call(this);
    const root = this.shadowRoot;
    if (!root) return;

    const voiceAction = root.querySelector('#hsQuickVoiceAuto223');
    if (voiceAction) {
      voiceAction.setAttribute('aria-label', 'Consuma prodotti, alimenti e consumabili insieme');
      voiceAction.innerHTML = '<span aria-hidden="true">🎙</span><div><b>Consuma prodotti</b><small>Alimenti e consumabili insieme</small></div><em aria-hidden="true">›</em>';
    }

    const version = root.querySelector('.hsVersion165 b');
    if (version) version.textContent = 'v2.0.28';
  };
}
