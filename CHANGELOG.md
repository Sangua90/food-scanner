# HomeStock changelog

## 2.0.18

- La X permanente ora chiude la schermata o torna alla vista Alimenti; non esce più da HomeStock.
- Rimossa l'azione “Registra vocale”. Il consumo resta disponibile con testo e dettatura della tastiera del telefono.

## 2.0.17

- Un timeout di consumo vocale o trascrizione ora restituisce un esito gestito dall'applicazione con messaggio e fallback testuale, senza risposta HTTP 408 che Home Assistant mostrava come errore generico.

## 2.0.16

- Verifica visiva e funzionale dell'intero pannello su desktop, tablet e iPhone, comprese le viste Alimenti, Consumabili, Liste, Impostazioni e aggiunta manuale.
- Aggiunto uno stato di caricamento esplicito per evitare il falso messaggio di archivio vuoto mentre Home Assistant sta ancora recuperando le scorte.
- Portati i principali controlli tattili, inclusi “Quantità”, chiusura finestre e regolazioni nelle impostazioni, a dimensioni più adatte all'uso su telefono.
- Aggiornato il pannello attivo a `panel_v214` e mantenute le correzioni vocali e di timeout introdotte nella 2.0.15.

## 2.0.15

- Consumo vocale: corretta la separazione locale di frasi con più prodotti e la gestione delle quantità nel matching; i risultati parziali non richiedono l'AI.
- Un solo budget per il fallback AI (12 secondi) e per la trascrizione (20 secondi), inclusi discovery, Engine e tentativi Gemini. I timeout restituiscono JSON `voice_timeout`, non un 504 non gestito.
- Registrazione: gestione di permesso ignorato, HTTPS/browser non supportato, errori, chiusura del popup e risposte tardive; limite di 45 secondi/10 MB e fallback alla tastiera.
- Verificati payload `action: transcribe`, MIME effettivo MP4/WebM e audio base64; aggiornamento coerente del pannello attivo a `panel_v213` e degli import nella catena esistente, senza aggiungere un wrapper.
- Aggiunti test backend e browser riproducibili e note di diagnosi in `docs/VOICE_2_0_15.md`.

## 2.0.12

- Consumabili: il campo **Supermercato / negozio** è assente prima della foto e compare una sola volta dopo il riconoscimento.
- Rimossa la decorazione legacy che reinseriva il campo nel popup dopo il render.

## 1.4.0

- Alimenti: un solo pulsante **Quantità** con correzione diretta tramite `− / +`.
- Alimenti: nuovo banner **Prossime scadenze**, con anteprima dei primi prodotti ordinati per data e filtro rapido.
- Consumabili: nuovo banner **Scorte basse / Da ricomprare**, basato sulla soglia minima.
- Consumabili: il barcode non dipende più da `BarcodeDetector` del browser/iPhone.
- Consumabili: prima foto barcode ridotta lato browser e decodificata su Home Assistant con `zxing-cpp`.
- Consumabili: ricerca Open Products Facts dopo lettura barcode; seconda foto Gemini solo come fallback.
- Aggiunta diagnostica Home Assistant non sensibile.
- Aggiunto `DEVELOPMENT.md` con architettura, compatibilità e procedura di manutenzione.
- Migliorato logging degli errori del flusso consumabili.

## 1.3.0

- Nome pubblico cambiato da Food Scanner a **HomeStock**, mantenendo il dominio tecnico `food_scanner`.
- Consumabili: Utilizza e Aggiungi separati.
- Consumabili: scansione continua e aggiunta manuale continua.
- Consumabili: conferma touch per quantità, unità e zona.
- Aggiunte zone Magazzino, Bagno, Cucina e Lavanderia con colori distintivi.
- Aggiunta X di chiusura nei principali menu/modali.
- Primo flusso barcode → Open Products Facts → Gemini fallback.

## 1.2.x

- Introduzione area Consumabili separata dagli Alimenti.
- Quantità, soglie minime, storico consumi e posizioni.
- Miglioramenti alla gestione quantità e modifica dei prodotti.

## 1.1.x

- Dashboard laterale Home Assistant.
- Coda Da verificare e seconda foto.
- Multipack e unità standardizzate.
- Open Food Facts, statistiche, CSV e backup JSON.
- Filtri Frigo / Freezer / Dispensa e gestione scadenze.
