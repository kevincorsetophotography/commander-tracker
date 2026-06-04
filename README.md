# Commanderone · Villastellone

Tracker di partite Magic: The Gathering formato Commander.
Guida utente: [GUIDA_UTENTE.md](GUIDA_UTENTE.md) · Roadmap: [ROADMAP.md](ROADMAP.md) · Deploy: [DEPLOY.md](DEPLOY.md)

## Sviluppo locale (isolato dalla produzione)

Lo sviluppo usa un **PostgreSQL "embedded"** locale (scaricato in automatico, nessuna
installazione di sistema, **nessun contatto con il database di produzione**).

### Backend
```bash
cd backend
npm install
cp .env.example .env   # poi tieni il DATABASE_URL locale già impostato
npm run dev
```
`npm run dev` fa tutto da solo:
1. avvia un PostgreSQL locale su `:5433` (cartella `backend/.devdb/`, ignorata da git);
2. sincronizza lo schema (`prisma db push`);
3. **semina dati di test** se il DB è vuoto (1 admin + 6 giocatori + 28 partite);
4. avvia il backend con nodemon.

Credenziali di test: **admin / test** (ogni giocatore di test ha password `test`).

> Per ripartire da zero coi dati di test: ferma il server, elimina `backend/.devdb/`
> e rilancia `npm run dev`. Per rigenerare solo il seed: `npm run db:seed`.

### Frontend
```bash
cd frontend
npm install
npm run dev
```

La **produzione** (Railway + Vercel) usa il proprio `DATABASE_URL` e non è mai
toccata dallo sviluppo locale. Dettagli in [DEPLOY.md](DEPLOY.md).

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

> Nota: il progetto usa **PostgreSQL** sia in locale (embedded) sia in produzione
> (Railway). Lo schema si applica con `prisma db push` (niente cartella migrations).

## Deploy
Backend + database su **Railway**, frontend su **Vercel**. Procedura completa passo
passo in **[DEPLOY.md](DEPLOY.md)**.
