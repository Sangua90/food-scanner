import './panel_v198.js?v=2.0.0-beta.2-base';

const Panel = customElements.get('food-scanner-panel');
if (Panel) {
  const previousVoiceClose = Panel.prototype.voiceClose;
  Panel.prototype.voiceClose = function() {
    const s = this._voice;
    if (s && s.status === 'preview') {
      s.status = 'input';
      s.ops = [];
      s.message = '';
      this.render();
      return;
    }
    previousVoiceClose.call(this);
  };

  const previousRender = Panel.prototype.render;
  Panel.prototype.render = function() {
    previousRender.call(this);
    const root = this.shadowRoot;
    if (!root) return;
    const version = root.querySelector('.hsVersion165 b');
    if (version) version.textContent = 'v2.0.0-beta.2';
  };
}
