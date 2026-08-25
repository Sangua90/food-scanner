class FoodScannerPanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._hass = null;
    this._items = [];
    this._reviews = [];
    this._summary = {};
    this._stats = {};
    this._settings = {};
    this._tab = 'inventory';
    this._location = '';
    this._expiryFilter = '';
    this._consume = null;
    this._scan = null;
    this._error = '';
  }
  set hass(v) { const first = !this._hass; this._hass = v; if (first) this.load(); }
  set panel(v) { this._panel = v; }
  connectedCallback() { this.render(); }
  esc(v) { return String(v == null ? '' : v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;'); }
  loc(v) { return ({frigo:'Frigo', freezer:'Freezer', dispensa:'Dispensa'})[v] || 'Senza posizione'; }
  icon(v) { return ({frigo:'mdi:fridge-outline', freezer:'mdi:snowflake', dispensa:'mdi:cupboard-outline'})[v] || 'mdi:map-marker-outline'; }
  unit(v) { const s=String(v||'').toLowerCase(); if(s.indexOf('bott')>=0)return 'Bottiglie'; if(s.indexOf('latt')>=0||s.indexOf('scatol')>=0)return 'Lattine'; if(s.indexOf('vasett')>=0||s.indexOf('baratt')>=0)return 'Vasetti'; if(s.indexOf('confez')>=0||s.indexOf('pacc')>=0)return 'Confezioni'; return 'Pezzi'; }
  fmtDate(v) { if(!v)return '—'; const p=String(v).split('-'); return p.length===3 ? p[2]+'/'+p[1]+'/'+p[0] : String(v); }
  days(v) { if(!v)return null; const d=new Date(String(v)+'T12:00:00'); if(Number.isNaN(d.getTime()))return null; const n=new Date(); const t=new Date(n.getFullYear(),n.getMonth(),n.getDate(),12); return Math.round((d.getTime()-t.getTime())/86400000); }
  expiry(v) { const d=this.days(v); if(d===null)return ['Nessuna scadenza','neutral']; if(d<0)return ['Scaduto da '+Math.abs(d)+' g','danger']; if(d===0)return ['Scade oggi','danger']; if(d===1)return ['Scade domani','warning']; if(d<=3)return ['Tra '+d+' giorni','warning']; if(d<=7)return ['Tra '+d+' giorni','soon']; return ['Tra '+d+' giorni','ok']; }
  async load() {
    if(!this._hass)return;
    try {
      const d=await this._hass.callApi('GET','food_scanner/archive?sort=expiry');
      this._items=d.items||[]; this._reviews=d.reviews||[]; this._summary=d.summary||{}; this._stats=d.statistics||{}; this._settings=d.settings||{}; this._error='';
    } catch(e) { this._error=e && e.message ? e.message : String(e); }
    this.render();
  }
  visible() {
    return this._items.filter((x)=>{
      if(this._location && x.location!==this._location)return false;
      if(this._expiryFilter){const d=this.days(x.expiry_date); if(d===null)return false; if(this._expiryFilter==='expired'&&!(d<0))return false; if(this._expiryFilter==='today'&&d!==0)return false; if(this._expiryFilter==='3'&&!(d>=0&&d<=3))return false; if(this._expiryFilter==='7'&&!(d>=0&&d<=7))return false;}
      return true;
    });
  }
  counts() { const r={expired:0,today:0,d3:0,d7:0}; this._items.forEach((x)=>{const d=this.days(x.expiry_date),u=Number(x.stock_units||1); if(d===null)return; if(d<0)r.expired+=u; if(d===0)r.today+=u; if(d>=0&&d<=3)r.d3+=u; if(d>=0&&d<=7)r.d7+=u;}); return r; }
  async post(p) { const r=await this._hass.callApi('POST','food_scanner/archive',p); await this.load(); return r; }
  openConsume(i) { this._consume={item:i,amount:1}; this.render(); }
  async consumeNow() { const m=this._consume;if(!m)return;const max=Number(m.item.stock_units||1);if(m.amount===max&&!confirm('Stai per terminare completamente '+(m.item.product_name||'questo prodotto')+'. Confermi?'))return;try{await this.post({action:'consume',id:m.item.id,amount:m.amount});this._consume=null;this.render();}catch(e){alert(e.message||e);} }
  async removeAll(i) { const n=Number(i.stock_units||1); if(!confirm('Rimuovere tutta la scorta di “'+(i.product_name||'Prodotto')+'”?\n\nVerranno tolte '+n+' '+this.unit(i.unit_name)+'.'))return; if(!confirm('Conferma finale: rimuovere davvero tutto il lotto?'))return; try{await this._hass.callApi('DELETE','food_scanner/archive?id='+encodeURIComponent(i.id));await this.load();}catch(e){alert(e.message||e);} }
  async discardReview(r) { if(!confirm('Eliminare questa richiesta di verifica?'))return; try{await this.post({action:'discard_review',id:r.id});}catch(e){alert(e.message||e);} }
  openScan() { this._scan={location:this._location||'',reviewId:null,status:'idle',message:'Scegli la posizione e scatta la foto.'}; this.render(); }
  async scanFile(file) {
    if(!file||!this._scan||!this._scan.location)return;
    this._scan.status='loading';this._scan.message='Analisi in corso…';this.render();
    try {
      const data=await new Promise((ok,no)=>{const r=new FileReader();r.onload=()=>ok(String(r.result).split(',',2)[1]||'');r.onerror=no;r.readAsDataURL(file);});
      let mime=file.type||'image/jpeg'; const name=String(file.name||'').toLowerCase(); if(!file.type&&name.endsWith('.heic'))mime='image/heic'; if(!file.type&&name.endsWith('.heif'))mime='image/heif';
      const out=await this._hass.callApi('POST','food_scanner/dashboard_scan',{location:this._scan.location,mime_type:mime,image_data:data,review_id:this._scan.reviewId||null});
      if(out.status==='archived'){this._scan.status='success';this._scan.reviewId=null;this._scan.message='✓ '+(out.product_name||'Prodotto')+' aggiunto in '+this.loc(this._scan.location)+'.';await this.load();}
      else{this._scan.status='review';this._scan.reviewId=out.review_id;this._scan.message=out.photo_request||'Serve un’altra foto dello stesso prodotto.';await this.load();}
    } catch(e){this._scan.status='error';this._scan.message=e.message||String(e);this.render();}
  }
  async cancelScan() { if(this._scan&&this._scan.reviewId){if(!confirm('Annullare la scansione ed eliminare la verifica?'))return;try{await this._hass.callApi('POST','food_scanner/archive',{action:'discard_review',id:this._scan.reviewId});}catch(e){}} this._scan=null;await this.load(); }
  renderInventory() {
    const c=this.counts(); const z=[['','Tutto','mdi:home-variant-outline',this._summary.total_units||0],['frigo','Frigo',this.icon('frigo'),this._summary.frigo||0],['freezer','Freezer',this.icon('freezer'),this._summary.freezer||0],['dispensa','Dispensa',this.icon('dispensa'),this._summary.dispensa||0]];
    const zones='<div class="zones">'+z.map((a)=>'<button data-zone="'+a[0]+'" class="zone '+a[0]+' '+(this._location===a[0]?'active':'')+'"><ha-icon icon="'+a[2]+'"></ha-icon><b>'+a[3]+'</b><span>'+a[1]+'</span></button>').join('')+'</div>';
    const exp='<div class="expboxes"><button data-exp="expired"><b>'+c.expired+'</b><span>Scaduti</span></button><button data-exp="today"><b>'+c.today+'</b><span>Oggi</span></button><button data-exp="3"><b>'+c.d3+'</b><span>Entro 3 giorni</span></button><button data-exp="7"><b>'+c.d7+'</b><span>Entro 7 giorni</span></button></div>';
    const tools='<div class="tools"><button id="scan" class="primary"><ha-icon icon="mdi:camera-outline"></ha-icon> Scansiona</button></div>';
    const cards=this.visible().map((i)=>{const e=this.expiry(i.expiry_date);return '<article class="card '+this.esc(i.location||'')+'"><div class="stripe"></div><div class="top"><div><h3>'+this.esc(i.product_name||'Prodotto')+'</h3><p>'+this.esc([i.brand,i.quantity,i.category].filter(Boolean).join(' · '))+'</p></div><span class="loc"><ha-icon icon="'+this.icon(i.location)+'"></ha-icon>'+this.loc(i.location)+'</span></div><div class="body"><div class="stock"><b>'+Number(i.stock_units||1)+'</b><small>'+this.unit(i.unit_name)+'</small></div><div class="details"><span>'+this.fmtDate(i.expiry_date)+'</span><span class="expiry '+e[1]+'">'+e[0]+'</span></div></div><div class="actions"><button class="primary" data-consume="'+i.id+'">Consuma</button><button class="danger" data-remove="'+i.id+'">Rimuovi tutto</button></div></article>';}).join('');
    return zones+exp+tools+'<div class="grid">'+(cards||'<div class="empty">Nessun prodotto con questi filtri</div>')+'</div>';
  }
  renderReviews() { if(!this._reviews.length)return '<div class="empty ok">✓ Tutto verificato</div>'; return '<div class="grid">'+this._reviews.map((r)=>{const f=r.food||{};return '<article class="card review"><button class="x" data-discard="'+r.id+'">×</button><h3>'+this.esc(f.product_name||'Prodotto non identificato')+'</h3><p>'+this.esc(f.photo_request||'Serve una foto più chiara')+'</p><small>'+this.loc(r.location)+' · confidenza '+Number(f.confidence||0)+'%</small></article>';}).join('')+'</div>'; }
  renderStats() { const s=this._stats||{}; return '<div class="stats"><div><b>'+Number(s.consumed_units||0)+'</b><span>unità consumate</span></div><div><b>'+Number(s.expired_units||0)+'</b><span>unità scadute eliminate</span></div></div>'; }
  renderSettings() { return '<div class="section"><h2>Impostazioni</h2><p>Le scansioni riuscite non generano notifiche. Restano gli avvisi per scadenze e verifiche.</p></div>'; }
  consumeDialog() { if(!this._consume)return ''; const m=this._consume,max=Number(m.item.stock_units||1); return '<div class="overlay"><div class="modal"><h2>Consuma '+this.esc(m.item.product_name||'prodotto')+'</h2><p>Disponibili: '+max+' '+this.unit(m.item.unit_name)+'</p><div class="step"><button id="minus">−</button><b>'+m.amount+'</b><button id="plus">+</button></div><div class="modalActions"><button id="consumeCancel">Annulla</button><button id="consumeOk" class="primary">Consuma '+m.amount+'</button></div></div></div>'; }
  scanDialog() { if(!this._scan)return ''; const s=this._scan; return '<div class="overlay"><div class="modal"><button id="scanClose" class="xclose">×</button><h2>Scansiona prodotto</h2><p>'+this.esc(s.message)+'</p><div class="scanZones">'+['frigo','freezer','dispensa'].map((k)=>'<button data-szone="'+k+'" class="'+(s.location===k?'active':'')+'"><ha-icon icon="'+this.icon(k)+'"></ha-icon>'+this.loc(k)+'</button>').join('')+'</div><input id="scanFile" type="file" accept="image/*,.heic,.heif" capture="environment" hidden>'+(s.status==='loading'?'<div class="notice">Analisi Gemini in corso…</div>':'')+(s.status==='review'?'<div class="warn">'+this.esc(s.message)+'</div>':'')+(s.status==='success'?'<div class="success">'+this.esc(s.message)+'</div>':'')+'<div class="modalActions">'+((s.status==='idle'||s.status==='review'||s.status==='error')?'<button id="takePhoto" class="primary" '+(!s.location?'disabled':'')+'>'+(s.status==='review'?'Rifai foto':'Scatta foto')+'</button>':'')+(s.status==='review'?'<button id="cancelScan" class="danger">Annulla scansione</button>':'')+(s.status==='success'?'<button id="nextScan" class="primary">Scansiona prossimo</button><button id="doneScan">Fine</button>':'')+'</div></div></div>'; }
  render() {
    if(!this.shadowRoot)return;
    let body=this._tab==='review'?this.renderReviews():this._tab==='stats'?this.renderStats():this._tab==='settings'?this.renderSettings():this.renderInventory();
    this.shadowRoot.innerHTML='<style>:host{display:block;min-height:100%;color:#f7f9ff;font-family:-apple-system,BlinkMacSystemFont,"SF Pro Display","Segoe UI",sans-serif;--border:rgba(255,255,255,.09);--muted:rgba(235,239,255,.6)}*{box-sizing:border-box}button{font:inherit;cursor:pointer}.page{min-height:100vh;padding:20px;background:radial-gradient(circle at 10% 0,rgba(93,69,255,.2),transparent 30%),radial-gradient(circle at 90% 8%,rgba(55,185,255,.15),transparent 28%),#08090d}.shell{max-width:1300px;margin:auto}.hero{display:flex;justify-content:space-between;align-items:center}.hero h1{font-size:40px;margin:0}.hero p{color:var(--muted)}.summary,.zones,.expboxes{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:12px 0}.summary{grid-template-columns:repeat(3,1fr)}.sum,.zone,.expboxes button,.card,.section,.stats>div{background:linear-gradient(145deg,rgba(255,255,255,.075),rgba(255,255,255,.025));border:1px solid var(--border);border-radius:24px;color:white;padding:16px}.sum b,.zone b,.expboxes b,.stats b{font-size:28px;display:block}.sum span,.zone span,.expboxes span,.stats span{font-size:12px;color:var(--muted)}.zone.active{outline:2px solid rgba(120,212,255,.45)}.zone.frigo{box-shadow:inset 4px 0 #4db6ff}.zone.freezer{box-shadow:inset 4px 0 #62e7ff}.zone.dispensa{box-shadow:inset 4px 0 #aa89ff}.tabs{display:flex;gap:6px;margin:14px 0}.tabs button,.tools button,.actions button,.modalActions button,.scanZones button{border:1px solid var(--border);background:rgba(255,255,255,.07);color:white;border-radius:14px;padding:10px 14px}.tabs .active,.primary{background:linear-gradient(135deg,#b9eaff,#78caff)!important;color:#071019!important;font-weight:700}.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-top:12px}.card{position:relative;overflow:hidden}.stripe{position:absolute;left:0;top:0;bottom:0;width:5px;background:#888}.card.frigo .stripe{background:#4db6ff}.card.freezer .stripe{background:#62e7ff}.card.dispensa .stripe{background:#aa89ff}.top{display:flex;justify-content:space-between;gap:10px}.top h3{margin:0}.top p{color:var(--muted);font-size:12px}.loc{font-size:12px;display:flex;gap:4px;align-items:center}.body{display:flex;gap:15px;align-items:center;margin:15px 0}.stock{min-width:90px;text-align:center;background:rgba(255,255,255,.05);border-radius:18px;padding:10px}.stock b{font-size:34px;display:block}.stock small{color:var(--muted)}.details{display:grid;gap:6px}.expiry{font-size:11px;padding:4px 8px;border-radius:20px;width:max-content}.danger{color:#ffbbc2!important;background:rgba(255,112,128,.1)!important}.actions{display:flex;gap:8px}.actions button{flex:1}.review .x,.xclose{position:absolute;right:12px;top:12px;width:34px;height:34px;border-radius:50%;border:1px solid rgba(255,112,128,.25);background:rgba(255,112,128,.1);color:#ffbbc2;font-size:20px}.empty{padding:45px;text-align:center;border:1px dashed var(--border);border-radius:24px;color:var(--muted)}.ok{color:#64e7a6}.stats{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}.overlay{position:fixed;inset:0;background:rgba(0,0,0,.72);display:grid;place-items:center;padding:14px;z-index:1000}.modal{position:relative;width:min(560px,100%);background:#12151e;border:1px solid var(--border);border-radius:28px;padding:22px}.step{display:grid;grid-template-columns:70px 1fr 70px;gap:10px;align-items:center;margin:18px 0}.step button{height:55px;border-radius:16px;border:1px solid var(--border);background:rgba(255,255,255,.07);color:white;font-size:26px}.step b{text-align:center;font-size:34px}.modalActions{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap}.scanZones{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:16px 0}.scanZones .active{outline:2px solid rgba(120,212,255,.45)}.notice,.warn,.success{padding:12px;border-radius:14px;margin:12px 0}.warn{background:rgba(255,180,94,.1)}.success{background:rgba(100,231,166,.1)}@media(max-width:760px){.page{padding:12px 9px}.hero h1{font-size:31px}.summary,.zones,.expboxes{grid-template-columns:repeat(2,1fr)}.grid{grid-template-columns:1fr}.tabs{display:grid;grid-template-columns:repeat(4,1fr)}.tabs button{font-size:11px;padding:9px 4px}.scanZones{grid-template-columns:1fr}}</style><div class="page"><div class="shell"><div class="hero"><div><h1>Food Scanner</h1><p>Magazzino alimentare intelligente</p></div><button id="refresh">↻</button></div><div class="summary"><div class="sum"><b>'+Number(this._summary.total_units||0)+'</b><span>Unità in casa</span></div><div class="sum"><b>'+Number(this._summary.lots||0)+'</b><span>Lotti distinti</span></div><div class="sum"><b>'+this._reviews.length+'</b><span>Da verificare</span></div></div><nav class="tabs"><button data-tab="inventory" class="'+(this._tab==='inventory'?'active':'')+'">Magazzino</button><button data-tab="review" class="'+(this._tab==='review'?'active':'')+'">Da verificare</button><button data-tab="stats" class="'+(this._tab==='stats'?'active':'')+'">Statistiche</button><button data-tab="settings" class="'+(this._tab==='settings'?'active':'')+'">Impostazioni</button></nav>'+(this._error?'<div class="warn">'+this.esc(this._error)+'</div>':'')+body+'</div></div>'+this.consumeDialog()+this.scanDialog();
    this.bind();
  }
  bind() {
    const r=this.shadowRoot;
    r.querySelector('#refresh')?.addEventListener('click',()=>this.load());
    r.querySelectorAll('[data-tab]').forEach((b)=>b.onclick=()=>{this._tab=b.dataset.tab;this.render();});
    r.querySelectorAll('[data-zone]').forEach((b)=>b.onclick=()=>{this._location=b.dataset.zone||'';this.render();});
    r.querySelectorAll('[data-exp]').forEach((b)=>b.onclick=()=>{this._expiryFilter=this._expiryFilter===b.dataset.exp?'':b.dataset.exp;this.render();});
    r.querySelector('#scan')?.addEventListener('click',()=>this.openScan());
    r.querySelectorAll('[data-consume]').forEach((b)=>b.onclick=()=>{const i=this._items.find((x)=>x.id===b.dataset.consume);if(i)this.openConsume(i);});
    r.querySelectorAll('[data-remove]').forEach((b)=>b.onclick=()=>{const i=this._items.find((x)=>x.id===b.dataset.remove);if(i)this.removeAll(i);});
    r.querySelectorAll('[data-discard]').forEach((b)=>b.onclick=()=>{const q=this._reviews.find((x)=>x.id===b.dataset.discard);if(q)this.discardReview(q);});
    if(this._consume){r.querySelector('#minus').onclick=()=>{this._consume.amount=Math.max(1,this._consume.amount-1);this.render();};r.querySelector('#plus').onclick=()=>{this._consume.amount=Math.min(Number(this._consume.item.stock_units||1),this._consume.amount+1);this.render();};r.querySelector('#consumeCancel').onclick=()=>{this._consume=null;this.render();};r.querySelector('#consumeOk').onclick=()=>this.consumeNow();}
    if(this._scan){r.querySelectorAll('[data-szone]').forEach((b)=>b.onclick=()=>{this._scan.location=b.dataset.szone;this.render();});r.querySelector('#takePhoto')?.addEventListener('click',()=>r.querySelector('#scanFile')?.click());const f=r.querySelector('#scanFile');if(f)f.onchange=()=>{if(f.files&&f.files[0])this.scanFile(f.files[0]);};r.querySelector('#scanClose')?.addEventListener('click',()=>{if(this._scan.status==='review')alert('Questo prodotto richiede ancora una verifica. Completa la foto oppure annulla la scansione.');else{this._scan=null;this.render();}});r.querySelector('#cancelScan')?.addEventListener('click',()=>this.cancelScan());r.querySelector('#nextScan')?.addEventListener('click',()=>{this._scan.reviewId=null;this._scan.status='idle';this._scan.message='Pronto per il prossimo prodotto in '+this.loc(this._scan.location)+'.';this.render();});r.querySelector('#doneScan')?.addEventListener('click',()=>{this._scan=null;this.render();});}
  }
}
if (!customElements.get('food-scanner-panel')) customElements.define('food-scanner-panel', FoodScannerPanel);
