import './panel_v192.js?v=1.6.48-base';
const P=customElements.get('food-scanner-panel');
if(P){
  P.prototype.voiceErrorText=function(err){
    const seen=new Set();
    const pick=(v)=>{
      if(v==null) return '';
      if(typeof v==='string') return v;
      if(typeof v==='number'||typeof v==='boolean') return String(v);
      if(typeof v==='object'){
        if(seen.has(v)) return '';
        seen.add(v);
        for(const key of ['message','error','detail','description','body']){
          const out=pick(v?.[key]);
          if(out) return out;
        }
        try{
          const json=JSON.stringify(v);
          if(json&&json!=='{}') return json;
        }catch(_){ }
      }
      return '';
    };
    return pick(err) || 'Errore durante l’analisi vocale.';
  };

  P.prototype.voiceAnalyze=async function(){
    const r=this.shadowRoot,s=this._voice;
    if(!r||!s)return;
    const text=(r.querySelector('#voiceText')?.value||'').trim();
    if(!text){alert('Detta prima cosa hai utilizzato.');return;}
    s.text=text;s.status='loading';this.render();
    try{
      const out=await this._hass.callApi('POST','food_scanner/voice_consume',{action:'preview',text});
      s.ops=Array.isArray(out?.operations)?out.operations:[];
      if(!s.ops.length && out?.message){
        s.status='error';s.message=String(out.message);this.render();return;
      }
      s.status='preview';this.render();
    }catch(e){
      s.status='error';s.message=this.voiceErrorText(e);this.render();
    }
  };

  P.prototype.voiceApply=async function(){
    const s=this._voice;
    if(!s||!this.voiceCanConfirm())return;
    s.status='saving';this.render();
    try{
      const operations=s.ops.map(x=>({id:x.id,amount:x.amount,consume_all:!!x.consume_all}));
      const out=await this._hass.callApi('POST','food_scanner/voice_consume',{action:'apply',operations});
      s.results=Array.isArray(out?.results)?out.results:[];
      s.status='success';
      try{await this.load();}catch(_){}
      this.render();
    }catch(e){
      s.status='error';s.message=this.voiceErrorText(e);this.render();
    }
  };

  const pr=P.prototype.render;
  P.prototype.render=function(){
    pr.call(this);
    const r=this.shadowRoot;if(!r)return;
    const v=r.querySelector('.hsVersion165 b');if(v)v.textContent='v1.6.48';
  };
}
