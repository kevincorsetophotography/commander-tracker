# 🗺️ Roadmap

Stato delle migliorie.

---

## ✅ Completate

### 1. Profilo mazzo raggiungibile da ovunque
Il profilo del mazzo (`/mazzo/:id`) si apre cliccando il mazzo da: tab Mazzi, tab
Giocatori (mazzi espansi), Matchup, Storico, pagina I miei mazzi e lista Admin.

### 2. Decklist nel profilo mazzo, raggruppata per tipo
Lista completa suddivisa per categoria (Commander, Creature, Istantanei,
Stregonerie, Artefatti, Incantesimi, Planeswalker, Terre, Altro) con conteggi e
anteprima carta. Dati via `GET /api/decks/:id` + `type_line` di Scryfall.

### 3. Usabilità e UI da smartphone
Header brandizzato + dock di navigazione in basso (con safe-area iPhone), schede
del Riepilogo scrollabili, form Admin a colonna singola, profilo mazzo con
anteprima a schermo intero, zoom bloccato e niente overscroll. Hook `useIsMobile`.
Inoltre: icona dell'app installata dedicata (`app-icon.png`, separata dal logo del
portale) e barra di stato iOS scura.

### 4. Stagioni (campionato a punti)
Tab **Stagione** nel Riepilogo. Stagioni automatiche di 4 mesi (Gen–Apr / Mag–Ago /
Set–Dic). Punteggio per piazzamento: 1°=3, 2°=2, 3°=1, **+1 presenza** a ogni
partita. Campione = primo qualificato (≥ 30% delle partite della stagione).
Tutto calcolato dalle partite, nessuna modifica al DB (`lib/seasons.js`).

### 5. Scontri diretti (1v1)
Sezione **Rivalità** nel profilo giocatore: scegli un avversario e vedi il testa a
testa nelle partite in comune — chi finisce più in alto (per piazzamento, fallback
al vincitore del pod), vittorie di ciascuno e scambio di eliminazioni. Client-side.

---

## 🔜 Pianificate (prossime, in ordine)

### 6. Archetipi dei mazzi
Tag Aggro / Control / Combo / Midrange / Stax sui mazzi, con filtri e win rate per
archetipo (accanto al livello/bracket). *Richiede un campo su `Deck`
(`archetype String?`) + migrazione.*

### 7. Commenti & reazioni sulle partite
Strato social sullo storico: commenti e reazioni emoji sotto ogni partita.
*Il più corposo: nuovi modelli (`Comment`, `Reaction`) + endpoint + UI.*

### 8. Calendario delle attività
Una sezione dove il gruppo organizza le **serate ed eventi**: data/ora, luogo,
descrizione (es. "Serata Commander da Kevin", "Torneo cEDH"). I giocatori vedono i
**prossimi appuntamenti** e possono dire se **partecipano** (RSVP).

**Valore:** coordina il gruppo dentro l'app, niente più chat sparse per decidere
quando giocare. Si lega bene alle partite (un evento → le partite di quella serata).

**Decisioni prese:**
- **Solo l'admin crea/modifica/elimina gli eventi.** Gli altri li vedono soltanto
  (ed eventualmente confermano la presenza). Creazione nel pannello Admin.

**Note tecniche:**
- Nuovo modello `Event` (titolo, data/ora, luogo, note, `createdByUserId`) + opz.
  `EventRsvp` (eventId, userId, stato: presente/forse/assente) per le adesioni.
- Endpoint: lettura eventi a tutti gli autenticati; creazione/modifica/eliminazione
  protetta da `requireAdmin`; RSVP scrivibile dal singolo utente.
- UI: vista **lista "prossimi eventi"** (semplice) e/o vista **calendario mensile**
  (più ricca). Possibile nuovo tab o voce nel dock mobile.

**Da decidere quando lo costruiamo:**
- Solo lista dei prossimi appuntamenti o anche griglia mensile?
- RSVP sì/no (e con quali stati)?
- Eventi ricorrenti (es. "ogni martedì")? — probabilmente in un secondo momento.
- Promemoria/notifiche? — vedi feature #9.

### 9. Sistema di notifiche
Avvisi per i giocatori, ad esempio: **achievement sbloccato**, **nuovo evento**
inserito a calendario, e in futuro altri trigger (sei stato eliminato, stagione
conclusa, nuova partita che ti riguarda…).

**Valore:** tiene il gruppo aggiornato e premia il coinvolgimento (lo sblocco di un
achievement diventa un momento "wow").

**Due livelli possibili (si può partire dal primo):**
1. **Notifiche in-app** — campanella 🔔 nell'header/dock con pallino "non lette" e
   un elenco. Funziona quando l'app è aperta. Più semplice.
2. **Notifiche push (PWA)** — arrivano anche con l'app chiusa. Richiedono Web Push
   (chiavi VAPID, permesso dell'utente, push nel service worker). Più complesso;
   da valutare in un secondo momento.

**Note tecniche:**
- Nuovo modello `Notification` (userId, tipo, messaggio, link, `read`, createdAt).
- Trigger lato server creano le notifiche:
  - **Nuovo evento** → notifica a tutti i giocatori (si aggancia alla feature #8).
  - **Achievement sbloccato** → ⚠️ oggi gli achievement sono calcolati **lato
    client** e non sono salvati. Per rilevare lo "sblocco" servirà o **persisterli**
    (tabella achievement per utente, valutati lato server dopo ogni partita) oppure
    un confronto lato client tra "prima/dopo". Da decidere insieme.
- UI: campanella con contatore, lista a tendina, segna come letto, link all'oggetto
  (profilo/evento).

**Da decidere quando lo costruiamo:**
- Partire da sole notifiche in-app o puntare subito alle push?
- Come gestire gli achievement (persistenza lato server vs confronto client)?
- Quali trigger attivare all'inizio (solo achievement + eventi, o anche altro)?

---

## Valutate e non necessarie (per ora)
- **Classifica ELO** — accantonata: per un formato multiplayer come Commander il
  sistema a punti per piazzamento (vedi Stagioni) è più adatto.
- **Password admin persistente** — va bene che resti quella di `ADMIN_PASSWORD`.
- **Dominio personalizzato** — si resta su `*.vercel.app`.
- **CORS multi-origine** — non serve con un solo indirizzo frontend.

---

## Idee possibili future
- Achievement aggiuntivi
- Caching lato client di tipi/immagini Scryfall
- Albo d'oro storico delle stagioni (campioni passati)
