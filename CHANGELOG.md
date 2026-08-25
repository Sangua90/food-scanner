# HomeStock changelog

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
