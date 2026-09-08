import './panel_v199.js?v=2.0.0-base';

const Panel = customElements.get('food-scanner-panel');
if (Panel) {
  const esc200 = (ctx, v) => ctx.esc ? ctx.esc(v) : String(v ?? '');

  // Show family/category directly on product cards. The family is the value used
  // for low-stock grouping, independently from brand and package format.
  const previousFoodMainCard = Panel.prototype.foodMainCard;
  if (previousFoodMainCard) {
    Panel.prototype.foodMainCard = function(item) {
      let html = previousFoodMainCard.call(this, item);
      const family = String(item?.generic_name || '').trim();
      const category = String(item?.category || '').trim();
      if (!family && !category) return html;
      const meta = `<small class="hsFamilyMeta200"><b>Famiglia:</b> ${esc200(this, family || 'Da definire')}${category ? ` <i>·</i> <b>Categoria:</b> ${esc200(this, category)}` : ''}</small>`;
      if (html.includes('</h3>')) return html.replace('</h3>', `</h3>${meta}`);
      return html;
    };
  }

  const previousConsCard = Panel.prototype.consCard166;
  if (previousConsCard) {
    Panel.prototype.consCard166 = function(item) {
      let html = previousConsCard.call(this, item);
      const family = String(item?.generic_name || '').trim();
      const category = String(item?.category || '').trim();
      if (!family && !category) return html;
      const meta = `<small class="hsFamilyMeta200"><b>Famiglia:</b> ${esc200(this, family || 'Da definire')}${category ? ` <i>·</i> <b>Categoria:</b> ${esc200(this, category)}` : ''}</small>`;
      if (html.includes('</p>')) return html.replace('</p>', `</p>${meta}`);
      return html;
    };
  }

  // Items without a preferred supermarket still belong to a valid general
  // shopping section rather than looking like incomplete data.
  const previousListsView = Panel.prototype.hsListsView175;
  if (previousListsView) {
    Panel.prototype.hsListsView175 = function() {
      let html = previousListsView.call(this);
      if ((this._hsListsView175 || '') === 'shopping') {
        html = html.replaceAll('Da assegnare', 'Generale');
      }
      return html;
    };
  }

  const previousRender = Panel.prototype.render;
  Panel.prototype.render = function() {
    previousRender.call(this);
    const root = this.shadowRoot;
    if (!root) return;
    const version = root.querySelector('.hsVersion165 b');
    if (version) version.textContent = 'v2.0.0';
    if (!root.querySelector('#hsFamilyStyle200')) {
      const style = document.createElement('style');
      style.id = 'hsFamilyStyle200';
      style.textContent = `
        .hsFamilyMeta200{display:block!important;margin:5px 0 0!important;color:#748aa0!important;font-size:9px!important;line-height:1.35!important;font-weight:500!important}
        .hsFamilyMeta200 b{color:#9eb2c6!important;font-weight:750!important}.hsFamilyMeta200 i{font-style:normal!important;color:#4e6378!important;margin:0 2px!important}
      `;
      root.appendChild(style);
    }
  };
}
