// Visual and interaction audit for the complete active HomeStock panel chain.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const {chromium} = require('playwright');

const webRoot = path.resolve(__dirname, '../custom_components/food_scanner/www');
const output = path.join(os.tmpdir(), 'homestock-ui-audit');
fs.mkdirSync(output, {recursive: true});

const food = [
  {id:'f1',product_name:'Yogurt greco bianco',generic_name:'Yogurt',brand:'Fattorie Alpine',quantity:'4 × 125 g',category:'Latticini',location:'frigo',stock_units:4,unit_name:'Pezzi',expiry_date:'2026-09-22'},
  {id:'f2',product_name:'Pizza Margherita surgelata formato famiglia',generic_name:'Pizza',brand:'Forno Italiano',quantity:'850 g',category:'Surgelati',location:'freezer',stock_units:2,unit_name:'Confezioni',expiry_date:'2026-12-18'},
  {id:'f3',product_name:'Tonno al naturale',generic_name:'Tonno',brand:'Migros',quantity:'3 × 80 g',category:'Dispensa',location:'dispensa',stock_units:6,unit_name:'Lattine',expiry_date:'2028-01-01'},
  {id:'f4',product_name:'Latte intero',generic_name:'Latte',brand:'Centrale',quantity:'1 L',category:'Latticini',location:'frigo',stock_units:1,unit_name:'Bottiglie',expiry_date:'2026-09-25'},
];
const consumables = [
  {id:'c1',product_name:'Carta cucina super assorbente',generic_name:'Carta cucina',brand:'Regina',quantity:'4 rotoli',category:'Casa',location:'cucina',stock_units:2,unit_name:'Confezioni',min_stock:2,store:'Coop'},
  {id:'c2',product_name:'Sapone mani delicato',generic_name:'Sapone mani',brand:'Dove',quantity:'250 ml',category:'Igiene',location:'bagno',stock_units:3,unit_name:'Bottiglie',min_stock:1,store:'Esselunga'},
  {id:'c3',product_name:'Detersivo lavatrice',generic_name:'Detersivo',brand:'Dash',quantity:'30 lavaggi',category:'Lavanderia',location:'lavanderia',stock_units:1,unit_name:'Confezioni',min_stock:1,store:'Coop'},
  {id:'c4',product_name:'Lampadine LED luce calda E27',generic_name:'Lampadine',brand:'Philips',quantity:'4 pezzi',category:'Casa',location:'magazzino',stock_units:4,unit_name:'Pezzi',min_stock:1,store:'IKEA'},
];

function apiScript() {
  return `
    customElements.define('ha-icon', class extends HTMLElement {});
    window.apiCalls=[];
    window.food=${JSON.stringify(food)};
    window.consumables=${JSON.stringify(consumables)};
    window.hass={callApi:async(method,url,data)=>{
      apiCalls.push({method,url,data});
      if(method==='GET'&&url.startsWith('food_scanner/archive')) return {items:food,reviews:[],summary:{},statistics:{},settings:{}};
      if(method==='GET'&&url==='food_scanner/consumables') return {items:consumables,summary:{products:4,units:10,low_stock:2},history:[]};
      if(method==='GET'&&url==='food_scanner/shopping') return {items:[]};
      if(url==='food_scanner/voice_consume'&&data?.action==='preview') return {operations:[{spoken_name:'pizza',status:'matched',id:'f2',product_name:'Pizza Margherita',amount:1,available:2}],can_confirm:true};
      if(url==='food_scanner/voice_consume'&&data?.action==='apply') return {results:[{product_name:'Pizza Margherita',amount:1}],skipped:[]};
      if(method==='POST') return {success:true,item:{id:data?.id},items:[]};
      return {};
    }};
  `;
}

async function audit(page, label) {
  const result = await page.locator('food-scanner-panel').evaluate((host) => {
    const root=host.shadowRoot;
    const viewport={width:innerWidth,height:innerHeight};
    const visible=el=>{const s=getComputedStyle(el),r=el.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&r.height>0;};
    const offenders=[...root.querySelectorAll('*')].filter(visible).map(el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return {tag:el.tagName,id:el.id,cls:String(el.className||'').slice(0,90),left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height,scrollWidth:el.scrollWidth,clientWidth:el.clientWidth,scrollable:s.overflowX==='auto'||s.overflowX==='scroll',ellipsis:s.overflow==='hidden'&&s.textOverflow==='ellipsis'};}).filter(x=>x.left<-.5||x.right>viewport.width+.5||(x.scrollWidth>x.clientWidth+2&&!x.scrollable&&!x.ellipsis));
    const tiny=[...root.querySelectorAll('button')].filter(visible).map(el=>{const r=el.getBoundingClientRect();return {text:(el.textContent||'').trim().replace(/\s+/g,' ').slice(0,60),id:el.id,width:r.width,height:r.height};}).filter(x=>x.width<38||x.height<38);
    const unnamed=[...root.querySelectorAll('button,input,select,textarea')].filter(visible).filter(el=>{
      if(el.matches('input[type=file]'))return false;
      const label=el.closest('label')?.textContent||el.getAttribute('aria-label')||el.getAttribute('title')||el.textContent||el.getAttribute('placeholder');
      return !String(label||'').trim();
    }).map(el=>({tag:el.tagName,id:el.id,cls:el.className}));
    return {viewport,offenders,tiny,unnamed,bodyWidth:root.querySelector('.page')?.scrollWidth,docWidth:document.documentElement.scrollWidth};
  });
  console.log(label, JSON.stringify(result));
  return result;
}

(async()=>{
  const server=http.createServer((req,res)=>{
    const pathname=new URL(req.url,'http://localhost').pathname;
    if(pathname==='/'){
      res.setHeader('Content-Type','text/html');
      res.end(`<style>html,body{margin:0;background:#080b11}</style><script>${apiScript()}</script><script type="module">import '/food_scanner_static/panel_boot.js'; await customElements.whenDefined('food-scanner-panel'); window.panel=document.createElement('food-scanner-panel'); document.body.append(panel); panel.hass=hass;</script>`);
      return;
    }
    const file=path.join(webRoot,path.basename(pathname));
    if(!fs.existsSync(file)){res.writeHead(404);res.end();return;}
    res.setHeader('Content-Type','text/javascript');res.end(fs.readFileSync(file));
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  let browser;
  try{
    browser=await chromium.launch({headless:true,...(process.env.BROWSER_CHANNEL?{channel:process.env.BROWSER_CHANNEL}:{})});
    for(const vp of [{name:'desktop',width:1440,height:1000},{name:'tablet',width:768,height:1024},{name:'iphone',width:390,height:844}]){
      const page=await browser.newPage({viewport:{width:vp.width,height:vp.height},deviceScaleFactor:1});
      const errors=[];page.on('pageerror',e=>errors.push(e.message));
      await page.goto(`http://127.0.0.1:${server.address().port}`);
      await page.waitForFunction(()=>window.panel?._items?.length===4&&window.panel?._cons?.length===4);
      await page.screenshot({path:path.join(output,`${vp.name}-food.png`),fullPage:true});
      const foodAudit=await audit(page,`${vp.name}-food`);
      await page.locator('food-scanner-panel').locator('#hsNavCons175').click();
      await page.screenshot({path:path.join(output,`${vp.name}-cons.png`),fullPage:true});
      const consAudit=await audit(page,`${vp.name}-cons`);
      await page.locator('food-scanner-panel').locator('#hsNavPlus175').click();
      await page.locator('food-scanner-panel').locator('#hsQuickManual').click();
      await page.screenshot({path:path.join(output,`${vp.name}-manual.png`),fullPage:true});
      const modalAudit=await audit(page,`${vp.name}-manual`);
      await page.locator('food-scanner-panel').locator('#manualX').click();
      await page.locator('food-scanner-panel').locator('#hsNavLists175').click();
      await page.locator('food-scanner-panel').locator('.hsListsPage175').waitFor();
      const listsAudit=await audit(page,`${vp.name}-lists`);
      await page.locator('food-scanner-panel').locator('#hsNavSettings175').click();
      await page.locator('food-scanner-panel').locator('.hsSettings165').waitFor();
      const settingsAudit=await audit(page,`${vp.name}-settings`);
      await page.locator('food-scanner-panel').locator('#homeStockExit').click();
      await page.waitForFunction(() => window.panel?._mode === 'food' && !window.panel?._hsSettingsPage);
      assert.equal(await page.locator('food-scanner-panel').locator('.neoFoodPage').count(), 1);
      assert.deepEqual(errors,[]);
      assert.equal(await page.locator('food-scanner-panel').evaluate(host=>host.__homestock_frontend_build),'2.0.18');
      if(foodAudit.offenders.length||consAudit.offenders.length||modalAudit.offenders.length||listsAudit.offenders.length||settingsAudit.offenders.length) console.log('OVERFLOW DETECTED',vp.name);
      await page.close();
    }
    console.log('Screenshots:',output);
  }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);process.exitCode=1});
