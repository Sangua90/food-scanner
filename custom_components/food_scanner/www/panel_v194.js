import './panel_v193.js?v=1.6.49-base';
const P=customElements.get('food-scanner-panel');
if(P){
  const prevVoiceHtml=P.prototype.voiceHtml;
  const prevVoiceDecorate=P.prototype.voiceDecorate;

  P.prototype.voiceOpen=function(kind){
    const resolved=kind || (this._mode==='cons'?'cons':'food');
    this._voice={status:'input',text:'',ops:[],kind:resolved};
    this.render();
  };

  P.prototype.voiceHtml=function(){
    let html=prevVoiceHtml.call(this);
    const kind=this._voice?.kind||'food';
    if(kind==='cons'){
      html=html
        .replace('Consuma alimenti','Consuma consumabili')
        .replace('Una pizza e due scatolette di tonno Migros','Due rotoli di carta cucina e un sapone mani Dove')
        .replace('alimenti presenti','consumabili presenti');
    }
    return html;
  };

  P.prototype.voiceAnalyze=async function(){
    const r=this.shadowRoot,s=this._voice;
    if(!r||!s)return;
    const text=(r.querySelector('#voiceText')?.value||'').trim();
    if(!text){alert('Detta prima cosa hai utilizzato.');return;}
    s.text=text;s.status='loading';this.render();
    try{
      const out=await this._hass.callApi('POST','food_scanner/voice_consume',{action:'preview',kind:s.kind||'food',text});
      s.ops=Array.isArray(out?.operations)?out.operations:[];
      if(!s.ops.length&&out?.message){s.status='error';s.message=String(out.message);this.render();return;}
      s.status='preview';this.render();
    }catch(e){s.status='error';s.message=this.voiceErrorText?this.voiceErrorText(e):(e?.message||String(e));this.render();}
  };

  P.prototype.voiceApply=async function(){
    const s=this._voice;
    if(!s||!this.voiceCanConfirm())return;
    s.status='saving';this.render();
    try{
      const operations=s.ops.map(x=>({id:x.id,amount:x.amount,consume_all:!!x.consume_all}));
      const out=await this._hass.callApi('POST','food_scanner/voice_consume',{action:'apply',kind:s.kind||'food',operations});
      s.results=Array.isArray(out?.results)?out.results:[];
      s.status='success';
      try{await this.load();}catch(_){}
      this.render();
    }catch(e){s.status='error';s.message=this.voiceErrorText?this.voiceErrorText(e):(e?.message||String(e));this.render();}
  };

  P.prototype.voiceDecorate=function(){
    const r=this.shadowRoot;if(!r)return;
    prevVoiceDecorate.call(this);

    if(this._mode==='cons'&&!r.querySelector('#voiceBtnCons')){
      const scan=[...r.querySelectorAll('button')].find(b=>{
        if(b.closest('.hsBottomNav163'))return false;
        const t=(b.textContent||'').replace(/\s+/g,' ').trim().toLowerCase();
        return t.includes('scansiona');
      });
      if(scan){
        let group=scan.parentElement?.querySelector(':scope > .hsConsHeaderActions1650');
        if(!group){
          group=document.createElement('div');
          group.className='hsConsHeaderActions1650';
          scan.parentNode.insertBefore(group,scan);
          group.appendChild(scan);
        }
        const mic=document.createElement('button');
        mic.id='voiceBtnCons';
        mic.className='voiceBtn hsVoiceCons1650';
        mic.type='button';
        mic.textContent='🎙';
        mic.setAttribute('aria-label','Consuma consumabili con voce');
        mic.setAttribute('title','Consuma con voce');
        mic.onclick=()=>this.voiceOpen('cons');
        group.appendChild(mic);
      }
    }

    const foodMic=r.querySelector('#voiceBtn');
    if(foodMic) foodMic.onclick=()=>this.voiceOpen('food');

    if(!r.querySelector('#voiceConsStyle1650')){
      const st=document.createElement('style');st.id='voiceConsStyle1650';
      st.textContent=`.hsConsHeaderActions1650{display:flex!important;align-items:center!important;justify-content:flex-end!important;gap:8px!important;margin-left:auto!important}.hsConsHeaderActions1650>.voiceBtn.hsVoiceCons1650{display:grid!important;place-items:center!important;width:48px!important;height:48px!important;min-width:48px!important;margin:0!important;padding:0!important;border-radius:16px!important;border:1px solid rgba(132,99,255,.55)!important;background:linear-gradient(145deg,rgba(72,50,135,.88),rgba(28,21,61,.98))!important;color:#fff!important;font-size:21px!important;line-height:1!important;box-shadow:0 0 22px rgba(112,82,255,.14)!important}@media(max-width:760px){.hsConsHeaderActions1650{gap:7px!important}.hsConsHeaderActions1650>.voiceBtn.hsVoiceCons1650{width:46px!important;height:46px!important;min-width:46px!important;border-radius:15px!important;font-size:20px!important}}`;
      r.appendChild(st);
    }
  };

  const pr=P.prototype.render;
  P.prototype.render=function(){
    pr.call(this);
    const r=this.shadowRoot;if(!r)return;
    const v=r.querySelector('.hsVersion165 b');if(v)v.textContent='v1.6.50';
    this.voiceDecorate();
  };
}
