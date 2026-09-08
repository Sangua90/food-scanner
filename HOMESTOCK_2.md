# HomeStock 2.0

## Architettura

HomeStock 2.0 mantiene due componenti coordinati:

- **HomeStock Integration** — dominio tecnico storico `food_scanner`; proprietaria dell'inventario, delle conferme, delle notifiche e della UI.
- **HomeStock Engine** — app/add-on Supervisor dedicato alle elaborazioni pesanti.

Il nome pubblico del progetto è **HomeStock**. Il dominio `food_scanner` resta soltanto un identificatore tecnico per mantenere compatibilità con i dati esistenti.

## Migrazione senza interruzioni

La migrazione è progressiva. L'integrazione continua a funzionare anche quando l'Engine non è installato o non è raggiungibile.

Ordine previsto:

1. Bridge e diagnostica — completato.
2. Trascrizione audio.
3. Parsing vocale AI.
4. Analisi foto alimenti.
5. Analisi foto consumabili.
6. Code di lavoro, cache e diagnostica avanzata.

L'Engine non modifica direttamente l'inventario. Le operazioni che cambiano quantità rimangono validate e confermate dall'integrazione HomeStock.

## Installazione alpha dell'Engine

Aggiungere questo repository nello Store Apps/Add-on di Home Assistant:

`https://github.com/Sangua90/food-scanner`

Poi installare **HomeStock**, avviarlo e lasciare attivo l'avvio automatico.

La prima alpha espone una Web UI di diagnostica e gli endpoint `/health`, `/v1/capabilities` e `/v1/diagnostics`.

## Versioni di transizione

- Integration 1.6.52: UX vocale testo/dettatura + registrazione opzionale.
- Integration 1.6.53: bridge automatico verso HomeStock Engine.
- Engine 2.0.0-alpha.1: base installabile e diagnostica.
