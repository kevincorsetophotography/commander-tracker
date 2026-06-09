# CLAUDE.md — Commanderone · Villastellone

Tracker di partite **Magic: The Gathering / Commander (EDH)** per il gruppo di Villastellone.
App full-stack deployata: i membri registrano partite, mazzi, statistiche, eventi, e c'è uno strato social (commenti/reazioni), achievement e notifiche.

> Questo file è il contesto che leggo a inizio sessione. Tienilo aggiornato quando l'architettura cambia.
> **Regola pratica**: prima di dire "manca X", cerca nel codice. Il progetto è più completo di quanto sembri.

---

## Stack & deploy

- **Frontend**: React 18 + Vite 5, `react-router-dom` 6, **stili inline** (niente CSS framework), tema dark/light (`hooks/useTheme`), PWA. Test: **Vitest 2** (`frontend/ npm test`).
- **Backend**: Node + Express + **Prisma 5** + **PostgreSQL**. Auth JWT + bcrypt, registrazione protetta da **INVITE_CODE**. Test: Vitest 2 (`backend/ npm test`).
- **Deploy**: push su `main` →
  - **Railway** (backend + Postgres): esegue `start:prod` = `prisma db push --accept-data-loss && ensureAdmin && migrateNotificationLinks && migrateSeasonAchievements && index.js`.
  - **Vercel** (frontend): build statico, SPA rewrites (`vercel.json`).
- **Node 18** in locale → Vitest e Prisma sono fissati a versioni compatibili (Vitest **2.x**, non 4.x).

## Ambiente di sviluppo locale (isolato, NON tocca produzione)

- `cd backend && npm run dev` → `scripts/dev.mjs`: avvia un **PostgreSQL embedded** (`embedded-postgres`) su **:5433**, fa `db push`, **semina** dati di test se vuoto, poi nodemon su **:3001**.
  - Il DB locale **deve essere UTF-8** (per le emoji). `dev.mjs` lo (ri)crea UTF-8 se serve: su Windows initdb usa WIN1252 di default, che fa crashare i salvataggi con emoji.
  - Credenziali seed: `admin/test`; giocatori `Ramuh, Shiva, Ifrit, Bahamut, Leviath, Titan` → password `test`.
- Frontend: `cd frontend && npx vite --host` (:5173). Punta a `http://localhost:3001/api` di default (`lib/api.js`, niente `.env` frontend in locale).
- `.env` (backend, **gitignored**): `DATABASE_URL` (locale o Railway), `JWT_SECRET` (≥32 char), `PORT`, `FRONTEND_URL`, `INVITE_CODE`, `GROQ_API_KEY` (per il Judge Bot).

### Gotcha Windows + Prisma
Rigenerare il client mentre il backend gira **blocca la query-engine DLL** (EPERM). Procedura: `db push --skip-generate` è sicuro a caldo; per `prisma generate` **fermare il backend**, generare, riavviare. (Le migrazioni usano `prisma db push`, **niente cartella migrations**.)

## Verifica delle modifiche (come lavoro qui)

- Uso **Playwright** in `~/ct-shots` (FUORI dal repo) per pilotare l'app reale: chromium via `channel:'msedge'` (no download), **webkit** per simulare iOS Safari. Screenshot di debug in `docs/img/_*.png` → **cancellati dopo**.
- Login programmatico via API, token iniettato in `localStorage` (`ct_token`, `ct_user`, `ct_theme`).
- Pattern: implemento → verifico in locale (desktop + mobile, spesso anche webkit) → `npm test` + `vite build` → commit. **Push solo quando l'utente lo chiede** (il push fa partire il deploy in produzione).
- Commit: messaggio in inglese, termina con `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. Lavoro su `main`.

---

## Struttura

```
backend/src/
  index.js            mount rotte, CORS, rate-limit /auth e /judge, trust proxy, init achievement snapshot, loadComprehensiveRules
  lib/
    prisma.js         PrismaClient SINGLETON condiviso (un solo pool)
    achievements.js   logica achievement lato server (mirror del frontend) + loadData/unlockedForUser + ACHIEVEMENT_META
    notify.js         createNotifications, checkAchievements, initAchievementSnapshots (backfill silenzioso)
    decklist.js       parseDecklist, findMissingCards, validateDecklist (100 carte, esistenza su Scryfall)
    tournament.js     algoritmi torneo PURI: podSizes, makePods, makePairings, standings1v1, swissPairings (con test)
    judge.js          Judge Bot: parseComprehensiveRules, searchInSections, detectCardNames, fetchCardContext, normalizeQuestion, askJudge
  routes/
    auth.js           POST /register, POST /login
    admin.js          CRUD users + export JSON (richiede ADMIN)
    decks.js          CRUD mazzi + POST /import (Archidekt/Moxfield)
    gamesV2.js        CRUD partite + commenti + reazioni (MONTATO; games.js è LEGACY)
    stats.js          GET players, decks, matchups, achievements/:userId
    events.js         CRUD eventi + RSVP + turni + risultati tavoli
    notifications.js  GET lista, GET unread-count, POST read
    judge.js          POST / (domanda → askJudge + salva JudgeQuestion)
  ensureAdmin.js                 upsert admin (one-shot, suo PrismaClient)
  migrateNotificationLinks.js    migrazione idempotente: link notifiche vecchie → deep-link
  migrateSeasonAchievements.js   migrazione idempotente: rimuove achievement stagionali assegnati per errore
  (games.js è LEGACY, non montato)

frontend/src/
  App.jsx             rotte React + layout (header desktop/mobile, dock 5-item mobile, NotificationBell)
                      Dock: Feed(/) | Gioca(/gioca) | Eventi(/eventi) | Gruppo(/gruppo) | Io(/giocatore/:id)
                      Desktop navbar: Feed | Gioca | Eventi | Gruppo | Mazzi | [Admin]
                      /tornei → /eventi redirect (retrocompatibilità deep-link)
  lib/
    api.js            client fetch (Authorization Bearer) — espone tutti i metodi API
    achievements.js   26 achievement: definizioni + computeUnlocked (mirror backend)
    seasons.js        stagioni 4-mesi, seasonOf, listSeasons, computeStandings
    cardCache.js      cache immagini+tipi carta Scryfall (localStorage, batch /cards/collection + fuzzy fallback)
    scryfall.js       chiamate Scryfall (autocomplete, colori, validazione, categorizeCard)
    brackets.js       BRACKETS {1:Casual, 2:Bilanciato, 3:Potente, 4:cEDH}, BRACKET_OPTIONS
    archetypes.js     ARCHETYPE_OPTIONS [Aggro, Midrange, Control, Combo, Stax, Aristocrats, Tokens, Voltron, Ramp]
    confetti.js       fireConfetti() — celebrazione visiva a schermo
    theme.js          token colore dark/light (bgSurface, border, primary, text, textSub, danger, win, winBg, gradient, glow, shadow…)
  hooks/
    useAuth.js        {user, login, register, logout} — JWT in localStorage
    useTheme.js       {t, dark, toggleDark} — tema colori dinamico
    useIsMobile.js    boolean (≤768px)
    useCountUp.js     animazione numerica (MetricCard in Dashboard)
  pages/
    Login.jsx             /login — form login/register con inviteCode
    FeedPage.jsx          / — home feed: snapshot stagione, prossimo evento, ultime partite + notifiche
    GiocaPage.jsx         /gioca — landing "Gioca": CTA nuova partita, mazzi recenti, ultima partita
    GruppoPage.jsx        /gruppo — statistiche gruppo con 4 tab URL-based: Stagione (classifica + Primati + Meta), Giocatori, Mazzi, Storico
    DashboardPage.jsx     /dashboard — 6 tab stats LEGACY (ancora funzionante, non nel dock)
    DecksPage.jsx         /mazzi — lista mazzi + form creazione
    DeckProfilePage.jsx   /mazzo/:id — profilo mazzo (tab perf/lista, stima prezzo €)
    PlayerProfilePage.jsx /giocatore/:id — profilo giocatore (progressive disclosure 6 sezioni)
    GamePage.jsx          /partita/:id — dettaglio partita + social
    NewGamePage.jsx       /nuova-partita — form registrazione partita
    EventsPage.jsx        /eventi — eventi + RSVP (form crea/modifica in modal overlay); /tornei redirige qui
    EventDetailPage.jsx   /evento/:id — dettaglio torneo (turni, tavoli, standings)
    AdminPage.jsx         /admin — gestione utenti/mazzi/partite (solo ADMIN)
    JudgePage.jsx         /giudice — Q&A ruling Commander + storico domande del gruppo (ultimi 20)
    Dashboard.jsx         LEGACY — non usata
  components/
    DeckThumb.jsx         thumbnail commander (art piccola o avatar con iniziali)
    DeckListPanel.jsx     modal/panel edit decklist + import da URL (Archidekt/Moxfield)
    GameSocial.jsx        commenti + reazioni emoji per partita
    NotificationBell.jsx  bell icon con badge unread, polling 60s, dropdown
    BracketBadge.jsx      badge colorato power level (Casual/Bilanciato/Potente/cEDH)
    ArchetypeBadge.jsx    badge archetipo mazzo
    CommanderInput.jsx    input con autocomplete Scryfall (debounced)
    Skeleton.jsx          loading placeholder (Skeleton + SkeletonList)
    EmptyState.jsx        stato vuoto con icona + messaggio
```

---

## Modello dati (Prisma — tutti i campi)

**User**: id, username (unique), password (bcrypt), role (PLAYER|ADMIN)

**Deck**: id, name, commander, colors (es. "WUBRG"), decklist (testo libero), bracket (1-4), archetype, userId
- Unique: (userId, name)

**Game**: id, playedAt, notes, createdByUserId

**GamePlayer**: id, gameId, userId, deckId, isWinner, placement (Int?), eliminatedById (userId di chi ha eliminato, nullable)

**Comment**: id, body, createdAt, gameId, userId

**Reaction**: id, emoji, createdAt, gameId, userId
- Unique: (gameId, userId, emoji)
- Emoji disponibili: 👍 🔥 😂 😮 💀 🎉 🐸

**Notification**: id, type (event|achievement|comment|reaction), title, body, link, read, createdAt, userId

**AchievementUnlock**: id, achievementId, createdAt, userId
- Unique: (userId, achievementId)

**JudgeQuestion**: id, question, answer, explanation, confidence (Float), sourcesJson (JSON), rulesUsed (JSON), createdAt, userId

**Event**: id, title, description, startsAt, allDay, location, format ('multiplayer'|'1v1'), bestOf (Int, 1 o 3 per 1v1), createdByUserId

**EventRsvp**: id, createdAt, eventId, userId — Unique: (eventId, userId)

**EventRound**: id, number, eventId — Unique: (eventId, number)

**EventTable**: id, number, done, roundId, gameId (partita reale per pod multiplayer), winnerUserId, isDraw, scoreA, scoreB (game won per 1v1)

**EventSeat**: id, seat, tableId, userId — Unique: (tableId, userId)

---

## API backend — tutti gli endpoint

```
// AUTH
POST /api/auth/register       {username, password, inviteCode}
POST /api/auth/login          {username, password} → {token, user}

// DECKS
GET  /api/decks               lista tutti i mazzi PLAYER (per comporre tavolo)
GET  /api/decks/mine          mazzi dell'utente corrente
GET  /api/decks/:id           singolo mazzo con decklist
POST /api/decks               crea mazzo {name, commander, colors, bracket, archetype, decklist}
PATCH /api/decks/:id          modifica mazzo
DELETE /api/decks/:id         elimina mazzo (solo se non usato in partite)
POST /api/decks/import        {url} → {decklist} — Archidekt (API) o Moxfield (spesso bloccato → guida export)

// GAMES (gamesV2)
GET  /api/games               lista partite con reactions + comment count
GET  /api/games/:id           dettaglio partita
POST /api/games               crea partita {players:[{userId,deckId,isWinner,placement,eliminatedById}], playedAt, notes}
PATCH /api/games/:id          modifica partita (admin o creatore)
DELETE /api/games/:id         elimina partita
GET  /api/games/:id/comments  lista commenti
POST /api/games/:id/comments  {body} → crea commento + notifica altri partecipanti
DELETE /api/games/:gameId/comments/:commentId
POST /api/games/:id/reactions {emoji} → toggle reazione

// STATS
GET  /api/stats/players       [{id, username, games, wins, winRate}] ordinato per winRate DESC
GET  /api/stats/decks         [{id, name, commander, colors, bracket, archetype, owner, ownerId, games, wins, winRate}]
GET  /api/stats/matchups      [{deckA:{id,name,owner}, deckB:{...}, games, wins, winRate}]
GET  /api/stats/achievements/:userId  {unlocked: [achievementId, ...]}

// NOTIFICATIONS
GET  /api/notifications       ultime 40 notifiche dell'utente
GET  /api/notifications/unread-count   {count}
POST /api/notifications/read  segna tutte come lette

// EVENTS
GET  /api/events              lista eventi ordinata per data ASC
POST /api/events              crea evento (admin) {title, description, startsAt, allDay, location, format, bestOf}
PATCH /api/events/:id         modifica evento (admin)
DELETE /api/events/:id        elimina evento (admin)
POST /api/events/:id/rsvp     toggle iscrizione utente
GET  /api/events/:id          dettaglio evento con rounds, tables, seats, standings (1v1)
POST /api/events/:id/rounds   genera turno successivo (admin): pod-based o swiss
DELETE /api/events/:eventId/rounds/:roundId   elimina turno (admin)
POST /api/events/:eventId/tables/:tableId/result   registra risultato tavolo {winnerUserId|isDraw, scoreA, scoreB}

// ADMIN (ruolo ADMIN)
GET  /api/admin/export        backup JSON completo (users, decks, games)
GET  /api/admin/users         lista utenti con conteggi
POST /api/admin/users         {username, password}
PATCH /api/admin/users/:id    {username?, password?, role?}
DELETE /api/admin/users/:id   (solo se no mazzi/partite)

// JUDGE
POST /api/judge               {question} → {answer, explanation, confidence, rulesUsed, cardsDetected, sources}
                              NON esiste GET /api/judge (storico non esposto)
```

---

## Achievement (26 totali)

**Pubblici** (visibili prima dello sblocco):
`rookie` · `first_win` · `streak3` · `streak5` · `streak7` · `wins10` · `wins25` · `collector` · `rainbow` · `fivecolor_deck` · `monocolor_win` · `survivor` · `fullpod_win` · `hunter` · `executioner` · `veteran` · `games50` · `games100` · `dominator` · `season_champion` (solo stagioni concluse)

**Segreti** (nascosti fino allo sblocco):
`last_one_standing` · `nemesis5` · `triple_day` · `wooden_spoon` · `giant_slayer` · `season_perfect` (solo stagioni concluse)

Logica **DUPLICATA** in `frontend/src/lib/achievements.js` e `backend/src/lib/achievements.js` → vanno tenuti in **parità** (entrambi hanno test).

---

## Stagioni

3 blocchi da 4 mesi: **Gen–Apr** (Q=0), **Mag–Ago** (Q=1), **Set–Dic** (Q=2).
Chiave: `"YYYY-Q"` (es. `"2025-1"`). Qualificazione: ≥30% delle partite della stagione.
Punteggio: 1°=3, 2°=2, 3°=1, +1 per ogni partenza. Achievement stagionali solo per stagioni concluse.

---

## Pagine — cosa c'è già (non rileggere il codice)

### FeedPage (`/`) — HOME
- `SnapshotCard`: "Ciao [username]", stagione corrente, rank/win rate, streak se ≥2
- `EventBanner`: prossimo evento con data e RSVP count → link `/evento/:id`
- Feed misto: ultime 25 partite + notifiche non-evento, ordinate per data DESC, taglio a 30 item
- `GameFeedItem`: 🏆 vittoria (verde) / ⚔ sconfitta con nome vincitore; date relative ("Oggi", "Ieri", "N gg fa")
- `NotifFeedItem`: bordo `t.primaryBg` se non letta; salta `type === 'event'` (già nel banner)
- Loading: Skeleton

### GiocaPage (`/gioca`)
- CTA principale "Nuova partita" → `/nuova-partita`
- Ultimi mazzi usati dall'utente con link a profilo
- Link all'ultima partita giocata

### GruppoPage (`/gruppo`)
4 MetricCard in alto (partite totali, giocatori, mazzi, top player), poi **4 tab URL-based** (`?tab=`):
- **Stagione** (default, no `?tab`): selector stagione, classifica con punti/qualificazione + **Primati** (collassabile, default aperto, 11 record, card grid `minmax(110px)` → 3 col mobile) + **Meta colori** (collassabile, default chiuso)
- **Giocatori** (`?tab=giocatori`): lista tutti i giocatori ordinata per win rate, WinBar, link a profilo
- **Mazzi** (`?tab=mazzi`): lista tutti i mazzi ordinata per win rate, DeckThumb + BracketBadge, link a profilo
- **Storico** (`?tab=storico`): presets periodo + range date custom, `GameSocial`

### DashboardPage (`/dashboard`) — LEGACY ancora funzionante
6 tab nell'URL (`?tab=…`): `stagione | giocatori | mazzi | matchup | storico | primati`
Non è nel dock né nel desktop navbar principale, ma raggiungibile via URL diretto.

### PlayerProfilePage (`/giocatore/:id`) — progressive disclosure (6 sezioni)
1. **Header**: avatar, username, win rate globale, partite, streak inline se ≥2
2. **Achievement** (posizione 2, collassabile): mostra hint "Prossimo: [titolo] — [desc]" quando chiuso; `?ach=1` lo apre e scrolla
3. **Mazzi del giocatore**: lista con win rate, link a DeckProfilePage
4. **Scontri diretti ⚔️** (collapsible, default chiuso): rivalità h2h — select avversario, partite condivise, meBetter/oppBetter, myKills/oppKills
5. **Statistiche dettagliate** (collapsible, default chiuso): stats chiave + kill tracking + trend win rate SVG
6. **Storico partite**: ultime partite con `GameSocial`

### DeckProfilePage (`/mazzo/:id`) — tab perf/lista
- Banner: art_crop commander, nome, bracket badge, colori, win rate
- **Tab switcher** `[ Performance | Lista carte ]` sotto il banner
- **Tab "Performance"**: stats card + stima prezzo `~€ XX.XX · prezzi Scryfall · carta singola` (da `prices.eur` Scryfall, `useMemo`) + matchup list + "Andamento win rate" (collapsible, default chiuso) + storico
- **Tab "Lista carte"**: carte per tipo (Gruppi: Commander, Creature, Planeswalker, Istantanei, Stregonerie, Artefatti, Incantesimi, Terre, Altro). Desktop: anteprima sticky hover; Mobile: modal tap. Footer: `~€ XX.XX (Scryfall)`

### NewGamePage (`/nuova-partita`)
- Slot giocatori 3–5: select user + select mazzo (grouped per user)
- Vincitore: select dal tavolo
- Ordine uscita: toggle giocatori eliminati in sequenza (primo eliminato → ultimo); piazzamenti calcolati automaticamente (vincitore=1°, usciti in ordine inverso)
- Chi ha eliminato: select per ogni eliminato
- Data: default oggi (locale, non UTC), override custom
- `podContext` da `location.state`: pre-popola giocatori quando arriva da EventDetailPage

### AdminPage (`/admin`)
3 tab: **Users** (CRUD utenti, cambio ruolo), **Decks** (CRUD mazzi per conto di qualsiasi utente), **Games** (CRUD partite con form completo)

### DeckListPanel (componente)
- Textarea decklist libera
- **Import da URL**: `POST /api/decks/import` → Archidekt (funziona), Moxfield (spesso blocca → messaggio guida export manuale)

### EventsPage (`/eventi`) — /tornei redirige qui (retrocompatibilità)
- Lista eventi con RSVP toggle
- Form crea/modifica evento (solo ADMIN) in **modal overlay** (fixed backdrop + card centrata, chiude su click fuori o ×)

### JudgePage (`/giudice`)
- Textarea domanda + "Chiedi al Judge" (Ctrl+Invio per inviare)
- Risposta: ruling + badge confidenza, spiegazione, carte rilevate, regole CR citate (collassabili)
- **Storico del gruppo**: ultimi 20 `JudgeQuestion` via `GET /api/judge?limit=20`, accordion collassabile

---

## Convenzioni & insidie (le cose che fanno perdere tempo)

- **Achievement: logica DUPLICATA** → vanno tenuti in **parità** (entrambi hanno test). La **fonte di verità per il DISPLAY** è lo **snapshot del server** (`AchievementUnlock`, esposto da `GET /api/stats/achievements/:userId`): `getAchievements` fa **unione snapshot ∪ live**, così gli achievement "non monotoni" (Ammazzagiganti, Dominatore, Sopravvissuto) non spariscono.
- **Achievement stagionali** (`season_champion`, `season_perfect`): solo per **stagioni concluse**, mai per quella in corso.
- **Anti-flood notifiche achievement**: `initAchievementSnapshots` gira a ogni avvio e registra in **silenzio** ciò che è già maturato (niente notifiche retroattive). Lo sblocco "vero" usa il vincolo unique come lock atomico → 1 sola notifica.
- **Notifiche**: create **lato server** come side-effect (mai dal client). **Deep-link**: commento/reazione → `/partita/:id`; evento → `/eventi?focus=:id` (scroll+highlight); achievement → `/giocatore/:id?ach=1`. Polling ogni 60s (`NotificationBell`). `/tornei` redirige a `/eventi` preservando la querystring (retrocompatibilità).
- **Scryfall**: MAI una chiamata `cards/named?format=image` per ogni miniatura (rate-limit 429). Usa `cardCache` (batch `/cards/collection` + URL CDN `cards.scryfall.io` in localStorage). Il batch non trova DFC con solo la faccia frontale né nomi alternativi (universe beyond): `batchFetch` ha un fuzzy fallback via `/cards/named?fuzzy=` per i not_found.
- **Judge Bot**: `lib/judge.js` carica le CR all'avvio in memoria (best-effort, fallback silenzioso). L'URL CR va aggiornato ad ogni set da `https://magic.wizards.com/en/rules`. Rate limit dedicato: 5 req / 5 min per IP. `GROQ_API_KEY` richiesta sia in `.env` locale che in Railway.
  - **Pipeline a due step**: (1) `llama-3.1-8b-instant` (`normalizeQuestion`) risolve abbreviazioni e slang italiano; (2) `llama-3.3-70b-versatile` risponde con oracle text + rulings Scryfall + regole CR.
  - **Parser CR**: le sotto-regole con lettera (es. `608.2b`) nel file CR non hanno il punto dopo la lettera — il pattern regex usa `\.?` (opzionale). Senza questo fix vengono parsate ~1537 regole invece di ~3138.
  - **System prompt**: include principi su stack LIFO e blink=zone change=nuovo oggetto=bersaglio illegale.
- **Dashboard tab nell'URL** (`?tab=mazzi`): il "back" del browser ripristina la scheda. Cambiare tab usa `replace`.
- **Scroll mobile**: NIENTE `overflow-x: hidden` su `<html>` (blocca scroll verticale su Android Chrome). Si usa `overflow-x: clip` sul `body`.
- **Header mobile** stretto: tutto deve stare a 320px (il brand cede per primo con `overflow:hidden`).
- **DB veloce, Scryfall lento**: cache aggressiva sulle carte (immutabili), **niente** cache lato client sulle query DB (rischio dati stantii).
- **Migrazioni dati una tantum**: scriverle **idempotenti** e agganciarle a `start:prod`.
- **Tornei — classifica 1v1 calcolata SOLO lato server** (`tournament.js` + `withStandings` in `routes/events.js`): fonte di verità unica. Svizzera evita re-match, bye al più basso senza bye, **max 4 turni**.
- **Tornei — pod multiplayer = Game VERA** (conta in stats/stagioni/achievement): `EventDetailPage` → "Registra partita" naviga a `/nuova-partita` con `location.state.podContext`. Gli iscritti SENZA mazzi non possono entrare in un pod.
- **Date locali, non UTC**: usare `getFullYear/Month/Date`, MAI `toISOString().slice(0,10)` (shifta col fuso → stagione sbagliata). Vedi `toLocalDate` in `NewGamePage`.
- **Commit da PowerShell**: gli here-string `@'...'@` si rompono con **virgolette doppie** → niente `"` nei messaggi di commit.

---

## Roadmap completata

Archetipi mazzi · Commenti & reazioni · Calendario eventi (admin) + RSVP · Notifiche (con deep-link) · Achievement 26 (pubblici/segreti/stagionali) · Pagina partita (`/partita/:id`) · **Tornei negli eventi** (1v1 svizzera + multiplayer pod con partite reali) · **Judge Bot** (`/giudice`: Groq + Scryfall + CR) · Guida Utente (`GUIDA_UTENTE.md`) · **Dashboard 6 tab** (stagione, giocatori, mazzi, matchup, storico, primati) · **Rivalità h2h** in PlayerProfilePage · **Kill tracking** completo (arcinemico, preda preferita, primati) · **Import decklist da URL** (Archidekt/Moxfield via DeckListPanel) · **Lista carte per tipo** in DeckProfilePage con anteprima hover/modal · **Meta colori** e **attività mensile** nei Primati.

**UX/IA revision (2026-06)**: **FeedPage** (nuova home `/`), **GiocaPage** (`/gioca`), **GruppoPage** (`/gruppo` section-based), **progressive disclosure** PlayerProfilePage (6 sezioni, achievement in posizione 2) e DeckProfilePage (tab perf/lista + stima prezzo €), **storico Judge Bot** (`GET /api/judge`), **modal form eventi**, **deep-link notifiche** `/eventi?focus=:id`, **5-item dock** mobile.

**Refactor UX (2026-06)**: **GruppoPage** ristrutturata con **4 tab URL-based** (Stagione/Giocatori/Mazzi/Storico); Primati compatti (`minmax(110px)`, 3 col mobile); **rinomina Tornei → Eventi** ovunque (dock, navbar, route canonica `/eventi`, heading, notifiche backend); `/tornei` → redirect retrocompatibile. **GUIDA_UTENTE.md** riscritta con screenshot mobile reali (20 immagini).

Robustezza: PrismaClient singleton, rate-limit login + judge, test Vitest su achievement/stagioni/decklist/torneo/judge, cache immagini/liste, deep-link notifiche.
