# ROADMAP — CommanderOne · Revisione UX

> Generato dopo analisi critica completa dell'app (giu 2025).
> Contiene: problemi identificati, decisioni prese, specifiche di implementazione.
> **Leggere integralmente prima di iniziare qualsiasi intervento UX.**

---

## Contesto della revisione

### Punteggi attuali
| Dimensione | Voto | Note |
|---|---|---|
| Funzionalità | 9/10 | Completo, tutto funziona |
| UX | 5/10 | Organizzazione per entità DB, non per intent utente |
| UI | 7/10 | Coerente, glassmorphism, ma stili inline limitano refactor |
| Navigazione | 4/10 | Dock sovraccarico, "Home" non è una home |
| Mobile Experience | 5/10 | Uso primario da telefono ma alcune pagine sono desktop-first |
| Architettura Informativa | 4/10 | Dati duplicati in 3-4 posti, nessuna dimensione temporale |
| Scalabilità futura | 6/10 | Buona base tecnica, struttura accumula complessità |

### Problema centrale
L'app è **organizzata attorno alle entità del database** (giocatori, mazzi, partite, eventi) invece che ai **bisogni dell'utente in un momento specifico**. Non esiste una dimensione temporale ("cosa è successo oggi"). Ogni feature è stata aggiunta nel posto più logico disponibile al momento — il risultato è densità e duplicazione.

### Contesto d'uso che guida le decisioni
- Gruppo fisso di amici a Villastellone
- **Serate Commander almeno settimanali** — gli eventi sono il battito cardiaco dell'app, non episodici
- Uso primario da **telefono durante la serata**
- Tre modalità d'uso distinte:
  1. **Durante la partita**: Judge bot (ruling urgente), registra partita post-game
  2. **Fine serata**: vedo il mio risultato, achievement, standings torneo
  3. **Navigazione libera**: stats del gruppo, profilo mazzo, storico

---

## Decisioni architetturali prese

### Navigazione — da 6+ voci a 5 fisse

**Attuale dock mobile:** `Home | Mazzi | + Partita | Eventi | Judge | Tu | [Admin]`
- 6 voci per utenti normali, 7 per admin — troppo
- "Home" porta a una Dashboard statistica con 6 tab — falsa aspettativa
- Judge e Partita separati anche se usati nello stesso contesto (serata di gioco)
- Mazzi occupa uno slot ma non è un'azione frequente durante la serata

**Nuova struttura dock mobile:**
```
┌──────┬──────┬──────┬──────┬──────┐
│  🏠  │ 🎮   │  📅  │ 📊   │  👤  │
│ Feed │Gioca │Tornei│Gruppo│  Io  │
└──────┴──────┴──────┴──────┴──────┘
```

| Voce | Rotta | Contiene |
|---|---|---|
| **Feed** | `/` | Nuova Home: attività recente, snapshot stagionale personale, CTA rapide |
| **Gioca** | `/gioca` | Landing con 2 CTA separate: Judge bot + Registra partita |
| **Tornei** | `/tornei` | Lista eventi + RSVP + EventDetailPage (ex /eventi) |
| **Gruppo** | `/gruppo` | Stagione, classifica, primati, meta colori, storico collettivo |
| **Io** | `/giocatore/:mio-id` | Profilo personale, achievement, mazzi, rivalità |

**Desktop navbar:** `Feed | Gioca | Tornei | Gruppo | [Admin]` + UserChip cliccabile a destra (→ profilo personale). Mazzi accessibile da navbar desktop come voce aggiuntiva.

**Admin:** rimosso dal dock. Accessibile da UserChip dropdown o `/admin` diretto.

---

### Pagina "Gioca" — nuova, landing minima

**Decisione:** non tab, non sezioni scrollabili. Due card grandi, un tap, destinazione chiara. Separazione netta tra le due azioni perché usate in momenti diversi della serata anche se nel medesimo contesto fisico.

```
GIOCA
──────────────────────────────────────
┌─────────────────────────────────┐
│  ⚖  JUDGE BOT                  │
│     Ruling Commander            │
│                      [ Apri › ] │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│  ＋  REGISTRA PARTITA           │
│     Nuova partita               │
│                    [ Inizia › ] │
└─────────────────────────────────┘
```

- "Apri" → naviga a `/giudice` (JudgePage invariata)
- "Inizia" → naviga a `/nuova-partita` (NewGamePage invariata)
- La pagina `/gioca` è solo una landing, ~30 righe di codice React

---

### Pagina "Feed" — nuova Home (`/`)

Risponde a: *"Sono appena entrato nell'app, cosa devo sapere?"*

**Struttura:**
```
FEED
──────────────────────────────────────
[RA]  Ciao, Ramuh
      Stagione Mag-Ago · 3° posto · 18 pt
      ████████░░  4 vittorie su 12

──────────────────────────────────────
ATTIVITÀ RECENTE

⚔️  Shiva ha vinto — ieri sera
    Bahamut · Ifrit · Titan · Tu
    [ Vedi partita › ]

🏆  Ifrit ha sbloccato "Streak 5"
    2 giorni fa

💬  Bahamut ha commentato
    "bella mossa con il combo!"
    [ Partita del 3 giu › ]

📅  TORNEO · Domenica 8 giu · ore 18
    6 iscritti · [ Iscriviti ]

⚔️  Tu hai vinto — 3 giorni fa
    4 giocatori · streak attiva 🔥

──────────────────────────────────────
```

**Fonti dati — nessuna nuova API necessaria:**
- Partite recenti: `GET /api/games` (già esiste) — ultime 10
- Achievement sbloccati: notifiche tipo `achievement` (già salvate in DB)
- Commenti recenti: notifiche tipo `comment` (già salvate in DB)
- Prossimi eventi: `GET /api/events` (già esiste) — prossimi 2
- Snapshot stagionale: `GET /api/stats/players` + `GET /api/games` (già usati in DashboardPage)

Il feed è un componente React che aggrega dati già esistenti con `Promise.all`. Nessun nuovo endpoint backend.

---

### Pagina "Gruppo" (`/gruppo`) — sostituisce Dashboard

La Dashboard attuale ha 6 tab di cui 4 duplicano altre pagine. "Gruppo" mantiene solo le sezioni esclusive e collettive, organizzate come sezioni scrollabili (non tab).

**Cosa resta:**
- Classifica stagionale (con selector stagione)
- Primati (11 record del gruppo)
- Meta colori (win rate per colore)
- Storico collettivo partite (con filtri data)

**Cosa sparisce dalla Dashboard attuale:**
- Tab "Giocatori" → duplica i profili individuali, rimosso
- Tab "Mazzi" → duplica DeckProfilePage, rimosso (Mazzi accessibili da navbar desktop)
- Tab "Matchup" → duplica la sezione matchup di DeckProfilePage, rimosso

**Struttura:**
```
GRUPPO
──────────────────────────────────────
🏆 STAGIONE · [← Mag-Ago 2025 →]
   Classifica con barre, punti, qualificazione

──────────────────────────────────────
🥇 PRIMATI                [ Espandi ▼ ]
   Re del mese, streak, kill, ecc.

──────────────────────────────────────
🎨 META COLORI            [ Espandi ▼ ]
   Win rate per colore (W U B R G)

──────────────────────────────────────
📜 STORICO PARTITE
   Ultime partite del gruppo, filtri data
```

---

### Pagina "Io" — profilo personale riorganizzato

**Problema attuale:** 7 sezioni lineari, achievement sepolti in fondo dopo molto scroll. Gli achievement sono la sezione più coinvolgente emotivamente ma sono ultimi.

**Nuova struttura con progressive disclosure:**
```
IO — Ramuh
──────────────────────────────────────
[RA]  Ramuh
      33% win rate · 12 partite
      🔥 Streak attiva: 2 vittorie

──────────────────────────────────────
🏅 ACHIEVEMENT  (4 / 26 sbloccati)
   ✅ Rookie      ✅ Prima vittoria
   ✅ Streak 3    🔒 Streak 5 (prossimo)
   [ Vedi tutti 26 › ]

──────────────────────────────────────
🎴 I MIEI MAZZI
   Zur Control    67% · 9 partite  →
   Krenko Combo   40% · 5 partite  →
   [ + Nuovo mazzo ]

──────────────────────────────────────
⚔️ SCONTRI DIRETTI        [ Espandi ▼ ]
   (collassato — rivalità h2h su richiesta)

📈 STATISTICHE DETTAGLIATE [ Espandi ▼ ]
   Kill, piazzamenti, trend SVG...
   (collassato — per chi è curioso)
```

**Cambiamenti rispetto all'attuale PlayerProfilePage:**
- Achievement salgono dalla posizione 6 alla posizione 2
- Mostro il prossimo achievement sbloccabile per creare engagement progressivo
- Trend SVG rimane ma va dentro "Statistiche dettagliate" collassate (non sparisce)
- Rivalità h2h → dentro "Scontri diretti" collassato (feature buona, discoverability attuale = zero)
- Kill tracking → dentro "Statistiche dettagliate" collassate

---

### JudgePage — aggiunta storico (`/giudice`)

**Problema:** le stesse ruling vengono chieste ogni 2 settimane. Non c'è memoria collettiva.

**Struttura aggiornata:**
```
JUDGE BOT
──────────────────────────────────────
[ La tua domanda...                  ]
[ Ctrl+Invio per inviare             ]
[ ⚖ Chiedi al Judge ]

RISPOSTA
Confidenza Alta · 94%
Il blink causa un cambio di zona...
[ Spiegazione ] [ Regole CR ] [ Fonti ▼ ]

──────────────────────────────────────
DOMANDE RECENTI DEL GRUPPO

  ⚖ "Rhystic Study è obbligatorio?"
     Shiva · 2 giorni fa · Alta confidenza
     [ Leggi › ]

  ⚖ "Blinking un permanente con target"
     Ramuh · 5 giorni fa
     [ Leggi › ]
```

**Backend necessario — `backend/src/routes/judge.js`:**
```js
// GET /api/judge — storico domande del gruppo
router.get('/', auth, async (req, res) => {
  const questions = await prisma.judgeQuestion.findMany({
    orderBy: { createdAt: 'desc' },
    take: 20,
    include: { user: { select: { username: true } } }
  })
  res.json(questions)
})
```

**Frontend — `frontend/src/lib/api.js`:**
```js
getJudgeHistory: () => req('GET', '/judge'),
```

---

### DeckProfilePage — due tab (`/mazzo/:id`)

**Problema:** risponde a due domande diverse (come performa? / cosa c'è dentro?) su un'unica pagina scrollabile densa.

**Struttura con tab:**
```
[  BANNER COMMANDER ART  ]
   Nome · Proprietario · Bracket · Win rate

[ Performance ]  [ Lista carte ]   ← tab

── TAB: PERFORMANCE (default) ──────
Stats: partite / vittorie / best-worst matchup
Matchup vs altri mazzi
Ultime 5 partite → [ Vedi tutte ]
[ Andamento win rate ▼ ]  ← collassabile

── TAB: LISTA CARTE ─────────────────
Categorie per tipo
Anteprima hover (desktop) / tap modal (mobile)
```

Il trend SVG non sparisce — va dentro "Andamento win rate" collassabile nella tab Performance.

---

### TorneiPage (`/tornei`) — ex EventsPage

**Cambiamenti:**
- Rotta: `/eventi` → `/tornei`
- Redirect da `/eventi` → `/tornei` (preservare querystring per deep-link notifiche)
- Form creazione evento (admin): da inline a modal
- Struttura lista: upcoming in cima, passati sotto (invariato)

**Attenzione ai deep-link:** le notifiche di tipo `event` puntano a `/eventi?focus=:id`. Aggiornare il link nelle nuove notifiche a `/tornei?focus=:id`. Le notifiche vecchie già salvate continueranno a funzionare grazie al redirect.

---

### Stima prezzo mazzo

- File: `frontend/src/pages/DeckProfilePage.jsx`
- `resolveDecklistCards` già restituisce `prices.eur` per ogni carta
- Sommare tutti i prezzi e mostrare `~€ X stimati (Scryfall)` nella tab Performance
- Mostrare solo se > 0 (non tutte le carte hanno il prezzo)

---

## Roadmap implementativa — ordine di impatto/sforzo

### Fase 1 — Navigazione e struttura (basso sforzo, alto impatto visivo)

| # | Task | File | Sforzo |
|---|---|---|---|
| 1.1 | Nuova pagina Gioca | `pages/GiocaPage.jsx` (nuovo) | XS |
| 1.2 | Dock mobile a 5 voci | `App.jsx` | XS |
| 1.3 | Aggiornare rotte in App.jsx | `App.jsx` | XS |
| 1.4 | Navbar desktop aggiornata | `App.jsx` | XS |

### Fase 2 — Storico Judge (funzionalità mancante, molto richiesta)

| # | Task | File | Sforzo |
|---|---|---|---|
| 2.1 | GET /api/judge backend | `routes/judge.js` | XS |
| 2.2 | api.getJudgeHistory() | `lib/api.js` | XS |
| 2.3 | Sezione storico in JudgePage | `pages/JudgePage.jsx` | S |

### Fase 3 — Nuova Home Feed (impatto alto, sforzo medio)

| # | Task | File | Sforzo |
|---|---|---|---|
| 3.1 | FeedPage con attività recente | `pages/FeedPage.jsx` (nuovo) | M |
| 3.2 | Snapshot stagionale personale | dentro FeedPage | S |
| 3.3 | Card evento prossimo | dentro FeedPage | S |

### Fase 4 — Pagina Gruppo (refactor Dashboard)

| # | Task | File | Sforzo |
|---|---|---|---|
| 4.1 | GruppoPage con stagione + primati | `pages/GruppoPage.jsx` (nuovo) | M |
| 4.2 | Rimuovere tab Giocatori e Mazzi | dentro GruppoPage | S |
| 4.3 | DashboardPage → deprecare o redirect | `App.jsx` | XS |

### Fase 5 — Progressive disclosure pagine dense

| # | Task | File | Sforzo |
|---|---|---|---|
| 5.1 | PlayerProfilePage: achievement in posizione 2 | `pages/PlayerProfilePage.jsx` | S |
| 5.2 | PlayerProfilePage: rivalità e stats collassate | `pages/PlayerProfilePage.jsx` | S |
| 5.3 | DeckProfilePage: due tab Performance / Lista | `pages/DeckProfilePage.jsx` | S |
| 5.4 | Stima prezzo mazzo | `pages/DeckProfilePage.jsx` | XS |

### Fase 6 — Tornei e polish finale

| # | Task | File | Sforzo |
|---|---|---|---|
| 6.1 | Redirect `/eventi` → `/tornei` | `App.jsx` | XS |
| 6.2 | Form evento in modal | `pages/EventsPage.jsx` | S |
| 6.3 | Aggiornare link notifiche nuove a `/tornei` | `lib/notify.js` | XS |

---

## Decisioni chiuse — non riaprire

- **"Gioca" = landing con 2 CTA separate** (non tab) — due card distinte che navigano alle pagine esistenti
- **Tornei = dock item fisso** — eventi settimanali, non episodici
- **Mazzi non ha dock item mobile** — accessibile da navbar desktop o da profilo
- **Admin non ha dock item** — accessibile da URL diretto
- **Trend SVG non sparisce** — si sposta in sezione collassabile, non viene eliminato
- **Nessuna riscrittura backend** — solo aggiunta `GET /api/judge`
- **Pagine di dettaglio invariate** — GamePage, EventDetailPage, NewGamePage restano uguali

## Invariato

Tutto il backend eccetto l'aggiunta di `GET /api/judge`. Tutte le pagine di dettaglio. Il sistema di achievement, stagioni, notifiche, deep-link, decklist, matchup. L'UI (colori, glassmorphism, stili inline).
