# HomeStock Engine — documentazione

HomeStock 2.0 usa due componenti:

1. **HomeStock Integration** (`custom_components/food_scanner`) — mantiene inventario, servizi, notifiche, pannello e conferme.
2. **HomeStock Engine** — esegue progressivamente foto, audio, AI, code di lavoro e diagnostica.

## Stato attuale

Versione add-on: `2.0.0-alpha.1`

Questa prima alpha serve soltanto a verificare installazione, avvio, Ingress e comunicazione futura. Non sposta ancora dati e non modifica l'inventario.

## Sicurezza della migrazione

- Il dominio tecnico `food_scanner` non viene rinominato.
- I dati esistenti restano negli Store di Home Assistant.
- L'add-on non scrive direttamente nell'inventario.
- Le modifiche inventario continueranno a richiedere una conferma lato integrazione.
- Ogni funzione verrà migrata singolarmente con fallback alla logica esistente fino a verifica.

## Ordine di migrazione previsto

1. Trascrizione audio.
2. Parsing vocale AI.
3. Analisi immagini alimenti.
4. Analisi immagini consumabili.
5. Coda lavori e diagnostica avanzata.
6. Cache AI e preparazione a elaborazione locale opzionale.

## Diagnostica

Dalla Web UI dell'add-on è possibile verificare che il motore sia attivo. Gli endpoint interni disponibili in alpha sono:

- `/health`
- `/v1/capabilities`
- `/v1/diagnostics`
