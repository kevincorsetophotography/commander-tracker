# Commanderone – Documento Tecnico

> Applicativo per il tracciamento di partite di Magic: The Gathering formato **Commander (EDH)**
> Gruppo: **Villastellone**

---

## 1. Stack Tecnologico

| Layer | Tecnologia |
|---|---|
| Frontend | React 18 + Vite |
| Routing | React Router v6 |
| Backend | Node.js + Express |
| ORM | Prisma 5 |
| Database | SQLite (migrabile a PostgreSQL) |
| Auth | JWT (jsonwebtoken) + bcryptjs |
| Card images | Scryfall REST API |
| Stile | Inline styles + sistema tema custom |

---

## 2. Architettura

```
commander-tracker/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma          # Modello dati
│   │   ├── dev-clean.db           # Database SQLite attivo
│   │   └── migrations/            # Storia delle migrazioni
│   └── src/
│       ├── index.js               # Entry point Express
│       ├── middleware/
│       │   ├── auth.js            # Verifica JWT
│       │   └── requireAdmin.js    # Controllo ruolo ADMIN
│       └── routes/
│           ├── auth.js            # POST /register, /login
│           ├── admin.js           # CRUD utenti (solo ADMIN)
│           ├── decks.js           # CRUD mazzi
│           ├── gamesV2.js         # CRUD partite
│           └── stats.js           # Statistiche aggregate
└── frontend/
    └── src/
        ├── App.jsx                # Router + Layout + Navbar
        ├── lib/
        │   ├── api.js             # Wrapper fetch verso il backend
        │   ├── scryfall.js        # Integrazione Scryfall API
        │   └── theme.js           # Definizione palette light/dark
        ├── hooks/
        │   ├── useAuth.jsx        # Context autenticazione
        │   └── useTheme.jsx       # Context tema UI
        ├── components/
        │   └── DeckListPanel.jsx  # Componente viewer/editor lista mazzo
        └── pages/
            ├── Login.jsx
            ├── DashboardPage.jsx
            ├── DecksPage.jsx
            ├── NewGamePage.jsx
            └── AdminPage.jsx
```

---

## 3. Modello Dati (Prisma / SQLite)

### User
| Campo | Tipo | Note |
|---|---|---|
| id | Int (PK) | autoincrement |
| username | String | unique |
| password | String | hash bcrypt (cost 10) |
| role | String | `PLAYER` \| `ADMIN`, default `PLAYER` |
| createdAt | DateTime | auto |

### Deck
| Campo | Tipo | Note |
|---|---|---|
| id | Int (PK) | autoincrement |
| name | String | unique per utente |
| commander | String? | nome esatto da Scryfall |
| colors | String? | es. `WUB`, `WUBRG` |
| decklist | String? | testo grezzo 100 carte |
| userId | Int (FK) | owner del mazzo |
| createdAt | DateTime | auto |

### Game
| Campo | Tipo | Note |
|---|---|---|
| id | Int (PK) | autoincrement |
| playedAt | DateTime | auto |
| notes | String? | note libere |
| createdByUserId | Int? (FK) | utente che ha registrato la partita |

### GamePlayer *(join table)*
| Campo | Tipo | Note |
|---|---|---|
| id | Int (PK) | |
| gameId | Int (FK) | onDelete: Cascade |
| userId | Int (FK) | |
| deckId | Int (FK) | |
| isWinner | Boolean | default false |

---

## 4. API Endpoints

### Autenticazione — `/api/auth`
| Metodo | Path | Auth | Descrizione |
|---|---|---|---|
| POST | `/register` | — | Crea account (ruolo PLAYER) |
| POST | `/login` | — | Login → restituisce JWT (scadenza 30 giorni) |

### Mazzi — `/api/decks`
| Metodo | Path | Auth | Descrizione |
|---|---|---|---|
| GET | `/` | ✓ | Tutti i mazzi (tutti gli utenti), con info owner |
| GET | `/mine` | ✓ | Solo i mazzi dell'utente autenticato |
| POST | `/` | ✓ | Crea mazzo. Admin può specificare `userId` arbitrario |
| PATCH | `/:id` | ✓ | Aggiorna mazzo (nome, commander, colors, decklist). Solo owner o ADMIN |
| DELETE | `/:id` | ✓ | Elimina mazzo se non usato in partite. Solo owner o ADMIN |

### Partite — `/api/games`
| Metodo | Path | Auth | Descrizione |
|---|---|---|---|
| GET | `/` | ✓ | Storico completo partite con giocatori e mazzi |
| POST | `/` | ✓ | Registra nuova partita |
| PATCH | `/:id` | ✓ | Modifica partita esistente (solo ADMIN) |
| DELETE | `/:id` | ✓ | Elimina partita (solo ADMIN) |

### Statistiche — `/api/stats`
| Metodo | Path | Auth | Descrizione |
|---|---|---|---|
| GET | `/players` | ✓ | Win rate per giocatore (wins, games, %) |
| GET | `/decks` | ✓ | Win rate per mazzo |
| GET | `/matchups` | ✓ | Scontri diretti mazzo vs mazzo |

### Admin — `/api/admin` *(solo ruolo ADMIN)*
| Metodo | Path | Descrizione |
|---|---|---|
| GET | `/users` | Lista utenti con contatori (mazzi, presenze, partite create) |
| POST | `/users` | Crea utente con ruolo specificabile |
| PATCH | `/users/:id` | Modifica username, password, ruolo |
| DELETE | `/users/:id` | Elimina utente (solo se senza dati collegati) |

---

## 5. Autenticazione e Autorizzazioni

- **Meccanismo**: JWT Bearer token in header `Authorization`
- **Scadenza**: 30 giorni
- **Payload JWT**: `{ id, username, role }`
- **Storage client**: `localStorage` (`ct_token`, `ct_user`)
- **Password**: hashing bcrypt con salt factor 10

### Regole di accesso
| Azione | PLAYER | ADMIN |
|---|---|---|
| Visualizzare tutti i mazzi | ✓ | ✓ |
| Gestire i propri mazzi | ✓ | ✓ |
| Gestire mazzi altrui | ✗ | ✓ |
| Creare/modificare/eliminare utenti | ✗ | ✓ |
| Modificare/eliminare partite | ✗ | ✓ |
| Assegnare un mazzo a un altro utente | ✗ | ✓ |
| Auto-eliminazione o auto-downgrade | — | Bloccato |

---

## 6. Funzionalità Frontend

### 6.1 Login / Registrazione
- Form unificato con toggle login ↔ registrazione
- Errori inline (username duplicato, credenziali errate)
- Logo e nome gruppo visibili

### 6.2 Dashboard (Riepilogo)
4 schede navigabili:

**Giocatori** — classifica con:
- Avatar con iniziali
- Win/Loss record e numero partite
- Barra win rate proporzionale

**Mazzi** — classifica con:
- Nome mazzo, owner, commander
- Win rate colorato (verde ≥ 50%, viola > 0%, grigio nessuna partita)

**Matchup** — scontri diretti tra coppie di mazzi:
- Barra duale che mostra distribuzione vittorie
- Ordinati per numero di partite

**Storico** — lista cronologica partite:
- Data, giocatori, mazzi, vincitore evidenziato
- Note della partita

Metriche globali in cima: totale partite, giocatori, mazzi registrati, top player.

### 6.3 Pagina Mazzi
- **Box mazzo** con banner art del commander (Scryfall `art_crop`) in overlay con sfumatura, nome e commander sovrapposti, color pips WUBRG
- Se nessun commander: layout testuale semplice
- Creazione mazzo con selezione colori interattiva
- **DeckListPanel**: editor + viewer integrato nella card del mazzo

### 6.4 DeckListPanel — Editor Lista
Flusso di inserimento:
1. Campo **Commander** (nome da incollare, singolo)
2. **Textarea** con le 99 carte rimanenti (formato `1 Nome Carta`)
3. Click **"Salva lista"** → validazione in cascata:
   - Commander non vuoto
   - Commander verificato su Scryfall → nome esatto recuperato
   - Lista completa (1 commander + 99 carte) = 100 totali
   - Ogni carta verificata su Scryfall (batch da 75, max 2 chiamate)
   - In caso di errore: carta non trovata o conteggio errato → errore inline
4. Salvataggio: aggiorna `decklist` + `commander` (nome esatto Scryfall)
5. Il banner del mazzo si aggiorna automaticamente con l'art corretto

### 6.5 DeckListPanel — Viewer Lista
- Lista testuale scrollabile con righe alternate e contatore copie (`1×`, `2×`, …)
- Click su una carta → immagine `normal` Scryfall (488×680) nel pannello destro
- Click sulla stessa carta → deseleziona
- Pulsante "Modifica lista" per tornare all'editor

### 6.6 Nuova Partita
- Slot per 3–5 giocatori (dinamici, aggiungibili/rimovibili)
- Per ogni slot: selezione giocatore + selezione mazzo (filtrato per giocatore)
- Selezione vincitore tra i candidati con slot completo
- Campo note opzionale
- Validazioni: min 3 giocatori, vincitore obbligatorio, no duplicati di giocatore

### 6.7 Pannello Admin
Tre schede:

**Utenti**: crea, modifica (username/password/ruolo), elimina utenti. Visualizza contatori per ogni utente.

**Mazzi**: crea mazzo assegnandolo a qualsiasi utente, modifica metadata (nome, commander, colori, owner), editor lista via DeckListPanel su tutti i mazzi, thumbnail commander inline.

**Partite**: visualizza e modifica partite esistenti (cambio giocatori, mazzi, vincitore, note). Eliminazione con conferma.

---

## 7. Integrazione Scryfall API

Base URL: `https://api.scryfall.com`

| Funzione | Endpoint | Uso |
|---|---|---|
| Verifica commander | `GET /cards/named?fuzzy=NAME` | Verifica esistenza, ottiene nome esatto |
| Verifica carte (batch) | `POST /cards/collection` | Batch fino a 75 carte, restituisce dati + `not_found` |
| Banner mazzo | `GET /cards/named?fuzzy=NAME&format=image&version=art_crop` | Immagine diretta (CDN), usata come `<img src>` |
| Immagine carta (viewer) | Ritornata da `/cards/collection` | Campo `image_uris.normal` o `card_faces[0].image_uris.normal` |

Nessuna API key richiesta. CORS aperto per browser. Rate limit: 10 req/s (rispettato dalla logica batch).

---

## 8. Sistema Tema (Light / Dark)

Il tema è gestito via `ThemeProvider` (React Context) e persistito in `localStorage` (`ct_theme`).

| Token | Light | Dark |
|---|---|---|
| `bgPage` | `#F5F4F0` | `#0D0F2B` |
| `bgSurface` | `#FFFFFF` | `#131637` |
| `bgNav` | `#FFFFFF` | `#080A1F` |
| `bgMuted` | `#F0EDE8` | `#191C3F` |
| `border` | `#E0DDD5` | `#252849` |
| `text` | `#1a1a2e` | `#E4E4F4` |
| `primary` | `#534AB7` *(viola)* | `#2EE88A` *(verde neon)* |
| `primaryFg` | `#FFFFFF` | `#080A1F` |
| `win` | `#3B6D11` | `#2EE88A` |
| `danger` | `#a32d2d` | `#FF7070` |

La palette dark rispecchia i colori del logo ufficiale (navy `#0D0F2B`, verde `#2EE88A`, viola `#7040B8`).

Toggle accessibile dalla navbar (☀ / 🌙), applicato istantaneamente a tutti i componenti.

---

## 9. Regole di Business (Commander Format)

- Il mazzo deve contenere esattamente **100 carte**
- La **carta commander** è inclusa nelle 100 e viene inserita separatamente nell'editor
- Ogni carta deve esistere nel database di Scryfall
- Un giocatore può avere più mazzi, ma **nomi univoci** per utente
- Un mazzo usato in almeno una partita **non può essere eliminato**
- Un utente con dati collegati **non può essere eliminato**

---

## 10. Deploy

### Sviluppo locale
```bash
# Backend (porta 3001)
cd backend && npm install && npx prisma migrate dev && npm run dev

# Frontend (porta 5173)
cd frontend && npm install && npm run dev
```

Variabili d'ambiente backend (`.env`):
```
DATABASE_URL="file:./prisma/dev-clean.db"
JWT_SECRET="change-me-in-production"
PORT=3001
FRONTEND_URL="http://localhost:5173"
```

### Migrazione a PostgreSQL
Cambiare in `prisma/schema.prisma`:
```
provider = "postgresql"
url      = env("DATABASE_URL")  // postgresql://user:pass@host:5432/db
```
Poi `npx prisma migrate deploy`.

### Railway / Render
1. Push su GitHub
2. Servizio backend Node.js con env vars: `DATABASE_URL`, `JWT_SECRET`, `FRONTEND_URL`
3. Servizio frontend Static Site con `VITE_API_URL=https://backend.railway.app/api`
