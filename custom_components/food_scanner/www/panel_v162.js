import './panel_v161.js?v=1.6.14-base';

const HomeStockPanel = customElements.get('food-scanner-panel');

if (HomeStockPanel) {
  HomeStockPanel.prototype.foodFallbackVisual = function(item) {
    const text = `${item?.product_name || ''} ${item?.category || ''}`.toLocaleLowerCase('it-IT');
    if (/acqua|bevanda|bibita|succo/.test(text)) return '🥤';
    if (/uov/.test(text)) return '🥚';
    if (/latte/.test(text)) return '🥛';
    if (/yogurt/.test(text)) return '🥣';
    if (/pasta/.test(text)) return '🍝';
    if (/riso/.test(text)) return '🍚';
    if (/tonno|pesce|salmone/.test(text)) return '🐟';
    if (/carne|prosciutto|salume/.test(text)) return '🥩';
    if (/formaggio|mozzarella/.test(text)) return '🧀';
    if (/pane|cracker|biscott/.test(text)) return '🥖';
    if (/verdura|insalata/.test(text)) return '🥬';
    if (/frutta/.test(text)) return '🍎';
    if (/ketchup|maionese|salsa|condiment|aceto/.test(text)) return '🫙';
    if (/arachid|nocciol|mandorl|snack/.test(text)) return '🥜';
    if (/caff[eè]|colazione/.test(text)) return '☕';
    return '🛒';
  };

  HomeStockPanel.prototype.foodImageHtml = function(item) {
    const url = String(item?.product_image_url || '').trim();
    if (url) {
      const safe = this.esc(url);
      return `<span class="neoPhotoBackdrop" style="background-image:url('${safe}')"></span><img class="neoFoodImg" src="${safe}" alt="" loading="lazy">`;
    }
    return `<span class="neoFoodFallback">${this.foodFallbackVisual(item)}</span>`;
  };

  HomeStockPanel.prototype.foodMainCard = function(item) {
    const d = this.days(item.expiry_date);
    let expiry = 'Nessuna scadenza';
    let expiryClass = 'neutral';
    if (d !== null) {
      expiry = d < 0 ? `Scaduto da ${Math.abs(d)} ${Math.abs(d) === 1 ? 'giorno' : 'giorni'}` : d === 0 ? 'Scade oggi' : `Tra ${d} ${d === 1 ? 'giorno' : 'giorni'}`;
      expiryClass = d < 0 ? 'expired' : d <= 2 ? 'urgent' : d <= 7 ? 'warning' : 'ok';
    }
    const secondary = [item.brand, item.category].filter(Boolean).join(' · ') || 'Alimento';
    return `<article class="neoFoodRow neoFoodRow162" data-edit-food="${item.id}">
      <div class="neoThumb neoThumb162">${this.foodImageHtml(item)}</div>
      <div class="neoFoodInfo">
        <h3>${this.esc(item.product_name || 'Prodotto')}</h3>
        <p>${this.esc(secondary)}</p>
        <div class="neoMeta">${this.foodLocationBadge(item)}<span>${Number(item.stock_units || 0)} ${this.esc(this.unit(item.unit_name))}</span></div>
      </div>
      <div class="neoFoodSide"><span class="neoExpiry ${expiryClass}">${this.esc(expiry)}</span><small>${this.fmtDate(item.expiry_date)}</small><button data-food-qty="${item.id}" aria-label="Modifica quantità">›</button></div>
    </article>`;
  };

  const originalRender162 = HomeStockPanel.prototype.render;
  HomeStockPanel.prototype.render = function() {
    originalRender162.call(this);
    const root = this.shadowRoot;
    if (!root || root.querySelector('#homeStockMockupPolish1614')) return;

    const style = document.createElement('style');
    style.id = 'homeStockMockupPolish1614';
    style.textContent = `
      :host{--mockBlue:#0d8cff;--mockLine:rgba(133,174,222,.22);--mockPanel:#0e1722}
      .page{background:radial-gradient(circle at 55% -12%,#111d2d 0,#080d14 36%,#060a0f 100%)!important}
      .shell{max-width:980px!important}

      .neoFoodPage{padding-bottom:84px}
      .neoTopline{margin:13px 0 14px!important}.neoTopline h2{font-size:28px!important;letter-spacing:-.8px!important}.neoTopline .eyebrow{font-size:10px!important;letter-spacing:.19em!important;color:#75879f!important}
      .neoScan{min-height:46px!important;padding:0 18px!important;border-radius:17px!important;border:1px solid rgba(26,139,255,.5)!important;background:linear-gradient(180deg,rgba(24,137,255,.19),rgba(8,81,159,.12))!important;color:#9ed0ff!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.05),0 8px 24px rgba(0,0,0,.2)!important}

      .neoSearch{min-height:64px!important;margin:0 0 18px!important;border-radius:22px!important;border:1px solid rgba(130,166,210,.22)!important;background:linear-gradient(145deg,rgba(18,29,43,.95),rgba(11,18,27,.98))!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.025),0 10px 28px rgba(0,0,0,.14)!important;padding:0 18px!important;grid-template-columns:32px 1fr 34px!important}
      .neoSearch>span{font-size:26px!important;color:#9fb9da!important}.neoSearch input{font-size:16px!important;color:#eef5ff!important}.neoSearch input::placeholder{color:#8293a9!important}

      .neoMenuStack{gap:12px!important}.neoMenuCard{min-height:116px!important;border-radius:27px!important;padding:15px 20px!important;border:1px solid rgba(132,170,217,.22)!important;background:linear-gradient(145deg,rgba(18,29,43,.98),rgba(10,17,25,.98))!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.03),0 12px 34px rgba(0,0,0,.18)!important;grid-template-columns:78px 1fr auto 18px!important;gap:15px!important}
      .neoMenuCard.soon{background:radial-gradient(circle at 7% 50%,rgba(16,131,255,.12),transparent 31%),linear-gradient(145deg,#101b29,#0a111a)!important}
      .neoMenuCard.expired{background:radial-gradient(circle at 7% 50%,rgba(239,68,68,.11),transparent 31%),linear-gradient(145deg,#121924,#0a111a)!important}
      .neoMenuCard.low{background:radial-gradient(circle at 7% 50%,rgba(245,158,11,.10),transparent 31%),linear-gradient(145deg,#121924,#0a111a)!important}
      .neoMenuIcon{width:72px!important;height:72px!important;border-radius:25px!important;font-size:29px!important;box-shadow:inset 0 0 22px rgba(255,255,255,.025),0 8px 24px rgba(0,0,0,.18)!important}
      .neoMenuCard.soon .neoMenuIcon{background:radial-gradient(circle,#0d85ff 0,#0b4d8f 72%)!important;color:#bce2ff!important}
      .neoMenuCard.expired .neoMenuIcon{background:radial-gradient(circle,#b72e3d 0,#4a1c28 72%)!important;color:#ffb1b8!important}
      .neoMenuCard.low .neoMenuIcon{background:radial-gradient(circle,#ad7411 0,#473415 72%)!important;color:#ffd778!important}
      .neoMenuCard b{font-size:20px!important;letter-spacing:-.25px!important}.neoMenuCard small{font-size:12px!important;margin-top:5px!important;color:#8797ab!important}.neoMenuCard strong{min-width:48px!important;height:42px!important;padding:0 12px!important;border-radius:14px!important;display:grid!important;place-items:center!important;font-size:16px!important}.neoMenuCard strong i{display:none!important}.neoMenuCard em{font-size:31px!important;color:#a7bdd6!important;font-weight:300!important}

      .neoListTitle{margin:22px 2px 11px!important}.neoListTitle b{font-size:22px!important;letter-spacing:-.4px!important}.neoAZ{font-size:11px!important;line-height:.9!important;color:#21a0ff!important}.neoListTitle>span{font-size:13px!important;color:#239cff!important}
      .neoZoneChips{gap:8px!important;margin-bottom:12px!important}.neoZoneChips button{min-height:40px!important;padding:0 17px!important;border-radius:16px!important;background:#101823!important;border:1px solid rgba(133,168,210,.2)!important;color:#aebdd0!important;font-size:12px!important}.neoZoneChips button.active{background:linear-gradient(180deg,#2a96ff,#0b73df)!important;color:#fff!important;border-color:#42a7ff!important;box-shadow:0 6px 18px rgba(14,121,232,.25)!important}

      .neoFoodList{gap:10px!important}.neoFoodRow162{min-height:116px!important;padding:10px 13px!important;border-radius:23px!important;border:1px solid rgba(136,174,218,.22)!important;background:linear-gradient(145deg,rgba(17,28,41,.98),rgba(9,16,24,.98))!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.028),0 10px 28px rgba(0,0,0,.14)!important;grid-template-columns:94px minmax(0,1fr) auto!important;gap:14px!important}
      .neoThumb162{position:relative!important;width:94px!important;height:94px!important;border-radius:19px!important;overflow:hidden!important;background:linear-gradient(145deg,#172433,#0b121a)!important;border:1px solid rgba(153,188,227,.14)!important;isolation:isolate!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.04),0 8px 18px rgba(0,0,0,.18)!important}
      .neoPhotoBackdrop{position:absolute;inset:-12px;z-index:0;background-size:cover;background-position:center;filter:blur(14px) saturate(.9) brightness(.52);transform:scale(1.12);opacity:.9}
      .neoFoodImg{position:relative!important;z-index:1!important;width:100%!important;height:100%!important;object-fit:contain!important;padding:6px!important;box-sizing:border-box!important;filter:drop-shadow(0 8px 10px rgba(0,0,0,.28))!important}
      .neoFoodFallback{position:relative;z-index:1;width:100%;height:100%;display:grid!important;place-items:center;font-size:43px!important;background:radial-gradient(circle at 40% 35%,rgba(61,135,210,.18),rgba(255,255,255,.015) 65%)!important}
      .neoFoodInfo{min-width:0!important;align-self:center!important}.neoFoodInfo h3{font-size:17px!important;line-height:1.18!important;letter-spacing:-.2px!important;margin:0!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}.neoFoodInfo p{font-size:11px!important;color:#8c9caf!important;margin:5px 0 9px!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}.neoMeta{gap:9px!important}.neoMeta>span:not(.neoLocation){font-size:10px!important;color:#9aa9ba!important}.neoLocation{min-height:29px!important;padding:0 10px!important;border-radius:10px!important;font-size:10px!important;font-weight:700!important}.neoFoodSide{min-width:126px!important;align-self:center!important;grid-template-columns:1fr 28px!important}.neoExpiry{font-size:10px!important;padding:8px 10px!important;border-radius:12px!important;font-weight:700!important}.neoFoodSide small{font-size:9px!important;color:#8d9caf!important;margin-top:5px!important}.neoFoodSide button{width:28px!important;height:44px!important;font-size:29px!important;background:transparent!important;color:#b9cbe1!important;border:0!important}

      .neoSubPage .neoSubHead{margin-bottom:15px!important}.neoSubHead>button{width:52px!important;height:52px!important;border-radius:18px!important;background:#111c29!important;border:1px solid rgba(141,177,219,.18)!important;color:#c8d8ea!important;font-size:34px!important}.neoSubHead h2{font-size:27px!important}.neoSubHead p{font-size:12px!important;color:#8797aa!important}.neoRangeChips{gap:8px!important;margin:10px 0 16px!important}.neoRangeChips button{min-height:42px!important;border-radius:15px!important;padding:0 15px!important;font-size:11px!important}.neoRangeChips button.active{box-shadow:0 6px 18px rgba(19,126,236,.24)!important}
      .neoInfoFooter,.neoDangerFooter,.neoLowHero{border-radius:20px!important;border:1px solid rgba(133,171,216,.17)!important;background:linear-gradient(145deg,#111b28,#0a1119)!important}

      @media(max-width:760px){
        .neoFoodPage{padding-bottom:92px!important}.neoTopline{margin:8px 0 11px!important}.neoTopline h2{font-size:22px!important}.neoScan{min-height:42px!important;padding:0 14px!important;border-radius:15px!important;font-size:12px!important}
        .neoSearch{min-height:58px!important;border-radius:19px!important;margin-bottom:15px!important;padding:0 14px!important}.neoSearch input{font-size:15px!important}
        .neoMenuStack{gap:10px!important}.neoMenuCard{min-height:106px!important;border-radius:23px!important;padding:12px 14px!important;grid-template-columns:68px 1fr auto 16px!important;gap:12px!important}.neoMenuIcon{width:64px!important;height:64px!important;border-radius:22px!important;font-size:25px!important}.neoMenuCard b{font-size:18px!important}.neoMenuCard small{font-size:11px!important}.neoMenuCard strong{height:38px!important;min-width:42px!important;padding:0 10px!important;font-size:14px!important}.neoMenuCard em{font-size:28px!important}
        .neoListTitle{margin:18px 2px 10px!important}.neoListTitle b{font-size:19px!important}.neoListTitle>span{font-size:11px!important}.neoZoneChips{overflow-x:auto!important;flex-wrap:nowrap!important;padding-bottom:2px!important}.neoZoneChips button{flex:0 0 auto!important;min-height:38px!important;padding:0 15px!important}
        .neoFoodRow162{min-height:108px!important;padding:9px 11px!important;border-radius:20px!important;grid-template-columns:82px minmax(0,1fr) 108px!important;gap:11px!important}.neoThumb162{width:82px!important;height:82px!important;border-radius:17px!important}.neoFoodInfo h3{font-size:15px!important}.neoFoodInfo p{font-size:10px!important;margin:4px 0 7px!important}.neoMeta{gap:6px!important}.neoLocation{min-height:26px!important;padding:0 8px!important;font-size:9px!important}.neoMeta>span:not(.neoLocation){font-size:9px!important}.neoFoodSide{min-width:0!important;grid-template-columns:1fr 22px!important}.neoExpiry{font-size:9px!important;padding:7px 8px!important;white-space:nowrap!important}.neoFoodSide small{font-size:8px!important}.neoFoodSide button{width:22px!important;height:38px!important;font-size:25px!important}
        .neoFoodFallback{font-size:36px!important}
      }

      @media(max-width:390px){
        .neoFoodRow162{grid-template-columns:74px minmax(0,1fr) 94px!important}.neoThumb162{width:74px!important;height:74px!important}.neoFoodInfo h3{font-size:14px!important}.neoFoodSide{font-size:9px!important}.neoExpiry{padding:6px!important}
      }
    `;
    root.appendChild(style);
  };
}
