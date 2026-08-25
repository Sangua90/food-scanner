# Food Scanner per Home Assistant

Food Scanner è un'integrazione personalizzata per Home Assistant che usa Google Gemini per leggere le confezioni alimentari e gestire un vero magazzino di **frigo, freezer e dispensa**.

## Funzioni principali

- scansione da iPhone tramite Comandi Rapidi
- riconoscimento di nome, marca, formato, EAN/GTIN e scadenza/TMC
- riconoscimento dei multipack e delle unità contenute nella confezione
- archivio persistente separato dal Recorder di Home Assistant
- raggruppamento dello stesso prodotto nello stesso lotto
- lotti separati quando cambia la scadenza
- conteggio delle unità realmente consumabili
- rimozione di 1, 2 o più unità senza cancellare tutto il lotto
- correzione manuale della quantità di magazzino
- ordinamento per scadenza, alfabetico o data di inserimento
- filtri Frigo / Freezer / Dispensa e ricerca per nome, marca o EAN
- notifiche automatiche delle scadenze con anticipo configurabile
- coda **Da verificare** quando l'AI non è abbastanza sicura
- possibilità di aggiungere una seconda foto in seguito senza interrompere le altre scansioni
- pannello Food Scanner direttamente nella barra laterale di Home Assistant

## Come funziona la scansione

Il flusso principale è:

`iPhone → scelta Frigo/Freezer/Dispensa → foto → Home Assistant → risposta immediata → analisi Gemini in background`

La foto viene elaborata in memoria e Food Scanner non la conserva nel magazzino.

Se i dati sono sufficientemente affidabili, il prodotto entra direttamente nel magazzino.

Se mancano dati importanti come la scadenza, il nome o il numero di pezzi di un multipack, la scansione viene messa nella sezione **Da verificare**. Puoi continuare a scansionare altri prodotti e tornare in seguito su quella scansione per aggiungere una seconda foto.

## Multipack e quantità

Food Scanner distingue la confezione dalle unità consumabili.

Esempi:

- una scatola con 10 merendine aggiunge **10 merendine** al magazzino
- una confezione `3 x 80 g` di tonno aggiunge **3 lattine**
- un pacco da 6 bottiglie aggiunge **6 bottiglie**
- una singola bottiglia aggiunge **1 bottiglia**
- un pacco di pasta da 500 g normalmente aggiunge **1 confezione**

Se la quantità viene letta male, dal pannello Food Scanner puoi usare **Correggi quantità**.

## Lotti e scadenze

Due scansioni vengono sommate nello stesso lotto solo quando sono compatibili per prodotto, formato, posizione e scadenza.

Per esempio, 3 yogurt con scadenza 28/08 e 3 yogurt identici con scadenza 31/08 restano due lotti diversi. In questo modo l'ordine delle scadenze e le notifiche restano corretti.

## Pannello Food Scanner

Dopo l'installazione compare **Food Scanner** nella barra laterale di Home Assistant.

Dal pannello puoi:

- vedere il magazzino ordinato per scadenza
- filtrare Frigo, Freezer e Dispensa
- ordinare alfabeticamente
- cercare un prodotto
- togliere rapidamente `-1` o `-2`
- scegliere quante unità consumare
- correggere la quantità
- eliminare completamente un lotto
- gestire le scansioni **Da verificare**
- scattare una seconda foto direttamente dall'iPhone per completare una scansione incerta

## Notifiche di scadenza

Vai in:

**Impostazioni → Dispositivi e servizi → Food Scanner → Configura**

Puoi scegliere:

- se ricevere notifiche dopo le scansioni
- se attivare le notifiche automatiche delle scadenze
- quanti giorni prima essere avvisato
- un servizio notifiche specifico del telefono, se necessario

Se Home Assistant trova un solo servizio `notify.mobile_app_*`, Food Scanner prova a usarlo automaticamente. Altrimenti resta disponibile la notifica persistente di Home Assistant.

Le notifiche di scadenza vengono controllate giornalmente e non vengono ripetute continuamente per lo stesso lotto e la stessa soglia.

## Installazione tramite HACS

1. Apri **HACS**.
2. Vai in **Integrazioni**.
3. Apri il menu in alto a destra e scegli **Repository personalizzati**.
4. Aggiungi `https://github.com/Sangua90/food-scanner` come tipo **Integrazione**.
5. Installa **Food Scanner**.
6. Riavvia Home Assistant.
7. Vai in **Impostazioni → Dispositivi e servizi → Aggiungi integrazione → Food Scanner**.
8. Inserisci la tua API key Gemini.

Modello predefinito:

`gemini-3.5-flash-lite`

## Scansione diretta da iPhone

Endpoint autenticato:

`POST /api/food_scanner/upload`

L'endpoint richiede la normale autenticazione Home Assistant:

`Authorization: Bearer TOKEN`

Posizione del prodotto:

- `?location=frigo`
- `?location=freezer`
- `?location=dispensa`

Sono accettate immagini JPEG, PNG o WEBP fino a 12 MB.

Dalla versione 0.5.1 l'endpoint risponde immediatamente con `202 Accepted`; l'analisi prosegue in Home Assistant, evitando i timeout di Comandi Rapidi.

## Entità create

- `sensor.food_scanner_last_result`
- `sensor.food_scanner_archive_count`
- `sensor.food_scanner_next_expiry`
- `sensor.food_scanner_to_review`

## Servizi disponibili

- `food_scanner.scan_image`
- `food_scanner.consume_product`
- `food_scanner.set_stock`
- `food_scanner.remove_product`
- `food_scanner.clear_archive`

La gestione quotidiana è comunque pensata per essere fatta dal pannello Food Scanner, senza usare manualmente gli ID.

## Sicurezza

Il token Home Assistant e la API key Gemini sono credenziali sensibili. Non inserirli in screenshot, chat, repository o note condivise.

Le foto inviate per l'analisi non vengono archiviate da Food Scanner: vengono inviate a Gemini per l'elaborazione e poi scartate dalla logica dell'integrazione.

## Versione 1.0.0

La 1.0 introduce:

- magazzino persistente
- Frigo / Freezer / Dispensa
- lotti e quantità
- multipack
- consumo parziale
- correzione quantità
- ordinamento e ricerca
- pannello laterale
- notifiche scadenze configurabili
- coda Da verificare
- seconda foto collegata alla scansione originale
- icona locale dell'integrazione
