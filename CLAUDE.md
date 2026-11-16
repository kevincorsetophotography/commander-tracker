# CLAUDE.md — Commanderone · Villastellone

Tracker di partite **Magic: The Gathering / Commander (EDH)** per il gruppo di Villastellone.
App full-stack deployata: i membri registrano partite, mazzi, statistiche, eventi, e c'è uno strato social (commenti/reazioni), achievement e notifiche.

> Questo file è il contesto che leggo a inizio sessione. Tienilo aggiornato quando l'architettura cambia.
> **Regola pratica**: prima di dire "manca X", cerca nel codice. Il progetto è più completo di quanto sembri.

---

## Stack & deploy

- **Frontend**: React 18 + Vite 5, `react-router-dom` 6, **stili inline** (niente CSS framework), tema dark/light (`hooks/useTheme`), PWA. Test: **Vitest 2** (`frontend/ npm test`).
- **Backend**: Node + Express + **Prisma 5** + **PostgreSQL**. Auth JWT + bcrypt, registrazione protetta da **INVITE_CODE**. Test: Vitest 2 (`backend/ npm test`).
- **Produzione**: frontend https://commanderone-villastellone.vercel.app · API https://commanderone-villastellone.up.railway.app/api
  (commanderone.vercel.app e commander-tracker-production sono morti). Backend e Postgres su Railway **EU West (Amsterdam)**,
  stessa regione, DB sulla rete privata: ~90 ms per chiamata dall'Italia (un 404 senza DB ~85-105 ms). Se torna lento,
  primo controllo: le due regioni coincidono? (Prima del 2026-11-16 era US → ~220 ms.)
- **Stato al 2026-11-17**: `main` = `5c0a142`, tutto pushato e in produzione.
- **Deploy**: push su `main` →
  - **Railway** (backend + Postgres): esegue `start:prod` = `prisma db push --accept-data-loss && ensureAdmin && migrateNotificationLinks && migrateSeasonAchievements && index.js`.
  - **Vercel** (frontend): build statico, SPA rewrites (`vercel.json`).
- **Node 18** in locale → Vitest e Prisma sono fissati a versioni compatibili (Vitest **2.x**, non 4.x).

## Ambiente di sviluppo locale (isolato, NON tocca produzione)

- `cd backend && npm run dev` → `scripts/dev.mjs`: avvia un **PostgreSQL embedded** (`embedded-postgres`) su **:5433**, fa `db push`, **semina** dati di test se vuoto, poi nodemon su **:3001**.
  - Il DB locale **deve essere UTF-8** (per le emoji). `dev.mjs` lo (ri)crea UTF-8 se serve: su Windows initdb usa WIN1252 di default, che fa crashare i salvataggi con emoji.
  - Credenziali seed: `admin/test`; giocatori `Ramuh, Shiva, Ifrit, Bahamut, Leviath, Titan` → password `test`.
  - Il seed produce **34 partite**: 28 distribuite random sugli ultimi 5 mesi + **6 con date fisse** (1-7 giorni fa, Ramuh vince 4/6) — garantisce che `DeckSpotlight` e `WeeklyActivity` abbiano sempre dati in dev.
- Frontend: `cd frontend && npx vite --host` (:5173). Punta a `http://localhost:3001/api` di default (`lib/api.js`, niente `.env` frontend in locale).
- `.env` (backend, **gitignored**): `DATABASE_URL` (locale o Railway), `JWT_SECRET` (≥32 char), `PORT`, `FRONTEND_URL`, `INVITE_CODE`, `GROQ_API_KEY` (per il Judge Bot).

### Gotcha Windows + Prisma
Rigenerare il client mentre il backend gira **blocca la query-engine DLL** (EPERM). Procedura: `db push --skip-generate` è sicuro a caldo; per `prisma generate` **fermare il backend**, generare, riavviare. (Le migrazioni usano `prisma db push`, **niente cartella migrations**.)

## Verifica delle modifiche (come lavoro qui)

- Uso **Playwright** in `~/ct-shots` (FUORI dal repo) per pilotare l'app reale: chromium via `channel:'msedge'` (no download), **webkit** per simulare iOS Safari. Screenshot di debug in `docs/img/_*.png` → **cancellati dopo**.
- Login programmatico via API, token iniettato in `localStorage` (`ct_token`, `ct_user`, `ct_theme`).
- Pattern: implemento → verifico in locale (desktop + mobile, spesso anche webkit) → `npm test` + `vite build` → commit. **Push su `main` SOLO con un ok scritto di Kevin che nomina azione e commit** ("push del commit abc123 su main"): il push fa partire il deploy in produzione. I push di branch possono essere bloccati dal classificatore: si lavora su `main` in locale o si fa merge fast-forward del branch prima del push.
- Commit: messaggio in inglese, termina con la riga `Co-Authored-By:` del modello in uso.
- **Lentezze in prod**: ogni risposta API ha l'header `Server-Timing` (`app;dur=…, db;dur=…;desc="N query"`, DevTools → Network → Timing) e le richieste oltre 300 ms (`SLOW_REQUEST_MS`) finiscono nei log Railway come `[slow] METODO /path status total=… db=… queries=…` (`lib/serverTiming.js`). Se il server risponde in pochi ms ma la UI sembra lenta, il problema è nel frontend (es. attese di animazioni: vedi apertura tavolo ottimistica). Script Playwright di timing: `~/ct-shots/table_open_timing.js` (`DELAY` simula la rete).
- **nodemon su Windows a volte NON riavvia** il backend dopo una modifica: se una modifica backend "non funziona" in locale, controlla che il processo `src/index.js` sia recente e in caso riavvialo.

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
    openTables.js     regole pure dei tavoli aperti (finestra evento, max posti) — con test
    scoreboard.js     regole pure del segnapunti condiviso (vita, veleno, danni commander, undo, seatOrder) — con test
    defaultAvatar.js  avatar di default = commander più giocato (poi creato per ultimo) — con test
    permissions.js    canCreateEvent / canManageEvent (admin, organizzatore)
    publicStats.js    totali aggregati per la landing — con test
    serverTiming.js   header Server-Timing + log [slow]
    asyncRoutes.js    wrapRouter: errori async → 500 invece di crash — con test
  routes/
    auth.js           POST /register, POST /login
    admin.js          CRUD users + export JSON (richiede ADMIN)
    decks.js          CRUD mazzi + POST /import (Archidekt/Moxfield)
    gamesV2.js        CRUD partite + commenti + reazioni (MONTATO; games.js è LEGACY)
    stats.js          GET players, decks, matchups, achievements/:userId
    events.js         CRUD eventi + RSVP + turni + risultati tavoli
    notifications.js  GET lista, GET unread-count, POST read
    judge.js          POST / (domanda → askJudge + salva JudgeQuestion), GET storico
    tables.js         tavoli aperti + posti + mazzi + segnapunti condiviso
    me.js             GET /api/me
    public.js         GET /api/public/stats (landing, senza login)
    scryfall.js       proxy immagini Scryfall (CORS)
  ensureAdmin.js                 upsert admin (one-shot, suo PrismaClient)
  migrateNotificationLinks.js    migrazione idempotente: link notifiche vecchie → deep-link
  migrateSeasonAchievements.js   migrazione idempotente: rimuove achievement stagionali assegnati per errore
  (games.js è LEGACY, non montato)

frontend/src/
  App.jsx             rotte React + layout (header desktop/mobile, dock 5-item mobile, NotificationBell)
                      Dock: Feed(/) | Gioca(/gioca) | Eventi(/eventi) | Gruppo(/gruppo) | Io(/giocatore/:id)
                      Desktop navbar: Feed | Gioca | Eventi | Gruppo | Mazzi | [Admin]
                      /tornei → /eventi redirect (retrocompatibilità deep-link)
                      /info → LandingPage, pubblica e scollegata dal portale (nessun redirect in base al
                      login): "/" resta sempre il portale (Feed se loggato, redirect a /login altrimenti)
  lib/
    api.js            client fetch (Authorization Bearer) — espone tutti i metodi API
    achievements.js   26 achievement: definizioni + computeUnlocked (mirror backend)
    seasons.js        stagioni 4-mesi, seasonOf, listSeasons, computeStandings
    cardCache.js      cache immagini+tipi carta Scryfall (localStorage, batch /cards/collection + fuzzy fallback)
    scryfall.js       chiamate Scryfall (autocomplete, colori, validazione, categorizeCard)
    brackets.js       BRACKETS {1:Casual, 2:Bilanciato, 3:Potente, 4:cEDH}, BRACKET_OPTIONS
    archetypes.js     ARCHETYPE_OPTIONS [Aggro, Midrange, Control, Combo, Stax, Aristocrats, Tokens, Voltron, Ramp]
    defaultAvatars.js useDefaultAvatar(username): mappa condivisa da /api/stats/default-avatars (TTL 5 min,
                      invalidata dall'evento `ct:avatars-stale` che api.js emette dopo scritture su mazzi/partite/profilo)
    deckList.js       filterSortDecks + DECK_SORTS (ricerca/ordinamento di "I miei mazzi") — con test
    decklistEdit.js   regola commander + 99: stripCommander, countCards, buildDecklist — con test
    freeScore.js · scoreboard.js · lifeCounter.js   segnapunti libero / specchio ottimistico / layout 2-6 — con test
    confetti.js       fireConfetti() — celebrazione visiva a schermo
    theme.js          token colore dark/light (bgSurface, border, primary, text, textSub, danger, win, winBg, gradient, glow, shadow…)
  hooks/
    useAuth.js        {user, login, register, logout} — JWT in localStorage
    useTheme.js       {t, dark, toggleDark} — tema colori dinamico
    useIsMobile.js    boolean (≤768px)
    useCountUp.js     animazione numerica (MetricCard in Dashboard)
  pages/
    LandingPage.jsx        /info — landing pubblica (marketing/community), scollegata dal portale: nessun redirect
                           né dipendenza da useAuth, accessibile a chiunque indipendentemente dal login. hero, chi
                           siamo, cosa facciamo, modo di giocare, proxy friendly, rule 0, mood, quando e dove, foto
                           (gallery con lightbox), footer, link "Accedi" (in alto a destra nella nav) verso /login per
                           i soci già registrati (e viceversa: Login.jsx ha un link "Chi siamo" verso /info). Scroll
                           interno animato (smoothScrollTo con offset per la nav sticky, rispetta prefers-reduced-
                           motion). Stile scoped in LandingPage.css (prefisso lp-), palette dark hard-coded
                           (coerente con lib/theme.js dark) indipendente dal toggle tema del portale. Dettagli a tema
                           Magic: ManaRow (pip WUBRG in hero/footer), rarity-dot colorato sulle card "Cosa facciamo",
                           watermark di simboli tenue sulle sezioni alt, decorazioni d'angolo (dado/carte, nascoste
                           sotto 720px).
                           Restyle 2026-11 (mockup Stitch "Deck Carte Interattive in Primo Piano"): hero "Il tavolo
                           da 4. Il tuo pod." + CTA "Entra nel pod" (/login); i 4 formati come CARTE in un ventaglio
                           (motion, frecce/puntini/swipe/tastiera); rullino foto orizzontale con lightbox; selettore
                           WUBRG con 5 principi (frasi reali, colore decorativo); bracket dell'app in Rule 0; "La Tana"
                           con mappa stilizzata + link Google Maps. SOLO contenuti reali (niente dati inventati da Stitch).
                           Foto reali: file in frontend/public/Foto Commanderone/ (nome con spazio, referenziato come
                           /Foto%20Commanderone/... in GALLERY_SLOTS). Versioni leggere in Foto Commanderone/web/
                           (<nome>-800.webp per rullino/carte, -1600.webp per il lightbox; `web: true` nello slot).
                           Per aggiungerne altre: copiare il file, generare le due webp (o omettere `web`) e aggiungere
                           una riga a GALLERY_SLOTS — se un file manca, il tile mostra "Foto in arrivo".
                           Logo leggero per la landing: public/logo-192.webp e logo-384.webp (logo.png resta per favicon/OG).
                           Interattivi (LandingExtras.jsx): scia di mana nell'hero (canvas), scintille e pioggia di rane
                           (5 tocchi sullo stemma), ventaglio che parte impilato + tilt 3D (giroscopio solo senza prompt),
                           manopola bracket B1-B4, d20 in "modo di giocare", La Tana tappabile, countdown al venerdì 21:30
                           ora di Roma (lib/nextNight.js, con test), numeri reali da /api/public/stats (nascosti se l'API fallisce).
                           Rullino foto: marquee trascinabile (FilmStrip). Stemma animato a ogni apertura.
                           Instagram (INSTAGRAM_URL in cima al file): carta in fondo al rullino, icona in barra (solo >440px), footer.
    Login.jsx             /login — form login/register con inviteCode
    FeedPage.jsx          / (autenticato) — home feed: snapshot stagione, classifica mini, deck spotlight, attività settimanale, ultime partite + notifiche
    GiocaPage.jsx         /gioca — landing "Gioca": CTA nuova partita, mazzi recenti, ultima partita
    GruppoPage.jsx        /gruppo — statistiche gruppo con 4 tab URL-based: Stagione (classifica + Primati + Meta), Giocatori, Mazzi, Storico
    DashboardPage.jsx     /dashboard — 6 tab stats LEGACY (ancora funzionante, non nel dock)
    DecksPage.jsx         /mazzi — involucro di components/MyDecks (griglia completa con ricerca + ordinamento)
    DeckProfilePage.jsx   /mazzo/:id — profilo mazzo (tab perf/lista, stima prezzo €)
    PlayerProfilePage.jsx /giocatore/:id — profilo giocatore (progressive disclosure 6 sezioni)
    GamePage.jsx          /partita/:id — dettaglio partita + social
    NewGamePage.jsx       /nuova-partita — form registrazione partita
    EventsPage.jsx        /eventi — eventi + RSVP (form crea/modifica in modal overlay); /tornei redirige qui
    EventDetailPage.jsx   /evento/:id — dettaglio torneo (turni, tavoli, standings)
    TablePage.jsx         /tavoli/:id — pagina del tavolo aperto (solo seduti): mazzi + segnapunti condiviso + Registra risultati
    FreeScorePage.jsx     /segnapunti (menu avatar mobile) — segnapunti LIBERO, non legato a un tavolo: setup 2-6 giocatori
                          (utenti registrati col loro mazzo via PlayerPicker, oppure ospiti con nome + commander facoltativo
                          via CommanderInput; ospiti = userId negativi) → stesso LifeCounter in modalità `local`.
                          Tutto sul telefono: regole pure in lib/freeScore.js (specchio di backend scoreboard.js, con test),
                          stato in sessionStorage (`ct_free_score`) solo contro il ricaricamento; "Chiudi segnapunti" chiede
                          conferma e lo distrugge. "Registra risultati" nel menu solo se tutti registrati e ≥3: apre
                          /nuova-partita con `location.state.prefill` (giocatori/mazzi precompilati ma modificabili); al
                          salvataggio la partita cancella lo stato del segnapunti.
    AdminPage.jsx         /admin — gestione utenti/mazzi/partite (solo ADMIN)
    JudgePage.jsx         /giudice — Q&A ruling Commander + storico domande del gruppo (ultimi 20)
    GuidaPage.jsx         /guida (menu avatar → Guida utente, pulsante Guida sul proprio profilo) — guida in-app.
                          Contenuti SOLO in pages/guida/guideContent.js (capitoli con colore di mana, blocchi p/steps/list/
                          tip/warn/table/shot/shots/gestures + FAQ; test in guideContent.test.js). Indice a carte 63:88,
                          ricerca, zoom immagini, deep-link /guida#<id capitolo>. GUIDA_UTENTE.md è GENERATO da quel file:
                          `cd frontend && npm run guide:md` (non modificarlo a mano). Screenshot: docs/img/guida/*.webp
                          (telefono 390px @2x, ritagliati sugli elementi; script in ~/ct-shots/guida/shots.js, dati demo con
                          setup3.js/decklist.js); vite.config copia docs/img ricorsivamente nel build.
    Dashboard.jsx         LEGACY — non usata
  components/
    DeckThumb.jsx         thumbnail commander (art piccola o avatar con iniziali)
    DeckListPanel.jsx     modal/panel edit decklist + import da URL (Archidekt/Moxfield)
    MyDecks.jsx           "I miei mazzi" (2026-11): griglia di carte compatte (art, colori, livello, win rate);
                          tocco → Sheet "gestisci" (archetipo, livello, Lista/DeckListPanel, Apri, Elimina); Sheet
                          "Nuovo mazzo". /mazzi = completo (ricerca + ordinamento, scelta in localStorage ct_deck_sort,
                          logica pura in lib/deckList.js con test); profilo proprio = limit 4 più giocati + "Vedi tutti".
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

**User**: id, username (unique), password (bcrypt), role (PLAYER|ADMIN), isOrganizer (Boolean, default false — ruolo invisibile: resta PLAYER ma crea/gestisce i PROPRI eventi), avatarCardName?, avatarScryfallId? (stampa scelta). Senza avatar scelto si mostra l'**avatar di default** = art del commander più giocato (calcolato al volo, mai salvato)

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

**OpenTable** (tavolo aperto dai giocatori, separato dai pod di torneo): id, title?, startsAt, isOpen, maxSeats (5, creatore incluso), createdById, eventId? (SetNull), gameId? @unique (SetNull)

**OpenTableSeat**: id, tableId (Cascade), userId (Cascade), createdAt, deckId? (mazzo scelto al tavolo, SetNull) — Unique: (tableId, userId)

OpenTable ha anche `scoreboard Json?` (segnapunti condiviso) e `scoreVersion Int` (cresce a ogni modifica).

---

## API backend — tutti gli endpoint

```
// AUTH
POST /api/auth/register       {username, password, inviteCode}
POST /api/auth/login          {username, password} → {token, user}
PATCH /api/auth/profile       {avatarCardName, avatarScryfallId} → avatar scelto (null = torna al default)

// DECKS
GET  /api/decks               lista tutti i mazzi PLAYER (per comporre tavolo)
GET  /api/decks/mine          mazzi dell'utente corrente
GET  /api/decks/:id           singolo mazzo con decklist
POST /api/decks               crea mazzo {name, commander, colors, bracket, archetype, decklist}
PATCH /api/decks/:id          modifica mazzo. decklist non vuota = commander + 99 (100 righe-carta, validata su Scryfall);
                              decklist '' = solo commander. Se cambia `commander` senza `decklist`, la riga del vecchio
                              commander nella lista salvata diventa quella nuova (replaceCommanderLine)
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
GET  /api/stats/default-avatars   {[username]: commander} per chi non ha scelto un avatar

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

// TAVOLI APERTI (giocatori)
GET  /api/tables?eventId=     tavoli dell'evento, oppure attivi (senza risultato, ultime 12h)
POST /api/tables              {eventId?} → un tocco: aperto, orario adesso (o inizio evento futuro), creatore seduto; aggancio automatico all'evento
PATCH /api/tables/:id         {isOpen?, startsAt?} creatore o admin (startsAt ricalcola l'evento)
DELETE /api/tables/:id        creatore o admin, solo senza risultato
POST /api/tables/:id/join | /leave   (leave del creatore: passa al primo seduto; tavolo vuoto = cancellato)
DELETE /api/tables/:id/seats/:userId creatore o admin
POST /api/tables/:id/result   {gameId} giocatore seduto o admin; giocatori partita == seduti; azzera segnapunti e mazzi del tavolo
GET  /api/tables/:id          SOLO seduti (403 altrimenti): posti+mazzi scelti, mazzi dei seduti, segnapunti
PUT  /api/tables/:id/seats/:userId/deck  {deckId|null} il giocatore per sé, il creatore per tutti; mazzo del giocatore
GET  /api/tables/:id/scoreboard  SOLO seduti, polling ~3s (limiter dedicato 900/min/IP, escluso da apiLimiter)
POST /api/tables/:id/scoreboard  {type:'life'|'poison'|'cmd', userId, fromUserId?, delta} | {type:'undo'} | {type:'seatOrder', order:[userId…]} SOLO seduti; lock di riga FOR UPDATE
DELETE /api/tables/:id/scoreboard  reset a 40 (solo creatore); l'ordine dei posti resta

// PUBBLICO (nessun login, publicLimiter 60/min, cache 5 min)
GET  /api/public/stats        {games, players, decks, nights} — SOLO totali aggregati per la landing /info

// UTENTE CORRENTE
GET  /api/me                  utente aggiornato (role, isOrganizer, avatar) — fuori da /api/auth per non consumare il rate limit del login

// ADMIN (ruolo ADMIN)
GET  /api/admin/export        backup JSON completo (users, decks, games)
GET  /api/admin/users         lista utenti con conteggi
POST /api/admin/users         {username, password}
PATCH /api/admin/users/:id    {username?, password?, role?, isOrganizer?}
DELETE /api/admin/users/:id   (solo se no mazzi/partite)

// JUDGE
POST /api/judge               {question} → {answer, explanation, confidence, rulesUsed, cardsDetected, sources}
GET  /api/judge               ?limit=N → ultime N JudgeQuestion del gruppo (storico pubblico, usato da JudgePage)
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
- `MiniClassifica`: top-3 qualificati stagione corrente con avatar, punti, `ct-bar-fill`; richiede `api.statsPlayers()` per `avatarCardName`. "Vedi classifica" → `/gruppo` (tab Stagione). Nascosta se <2 qualificati.
- `DeckSpotlight`: mazzo con miglior win rate negli **ultimi 10 giorni** (min 3 partite, finestra `Date.now() - 10*86400000`). Calcolato dal `games` array già caricato — nessuna chiamata extra. Nascosto se nessun candidato. Link → `/mazzo/:id`.
- `WeeklyActivity`: contatore partite settimana corrente (lun–oggi) vs settimana precedente, sparkline 7 giorni CSS. Nascosta se entrambe le settimane = 0.
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
3. **Mazzi**: profilo proprio = `MyDecks limit={4}` (4 più giocati, gestione nel pannello, "Vedi tutti" → /mazzi); profilo altrui = Miglior mazzo + lista read-only con win rate
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
- Campo Commander separato + sezione mazzo (textarea) con contatore live N/99. **Sezione vuota = si salva solo il commander**; con carte servono **esattamente 99** (il commander sta nel suo campo; se lo incolli nella lista viene tolto da solo). Regole in `lib/decklistEdit.js`.
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
- **Permessi eventi**: `backend/src/lib/permissions.js` (`canCreateEvent`, `canManageEvent`): admin tutto; organizzatore crea eventi e gestisce SOLO i propri (modifica, elimina, turni, risultati); gli eventi espongono `canManage` per chi guarda e `createdBy` ("Organizzato da"). Il middleware auth rilegge `role` e `isOrganizer` dal DB a ogni richiesta (revoca immediata).
- **Tavoli aperti**: regole pure in `backend/src/lib/openTables.js` (finestra evento: da 1h prima dell'inizio alle 4:00; eventi tutto il giorno = intera giornata; max 5; chiuso = nessuno entra; mai sui tornei 1v1: niente pulsante, l'API rifiuta e l'aggancio automatico li esclude). Notifica `type: 'table'` al creatore quando qualcuno si siede. Il risultato passa da Registra partita con `location.state.tableContext` (giocatori bloccati, come i pod; `players[].deckId` precompila i mazzi).
  - **Pagina del tavolo** `/tavoli/:id` (`TablePage.jsx`): un tavolo CHIUSO (dal creatore o pieno) è cliccabile solo per chi è seduto; il server risponde 403 ai non seduti. Mazzo per posto, segnapunti condiviso (vita 40, ±1/±5, veleno 10, danni commander 21 per avversario che tolgono anche vita; regole pure in `backend/src/lib/scoreboard.js`, specchio ottimistico in `frontend/src/lib/scoreboard.js`). Aperto/chiuso del segnapunti è solo vista per-utente (localStorage), lo stato resta sul server. **Ordine dei posti** condiviso in `scoreboard.seatOrder` (permutazione esatta dei seduti, validata dal server; `seatOrderOf` la ricalcola se i seduti cambiano: chi si alza sparisce, chi arriva va in fondo). Si cambia tenendo premuto il nome nel pannello (~400ms) e trascinandolo su un altro posto (scambio) o con "Ruota i posti" nel menu; NON entra nello storico di Annulla e sopravvive al Ripristina.
  - **LifeCounter condiviso** (`components/LifeCounter.jsx`): solo UI e gesti, lo stato arriva da fuori. Tavolo = trasporto server (TablePage); `local` = segnapunti libero (FreeScorePage, testi del menu adattati, chiusura con conferma, `onRegister` facoltativo). Layout 2-6 giocatori in `lib/lifeCounter.js` (6 = due colonne da tre, solo nel libero: i tavoli hanno max 5 posti).
  - **Fine del tavolo**: risultato registrato → la riga OpenTable RESTA (legame evento→partita per lo storico, "Concluso" nella serata) ma segnapunti e mazzi scelti vengono cancellati e il tavolo esce dagli attivi; cancellazione del creatore → riga, posti e segnapunti eliminati.
- **Tornei — classifica 1v1 calcolata SOLO lato server** (`tournament.js` + `withStandings` in `routes/events.js`): fonte di verità unica. Svizzera evita re-match, bye al più basso senza bye, **max 4 turni**.
- **Tornei — pod multiplayer = Game VERA** (conta in stats/stagioni/achievement): `EventDetailPage` → "Registra partita" naviga a `/nuova-partita` con `location.state.podContext`. Gli iscritti SENZA mazzi non possono entrare in un pod.
- **Date locali, non UTC**: usare `getFullYear/Month/Date`, MAI `toISOString().slice(0,10)` (shifta col fuso → stagione sbagliata). Vedi `toLocalDate` in `NewGamePage`.
- **Commit da PowerShell**: gli here-string `@'...'@` si rompono con **virgolette doppie** → niente `"` nei messaggi di commit.
- **Prestazioni (2026-11)**: il frontend (Vercel) e l'API (Railway) sono su domini diversi + header Authorization → ogni chiamata ha un preflight CORS: `cors({ maxAge: 7200 })` lo fa ricordare al browser (senza, ~2 viaggi per chiamata). Risposte compresse (`compression`). Cache 30s del ruolo nel middleware auth (`forgetUser(id)` nelle modifiche admin: revoca immediata). `vercel.json`: `/assets/*` immutable 1 anno. Logo in app = `logo-192.webp`/`logo-384.webp` (`logo.png` è 1,3 MB: solo OG). Miniature carte SEMPRE da `cardCache` (`useCardArt`): i nomi che il batch non trova passano da una ricerca fuzzy JSON e finiscono in cache; `format=image` solo come ultimo ripiego. Pagina tavolo: chunk precaricato da `OpenTables` e dettaglio richiesto al tocco (`lib/tablePrefetch.js`). Con backend+DB in EU West la latenza base è ~90 ms per viaggio (era ~230 ms dagli USA): la regione conta.
- **iPhone da Home (standalone)**: margine alto = `var(--sat)` (definita in `index.css`) = `max(env(safe-area-inset-top), --sat-min)`; `--sat-min` lo calcola `lib/safeArea.js` (con test) solo su iOS standalone verticale a schermo pieno, come riserva quando iOS riporta env()=0. Usarla per ogni elemento fisso/sticky in alto (header, toast, overlay, segnapunti, Login).
- **Classi animazione globali** (`frontend/src/index.css`): `ct-fade-up` (stagger con `animationDelay`), `ct-bar-fill` (scaleX 0→1 su mount, rimpiazza `transition:width` che non si anima al primo render), `ct-section-open` (collapsible open, opacity+translateY), `ct-modal-in` (spring cubic-bezier per overlay), `ct-lift:active` + `ct-press` (tap feedback mobile), `ct-life-bump`/`ct-delta-in` (segnapunti), `ct-badge-pop`/`ct-bell-ring` (notifiche nuove), `ct-flame` (serie di vittorie); coriandoli (`fireConfetti`) al salvataggio partita e all'apertura degli achievement da notifica (`?ach=1`, solo proprio profilo). Tutte disabilitate con `@media (prefers-reduced-motion: reduce)`. Tab transition trick: `<div key={tab} className="ct-fade-up">` — cambiare key smonta/rimonta il nodo riattivando l'animazione.

---

## Roadmap completata

Archetipi mazzi · Commenti & reazioni · Calendario eventi (admin) + RSVP · Notifiche (con deep-link) · Achievement 26 (pubblici/segreti/stagionali) · Pagina partita (`/partita/:id`) · **Tornei negli eventi** (1v1 svizzera + multiplayer pod con partite reali) · **Judge Bot** (`/giudice`: Groq + Scryfall + CR) · Guida Utente (`GUIDA_UTENTE.md`) · **Dashboard 6 tab** (stagione, giocatori, mazzi, matchup, storico, primati) · **Rivalità h2h** in PlayerProfilePage · **Kill tracking** completo (arcinemico, preda preferita, primati) · **Import decklist da URL** (Archidekt/Moxfield via DeckListPanel) · **Lista carte per tipo** in DeckProfilePage con anteprima hover/modal · **Meta colori** e **attività mensile** nei Primati.

**UX/IA revision (2026-06)**: **FeedPage** (nuova home `/`), **GiocaPage** (`/gioca`), **GruppoPage** (`/gruppo` section-based), **progressive disclosure** PlayerProfilePage (6 sezioni, achievement in posizione 2) e DeckProfilePage (tab perf/lista + stima prezzo €), **storico Judge Bot** (`GET /api/judge`), **modal form eventi**, **deep-link notifiche** `/eventi?focus=:id`, **5-item dock** mobile.

**Refactor UX (2026-06)**: **GruppoPage** ristrutturata con **4 tab URL-based** (Stagione/Giocatori/Mazzi/Storico); Primati compatti (`minmax(110px)`, 3 col mobile); **rinomina Tornei → Eventi** ovunque (dock, navbar, route canonica `/eventi`, heading, notifiche backend); `/tornei` → redirect retrocompatibile. **GUIDA_UTENTE.md** riscritta con screenshot mobile reali (20 immagini).

**Animation & Feed polish (2026-06)**: Sistema animazioni globali in `index.css` (`ct-fade-up`, `ct-bar-fill`, `ct-section-open`, `ct-modal-in`, `ct-lift`, `ct-press`). Stagger su GiocaPage/EventsPage/JudgePage/GruppoPage; tab transition con `key={tab}`; collapsible open con `ct-section-open`; WinBar con `ct-bar-fill` (scaleX). **FeedPage** arricchita: `MiniClassifica` (top-3 stagione), `DeckSpotlight` (miglior mazzo ultimi 10gg, min 3 partite), `WeeklyActivity` (sparkline 7 giorni). Seed dev aggiornato con 6 partite recenti garantite.

**Security hardening (2026-06)**: SSRF fix import deck (`new URL().hostname`), input length limits (username ≤32, password ≤128, decklist ≤20k, notes ≤2000), `apiLimiter` 300 req/min su tutte le route autenticate, `helmet` (HTTP security headers), re-fetch ruolo dal DB ad ogni request (revoca immediata role changes), `npm audit fix` (brace-expansion, qs/express), try/catch su tutti gli handler async.

**Landing page pubblica (2026-08)**: `LandingPage.jsx` + `LandingPage.css` — presentazione ufficiale della community su `/info` (chi siamo, cosa facciamo, modo di giocare, proxy friendly 100%, Rule 0, mood, quando e dove con link Google Maps, gallery foto reali con lightbox, footer). Rotta pubblica indipendente, scollegata dal portale: `/` resta sempre e solo il portale (Feed se loggato, redirect a `/login` altrimenti), nessuna funzionalità esistente toccata. Link incrociati "Accedi" (landing → `/login`) e "Chi siamo" (Login → `/info`). Reveal-on-scroll via `IntersectionObserver` con timeout di sicurezza (2.5s), scroll interno animato con offset nav sticky. SEO/OG in `index.html` + override runtime in `LandingPage.jsx`.

**Novembre 2026**: **avatar di default** dal commander più giocato · **tavoli aperti** con pagina del tavolo, mazzi per posto e **segnapunti condiviso** (vita/veleno/danni commander, ordine posti trascinabile) · **segnapunti libero** `/segnapunti` (2-6 giocatori, anche ospiti, "Registra risultati" precompila la partita) · **guida in-app** `/guida` rifatta · perf (CORS maxAge, compression, cache ruolo, Railway EU West, Server-Timing) + safe-area iPhone standalone · **I miei mazzi** a griglia di carte + pannello (`MyDecks`, ricerca/ordinamento) · regola **commander + 99** nella modifica lista · **sync del commander** nella lista salvata quando lo si cambia.

Robustezza: PrismaClient singleton, rate-limit login + judge + API, test Vitest su achievement/stagioni/decklist/torneo/judge, cache immagini/liste, deep-link notifiche.

---

## Roadmap futura

### Alta priorità

- **Cambio password autonomo**: `PATCH /api/auth/password` con `{currentPassword, newPassword}` — gli utenti non devono passare dall'admin per cambiare la password. Aggiungere anche invalidazione JWT: campo `passwordChangedAt` su User, controllo `token.iat < passwordChangedAt` in `auth.js`.
- **Indice `GamePlayer.userId`**: aggiungere `@@index([userId])` nello schema Prisma — manca l'indice su una colonna usata massicciamente dalle query stats/achievements.
- **Validazione username**: regex `/^[a-zA-Z0-9_.-]{2,32}$/` in register e admin create — attualmente ammette spazi, emoji e caratteri ambigui.
- **Elimina `games.js` legacy**: `backend/src/routes/games.js` non è montato ma genera confusione. Va rimosso.
- **Paginazione `GET /api/games`**: aggiungere `?limit=N&before=<gameId>` (cursor pagination) — senza paginazione con 500+ partite il payload diventa pesante; FeedPage e GruppoPage/Storico caricano comunque tutto e filtrano in JS.

### Media priorità

- **`role` enum in schema Prisma**: sostituire `String` con `enum Role { PLAYER ADMIN }` — aggiunge validazione a livello DB e type safety nel client Prisma.
- **useRequireAdmin middleware negli eventi**: le 4 route admin in `events.js` usano `if (req.user.role !== 'ADMIN')` inline invece del middleware `requireAdmin` — inconsistente con il pattern usato altrove.
- **Commander partner** (`commanderB String?`): alcuni mazzi EDH hanno due commander (Partner). Aggiungere campo opzionale nello schema, nel form di creazione mazzo e in DeckThumb.
- **Ricerca globale**: `GET /api/search?q=` su username/deck name/commander — nessun modo attuale di trovare qualcosa senza navigare manualmente.
- **Export personale giocatore**: `GET /api/me/export` — scarica le proprie partite e mazzi in JSON senza essere admin.
- **Sentry error monitoring**: 3 righe di codice sul backend (Railway) per sapere quando una route inizia a restituire 500 senza aspettare segnalazioni degli utenti.
- **Audit log azioni ADMIN**: `console.log` strutturato con `{action, adminId, targetId, timestamp, ip}` per le mutazioni admin (crea/modifica/elimina utenti, modifica partite altrui).
- **Test di integrazione con supertest**: nessun test copre le route HTTP — aggiungere test per i path critici (auth, games CRUD, ownership check 403, rate limit).

### Bassa priorità / future features

- **Web Push notifications** (PWA): sostituire il polling 60s con notifiche native sul telefono anche con app chiusa. Backend: `web-push` npm + tabella `PushSubscription`. Richiede HTTPS (già su Railway/Vercel).
- **Deck sharing pubblico**: route `/mazzo/:id/public` senza autenticazione per mostrare una lista a chi non è nel gruppo.
- **Staging environment**: branch `dev` → Railway staging, così ogni push non va diretto in produzione.
- **Dashboard.jsx legacy**: componente non raggiungibile dalla navigazione — da rimuovere o integrare in GruppoPage.
- **`npm audit` esbuild/vitest**: le 5 vulnerabilità residue sono tutte nel dev server Vite (non produzione); il fix richiederebbe Vitest 4 incompatibile con Node 18 — rivalutare quando si aggiorna Node.
- **Deck comparison**: tool per confrontare due mazzi (win rate incrociato, matchup diretto, differenza bracket) accessibile da DeckProfilePage.
