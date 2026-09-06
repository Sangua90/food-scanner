import './panel_v163.js?v=1.6.16-base';

const HomeStockPanel = customElements.get('food-scanner-panel');

if (HomeStockPanel) {
  const previousGenericName164 = HomeStockPanel.prototype.foodGenericName;
  HomeStockPanel.prototype.foodGenericName = function(item) {
    const stored = String(item?.generic_name || '').trim();
    if (stored) return stored;
    return previousGenericName164 ? previousGenericName164.call(this, item) : String(item?.product_name || 'Prodotto').trim();
  };

  const previousSearchMatch164 = HomeStockPanel.prototype.foodSearchMatch;
  HomeStockPanel.prototype.foodSearchMatch = function(item, query) {
    // Zero-stock products remain archived for product-family memory and low-stock,
    // but disappear from the normal inventory/expiry lists.
    if (Number(item?.stock_units || 0) <= 0) return false;
    return previousSearchMatch164 ? previousSearchMatch164.call(this, item, query) : true;
  };

  const previousFoodStockGroups164 = HomeStockPanel.prototype.foodStockGroups;
  HomeStockPanel.prototype.foodStockGroups = function() {
    const groups = previousFoodStockGroups164 ? previousFoodStockGroups164.call(this) : [];
    return groups.map(group => {
      const stored = (group.items || []).map(x => String(x.generic_name || '').trim()).find(Boolean);
      return stored ? { ...group, name: stored, key: stored.toLocaleLowerCase('it-IT') } : group;
    });
  };

  const previousRender164 = HomeStockPanel.prototype.render;
  HomeStockPanel.prototype.render = function() {
    previousRender164.call(this);
    const root = this.shadowRoot;
    if (!root || root.querySelector('#homeStockProductFamily1616')) return;
    const style = document.createElement('style');
    style.id = 'homeStockProductFamily1616';
    style.textContent = `
      .neoLowRow small{color:#8293a7!important}
      .neoLowRow strong{white-space:nowrap}
      .neoLowGroup .neoLowHead:after{content:'Raggruppato per tipologia';margin-left:auto;font-size:9px;color:#66778c;font-weight:600}
      @media(max-width:760px){.neoLowGroup .neoLowHead:after{display:none}}
    `;
    root.appendChild(style);
  };
}
