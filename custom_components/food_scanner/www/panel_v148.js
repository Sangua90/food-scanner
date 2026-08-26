import './panel_v147.js?v=1.4.8-base';

const HomeStockPanel = customElements.get('food-scanner-panel');

if (HomeStockPanel) {
  const originalRender148 = HomeStockPanel.prototype.render;
  HomeStockPanel.prototype.render = function() {
    originalRender148.call(this);

    const root = this.shadowRoot;
    if (!root || root.querySelector('#homeStockExit')) return;

    const exit = document.createElement('button');
    exit.id = 'homeStockExit';
    exit.type = 'button';
    exit.setAttribute('aria-label', 'Torna a Home Assistant');
    exit.setAttribute('title', 'Torna a Home Assistant');
    exit.textContent = '×';
    exit.style.cssText = [
      'position:fixed',
      'top:max(14px, env(safe-area-inset-top))',
      'right:14px',
      'z-index:10000',
      'width:44px',
      'height:44px',
      'border-radius:50%',
      'border:1px solid rgba(255,255,255,.18)',
      'background:rgba(18,18,18,.82)',
      'backdrop-filter:blur(10px)',
      '-webkit-backdrop-filter:blur(10px)',
      'color:#fff',
      'font-size:30px',
      'font-weight:300',
      'line-height:38px',
      'display:flex',
      'align-items:center',
      'justify-content:center',
      'box-shadow:0 6px 18px rgba(0,0,0,.28)',
      'cursor:pointer',
      'padding:0',
      'touch-action:manipulation'
    ].join(';');

    exit.addEventListener('click', () => {
      history.pushState(null, '', '/');
      window.dispatchEvent(new Event('location-changed'));
    });

    root.appendChild(exit);
  };
}
