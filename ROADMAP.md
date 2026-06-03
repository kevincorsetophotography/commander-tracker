# 🗺️ Roadmap

Stato delle migliorie pianificate.

---

## ✅ Completate

### 1. Profilo mazzo raggiungibile da ovunque
Il profilo del mazzo (`/mazzo/:id`) si apre cliccando il mazzo da: tab Mazzi, tab
Giocatori (mazzi espansi), Matchup, Storico, pagina I miei mazzi e lista Admin.

### 2. Decklist nel profilo mazzo, raggruppata per tipo
Il profilo mazzo mostra la lista completa suddivisa per categoria (Commander,
Creature, Istantanei, Stregonerie, Artefatti, Incantesimi, Planeswalker, Terre,
Altro), con conteggi e anteprima della carta. Dati via `GET /api/decks/:id` +
`type_line` di Scryfall.

### 3. Usabilità e UI da smartphone
Header brandizzato + dock di navigazione in basso (con safe-area iPhone), schede
del Riepilogo scrollabili, form Admin a colonna singola, profilo mazzo con
anteprima a schermo intero, zoom bloccato e niente overscroll. Hook `useIsMobile`.

---

## Valutate e non necessarie (per ora)

Decisione del 2026-06-03 — riaprire solo se cambiano le esigenze:

- **Password admin persistente** — va bene che resti quella di `ADMIN_PASSWORD`
  (reimpostata a ogni deploy). Nessuna modifica.
- **Dominio personalizzato** — si resta su `*.vercel.app`.
- **CORS multi-origine** — non serve finché c'è un solo indirizzo frontend.

---

## Idee possibili future
Spunti non pianificati, da valutare se verrà voglia di espandere:
- Stagioni / campionato (classifiche per periodo con reset e albo d'oro)
- Achievement aggiuntivi
- Caching lato client di tipi/immagini Scryfall
