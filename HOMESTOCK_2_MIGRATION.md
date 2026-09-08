# HomeStock 2.0 — migrazione a integrazione + add-on

## Obiettivo
Portare HomeStock da una custom integration che svolge tutto il lavoro a una struttura ibrida più robusta:

- **HomeStock Integration**: UI/pannello, servizi Home Assistant, notifiche, configurazione, sensori e collegamento con HA.
- **HomeStock Add-on**: elaborazioni pesanti (foto, audio, AI), cache, diagnostica e servizi futuri.

## Nome prodotto
Il prodotto e l'add-on si chiamano **HomeStock**.

Per compatibilità il dominio tecnico della custom integration resta:

`food_scanner`

Non va rinominato durante la migrazione perché identifica dati, Store, configurazioni e API già esistenti.

## Principi di migrazione

1. Nessuna perdita di archivio alimenti, consumabili, lista spesa, storico o impostazioni.
2. La 1.6.x continua a funzionare durante lo sviluppo della 2.0.
3. L'add-on viene introdotto inizialmente come servizio opzionale affiancato all'integrazione.
4. Solo dopo verifica si spostano foto/audio/AI dall'integrazione all'add-on.
5. Il frontend HomeStock mantiene lo stesso flusso utente.
6. Se l'add-on non è disponibile, l'integrazione deve mostrare un errore chiaro e non corrompere i dati.

## Responsabilità finali

### HomeStock Integration
- registrazione pannello `/food-scanner`
- gestione config entry
- archivio e stato Home Assistant
- servizi e notifiche
- liste e scorte basse
- API frontend leggere
- health/status dell'add-on
- backup/migrazione dati

### HomeStock Add-on
- scansione immagini
- trascrizione audio
- parsing AI consumo multiprodotto
- code di elaborazione
- cache temporanea
- diagnostica dettagliata
- eventuale AI locale futura

## Comunicazione
L'integrazione comunica con l'add-on via HTTP locale autenticato sulla rete Supervisor/Add-on.

API prevista, prima fase:

- `GET /health`
- `POST /v1/image/analyze`
- `POST /v1/audio/transcribe`
- `POST /v1/consume/parse`

L'add-on non modifica direttamente il magazzino Home Assistant. Restituisce solo risultati strutturati. La conferma e la mutazione finale restano nell'integrazione, così HomeStock mantiene un unico punto sicuro di scrittura.

## Strategia dati
Nella prima 2.0 il database autorevole resta quello già esistente nell'integrazione (`food_scanner.archive`, consumabili, shopping, history).

Questo evita una migrazione distruttiva. In una fase successiva si potrà valutare un database dell'add-on con sincronizzazione/versioning, ma non è necessario per ottenere subito i vantaggi dell'add-on.

## Fasi

### Fase A — 1.6.x stabile
- confermare scansioni
- confermare voce/dettatura
- confermare consumi
- congelare il comportamento stabile

### Fase B — HomeStock Add-on minimo
- server locale
- endpoint health
- endpoint AI test
- configurazione API key/modello
- log/diagnostica

### Fase C — spostamento AI
- trascrizione audio nell'add-on
- parser consumi nell'add-on
- analisi foto nell'add-on
- fallback controllato durante il passaggio

### Fase D — HomeStock 2.0
- integrazione usa l'add-on come motore AI principale
- UI mostra stato add-on
- diagnostica completa
- rimozione del codice AI duplicato dall'integrazione solo dopo verifica

## Compatibilità
- Nome visibile: **HomeStock**
- Nome add-on: **HomeStock**
- Dominio integrazione: `food_scanner` (compatibilità)
- URL pannello può restare `/food-scanner` inizialmente; il nome visibile resta HomeStock.

## Regola di sicurezza
L'AI non deve mai modificare direttamente quantità o cancellare prodotti. Qualunque operazione di consumo continua a seguire:

`analisi -> anteprima -> conferma utente -> validazione stock -> modifica archivio`
