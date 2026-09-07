import './panel_v191.js?v=1.6.47-base';
const P=customElements.get('food-scanner-panel');
if(P){
  const previousDecorate=P.prototype.voiceDecorate;
  P.prototype.voiceDecorate=function(){
    const r=this.shadowRoot;
    if(!r)return;

    // Let v1.6.46 render modal/styles first, then repair the header trigger.
    previousDecorate.call(this);

    if(this._mode==='food'&&!r.querySelector('#voiceBtn')){
      const scan=[...r.querySelectorAll('button')].find(b=>{
        if(b.closest('.hsBottomNav163')) return false;
        const text=(b.textContent||'').replace(/\s+/g,' ').trim().toLowerCase();
        return text.includes('scansiona');
      });
      if(scan){
        let group=scan.parentElement?.querySelector(':scope > .hsFoodHeaderActions1647');
        if(!group){
          group=document.createElement('div');
          group.className='hsFoodHeaderActions1647';
          scan.parentNode.insertBefore(group,scan);
          group.appendChild(scan);
        }
        const mic=document.createElement('button');
        mic.id='voiceBtn';
        mic.className='voiceBtn hsVoiceHeader1647';
        mic.type='button';
        mic.textContent='🎙';
        mic.setAttribute('aria-label','Consuma alimenti con voce');
        mic.setAttribute('title','Consuma con voce');
        mic.onclick=()=>this.voiceOpen();
        group.appendChild(mic);
      }
    }

    if(!r.querySelector('#voiceHeaderStyle1647')){
      const st=document.createElement('style');
      st.id='voiceHeaderStyle1647';
      st.textContent=`
        .hsFoodHeaderActions1647{display:flex!important;align-items:center!important;justify-content:flex-end!important;gap:8px!important;margin-left:auto!important}
        .hsFoodHeaderActions1647>.voiceBtn.hsVoiceHeader1647{display:grid!important;place-items:center!important;width:48px!important;height:48px!important;min-width:48px!important;margin:0!important;padding:0!important;border-radius:16px!important;border:1px solid rgba(35,153,255,.55)!important;background:linear-gradient(145deg,rgba(14,73,126,.88),rgba(9,35,62,.98))!important;color:#fff!important;font-size:21px!important;line-height:1!important;box-shadow:0 0 22px rgba(25,137,241,.13)!important}
        @media(max-width:760px){.hsFoodHeaderActions1647{gap:7px!important}.hsFoodHeaderActions1647>.voiceBtn.hsVoiceHeader1647{width:46px!important;height:46px!important;min-width:46px!important;border-radius:15px!important;font-size:20px!important}}
      `;
      r.appendChild(st);
    }
  };

  const previousRender=P.prototype.render;
  P.prototype.render=function(){
    previousRender.call(this);
    const r=this.shadowRoot;
    if(!r)return;
    const v=r.querySelector('.hsVersion165 b');
    if(v)v.textContent='v1.6.47';
    this.voiceDecorate();
  };
}
