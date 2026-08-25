# Food Scanner per Home Assistant

Food Scanner è un'integrazione personalizzata per Home Assistant che analizza le foto delle confezioni alimentari tramite Google Gemini e prova a ricavare automaticamente:

- nome del prodotto
- marca
- quantità/formato
- codice a barre EAN/GTIN
- data di scadenza o TMC
- livello di confidenza della lettura

L'integrazione è pensata come base per costruire una gestione completa di frigorifero, freezer e dispensa con notifiche sulle scadenze.

## Come funziona

Dalla versione 0.4.0 il flusso principale è:

`iPhone → foto → Home Assistant → Food Scanner → Gemini → risultato JSON + sensore Home Assistant`

La foto viene analizzata direttamente in memoria e non viene salvata da Food Scanner sul disco di Home Assistant.

Il risultato più recente viene esposto come:

`sensor.food_scanner_last_result`

## Installazione tramite HACS

1. Apri **HACS**.
2. Vai in **Integrazioni**.
3. Apri il menu in alto a destra e scegli **Repository personalizzati**.
4. Aggiungi `https://github.com/Sangua90/food-scanner` come tipo **Integrazione**.
5. Installa **Food Scanner**.
6. Riavvia Home Assistant.
7. Vai in **Impostazioni → Dispositivi e servizi → Aggiungi integrazione → Food Scanner**.
8. Inserisci la tua API key Gemini.

## Configurazione

Il modello Gemini può essere modificato in seguito da:

**Impostazioni → Dispositivi e servizi → Food Scanner → Configura**

senza eliminare l'integrazione e senza reinserire la API key.

Modello predefinito attuale:

`gemini-3.5-flash-lite`

## Scansione diretta da iPhone

La versione 0.4.0 espone questo endpoint autenticato:

`POST /api/food_scanner/upload`

L'endpoint richiede la normale autenticazione Home Assistant tramite header:

`Authorization: Bearer TOKEN`

Il corpo della richiesta deve essere la foto stessa in JPEG, PNG o WEBP. Sono accettati file fino a 12 MB.

Il risultato viene restituito immediatamente in JSON, per esempio:

```json
{
  "success": true,
  "product_name": "Yogurt bianco",
  "brand": "Müller",
  "quantity": "125 g",
  "barcode": null,
  "expiry_date": "2026-08-30",
  "expiry_type": "scadenza",
  "confidence": 96
}
```

### Sicurezza

Il token Home Assistant è una credenziale sensibile: non inserirlo in screenshot, chat, repository o note condivise. Conservalo solo nel tuo Comando Rapido personale.

## Test con una foto locale

Resta disponibile anche il servizio tradizionale:

```yaml
action: food_scanner.scan_image
data:
  image_path: /config/www/test_alimento.png
  notify: true
```

## Versioni

### 0.4.0
- upload diretto delle foto da iPhone/Comandi Rapidi
- endpoint `/api/food_scanner/upload` protetto dall'autenticazione Home Assistant
- nessun salvataggio obbligatorio della foto su disco
- risposta JSON immediata al telefono
- riconoscimento automatico JPEG/PNG/WEBP anche se iOS invia il file come dati generici

### 0.3.2
- corretta la compatibilità delle notifiche con Home Assistant 2026.x
- uso della sessione HTTP gestita da Home Assistant
- messaggi di errore più chiari
- README tradotto in italiano

### 0.3.1
- corretto il flusso Opzioni per Home Assistant 2026.8
- modello Gemini modificabile senza reinstallare l'integrazione

### 0.3.0
- prima versione HACS-ready

## Prossimi sviluppi

- archivio persistente degli alimenti
- gestione frigorifero / freezer / dispensa
- notifiche automatiche delle scadenze
- ricerca prodotto tramite barcode
- dashboard dedicata
- logo e icona dell'integrazione
