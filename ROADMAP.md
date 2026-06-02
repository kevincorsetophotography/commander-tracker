# 🗺️ Roadmap — migliorie future

Elenco delle migliorie pianificate, da riprendere in un secondo momento.
Ogni voce include cosa fare, perché, e note tecniche per l'implementazione.

---

## 1. Profilo mazzo raggiungibile da ovunque

**Obiettivo:** poter aprire il **profilo del mazzo** (`/mazzo/:id`) da *qualunque* punto in cui un mazzo è mostrato, in modo coerente.

**Stato attuale (già cliccabile):**
- ✅ Dashboard → tab **Mazzi** (le righe della classifica)
- ✅ Profilo giocatore → sezione **Mazzi**

**Da rendere cliccabile:**
- ⬜ Dashboard → tab **Giocatori** → mazzi mostrati nella sezione espansa del giocatore
- ⬜ Pagina **I miei mazzi** (`DecksPage`) → card dei mazzi
- ⬜ Tab **Matchup** → mazzo avversario
- ⬜ **Storico** → chip dei mazzi nelle partite
- ⬜ **Admin** → lista mazzi

**Note tecniche:**
- La navigazione è `navigate(\`/mazzo/${deckId}\`)` (serve `useNavigate`).
- Attenzione ai conflitti di click: in `DecksPage` la card ha già azioni (Lista, Elimina, selettore livello) — rendere cliccabile solo il titolo/miniatura, non l'intera card, per non intercettare i controlli.
- Nello Storico le chip sono piccole: valutare se rendere cliccabile solo la miniatura `DeckThumb` o l'intera chip.
- `DeckThumb` ha già l'anteprima al hover: valutare se il click sulla miniatura debba aprire il profilo (e disattivare l'anteprima in quei contesti per evitare ambiguità).

---

## 2. Decklist nel profilo mazzo, raggruppata per tipo

**Obiettivo:** nel profilo mazzo mostrare la **lista completa delle carte**, suddivisa per categoria: **Commander, Creature, Istantanei, Stregonerie, Artefatti, Incantesimi, Planeswalker, Terre, Altro**.

**Note tecniche:**
- Il profilo mazzo oggi usa i dati di `statsDecks` / `statsMatchups`, che **non includono la `decklist`**. Serve recuperarla:
  - Aggiungere un endpoint backend `GET /api/decks/:id` (auth) che restituisce il singolo mazzo **con `decklist`** (oltre a name, commander, colors, bracket, owner).
- Il tipo di ogni carta arriva da **Scryfall** (`type_line`). Si può riusare la logica batch già presente in `frontend/src/lib/scryfall.js` (`/cards/collection`) per ottenere `type_line` di ogni carta.
- Raggruppamento dal `type_line`:
  - Il commander è la prima riga / la carta marcata come commander.
  - Mappare la prima parola-tipo rilevante: `Creature → Creature`, `Instant → Istantanei`, `Sorcery → Stregonerie`, `Artifact → Artefatti`, `Enchantment → Incantesimi`, `Planeswalker → Planeswalker`, `Land → Terre`, fallback `Altro`.
  - Attenzione alle carte multi-tipo (es. "Artifact Creature" → conta come Creature) e alle doppie facce (`card_faces`).
- UI: sezioni a fisarmonica o colonne, con conteggio per categoria (es. "Creature (32)") e miniatura/anteprima per carta. Riusare lo stile del `DeckListPanel` (lista + anteprima).
- Caching: le immagini/tipi sono già recuperabili da Scryfall; valutare un piccolo caching lato client per non rifare la chiamata a ogni apertura.

---

## 3. Usabilità e UI da smartphone

**Obiettivo:** rendere l'esperienza mobile fluida (l'app è già PWA installabile, ma alcune schermate sono pensate per desktop).

**Punti da rivedere:**
- ⬜ **Navbar**: su schermi stretti i link vanno a capo. Valutare un menù compatto (hamburger) o un dock inferiore con icone.
- ⬜ **Selettore schede** (Giocatori/Mazzi/Matchup/Storico/Primati): su mobile può eccedere la larghezza → renderlo scrollabile orizzontalmente.
- ⬜ **Form Admin** (crea/modifica utente, mazzo, partita): usano `gridTemplateColumns` rigide che sforano su mobile → passare a layout a colonna sotto una certa larghezza.
- ⬜ **Nuova partita**: le righe giocatore/mazzo e le sezioni ordine/eliminazioni vanno verificate su schermo piccolo.
- ⬜ **Editor lista mazzo** (`DeckListPanel`): la vista "lista + immagine" affianca due colonne → su mobile impilare (già c'è `flexWrap`, ma rifinire dimensioni).
- ⬜ **Barre filtri** (tab Mazzi, Matchup, Storico): tanti controlli in riga → verificare il wrapping e la dimensione dei tap target.
- ⬜ **Tap target**: pulsanti e select abbastanza grandi per le dita (min ~40px).
- ⬜ **Tabelle/righe statistiche**: controllare che i numeri a destra non vengano compressi.

**Note tecniche:**
- Gli stili sono inline in JS (niente CSS media query diretto sui componenti). Opzioni:
  - introdurre un hook `useIsMobile()` (match `window.matchMedia('(max-width: 600px)')`) per ramificare gli stili;
  - oppure spostare i layout critici in classi CSS in `index.css` con media query.
- Verificare tutto a ~360–414px di larghezza (telefoni tipici).

---

## Idee minori / parcheggio
- Far sì che la **password admin** modificata dall'app non venga sovrascritta a ogni deploy (oggi `ensureAdmin` la reimposta da `ADMIN_PASSWORD` a ogni avvio → cambiare in "imposta solo alla creazione").
- Dominio personalizzato al posto di `*.vercel.app`.
- Supporto a **più origini CORS** contemporaneamente (se si tengono attivi più domini frontend).
