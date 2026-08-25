# HomeStock per Home Assistant

HomeStock gestisce **alimenti e consumabili di casa** direttamente da Home Assistant. Il dominio tecnico rimane `food_scanner` per preservare configurazione, entità e dati delle versioni precedenti.

## Alimenti

- Frigo / Freezer / Dispensa
- riconoscimento con Google Gemini
- nome, marca, formato, barcode, scadenza/TMC
- multipack e quantità
- consumo e aggiunta scorta
- modifica posizione e dati del prodotto
- notifiche di scadenza

## Consumabili

- Magazzino / Bagno / Cucina / Lavanderia
- pulsanti separati **Utilizza** e **Aggiungi**
- scansione barcode rapida con ricerca su Open Products Facts
- se il barcode non viene letto o il prodotto non è presente nel database, seconda foto con Gemini
- conferma touch di quantità, unità e posizione
- scansione continua
- aggiunta manuale continua
- modifica del prodotto toccando la card
- soglia minima e storico dei consumi

## Flusso consumabili

`Foto barcode → lettura locale → Open Products Facts → conferma → aggiungi`

Se il primo tentativo non riesce:

`Riprova barcode` oppure `Seconda foto → Gemini → conferma → aggiungi`

La foto usata per il barcode viene ridotta solo localmente per la lettura del codice; la foto destinata a Gemini mantiene la qualità normale.

## Installazione / aggiornamento HACS

1. HACS → Integrazioni → HomeStock.
2. Aggiorna all'ultima versione.
3. Riavvia Home Assistant.
4. Apri **HomeStock** dalla barra laterale.

Per nuove installazioni il repository resta `https://github.com/Sangua90/food-scanner`.

## Versione 1.3.0

- nuovo nome visibile **HomeStock**
- dominio interno invariato `food_scanner`
- barcode-first per consumabili con Open Products Facts
- Gemini come fallback con seconda foto
- Utilizza / Aggiungi separati
- zone consumabili con colori distintivi
- conferma scansione touch
- scansione continua
- aggiunta manuale continua
- X di chiusura su tutti i menu principali
