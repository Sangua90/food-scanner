import './panel_v195.js?v=1.6.52-base';

const P=customElements.get('food-scanner-panel');
if(P){
  const prevVoiceHtml=P.prototype.voiceHtml;
  const prevVoiceDecorate=P.prototype.voiceDecorate;

  P.prototype.voiceHtml=function(){
    const s=this._voice;
    if(!s)return'';
    if(s.status!=='input'&&s.status!=='error') return prevVoiceHtml.call(this);

    const e=v=>this.esc?this.esc(v):String(v??'');
    const kind=s.kind==='cons'?'cons':'food';
    const title=kind==='cons'?'Consuma consumabili':'Consuma alimenti';
    const example=kind==='cons'
      ? 'Due rotoli di carta cucina e un sapone mani Dove'
      : 'Una pizza e due scatolette di tonno Migros';

    return `<div class="voiceOv"><div class="voiceMd voiceInput1652">
      <button id="voiceX">×</button>
      <h2>🎙 ${title}</h2>
      <p>Scrivi oppure usa il microfono della tastiera iPhone.</p>
      ${s.status==='error'?`<div class="voiceErr">${e(s.message||'Analisi non riuscita')}</div>`:''}
      <textarea id="voiceText" rows="4" placeholder="Scrivi o detta qui…">${e(s.text||'')}</textarea>
      <small>Esempio: “${e(example)}”</small>
      <button id="voiceGo" class="primary">Analizza</button>
      <div class="voiceDivider1652"><span>oppure</span></div>
      <button id="voiceRecordOptional1652" class="voiceRecordOptional1652"><span>🎙</span><div><b>Registra vocale</b><small>Parla direttamente a HomeStock</small></div></button>
    </div></div>`;
  };

  P.prototype.voiceDecorate=function(){
    const r=this.shadowRoot;if(!r)return;
    prevVoiceDecorate.call(this);

    // Header microphone opens the fast text/dictation flow.
    const foodMic=r.querySelector('#voiceBtn');
    if(foodMic) foodMic.onclick=()=>this.voiceOpen('food');
    const consMic=r.querySelector('#voiceBtnCons');
    if(consMic) consMic.onclick=()=>this.voiceOpen('cons');

    // Direct recording remains available as an optional secondary action.
    const rec=r.querySelector('#voiceRecordOptional1652');
    if(rec) rec.onclick=()=>this.voiceRecordStart1651(this._voice?.kind||((this._mode==='cons')?'cons':'food'));

    if(!r.querySelector('#voiceInputStyle1652')){
      const st=document.createElement('style');
      st.id='voiceInputStyle1652';
      st.textContent=`
        .voiceInput1652 textarea{margin-top:10px!important}
        .voiceDivider1652{display:flex;align-items:center;gap:10px;margin:15px 0;color:#65788e;font-size:11px;text-transform:uppercase;letter-spacing:.08em}
        .voiceDivider1652:before,.voiceDivider1652:after{content:'';height:1px;flex:1;background:rgba(137,177,218,.13)}
        .voiceRecordOptional1652{box-sizing:border-box;width:100%;min-height:54px;display:grid;grid-template-columns:42px 1fr;align-items:center;gap:10px;text-align:left;padding:8px 12px!important;border-radius:16px!important;border:1px solid rgba(80,164,238,.2)!important;background:linear-gradient(145deg,rgba(14,31,47,.98),rgba(9,20,32,.98))!important;color:#fff!important}
        .voiceRecordOptional1652>span{width:38px;height:38px;border-radius:13px;display:grid;place-items:center;background:rgba(39,151,244,.12);font-size:19px}
        .voiceRecordOptional1652 b{display:block;font-size:13px}.voiceRecordOptional1652 small{display:block;margin:3px 0 0!important;color:#8194aa!important;font-size:10px!important}
      `;
      r.appendChild(st);
    }
  };

  const pr=P.prototype.render;
  P.prototype.render=function(){
    pr.call(this);
    const r=this.shadowRoot;if(!r)return;
    const v=r.querySelector('.hsVersion165 b');if(v)v.textContent='v1.6.52';
    this.voiceDecorate();
  };
}
