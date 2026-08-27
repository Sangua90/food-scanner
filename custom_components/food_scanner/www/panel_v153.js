import './panel_v152.js?v=1.5.3-base';

const HomeStockPanel = customElements.get('food-scanner-panel');

if (HomeStockPanel) {
  const originalRender153 = HomeStockPanel.prototype.render;
  HomeStockPanel.prototype.render = function() {
    originalRender153.call(this);
    const root = this.shadowRoot;
    if (!root || root.querySelector('#homeStockPolish153')) return;

    const style = document.createElement('style');
    style.id = 'homeStockPolish153';
    style.textContent = `
      .macro{
        max-width:520px!important;
        margin:14px auto 18px!important;
        padding:5px!important;
        border-radius:18px!important;
        background:linear-gradient(180deg,rgba(22,26,35,.96),rgba(12,15,21,.96))!important;
        border:1px solid rgba(255,255,255,.08)!important;
        box-shadow:0 10px 28px rgba(0,0,0,.18),inset 0 1px 0 rgba(255,255,255,.03)!important;
      }
      .macro button{
        min-height:44px!important;
        border-radius:14px!important;
        font-size:15px!important;
        font-weight:750!important;
        letter-spacing:-.1px!important;
      }
      .macro button.active{
        background:linear-gradient(180deg,rgba(44,142,255,.96),rgba(20,103,216,.96))!important;
        box-shadow:0 5px 14px rgba(25,110,226,.22),inset 0 1px 0 rgba(255,255,255,.16)!important;
      }

      @media(max-width:760px){
        .page{padding:10px!important}
        .hero{min-height:44px!important}
        .hero h1{font-size:25px!important;line-height:1.15!important}

        .macro{
          position:sticky!important;
          top:6px!important;
          z-index:40!important;
          width:100%!important;
          max-width:none!important;
          margin:8px 0 12px!important;
          padding:5px!important;
          border-radius:17px!important;
          background:rgba(14,17,24,.96)!important;
          backdrop-filter:blur(16px)!important;
          -webkit-backdrop-filter:blur(16px)!important;
        }
        .macro button{
          min-height:42px!important;
          padding:9px 10px!important;
          font-size:15px!important;
          border-radius:12px!important;
        }

        .hsSectionHead{margin:10px 0 9px!important}
        .hsSectionHead h2{font-size:20px!important;line-height:1.15!important}
        .eyebrow{font-size:10px!important;letter-spacing:.14em!important}
        .hsScan{font-size:13px!important;padding:9px 11px!important}
        .hsManual{width:40px!important;font-size:19px!important}

        .hsZone{min-height:74px!important;padding:9px!important}
        .hsZoneIcon{font-size:15px!important;margin-bottom:5px!important}
        .hsZone b{font-size:22px!important}
        .hsZone small{font-size:12px!important;margin-top:4px!important}

        .hsAlert,.hsLow{padding:10px!important;gap:8px!important}
        .hsAlertIcon{width:30px!important;height:30px!important;font-size:13px!important}
        .hsAlert b,.hsLow b{font-size:13px!important}
        .hsAlert small,.hsLow small{font-size:11px!important;line-height:1.25!important}
        .hsAlert strong,.hsLow strong{font-size:19px!important}

        .hsListHead{margin:13px 2px 7px!important}
        .hsListHead b{font-size:15px!important}
        .hsListHead span{font-size:12px!important;padding:4px 8px!important}

        .hsProducts{gap:7px!important}
        .hsProduct{padding:11px 12px!important;border-radius:15px!important}
        .hsProduct h3{font-size:16px!important;line-height:1.2!important}
        .hsProduct p{font-size:12px!important;line-height:1.3!important;margin-top:4px!important}
        .hsLocation{font-size:11px!important;padding:5px 7px!important}
        .hsProductFoot{grid-template-columns:62px minmax(0,1fr) auto!important;gap:7px!important;margin-top:10px!important}
        .hsStock b{font-size:23px!important}
        .hsStock span{font-size:9px!important}
        .hsExpiry small,.hsThreshold small{font-size:11px!important;line-height:1.2!important}
        .hsQty{padding:8px 9px!important;font-size:11px!important;line-height:1.15!important}

        .scanHead h2{font-size:21px!important}
        .scanHead p{font-size:13px!important}
        .scanSectionLabel{font-size:11px!important}
        .scanLocations .choice{font-size:13px!important}
        .scanPhotoButton b{font-size:15px!important}
        .scanPhotoButton small{font-size:12px!important}
        .scanProgress b,.scanSuccess b,.scanHint b{font-size:14px!important}
        .scanProgress small,.scanSuccess small,.scanHint span,.scanHint small{font-size:12px!important}
      }
    `;
    root.appendChild(style);
  };
}
