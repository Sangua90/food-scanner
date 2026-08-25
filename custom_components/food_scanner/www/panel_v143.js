import './panel_v142.js?v=1.4.3-base';

const HomeStockPanel = customElements.get('food-scanner-panel');

if (HomeStockPanel) {
  HomeStockPanel.prototype.openUnifiedQuantity = function(item, type) {
    this._adjust = {
      item,
      type,
      kind: 'quantity',
      value: Number(item?.stock_units || 0),
      original: Number(item?.stock_units || 0),
    };
    this.render();
  };

  const originalSaveAdjust = HomeStockPanel.prototype.saveAdjust;
  HomeStockPanel.prototype.saveAdjust = async function() {
    const a = this._adjust;
    if (!a || a.kind !== 'quantity') {
      return originalSaveAdjust.call(this);
    }
    try {
      if (a.value === 0 && !confirm('Portare a zero la scorta di questo prodotto?')) return;
      if (a.type === 'food') {
        await this.foodPost({ action: 'set_stock', id: a.item.id, amount: a.value });
      } else {
        await this.consPost({ action: 'update', id: a.item.id, changes: { stock_units: a.value } });
      }
      this._adjust = null;
      this.render();
    } catch (e) {
      alert(e?.message || e);
    }
  };

  const originalRenderFood = HomeStockPanel.prototype.renderFood;
  HomeStockPanel.prototype.renderFood = function() {
    return originalRenderFood.call(this)
      .replace(/>Quantità<\/button>/g, '>Consumo / Aggiungi</button>');
  };

  const originalRenderCons = HomeStockPanel.prototype.renderCons;
  HomeStockPanel.prototype.renderCons = function() {
    let html = originalRenderCons.call(this);
    html = html.replace(
      /<div class="actions"><button class="primary" data-cons-use="([^"]+)">Utilizza<\/button><button data-cons-add="\1">Aggiungi<\/button><\/div>/g,
      '<div class="actions"><button class="primary" data-cons-qty="$1">Consumo / Aggiungi</button></div>'
    );
    return html;
  };

  const originalAdjustDialog = HomeStockPanel.prototype.adjustDialog;
  HomeStockPanel.prototype.adjustDialog = function() {
    return originalAdjustDialog.call(this)
      .replace('<h2>Quantità</h2>', '<h2>Consumo / Aggiungi</h2>')
      .replace('Scorta precedente:', 'Scorta attuale:');
  };

  const originalBind = HomeStockPanel.prototype.bind;
  HomeStockPanel.prototype.bind = function() {
    originalBind.call(this);
    const r = this.shadowRoot;
    r.querySelectorAll('[data-food-qty]').forEach((b) => {
      b.onclick = (e) => {
        e.stopPropagation();
        const item = this._items.find((x) => x.id === b.dataset.foodQty);
        if (item) this.openUnifiedQuantity(item, 'food');
      };
    });
    r.querySelectorAll('[data-cons-qty]').forEach((b) => {
      b.onclick = (e) => {
        e.stopPropagation();
        const item = this._cons.find((x) => x.id === b.dataset.consQty);
        if (item) this.openUnifiedQuantity(item, 'cons');
      };
    });
  };
}
