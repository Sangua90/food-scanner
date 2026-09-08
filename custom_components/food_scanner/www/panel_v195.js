import './panel_v194.js?v=1.6.51-base';

const P=customElements.get('food-scanner-panel');
if(P){
  const prevVoiceHtml=P.prototype.voiceHtml;
  const prevVoiceDecorate=P.prototype.voiceDecorate;
  const prevVoiceClose=P.prototype.voiceClose;

  P.prototype.voiceStopMedia1651=function(){
    try{
      const rec=this._voiceRecorder1651;
      if(rec&&rec.state!=='inactive') rec.stop();
    }catch(_){ }
    try{
      (this._voiceStream1651?.getTracks?.()||[]).forEach(t=>t.stop());
    }catch(_){ }
    this._voiceRecorder1651=null;
    this._voiceStream1651=null;
  };

  P.prototype.voiceClose=function(){
    this.voiceStopMedia1651();
    prevVoiceClose.call(this);
  };

  P.prototype.voiceAudioBase641651=async function(blob){
    return await new Promise((resolve,reject)=>{
      const reader=new FileReader();
      reader.onload=()=>resolve(String(reader.result||'').split(',')[1]||'');
      reader.onerror=()=>reject(reader.error||new Error('Lettura audio fallita'));
      reader.readAsDataURL(blob);
    });
  };

  P.prototype.voiceAnalyzeText1651=async function(text){
    const s=this._voice;
    const phrase=String(text||'').trim();
    if(!s||!phrase)return;
    s.text=phrase;
    s.status='loading';
    this.render();
    try{
      const out=await this._hass.callApi('POST','food_scanner/voice_consume',{
        action:'preview',kind:s.kind||'food',text:phrase
      });
      if(!this._voice)return;
      s.ops=Array.isArray(out?.operations)?out.operations:[];
      if(!s.ops.length&&out?.message){
        s.status='error';s.message=String(out.message);this.render();return;
      }
      s.status='preview';
      this.render();
    }catch(e){
      if(!this._voice)return;
      s.status='error';
      s.message=this.voiceErrorText?this.voiceErrorText(e):(e?.message||String(e));
      this.render();
    }
  };

  P.prototype.voiceAnalyze=async function(){
    const r=this.shadowRoot,s=this._voice;
    if(!r||!s)return;
    const text=(r.querySelector('#voiceText')?.value||'').trim();
    if(!text){alert('Detta prima cosa hai utilizzato.');return;}
    await this.voiceAnalyzeText1651(text);
  };

  P.prototype.voiceProcessAudio1651=async function(blob,mime){
    const s=this._voice;
    if(!s)return;
    if(!blob||!blob.size){
      s.status='error';s.message='La registrazione è vuota. Riprova.';this.render();return;
    }
    if(blob.size>10*1024*1024){
      s.status='error';s.message='Registrazione troppo lunga. Riprova con un messaggio più breve.';this.render();return;
    }
    s.status='transcribing';
    this.render();
    try{
      const audioData=await this.voiceAudioBase641651(blob);
      const out=await this._hass.callApi('POST','food_scanner/voice_consume',{
        action:'transcribe',
        kind:s.kind||'food',
        mime_type:String(mime||blob.type||'audio/mp4').split(';',1)[0],
        audio_data:audioData,
      });
      if(!this._voice)return;
      const text=String(out?.text||'').trim();
      if(!text)throw new Error('Non ho riconosciuto parole nella registrazione.');
      await this.voiceAnalyzeText1651(text);
    }catch(e){
      if(!this._voice)return;
      s.status='error';
      s.message=this.voiceErrorText?this.voiceErrorText(e):(e?.message||String(e));
      this.render();
    }
  };

  P.prototype.voiceRecordStart1651=async function(kind){
    const resolved=kind||((this._mode==='cons')?'cons':'food');
    this.voiceStopMedia1651();
    this._voice={status:'requesting',text:'',ops:[],kind:resolved};
    this.render();

    if(!navigator.mediaDevices?.getUserMedia||typeof MediaRecorder==='undefined'){
      this._voice.status='mic_error';
      this._voice.message='La registrazione diretta non è disponibile in questa modalità. Puoi usare la dettatura iPhone.';
      this.render();
      return;
    }

    try{
      const stream=await navigator.mediaDevices.getUserMedia({audio:true});
      if(!this._voice){stream.getTracks().forEach(t=>t.stop());return;}
      this._voiceStream1651=stream;

      const candidates=['audio/mp4','audio/webm;codecs=opus','audio/webm','audio/ogg;codecs=opus'];
      let mime='';
      for(const candidate of candidates){
        try{if(MediaRecorder.isTypeSupported?.(candidate)){mime=candidate;break;}}catch(_){ }
      }
      const recorder=mime?new MediaRecorder(stream,{mimeType:mime}):new MediaRecorder(stream);
      this._voiceRecorder1651=recorder;
      const chunks=[];
      recorder.ondataavailable=e=>{if(e.data&&e.data.size)chunks.push(e.data);};
      recorder.onerror=()=>{
        if(!this._voice)return;
        this.voiceStopMedia1651();
        this._voice.status='mic_error';
        this._voice.message='Errore durante la registrazione. Puoi usare la dettatura iPhone.';
        this.render();
      };
      recorder.onstop=async()=>{
        const actualMime=String(recorder.mimeType||mime||chunks[0]?.type||'audio/mp4');
        try{stream.getTracks().forEach(t=>t.stop());}catch(_){ }
        this._voiceRecorder1651=null;
        this._voiceStream1651=null;
        if(!this._voice)return;
        const blob=new Blob(chunks,{type:actualMime});
        await this.voiceProcessAudio1651(blob,actualMime);
      };
      this._voice.status='recording';
      this.render();
      recorder.start(250);
    }catch(e){
      if(!this._voice)return;
      const name=String(e?.name||'');
      let msg='Non riesco ad accedere al microfono.';
      if(name==='NotAllowedError'||name==='SecurityError') msg='Permesso microfono non concesso. Puoi abilitarlo oppure usare la dettatura iPhone.';
      else if(name==='NotFoundError') msg='Nessun microfono disponibile su questo dispositivo.';
      this._voice.status='mic_error';
      this._voice.message=msg;
      this.render();
    }
  };

  P.prototype.voiceRecordStop1651=function(){
    const rec=this._voiceRecorder1651;
    if(!rec||rec.state==='inactive')return;
    if(this._voice){this._voice.status='transcribing';this.render();}
    try{rec.stop();}catch(e){
      if(this._voice){this._voice.status='error';this._voice.message=e?.message||String(e);this.render();}
    }
  };

  P.prototype.voiceHtml=function(){
    const s=this._voice;
    if(!s)return'';
    const e=v=>this.esc?this.esc(v):String(v??'');
    const noun=s.kind==='cons'?'consumabili':'alimenti';

    if(s.status==='requesting'){
      return `<div class="voiceOv"><div class="voiceMd voiceRecordMd1651"><button id="voiceX">×</button><div class="voiceRecordIcon1651">🎙</div><h2>Accesso al microfono</h2><p>Consenti a HomeStock di usare il microfono per registrare direttamente.</p></div></div>`;
    }
    if(s.status==='recording'){
      return `<div class="voiceOv"><div class="voiceMd voiceRecordMd1651"><button id="voiceX">×</button><div class="voiceRecordIcon1651 recording"><span>🎙</span></div><h2>Sto ascoltando…</h2><p>Di' quali ${noun} hai utilizzato, con quantità e marca se serve.</p><button id="voiceStop1651" class="voiceStop1651">■ Stop e analizza</button></div></div>`;
    }
    if(s.status==='transcribing'){
      return `<div class="voiceOv"><div class="voiceMd voiceRecordMd1651"><button id="voiceX">×</button><div class="voiceRecordIcon1651 working">⌁</div><h2>Trascrizione in corso…</h2><p>Sto trasformando la registrazione in testo e poi confronterò i prodotti con HomeStock.</p></div></div>`;
    }
    if(s.status==='mic_error'){
      return `<div class="voiceOv"><div class="voiceMd voiceRecordMd1651"><button id="voiceX">×</button><div class="voiceRecordIcon1651">🎙</div><h2>Microfono non disponibile</h2><p>${e(s.message||'Non riesco ad usare il microfono direttamente.')}</p><button id="voiceUseKeyboard1651" class="primary">Usa dettatura iPhone</button></div></div>`;
    }

    let html=prevVoiceHtml.call(this);
    if(s.status==='input'||s.status==='error'){
      html=html.replace('Tocca il microfono della tastiera iPhone e detta cosa hai utilizzato.','Usa la dettatura della tastiera iPhone come modalità alternativa.');
    }
    return html;
  };

  P.prototype.voiceDecorate=function(){
    const r=this.shadowRoot;if(!r)return;
    prevVoiceDecorate.call(this);

    const foodMic=r.querySelector('#voiceBtn');
    if(foodMic) foodMic.onclick=()=>this.voiceRecordStart1651('food');
    const consMic=r.querySelector('#voiceBtnCons');
    if(consMic) consMic.onclick=()=>this.voiceRecordStart1651('cons');

    const stop=r.querySelector('#voiceStop1651');
    if(stop) stop.onclick=()=>this.voiceRecordStop1651();
    const fallback=r.querySelector('#voiceUseKeyboard1651');
    if(fallback) fallback.onclick=()=>{
      if(!this._voice)return;
      this.voiceStopMedia1651();
      this._voice.status='input';
      this._voice.message='';
      this.render();
    };

    if(!r.querySelector('#voiceRecordStyle1651')){
      const st=document.createElement('style');
      st.id='voiceRecordStyle1651';
      st.textContent=`
        .voiceRecordMd1651{text-align:center!important;padding-top:26px!important}
        .voiceRecordIcon1651{width:86px;height:86px;margin:8px auto 18px;border-radius:50%;display:grid;place-items:center;font-size:34px;background:radial-gradient(circle at 40% 32%,rgba(44,173,255,.34),rgba(10,55,94,.9));border:1px solid rgba(72,180,255,.46);box-shadow:0 0 0 9px rgba(28,145,235,.06),0 0 34px rgba(27,150,244,.22)}
        .voiceRecordIcon1651.recording{animation:hsVoicePulse1651 1.25s ease-in-out infinite;background:radial-gradient(circle at 40% 32%,rgba(255,80,96,.4),rgba(91,20,35,.94));border-color:rgba(255,95,108,.6);box-shadow:0 0 0 9px rgba(255,60,80,.07),0 0 38px rgba(255,55,75,.24)}
        .voiceRecordIcon1651.working{animation:hsVoicePulse1651 1.1s ease-in-out infinite}
        .voiceRecordMd1651 h2{margin:0 42px 7px!important}.voiceRecordMd1651 p{max-width:390px;margin:0 auto 18px!important;line-height:1.5}
        .voiceStop1651{width:100%;min-height:52px;border-radius:16px!important;border:1px solid rgba(255,90,105,.42)!important;background:linear-gradient(145deg,rgba(126,27,42,.98),rgba(75,16,28,.98))!important;color:#fff!important;font-weight:800!important;font-size:14px!important}
        @keyframes hsVoicePulse1651{0%,100%{transform:scale(1);box-shadow:0 0 0 8px rgba(45,155,245,.06),0 0 28px rgba(35,145,235,.18)}50%{transform:scale(1.06);box-shadow:0 0 0 16px rgba(45,155,245,.025),0 0 44px rgba(35,145,235,.3)}}
      `;
      r.appendChild(st);
    }
  };

  const pr=P.prototype.render;
  P.prototype.render=function(){
    pr.call(this);
    const r=this.shadowRoot;if(!r)return;
    const v=r.querySelector('.hsVersion165 b');if(v)v.textContent='v1.6.51';
    this.voiceDecorate();
  };
}
