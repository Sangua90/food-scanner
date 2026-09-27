import './panel_v217.js?v=2.0.28';

const Panel = customElements.get('food-scanner-panel');

if (Panel) {
  const previousRender218 = Panel.prototype.render;

  Panel.prototype.render = function() {
    previousRender218.call(this);
    const root = this.shadowRoot;
    if (!root) return;

    root.querySelectorAll(
      '.hsFoodHeaderActions1647, .hsConsHeaderActions1650, #voiceBtn, #voiceBtnCons'
    ).forEach(node => {
      node.style.setProperty('display', 'none', 'important');
      node.setAttribute('aria-hidden', 'true');
    });

    // Fallback for header markup variations: hide only header scan/microphone
    // controls, leaving actions inside dialogs and the central add menu intact.
    root.querySelectorAll('button').forEach(button => {
      if (button.closest('.hsBottomNav163, .hsQuickSheet163, .hsQuickOverlay163, .modal, .overlay, .voiceOv')) return;
      const label = (button.getAttribute('aria-label') || button.title || '').trim().toLowerCase();
      const text = (button.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
      if (label.includes('consuma alimenti con voce') || label.includes('consuma consumabili con voce')
        || text === 'scansiona' || text === '⌁ scansiona') {
        button.style.setProperty('display', 'none', 'important');
        button.setAttribute('aria-hidden', 'true');
      }
    });

    const version = root.querySelector('.hsVersion165 b');
    if (version) version.textContent = 'v2.0.29';
  };
}
