import './panel_v153.js?v=1.6.6-base';

const HomeStockPanel = customElements.get('food-scanner-panel');

if (HomeStockPanel) {
  const originalLoc154 = HomeStockPanel.prototype.loc;
  HomeStockPanel.prototype.loc = function(v) {
    if (v === 'stalla') return 'Stalla';
    if (v === 'dispensa') return 'Dispensa';
    return originalLoc154.call(this, v);
  };

  const makeZoneButton = (panel, key, label, icon) => {
    const btn = document.createElement('button');
    btn.dataset.czone = key;
    btn.className = `hsZone ${key} ${panel._consLocation === key ? 'active' : ''}`;
    btn.innerHTML = `<span class="hsZoneIcon">${icon}</span><b>${panel.consCount(key)}</b><small>${label}</small>`;
    btn.addEventListener('click', () => {
      panel._consLocation = panel._consLocation === key ? '' : key;
      panel._lowOnly = false;
      panel.render();
    });
    return btn;
  };

  const addChoice = (panel, container, attr, key, label, state) => {
    if (!container || container.querySelector(`[${attr}="${key}"]`)) return;
    const btn = document.createElement('button');
    btn.className = `choice ${key} ${state?.location === key ? 'selected' : ''}`;
    btn.setAttribute(attr, key);
    btn.textContent = label;
    btn.addEventListener('click', () => {
      container.querySelectorAll('.choice').forEach(x => x.classList.remove('selected'));
      btn.classList.add('selected');
      if (state) state.location = key;
    });
    container.appendChild(btn);
  };

  const originalRender154 = HomeStockPanel.prototype.render;
  HomeStockPanel.prototype.render = function() {
    originalRender154.call(this);
    const root = this.shadowRoot;
    if (!root) return;

    const zones = root.querySelector('.consZones');
    if (zones) {
      if (!zones.querySelector('[data-czone="dispensa"]')) zones.appendChild(makeZoneButton(this, 'dispensa', 'Dispensa', '▦'));
      if (!zones.querySelector('[data-czone="stalla"]')) zones.appendChild(makeZoneButton(this, 'stalla', 'Stalla', '⌂'));
    }

    const plocContainer = root.querySelector('[data-ploc]')?.parentElement;
    if (plocContainer) {
      addChoice(this, plocContainer, 'data-ploc', 'dispensa', 'Dispensa', this._consScan);
      addChoice(this, plocContainer, 'data-ploc', 'stalla', 'Stalla', this._consScan);
    }

    const mlocContainer = root.querySelector('[data-mloc]')?.parentElement;
    if (mlocContainer) {
      addChoice(this, mlocContainer, 'data-mloc', 'dispensa', 'Dispensa', this._manual);
      addChoice(this, mlocContainer, 'data-mloc', 'stalla', 'Stalla', this._manual);
    }

    const editLoc = root.querySelector('#edLoc');
    if (editLoc) {
      if (!editLoc.querySelector('option[value="dispensa"]')) editLoc.insertAdjacentHTML('beforeend', '<option value="dispensa">Dispensa</option>');
      if (!editLoc.querySelector('option[value="stalla"]')) editLoc.insertAdjacentHTML('beforeend', '<option value="stalla">Stalla</option>');
      if (this._edit?.item?.location) editLoc.value = this._edit.item.location;
    }

    if (!root.querySelector('#homeStockConsumables166')) {
      const style = document.createElement('style');
      style.id = 'homeStockConsumables166';
      style.textContent = `
        .consZones{grid-template-columns:repeat(3,1fr)!important}
        .hsZone.dispensa:after{background:#eab308}
        .hsZone.stalla:after{background:#8b5a2b}
        @media(max-width:760px){.consZones{grid-template-columns:repeat(2,1fr)!important}}
      `;
      root.appendChild(style);
    }
  };
}
