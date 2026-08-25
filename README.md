# Food Scanner per Home Assistant

Food Scanner usa Google Gemini per leggere confezioni alimentari e gestire un magazzino di **frigo, freezer e dispensa** direttamente da Home Assistant.

## Funzioni principali

- scansione rapida da iPhone tramite Comandi Rapidi
- riconoscimento di nome, marca, formato, EAN/GTIN e scadenza/TMC
- riconoscimento multipack e unità realmente consumabili
- archivio persistente separato dal Recorder
- lotti separati quando cambia la scadenza
- consumo parziale di 1, 2 o più unità
- modifica e inserimento manuale
- filtri Frigo / Freezer / Dispensa
- ordinamento per scadenza, alfabetico o inserimento
- ricerca per nome, marca, EAN o categoria
- notifiche di scadenza con anticipo configurabile
- coda **Da verificare** con seconda foto collegata alla scansione originale
- categorie automatiche
- arricchimento barcode tramite Open Food Facts
- statistiche su consumi e prodotti scaduti
- esportazione CSV e backup JSON
- dashboard completa nella barra laterale di Home Assistant

## Scansione

`iPhone → scegli Frigo/Freezer/Dispensa → foto → Home Assistant → risposta immediata → Gemini in background`

La foto non viene conservata nel magazzino. Se Gemini non è sufficientemente sicuro o manca un dato importante, la scansione finisce in **Da verificare** e puoi continuare a scansionare altri prodotti.

## Barcode e Open Food Facts

Se Gemini legge un EAN/GTIN valido, Food Scanner prova automaticamente a cercarlo su Open Food Facts per completare nome, marca, formato, categoria e miniatura del prodotto. La scadenza continua invece a provenire dalla foto, perché è specifica della confezione che hai in casa.

Il pannello contiene anche una ricerca manuale barcode.

## Multipack e quantità

Food Scanner distingue confezione e unità consumabili:

- scatola da 10 merendine → **10 merendine**
- tonno `3 x 80 g` → **3 lattine**
- pacco da 6 bottiglie → **6 bottiglie**
- bottiglia singola → **1 bottiglia**

Prodotti identici con la stessa posizione e scadenza vengono sommati nello stesso lotto; scadenze diverse restano separate.

## Dashboard laterale

La dashboard **Food Scanner** contiene quattro sezioni:

- **Magazzino**: prodotti, quantità, scadenze, categorie, consumo, modifica ed eliminazione
- **Da verificare**: seconda foto, salva comunque o scarta
- **Statistiche**: consumati, scaduti, ultime attività, categorie, export e backup
- **Impostazioni**: notifiche, giorni di preavviso e modello Gemini

## Statistiche

- ogni uso del pulsante **Consuma** incrementa le unità consumate
- se elimini completamente un lotto già scaduto, viene conteggiato come **scaduto**
- se elimini un lotto non scaduto, viene registrato come semplice rimozione
- le correzioni manuali della quantità non vengono conteggiate come consumo

Lo storico è persistente ma limitato agli ultimi 5000 eventi per evitare crescita indefinita.

## Export e backup

Dalla scheda **Statistiche** puoi scaricare:

- **CSV** del magazzino, compatibile con Excel/Numbers
- **Backup JSON** con magazzino, storico e statistiche

## Notifiche scadenza

Puoi scegliere quanti giorni prima ricevere l'avviso. Se hai un solo servizio `notify.mobile_app_*`, Food Scanner prova a usarlo automaticamente; altrimenti puoi indicare manualmente il servizio notifiche.

## Installazione HACS

1. HACS → Integrazioni → Repository personalizzati.
2. Aggiungi `https://github.com/Sangua90/food-scanner` come **Integrazione**.
3. Installa o aggiorna Food Scanner.
4. Riavvia Home Assistant.
5. Impostazioni → Dispositivi e servizi → Food Scanner.
6. Inserisci la API key Gemini se è una nuova installazione.

Modello predefinito: `gemini-3.5-flash-lite`.

## Scansione iPhone

Endpoint autenticato:

`POST /api/food_scanner/upload`

Posizione:

- `?location=frigo`
- `?location=freezer`
- `?location=dispensa`

Formati supportati: JPEG, PNG, WEBP, HEIC e HEIF, fino a 12 MB.

L'endpoint risponde subito con `202 Accepted`; l'analisi continua in Home Assistant, evitando i timeout di Comandi Rapidi.

## Entità

- `sensor.food_scanner_last_result`
- `sensor.food_scanner_archive_count`
- `sensor.food_scanner_next_expiry`
- `sensor.food_scanner_to_review`

## Versione 1.1.0

La 1.1 aggiunge:

- Open Food Facts
- categorie automatiche
- miniature prodotto quando disponibili
- statistiche persistenti
- storico consumi/scaduti
- esportazione CSV
- backup JSON
- ricerca manuale barcode
- nuova scheda Statistiche nella dashboard laterale
