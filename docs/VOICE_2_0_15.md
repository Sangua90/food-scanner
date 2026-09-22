# HomeStock 2.0.15 — consumo e registrazione vocale

## Problemi individuati nella 2.0.14

1. `voice_consume.py`: il pattern raw di separazione conteneva `\\s`/`\\b` invece di `\s`/`\b`. Le congiunzioni non separavano i prodotti; una frase multipla poteva finire nel fallback AI. I numeri detti riducevano inoltre il punteggio del nome prodotto.
2. I 12 secondi limitavano una singola richiesta Gemini. La scoperta modelli poteva attendere 20 secondi, l'Engine 85 secondi più discovery/health e la trascrizione 75 secondi nell'Engine oppure 60 secondi per ogni modello diretto.
3. `TimeoutError` non era intercettato dalla view: il server aiohttp può convertirlo in HTTP 504. Verificato nel codice di `aiohttp.web_protocol.RequestHandler._handle_request` 3.14.3. Un 504 non identifica quindi necessariamente Nabu Casa o un reverse proxy.
4. Il pulsante secondario in `panel_v196` era collegato a `voiceRecordStart1651` in `panel_v195`. Il payload conteneva già `action: 'transcribe'`, `mime_type` e `audio_data`. Mancavano però limiti per il permesso e la durata, pulizia completa in caso di errore e controllo dell'identità del popup nei callback asincroni. Il MIME di ripiego MP4 poteva essere inventato.

## Comportamento corretto

| Fase | Limite e risultato |
| --- | --- |
| Matching locale | Nessun accesso a Gemini, Supervisor o Engine quando almeno un prodotto è riconosciuto. Gli altri restano non trovati. |
| AI di consumo | 12 s complessivi per discovery, Engine e tutti i modelli; protezione della view a 15 s. |
| Trascrizione | 20 s complessivi nella view; discovery limitata a 2 s e Engine a 5 s, lasciando tempo al percorso diretto. |
| Engine di consumo | 3 s inclusi Supervisor, health e richiesta; poi percorso diretto entro il budget globale. |
| Timeout applicativo | HTTP 408 con JSON `success: false`, `code: voice_timeout` e istruzioni per usare il testo. |
| Attesa frontend | 25 s per analisi/trascrizione; ritorno al testo senza applicare consumi o ritentare automaticamente. |
| Permesso microfono | Dopo 15 s senza risposta compare il fallback. Un consenso tardivo rilascia subito le tracce. |
| Registrazione | Stop automatico dopo 45 s, massimo 10 MB, watchdog di 5 s sulla finalizzazione. |
| Chiusura/navigation | Callback del registratore annullati e tracce rilasciate. Risposte precedenti non modificano un nuovo popup. |

I budget server iniziano dopo la lettura del JSON: non sostituiscono i limiti di upload o connessione del proxy. Non è applicata una cancellazione temporizzata alla scrittura `apply`, che potrebbe avere già modificato l'inventario.

Il MIME inviato deriva dal registratore/blob effettivo, con rimozione del parametro codec per il backend. La registrazione diretta richiede un contesto sicuro e le API multimediali disponibili. In caso contrario resta accessibile la scrittura/dettatura della tastiera. La chiave Gemini non è inviata al browser.

Le modifiche sono nei metodi esistenti, senza un nuovo strato di override. Il pannello attivo passa da `panel_v212` a `panel_v213`; la catena di import fino alla classe base `panel_v140` usa `?v=2.0.15`. La classe base registra il cleanup `disconnectedCallback` prima di `customElements.define`. Manifest, `PANEL_VERSION`, boot e versione visibile sono 2.0.15.

## Verifiche riproducibili

```text
python -m pip install aiohttp
python -m unittest discover -s tests -v
npm install --no-save playwright
npx playwright install chromium
node tests/voice_frontend.cjs
```

Per usare un Edge già installato impostare `BROWSER_CHANNEL=msedge`.

- 15 test backend con vera risposta HTTP aiohttp e confini Home Assistant simulati: matching multiplo/parziale, quantità, timeout globale e cancellazione, modelli manuali, Engine/discovery lenti, MIME, audio/JSON invalidi e quantità duplicate.
- Browser Edge/Chromium: caricamento dell'intera catena attiva, click sul pulsante reale, MP4/WebM con recorder simulato, permesso negato/ignorato/tardivo, richieste bloccate, risposte obsolete.
- Registratore nativo del browser con microfono sintetico: produce MP4 non vuoto, invia `transcribe` e arriva all'anteprima. Uscendo dal pannello la traccia passa a `ended`.

Non sono stati eseguiti test su un iPhone fisico, con Gemini reale o sull'installazione domestica Home Assistant/Nabu Casa. Le prove non certificano la qualità della trascrizione o le impostazioni del dispositivo.

## Distinguere applicazione e proxy nell'installazione

1. Dopo aggiornamento e riavvio verificare la versione visibile 2.0.15. Ricaricare il pannello se è ancora vecchia.
2. Provare una frase con nomi presenti in inventario. La richiesta `preview` deve restituire 200 rapidamente; l'anteprima non modifica scorte.
3. Un 408 JSON con `voice_timeout` e il log `Voice action=... application timeout after ...s` identifica il limite HomeStock. I log riportano azione e durata, senza audio, testo o chiavi API.
4. Se rimane un 504, annotare durata, intestazioni/corpo della risposta e log HA/proxy allo stesso orario. Confrontare la stessa **analisi testuale** dall'accesso locale e da quello remoto. HTTP locale può impedire il microfono per ragioni di sicurezza: non usarlo come confronto della registrazione.
5. 504 solo da remoto, con risposta locale regolare, è un indizio sul percorso remoto; non prova quale intermediario abbia fallito. Verificare i timeout effettivi di NGINX/Caddy/altro proxy e i log di HA/Nabu Casa. Non aumentare i timeout alla cieca.
6. Su iPhone provare HTTPS, consenso microfono e una registrazione breve; negare poi il consenso e verificare che il pulsante per la tastiera funzioni. Verificare anche chiusura durante la registrazione.

Riferimenti: [getUserMedia: contesto sicuro e consenso che può restare pendente](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia), [MIME effettivo di MediaRecorder](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder/mimeType), [supporto MediaRecorder WebKit](https://webkit.org/blog/11353/mediarecorder-api/), [HTTP e reverse proxy Home Assistant](https://www.home-assistant.io/integrations/http), [timeout aiohttp](https://docs.aiohttp.org/en/stable/client_reference.html).
