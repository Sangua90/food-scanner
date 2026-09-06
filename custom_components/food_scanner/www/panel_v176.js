import './panel_v175.js?v=1.6.31-base';

const HomeStockPanel = customElements.get('food-scanner-panel');

if (HomeStockPanel) {
  HomeStockPanel.prototype.exitHomeStock176 = function() {
    history.pushState(null, '', '/');
    window.dispatchEvent(new Event('location-changed'));
  };

  HomeStockPanel.prototype.smartClose176 = function() {
    // Modali / azioni temporanee: torna sempre alla schermata sottostante.
    if (this._consScan) {
      this._consScan = null;
      this.render();
      return true;
    }
    if (this._foodScan) {
      this._foodScan = null;
      this.render();
      return true;
    }
    if (this._hsQuickAddOpen) {
      this._hsQuickAddOpen = false;
      this.render();
      return true;
    }

    // Sottosezioni Liste: torna alla pagina principale Liste.
    if (this._hsListsPage175 && this._hsListsView175) {
      this._hsListsView175 = '';
      this.render();
      return true;
    }

    // Sottosezioni Alimenti: torna alla pagina principale Alimenti.
    if (this._foodNeoMenu) {
      this._foodNeoMenu = '';
      this._foodNeoSearch = '';
      this.render();
      return true;
    }

    // Le sezioni principali non hanno un livello precedente interno:
    // esci da HomeStock e torna a Home Assistant.
    this.exitHomeStock176();
    return true;
  };

  HomeStockPanel.prototype.installSmartClose176 = function() {
    const root = this.shadowRoot;
    if (!root || root.__hsSmartClose176) return;
    root.__hsSmartClose176 = true;

    root.addEventListener('click', (event) => {
      const path = event.composedPath?.() || [];
      const button = path.find(el => el?.tagName === 'BUTTON');
      if (!button) return;

      const text = String(button.textContent || '').trim();
      const aria = String(button.getAttribute?.('aria-label') || '').trim().toLocaleLowerCase('it-IT');
      const isClose = text === '×' || text === '✕' || text === '✖' || aria === 'chiudi' || aria === 'close';
      if (!isClose) return;

      // Non sostituire X di editor/modali sconosciuti: qui gestiamo solo
      // le schermate HomeStock note o la X globale dell'app.
      const knownOverlay = !!button.closest?.('.foodScanModal, .consSimpleModal, .hsQuickSheet163');
      const appLevel = !button.closest?.('.modal');
      if (!knownOverlay && !appLevel) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      this.smartClose176();
    }, true);
  };

  const prevRender176 = HomeStockPanel.prototype.render;
  HomeStockPanel.prototype.render = function() {
    prevRender176.call(this);
    this.installSmartClose176();
    const root = this.shadowRoot;
    if (!root) return;
    const version = root.querySelector('.hsVersion165 b');
    if (version) version.textContent = 'v1.6.31';
  };
}
