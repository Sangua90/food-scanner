import './panel_v172.js?v=1.6.28-base';

const HomeStockPanel = customElements.get('food-scanner-panel');

if (HomeStockPanel) {
  const previousBind173 = HomeStockPanel.prototype.bind;
  HomeStockPanel.prototype.bind = function() {
    previousBind173.call(this);
    const root = this.shadowRoot;
    if (!root) return;

    const close = root.querySelector('#consSimpleX');
    if (close) {
      close.onclick = (ev) => {
        ev?.preventDefault?.();
        ev?.stopPropagation?.();
        this._consScan = null;
        this.render();
      };
    }
  };

  HomeStockPanel.prototype.removeLegacyModeSwitch173 = function() {
    const root = this.shadowRoot;
    if (!root) return;

    const buttons = [...root.querySelectorAll('button')];
    const foodButtons = buttons.filter(btn => (btn.textContent || '').trim() === 'Alimenti');
    const consButtons = buttons.filter(btn => (btn.textContent || '').trim() === 'Consumabili');

    for (const foodBtn of foodButtons) {
      if (foodBtn.closest('.hsBottomNav163')) continue;
      const parent = foodBtn.parentElement;
      if (!parent) continue;
      const hasConsSibling = [...parent.querySelectorAll(':scope > button')]
        .some(btn => (btn.textContent || '').trim() === 'Consumabili');
      if (hasConsSibling) {
        parent.style.setProperty('display', 'none', 'important');
        parent.style.setProperty('height', '0', 'important');
        parent.style.setProperty('margin', '0', 'important');
        parent.style.setProperty('padding', '0', 'important');
        parent.setAttribute('aria-hidden', 'true');
      }
    }

    for (const consBtn of consButtons) {
      if (consBtn.closest('.hsBottomNav163')) continue;
      const parent = consBtn.parentElement;
      if (!parent) continue;
      const hasFoodSibling = [...parent.querySelectorAll(':scope > button')]
        .some(btn => (btn.textContent || '').trim() === 'Alimenti');
      if (hasFoodSibling) {
        parent.style.setProperty('display', 'none', 'important');
        parent.style.setProperty('height', '0', 'important');
        parent.style.setProperty('margin', '0', 'important');
        parent.style.setProperty('padding', '0', 'important');
        parent.setAttribute('aria-hidden', 'true');
      }
    }
  };

  const previousRender173 = HomeStockPanel.prototype.render;
  HomeStockPanel.prototype.render = function() {
    previousRender173.call(this);
    this.removeLegacyModeSwitch173();

    const root = this.shadowRoot;
    if (!root) return;
    const version = root.querySelector('.hsVersion165 b');
    if (version) version.textContent = 'v1.6.28';
  };
}
