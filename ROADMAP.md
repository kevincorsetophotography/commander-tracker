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

---

## 🔜 Pianificate (prossime, in ordine)

Direzioni scelte insieme. Le prime due non richiedono modifiche al database.

### 5. Scontri diretti (1v1)
Vista testa a testa tra due giocatori: partite in comune, chi vince di più quando
sono allo stesso tavolo, scambio di eliminazioni. Tutto dai dati esistenti.

### 6. Turno di vittoria & durata
Campo opzionale "vinta al turno N" quando si registra una partita. Sblocca record
**vittoria più veloce**, **partita più lunga** e medie per mazzo/bracket.
*Richiede un piccolo campo nuovo su `Game` (es. `winTurn Int?`) + migrazione.*

### 7. Archetipi dei mazzi
Tag Aggro / Control / Combo / Midrange / Stax sui mazzi, con filtri e win rate per
archetipo (accanto al livello/bracket). *Richiede un campo su `Deck`
(`archetype String?`) + migrazione.*

### 8. Commenti & reazioni sulle partite
Strato social sullo storico: commenti e reazioni emoji sotto ogni partita.
*Il più corposo: nuovi modelli (`Comment`, `Reaction`) + endpoint + UI.*

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
