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

Il flusso attuale è:

`foto presente in Home Assistant → Food Scanner → Gemini → risultato → sensore Home Assistant`

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

## Test con una foto locale

Metti una foto in una cartella accessibile da Home Assistant, per esempio:

`/config/www/test_alimento.png`

Poi esegui:

```yaml
action: food_scanner.scan_image
data:
  image_path: /config/www/test_alimento.png
  notify: true
```

Se la lettura riesce, Food Scanner aggiorna `sensor.food_scanner_last_result` e mostra una notifica con i dati riconosciuti.

## Versioni

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

- acquisizione diretta della foto da iPhone tramite Comandi Rapidi
- caricamento automatico della foto in Home Assistant
- archivio persistente degli alimenti
- gestione frigorifero / freezer / dispensa
- notifiche automatiche delle scadenze
- ricerca prodotto tramite barcode
- dashboard dedicata
- logo e icona dell'integrazione
