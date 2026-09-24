import './panel_v211.js?v=2.0.18';

const Panel = customElements.get('food-scanner-panel');

if (Panel) {
  const previousVoiceHtml216 = Panel.prototype.voiceHtml;
  const previousSmartClose216 = Panel.prototype.smartClose176;

  // Keep both paths: keyboard dictation for maximum compatibility and direct
  // microphone recording when the browser exposes MediaRecorder.
  Panel.prototype.voiceHtml = function() {
    const state = this._voice;
    if (!state || !['input','error','recording216'].includes(state.status)) {
      return previousVoiceHtml216.call(this);
    }
    const esc = value => this.esc ? this.esc(value) : String(value ?? '');
    const consumables = state.kind === 'cons';
    const automatic = state.kind === 'auto';
    const title = automatic ? 'Consuma prodotti' : (consumables ? 'Consuma consumabili' : 'Consuma alimenti');
    const example = automatic
      ? 'Due yogurt, una maionese e un rotolo di carta cucina'
      : (consumables
        ? 'Due rotoli di carta cucina e un sapone mani Dove'
        : 'Una pizza e due scatolette di tonno Migros');
    return `<div class="voiceOv"><div class="voiceMd voiceInput216">
      <button id="voiceX">×</button>
      <h2>🎙 ${title}</h2>
      <p>Scrivi oppure usa il microfono della tastiera del telefono.</p>
      ${state.status === 'error' ? `<div class="voiceErr">${esc(state.message || 'Analisi non riuscita')}</div>` : ''}
      <textarea id="voiceText" rows="4" placeholder="Scrivi o detta qui…">${esc(state.text || '')}</textarea>
      <small>Esempio: “${esc(example)}”</small>
      <button id="voiceGo" class="primary">Analizza</button>
      <div class="voiceOr216"><span></span><b>OPPURE</b><span></span></div>
      <button id="voiceRecord216" class="voiceRecord216">🎙 <span><b>${state.status === 'recording216' ? 'Termina registrazione' : 'Registra vocale'}</b><small>${state.status === 'recording216' ? 'Sto ascoltando…' : 'Parla direttamente a HomeStock'}</small></span></button>
    </div></div>`;
  };

  Panel.prototype.voiceCanConfirm = function() {
    const ops = this._voice?.ops || [];
    return ops.some(x => x?.status === 'matched' && x?.id && Number(x?.amount) > 0);
  };

  Panel.prototype.smartClose176 = function() {
    if (this._voice) {
      const recorder = this._voice?._recorder216;
      if (recorder?.state === 'recording') {
        try { recorder.stop(); } catch (_) {}
      }
      this._voice = null;
      this.render();
      return true;
    }
    // Delegate every other close action to the established navigation logic:
    // modals close locally, while the persistent main X exits HomeStock and
    // returns to Home Assistant.
    return previousSmartClose216.call(this);
  };
  const previousConsDialog212 = Panel.prototype.consScanDialog;
  const previousLoad214 = Panel.prototype.load;
  const previousConnected214 = Panel.prototype.connectedCallback;
  const previousFood214 = Panel.prototype.renderFood;
  const previousCons214 = Panel.prototype.renderCons;

  Panel.prototype.connectedCallback = function() {
    this._hsInitialLoading214 = true;
    previousConnected214.call(this);
  };

  Panel.prototype.load = async function() {
    this._hsInitialLoading214 = true;
    this.render();
    try {
      return await previousLoad214.call(this);
    } finally {
      this._hsInitialLoading214 = false;
      this.render();
    }
  };

  const loadingView214 = () => `<section class="hsModePage hsLoading214" role="status" aria-live="polite">
    <span class="hsLoadingSpinner214" aria-hidden="true"></span>
    <b>Caricamento delle scorte…</b>
    <small>Aggiorno alimenti e consumabili</small>
  </section>`;
  Panel.prototype.renderFood = function() {
    if (this._hsInitialLoading214) return loadingView214();
    if (this._hsListsPage175 && this.hsListsView175) return this.hsListsView175();
    return previousFood214.call(this);
  };
  Panel.prototype.renderCons = function() {
    if (this._hsInitialLoading214) return loadingView214();
    if (this._hsListsPage175 && this.hsListsView175) return this.hsListsView175();
    return previousCons214.call(this);
  };

  // Build the pre-recognition popup explicitly. Older frontend overrides decorate
  // the rendered modal afterwards, so filtering the returned HTML is not enough.
  Panel.prototype.consScanDialog = function() {
    const s = this._consScan;
    if (!s) return '';

    if (s.status !== 'photo' && s.status !== 'fallback') {
      return previousConsDialog212.call(this);
    }

    const failed = s.status === 'fallback';
    return `<div class="overlay"><div class="modal scanModal foodScanModal cons1644Modal cons212PreScan">
      <button class="close" id="cons1644X">×</button>
      <div class="scanHead">
        <div class="scanIcon">⌁</div>
        <div>
          <h2>Scansiona consumabile</h2>
          <p>${failed ? this.esc(s.message || 'Riprova con una foto più chiara.') : 'Scatta una foto chiara della confezione. Posizione, quantità e negozio li scegli dopo il riconoscimento.'}</p>
        </div>
      </div>
      <input id="cons1644File" type="file" accept="image/*,.heic,.heif" capture="environment" hidden>
      <button id="cons1644Photo" class="scanPhotoButton">
        <span class="cameraGlyph">◉</span>
        <span><b>${failed ? 'Riprova foto' : 'Scatta foto'}</b><small>Apri la fotocamera</small></span>
      </button>
      ${failed ? `<div class="scanHint"><b>Riconoscimento non riuscito</b><span>${this.esc(s.message || 'Riprova con una foto più chiara.')}</span></div>` : ''}
    </div></div>`;
  };

  const previousRender212 = Panel.prototype.render;

  Panel.prototype.hsVoiceRecord216 = async function() {
    const s = this._voice;
    if (!s) return;
    if (s._recorder216?.state === 'recording') { s._recorder216.stop(); return; }
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      s.status = 'error';
      s.message = 'Registrazione diretta non disponibile qui. Usa il microfono della tastiera.';
      this.render();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({audio:true});
      const preferred = ['audio/mp4','audio/webm;codecs=opus','audio/webm'].find(x => MediaRecorder.isTypeSupported?.(x));
      const rec = preferred ? new MediaRecorder(stream,{mimeType:preferred}) : new MediaRecorder(stream);
      const chunks = [];
      rec.ondataavailable = e => { if (e.data?.size) chunks.push(e.data); };
      rec.onstop = async () => {
        stream.getTracks().forEach(t=>t.stop());
        try {
          const blob = new Blob(chunks,{type:rec.mimeType || preferred || 'audio/webm'});
          const raw = await new Promise((resolve,reject)=>{
            const reader=new FileReader();
            reader.onload=()=>resolve(String(reader.result||'').split(',')[1]||'');
            reader.onerror=()=>reject(reader.error);
            reader.readAsDataURL(blob);
          });
          s.status='loading'; s.message='Trascrizione in corso…'; this.render();
          const out=await this._hass.callApi('POST','food_scanner/voice_consume',{action:'transcribe',audio_data:raw,mime_type:(blob.type||'audio/webm').split(';')[0]});
          s.text=String(out?.text||'').trim();
          s.status='input'; this.render();
        } catch(e) {
          s.status='error'; s.message=e?.message||String(e); this.render();
        }
      };
      rec.start();
      s._recorder216=rec;
      s.status='recording216'; this.render();
      setTimeout(()=>{ if(rec.state==='recording') rec.stop(); },15000);
    } catch(e) {
      s.status='error'; s.message='Microfono non disponibile: '+(e?.message||String(e)); this.render();
    }
  };

  Panel.prototype.render = function() {
    previousRender212.call(this);
    const root = this.shadowRoot;
    if (!root) return;

    const version = root.querySelector('.hsVersion165 b');
    if (version) version.textContent = 'v2.0.23';

    // Bind voice controls after every render; older voiceDecorate only binds
    // when it creates the overlay itself.
    const voiceClose = root.querySelector('#voiceX');
    if (voiceClose && !voiceClose.__hsClose220) {
      voiceClose.__hsClose220 = true;
      voiceClose.addEventListener('click', event => {
        event.preventDefault();
        event.stopImmediatePropagation();
        const recorder = this._voice?._recorder216;
        if (recorder?.state === 'recording') {
          try { recorder.stop(); } catch (_) {}
        }
        this._voice = null;
        root.querySelector('.voiceOv')?.remove();
        this.render();
      }, true);
    }
    root.querySelector('#voiceGo')?.addEventListener('click', () => this.voiceAnalyze(), {once:true});
    root.querySelector('#voiceRecord216')?.addEventListener('click', () => this.hsVoiceRecord216(), {once:true});

    // Central + menu is the single action hub.
    root.querySelectorAll('.hsFoodHeaderActions1647,.hsConsHeaderActions1650').forEach(node => {
      node.style.display = 'none';
      node.setAttribute('aria-hidden','true');
    });
    root.querySelectorAll('#voiceBtn,#voiceBtnCons').forEach(node => {
      node.style.display = 'none';
      node.setAttribute('aria-hidden','true');
    });

    const quickSheet = root.querySelector('.hsQuickSheet163');
    if (quickSheet) {
      quickSheet.querySelectorAll('#hsQuickVoiceFood220,#hsQuickVoiceCons220,#hsQuickVoiceAuto223').forEach(node => node.remove());
      const manual = quickSheet.querySelector('#hsQuickManual');
      const voice = document.createElement('button');
      voice.type = 'button';
      voice.id = 'hsQuickVoiceAuto223';
      voice.className = 'hsQuickAction voice220';
      voice.innerHTML = '<span>🎙</span><div><b>Consuma prodotti</b><small>Alimenti e consumabili insieme</small></div><em>›</em>';
      voice.addEventListener('click', () => {
        this._hsQuickAddOpen = false;
        this.voiceOpen('auto');
      });
      if (manual) quickSheet.insertBefore(voice, manual);
      else quickSheet.appendChild(voice);
    }

    const close = root.querySelector('#homeStockExit');
    if (close) {
      close.setAttribute('aria-label', 'Chiudi schermata');
      close.setAttribute('title', 'Chiudi schermata');
    }

    if (!root.querySelector('#hsUsability214')) {
      const style = document.createElement('style');
      style.id = 'hsUsability214';
      style.textContent = `
.voiceInput216 textarea{margin-top:10px!important}
        .voiceOr216{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:12px;margin:16px 0;color:#718398;font-size:10px;letter-spacing:.14em}.voiceOr216 span{height:1px;background:rgba(120,175,230,.16)}.voiceRecord216{width:100%!important;min-height:58px!important;display:flex!important;align-items:center!important;gap:12px!important;text-align:left!important;padding:10px 14px!important;border-radius:16px!important}.voiceRecord216 span{display:flex;flex-direction:column}.voiceRecord216 small{margin:2px 0 0!important}.hsQuickAction.voice220>span{background:rgba(119,85,255,.14)!important}
        .hsLoading214{min-height:min(58vh,520px);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:9px;text-align:center;color:#eaf4ff}
        .hsLoading214 b{font-size:16px}.hsLoading214 small{color:#8194a9!important;font-size:11px!important}
        .hsLoadingSpinner214{width:32px;height:32px;border-radius:50%;border:3px solid rgba(105,183,255,.18);border-top-color:#4daeff;animation:hsSpin214 .8s linear infinite}
        @keyframes hsSpin214{to{transform:rotate(360deg)}}
        .neoFoodSide .hsQtyButton201,.hsConsSide166 .hsQtyButton201{height:44px!important;min-height:44px!important}
        .modal>.close,.voiceMd>button:first-child{width:44px!important;height:44px!important;min-width:44px!important;min-height:44px!important}
        .hsInlineSave165,.hsFamilyProduct202>button{min-height:44px!important;height:44px!important}
        .hsMiniStep165{grid-template-columns:44px 42px 44px!important}.hsMiniStep165 button{width:44px!important;height:44px!important}
        .hsSwitch165{min-width:48px!important;min-height:38px!important}
        @media(max-width:760px){
          .hsConsZoneChips180{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;overflow:visible!important;gap:8px!important}
          .hsConsZoneChips180 button{min-width:0!important;width:100%!important}
          .neoFoodSide .hsQtyButton201,.hsConsSide166 .hsQtyButton201{height:44px!important;min-height:44px!important;font-size:10px!important}
          .hsLoading214{min-height:52vh;padding:36px 16px}
        }
        @media(prefers-reduced-motion:reduce){.hsLoadingSpinner214{animation:none}}
      `;
      root.appendChild(style);
    }

    if (!this._consScan) return;
    const modal = root.querySelector('#cons1644X')?.closest('.modal')
      || root.querySelector('#cons1644File')?.closest('.modal')
      || root.querySelector('.cons1644Modal');
    if (!modal) return;

    // panel_v156 injects #consStoreScan after the dialog HTML has been rendered.
    // Remove only that legacy decoration. The preview field #cons1644Store stays
    // in place and remains wired by panel_v189's isolated consumable bind.
    modal.querySelectorAll('#consStoreScan').forEach(input => {
      const field = input.closest('.hsStoreField');
      if (field) field.remove();
      else input.remove();
    });

    // Defensive invariant: before recognition there must be no editable store
    // control even if another cached override supplied the modern field early.
    if (this._consScan.status !== 'preview') {
      modal.querySelectorAll('#cons1644Store').forEach(input => {
        const field = input.closest('.cons1644Field');
        if (field) field.remove();
        else input.remove();
      });
    }
  };
}
