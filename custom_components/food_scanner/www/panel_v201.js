import './panel_v200.js?v=2.0.1-base';

const Panel = customElements.get('food-scanner-panel');
if (Panel) {
  const prevFoodCard201 = Panel.prototype.foodMainCard;
  if (prevFoodCard201) {
    Panel.prototype.foodMainCard = function(item) {
      let html = prevFoodCard201.call(this, item);
      html = html.replace(
        /<button\s+data-food-qty="([^"]+)"\s+aria-label="Modifica quantità">›<\/button>/,
        '<button type="button" class="hsQtyButton201" data-food-qty="$1" aria-label="Modifica quantità"><span>Quantità</span></button>'
      );
      return html;
    };
  }

  const prevConsCard201 = Panel.prototype.consCard166;
  if (prevConsCard201) {
    Panel.prototype.consCard166 = function(item) {
      let html = prevConsCard201.call(this, item);
      html = html.replace(
        /<button\s+data-cons-qty="([^"]+)"\s+aria-label="Modifica quantità">›<\/button>/,
        '<button type="button" class="hsQtyButton201" data-cons-qty="$1" aria-label="Modifica quantità"><span>Quantità</span></button>'
      );
      return html;
    };
  }

  const prevRender201 = Panel.prototype.render;
  Panel.prototype.render = function() {
    prevRender201.call(this);
    const root = this.shadowRoot;
    if (!root) return;

    const version = root.querySelector('.hsVersion165 b');
    if (version) version.textContent = 'v2.0.1';

    if (!root.querySelector('#hsQuantityButtons201')) {
      const style = document.createElement('style');
      style.id = 'hsQuantityButtons201';
      style.textContent = `
        .neoFoodSide{align-content:center!important}
        .neoFoodSide .hsQtyButton201{
          grid-column:1/-1!important;
          width:100%!important;
          min-width:88px!important;
          height:34px!important;
          min-height:34px!important;
          margin-top:7px!important;
          padding:0 12px!important;
          border-radius:11px!important;
          border:1px solid rgba(42,151,255,.32)!important;
          background:linear-gradient(180deg,rgba(32,133,235,.18),rgba(15,84,156,.12))!important;
          color:#86c9ff!important;
          font-size:10px!important;
          font-weight:800!important;
          line-height:1!important;
          letter-spacing:.01em!important;
          display:flex!important;
          align-items:center!important;
          justify-content:center!important;
          box-sizing:border-box!important;
        }
        .neoFoodSide .hsQtyButton201:active,
        .hsConsSide166 .hsQtyButton201:active{transform:scale(.97)!important;background:rgba(32,133,235,.26)!important}

        .hsConsSide166 .hsQtyButton201{
          width:100%!important;
          min-width:88px!important;
          height:34px!important;
          min-height:34px!important;
          margin-top:7px!important;
          padding:0 12px!important;
          border-radius:11px!important;
          border:1px solid rgba(42,151,255,.32)!important;
          background:linear-gradient(180deg,rgba(32,133,235,.18),rgba(15,84,156,.12))!important;
          color:#86c9ff!important;
          font-size:10px!important;
          font-weight:800!important;
          line-height:1!important;
          display:flex!important;
          align-items:center!important;
          justify-content:center!important;
          box-sizing:border-box!important;
        }

        @media(max-width:760px){
          .neoFoodSide .hsQtyButton201,.hsConsSide166 .hsQtyButton201{
            min-width:82px!important;
            height:36px!important;
            min-height:36px!important;
            font-size:10px!important;
            margin-top:6px!important;
          }
        }
      `;
      root.appendChild(style);
    }
  };
}
