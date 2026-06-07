# CLAUDE.md — Commanderone · Villastellone

Tracker di partite **Magic: The Gathering / Commander (EDH)** per il gruppo di Villastellone.
App full-stack deployata: i membri registrano partite, mazzi, statistiche, eventi, e c'è uno strato social (commenti/reazioni), achievement e notifiche.

> Questo file è il contesto che leggo a inizio sessione. Tienilo aggiornato quando l'architettura cambia.

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
    decklist.js       validazione decklist (100 carte, esistenza su Scryfall)
    tournament.js     algoritmi torneo PURI: podSizes (3-5, pref 4), makePods/makePairings, standings1v1, swissPairings (con test)
    judge.js          Judge Bot: parse/search CR, keyword extraction, card detection Scryfall, chiamata Groq (con test)
  routes/             auth, admin, decks, gamesV2 (partite + commenti/reazioni), stats, events (calendario + tornei), notifications, judge
  ensureAdmin.js                 upsert admin (one-shot, suo PrismaClient)
  migrateNotificationLinks.js    migrazione idempotente: link notifiche vecchie → deep-link
  migrateSeasonAchievements.js   migrazione idempotente: rimuove achievement stagionali assegnati per errore
  (games.js è LEGACY, non montato — si usa gamesV2.js)

frontend/src/
  App.jsx             rotte + layout (header desktop/mobile, dock mobile, NotificationBell)
  lib/
    api.js            client fetch (Authorization Bearer)
    achievements.js   definizioni + computeUnlocked (mirror backend); getAchievements fa UNIONE snapshot+live
    seasons.js        stagioni 4-mesi, punteggi, classifica, campione
    cardCache.js      cache immagini+tipi carta Scryfall (localStorage, batch /cards/collection)
    scryfall.js       chiamate Scryfall (autocomplete, colori, validazione)
  pages/              DashboardPage, DecksPage, DeckProfilePage, PlayerProfilePage, GamePage (/partita/:id),
                      EventsPage (/eventi), EventDetailPage (/evento/:id, torneo), AdminPage, NewGamePage, Login,
                      JudgePage (/giudice)
                      (Dashboard.jsx è LEGACY)
  components/         DeckThumb, GameSocial, NotificationBell, BracketBadge, ArchetypeBadge, DeckListPanel, ...
```

## Modello dati (Prisma)

`User`, `Deck` (commander, colors, bracket, archetype, decklist), `Game` (playedAt, notes, createdBy),
`GamePlayer` (isWinner, **placement**, **eliminatedById**), `Comment`, `Reaction` (`@@unique[gameId,userId,emoji]`),
`Notification` (type, title, body, link, read), `AchievementUnlock` (`@@unique[userId,achievementId]`).

Eventi/tornei: `Event` (startsAt, allDay, location, **format** 'multiplayer'|'1v1', **bestOf**),
`EventRsvp` (iscritti, `@@unique[eventId,userId]`), `EventRound` (turno), `EventTable` (pod o pairing;
**gameId** = partita reale per i pod multiplayer; scoreA/scoreB/winnerUserId/isDraw/done per 1v1),
`EventSeat` (posto = utente).

Judge Bot: `JudgeQuestion` (userId, question, answer, explanation, confidence, sourcesJson, rulesUsed, createdAt).

---

## Convenzioni & insidie (le cose che fanno perdere tempo)

- **Achievement: logica DUPLICATA** in `frontend/src/lib/achievements.js` e `backend/src/lib/achievements.js` → vanno tenuti in **parità** (entrambi hanno test). La **fonte di verità per il DISPLAY** è lo **snapshot del server** (`AchievementUnlock`, esposto da `GET /api/stats/achievements/:userId`): `getAchievements` fa **unione snapshot ∪ live**, così gli achievement "non monotoni" (Ammazzagiganti, Dominatore, Sopravvissuto) non spariscono dopo essere stati guadagnati.
- **Achievement stagionali** (`season_champion`, `season_perfect`): solo per **stagioni concluse**, mai per quella in corso.
- **Anti-flood notifiche achievement**: `initAchievementSnapshots` gira a ogni avvio e registra in **silenzio** ciò che è già maturato (niente notifiche retroattive). Lo sblocco "vero" usa il vincolo unique come lock atomico → 1 sola notifica.
- **Notifiche**: create **lato server** come side-effect (mai dal client). **Deep-link** all'oggetto: commento/reazione → `/partita/:id`; evento → `/eventi?focus=:id` (scroll+highlight); achievement → `/giocatore/:id?ach=1` (apre la sezione). Polling ogni 60s (`NotificationBell`).
- **Scryfall**: MAI una chiamata `cards/named?format=image` per ogni miniatura (rate-limit 429). Usa `cardCache` (batch `/cards/collection` + URL CDN `cards.scryfall.io` in localStorage). Stesso meccanismo per la lista carte per tipo. Il batch `/cards/collection` non trova DFC con solo la faccia frontale né nomi alternativi (universe beyond): `batchFetch` ha un fuzzy fallback via `/cards/named?fuzzy=` per i not_found.
- **Judge Bot**: `lib/judge.js` carica le CR all'avvio in memoria (best-effort, fallback silenzioso). L'URL CR va aggiornato ad ogni set da `https://magic.wizards.com/en/rules`. Rate limit dedicato: 5 req / 5 min per IP. `GROQ_API_KEY` va aggiunta sia in `.env` locale che nelle variabili Railway prima del deploy.
  - **Pipeline a due step**: (1) `llama-3.1-8b-instant` (`normalizeQuestion`) risolve abbreviazioni (PoE→Path to Exile, StP→Swords to Plowshares) e slang italiano (blinka→blink) estraendo nomi carta e concetti-chiave inglesi per la ricerca CR; (2) `llama-3.3-70b-versatile` risponde con il contesto arricchito (oracle text + ruling Scryfall + regole CR trovate).
  - **Parser CR**: le sotto-regole con lettera (es. `608.2b`) nel file CR non hanno il punto dopo la lettera — il pattern regex usa `\.?` (opzionale). Senza questo fix vengono parsate ~1537 regole invece di ~3138 e regole critiche come 608.2b (bersaglio illegale) e 115.9b vengono ignorate.
  - **System prompt finale** include principi espliciti su: (a) stack LIFO — "in risposta" significa che il tuo spell risolve PRIMA, quindi un permanente entrato in risposta è già in gioco quando lo spell originale risolve; (b) blink = zone change = nuovo oggetto = bersaglio illegale. Questi principi garantiscono ruling corretti su qualsiasi spell con target e sulle interazioni triggered-ability + stack.
- **Dashboard tab nell'URL** (`?tab=mazzi`): così il "back" del browser/gesture ripristina la scheda. Cambiare tab usa `replace`.
- **Scroll mobile**: NIENTE `overflow-x: hidden` su `<html>` (su Android Chrome rende `<html>` un contenitore di scroll e blocca lo scroll verticale). Si usa `overflow-x: clip` sul `body`.
- **Header mobile** stretto: logo + nome utente + 🔔 + tema + Esci devono stare anche a 320px (il brand cede per primo con `overflow:hidden`).
- **DB veloce, Scryfall lento**: cache aggressiva sulle carte (immutabili), **niente** cache lato client sulle query DB (rischio dati stantii; sono già millisecondi).
- **Migrazioni dati una tantum**: scriverle **idempotenti** e agganciarle a `start:prod` (vedi i due `migrate*.js`).
- **Tornei — classifica 1v1 calcolata SOLO lato server** (`tournament.js` + `withStandings` in `routes/events.js`) e allegata al dettaglio evento: fonte di verità unica, niente mirror sul client (lezione achievement). Svizzera evita i re-match, bye al più basso senza bye, **max 4 turni**.
- **Tornei — il risultato di un pod multiplayer è una Game VERA** (conta in stats/stagioni/achievement): `EventDetailPage` → "Registra partita" naviga a `/nuova-partita` con `location.state.podContext` (giocatori bloccati); al salvataggio crea la Game e la collega a `EventTable.gameId`. Gli iscritti SENZA mazzi (es. admin) non possono entrare in un pod registrato.
- **Date locali, non UTC**: per pre-compilare/salvare una data usare i componenti **locali** (`getFullYear/Month/Date`), MAI `toISOString().slice(0,10)` (shifta di un giorno col fuso → la partita finirebbe nella stagione sbagliata). Vedi `toLocalDate` in `NewGamePage`.
- **Commit da PowerShell**: gli here-string `@'...'@` si rompono se il messaggio contiene **virgolette doppie** → niente `"` nei messaggi di commit (usa parole o apici).

## Roadmap completata

Archetipi mazzi · Commenti & reazioni · Calendario eventi (admin) + RSVP · Notifiche (con deep-link) · Achievement (pubblici/segreti/stagionali) · Pagina partita (`/partita/:id`) · **Tornei negli eventi** (formato 1v1 svizzera con classifica/vincitore, o multiplayer a pod con partite reali) · **Judge Bot** (`/giudice`: Q&A ruling Commander via Groq + Scryfall + CR) · Guida Utente (`GUIDA_UTENTE.md`, con screenshot in `docs/img/`).

Robustezza fatta: PrismaClient singleton, rate-limit login + judge, aria-label, test Vitest sulle logiche pure (achievement, stagioni, decklist, **torneo**, **judge**), cache immagini/liste.

> Nota: la Guida Utente (`GUIDA_UTENTE.md`) **non** copre ancora la sezione **Tornei** — da aggiornare quando si vuole.
