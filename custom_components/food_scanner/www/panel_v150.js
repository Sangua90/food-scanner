import './panel_v149.js?v=1.5.0-base';

const HomeStockPanel = customElements.get('food-scanner-panel');

if (HomeStockPanel) {
  const originalRender150 = HomeStockPanel.prototype.render;
  HomeStockPanel.prototype.render = function() {
    originalRender150.call(this);
    const root = this.shadowRoot;
    if (!root || root.querySelector('#homeStockResponsive150')) return;

    const style = document.createElement('style');
    style.id = 'homeStockResponsive150';
    style.textContent = `
      @media (max-width: 760px) {
        .page{padding:8px!important;padding-top:max(8px,env(safe-area-inset-top))!important}
        .shell{max-width:none!important}
        .hero{display:flex!important;align-items:center!important;min-height:42px!important;padding-right:52px!important}
        .hero h1{font-size:24px!important;line-height:1.1!important;margin:0!important}
        .hero p{display:none!important}

        .macro{position:sticky!important;top:0!important;z-index:30!important;grid-template-columns:1fr 1fr!important;gap:4px!important;margin:8px 0 10px!important;padding:4px!important;border:1px solid rgba(255,255,255,.07)!important;background:rgba(13,16,22,.94)!important;backdrop-filter:blur(14px)!important;-webkit-backdrop-filter:blur(14px)!important;border-radius:15px!important}
        .macro button{min-height:38px!important;padding:8px 10px!important;border:0!important;border-radius:11px!important;background:transparent!important;color:#b8c0ce!important;font-size:14px!important}
        .macro button.active{background:linear-gradient(180deg,#2389ff,#0d69dc)!important;color:#fff!important;outline:none!important;box-shadow:0 5px 14px rgba(18,113,232,.28)!important}
        .macro button b{font-weight:700!important}

        .zones{grid-template-columns:repeat(3,1fr)!important;gap:6px!important;margin:8px 0!important}
        .zones.five{grid-template-columns:repeat(2,1fr)!important}
        .zone{min-height:72px!important;padding:8px 6px!important;border-radius:14px!important}
        .zone b{font-size:22px!important;line-height:1!important;margin-bottom:5px!important}
        .zone span{font-size:12px!important}

        .expiryOverview{grid-template-columns:1fr!important;gap:7px!important;margin:8px 0!important}
        .expiryPanel{padding:11px!important;border-radius:16px!important}
        .expiryPanelTop{grid-template-columns:34px 1fr auto!important;gap:8px!important}
        .expiryIcon{width:34px!important;height:34px!important;border-radius:11px!important;font-size:16px!important}
        .expiryCopy strong{font-size:15px!important}.expiryCopy span{font-size:11px!important}
        .expiryCount{font-size:22px!important}
        .expiryChips{margin-top:8px!important;gap:5px!important}
        .expiryChip{padding:5px 8px!important;font-size:11px!important}
        .expiryChip:nth-child(n+4){display:none!important}

        .bigBanner{margin:8px 0!important;padding:11px!important;border-radius:16px!important}
        .bannerHead strong{font-size:15px!important}.bannerHead span{font-size:11px!important}.bannerHead>b{font-size:21px!important}
        .bannerItems{padding:8px 0 2px!important;gap:5px!important}
        .bannerItems .mini:nth-child(n+4){display:none!important}
        .mini{font-size:11px!important;padding:5px 7px!important}

        .tools{margin-top:8px!important;display:grid!important;grid-template-columns:1fr!important;gap:6px!important}
        .tools button{min-height:42px!important;padding:9px 11px!important;border-radius:13px!important;font-size:13px!important}

        .grid{grid-template-columns:1fr!important;gap:7px!important;margin-top:8px!important}
        .card{padding:11px!important;border-radius:15px!important}
        .card h3{font-size:15px!important;margin:0 88px 2px 0!important}
        .card p{font-size:11px!important;margin:6px 0!important}
        .tag{right:10px!important;top:10px!important;font-size:11px!important}
        .stock{font-size:13px!important;margin:9px 0!important}.stock b{font-size:25px!important}
        .card small{font-size:11px!important}
        .card small + span{margin-top:6px!important;padding:4px 7px!important;font-size:10px!important}
        .actions{margin-top:8px!important}.actions button{min-height:38px!important;padding:8px!important;border-radius:12px!important;font-size:12px!important}

        .scanModal{width:100%!important;max-height:94vh!important;padding:15px!important;border-radius:21px!important}
        .scanHead{grid-template-columns:42px 1fr!important;gap:9px!important;margin-bottom:12px!important;padding-right:34px!important}
        .scanIcon{width:42px!important;height:42px!important;border-radius:13px!important;font-size:21px!important}
        .scanHead h2{font-size:19px!important}.scanHead p{font-size:12px!important}
        .scanSectionLabel{font-size:10px!important;margin-bottom:6px!important}
        .scanLocations{gap:5px!important;margin-bottom:10px!important}.scanLocations .choice{min-height:40px!important;padding:8px 5px!important;font-size:12px!important}
        .scanPhotoButton{grid-template-columns:44px 1fr!important;padding:11px!important;border-radius:16px!important}.scanPhotoButton .cameraGlyph{width:42px!important;height:42px!important;border-radius:13px!important}.scanPhotoButton b{font-size:14px!important}.scanPhotoButton small{font-size:11px!important}
        .scanProgress,.scanSuccess{padding:11px!important;border-radius:15px!important}.scanHint{padding:11px!important;border-radius:15px!important}

        #homeStockExit{width:38px!important;height:38px!important;right:8px!important;top:max(8px,env(safe-area-inset-top))!important;font-size:25px!important}
      }

      @media (min-width: 761px) and (max-width: 1100px) {
        .page{padding:14px!important}
        .shell{max-width:980px!important}
        .hero h1{font-size:31px!important}
        .macro{margin:12px 0!important}
        .zones{gap:8px!important}
        .grid{grid-template-columns:repeat(2,1fr)!important;gap:10px!important}
        .expiryOverview{grid-template-columns:1fr 1fr!important;gap:10px!important}
        .expiryPanel{padding:14px!important}
        .tools{gap:7px!important}
        .card{padding:12px!important}
      }
    `;
    root.appendChild(style);
  };
}
