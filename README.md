# Commander Tracker

## Setup rapido

### Backend
```bash
cd backend
npm install
npx prisma migrate dev --name init
npm run dev
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## Struttura DB

- **User**: giocatori con login
- **Deck**: mazzi, collegati a un utente
- **Game**: partita
- **GamePlayer**: join table (chi ha giocato, con quale mazzo, ha vinto?)

## API endpoints

| Method | Path | Auth | Descrizione |
|--------|------|------|-------------|
| POST | /api/auth/register | — | Registrazione |
| POST | /api/auth/login | — | Login → JWT |
| GET | /api/decks | ✓ | Tutti i mazzi |
| POST | /api/decks | ✓ | Crea mazzo |
| DELETE | /api/decks/:id | ✓ | Elimina mazzo |
| GET | /api/games | ✓ | Storico partite |
| POST | /api/games | ✓ | Salva partita |
| GET | /api/stats/players | ✓ | Win rate giocatori |
| GET | /api/stats/decks | ✓ | Win rate mazzi |
| GET | /api/stats/matchups | ✓ | Matchup mazzo vs mazzo |

## Migrazione a PostgreSQL
Cambia solo una riga in `backend/prisma/schema.prisma`:
```
provider = "postgresql"
url      = env("DATABASE_URL")  // postgresql://user:pass@host:5432/db
```
Poi `npx prisma migrate deploy`.

## Deploy su Railway / Render
1. Push il repo su GitHub
2. Crea un servizio backend (Node.js) e uno frontend (Static Site)
3. Aggiungi le env vars: DATABASE_URL, JWT_SECRET, FRONTEND_URL
4. Il frontend ha bisogno di VITE_API_URL=https://tuo-backend.railway.app/api
