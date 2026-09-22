# HomeStock changelog

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
