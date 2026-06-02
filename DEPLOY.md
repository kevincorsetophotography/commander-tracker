# 🚀 Deploy di Commanderone (Railway + Vercel)

Guida per pubblicare il portale online. Architettura:

- **Backend + PostgreSQL** → Railway
- **Frontend** → Vercel
- Entrambi si aggiornano automaticamente a ogni `git push` su `main`.

Il codice è già predisposto: questa guida copre solo i clic sui due servizi.

---

## Prerequisiti

- Il repo è già su GitHub: `kevincorsetophotography/commander-tracker` ✓
- Crea (gratis) un account su **[railway.app](https://railway.app)** e su **[vercel.com](https://vercel.com)**, accedendo con GitHub.
- Tieni a portata di mano un **JWT_SECRET**. Generane uno con:
  ```
  node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
  ```
  (copialo, serve tra poco)

---

## Parte 1 — Backend + Database su Railway

### 1.1 Crea il progetto
1. Su Railway: **New Project → Deploy from GitHub repo** → scegli `commander-tracker`.
2. Railway crea un servizio. Aprilo → **Settings → Root Directory** → imposta **`backend`** → Save.

### 1.2 Aggiungi il database PostgreSQL
1. Nel progetto: **New → Database → Add PostgreSQL**.
2. Railway crea il servizio Postgres e una variabile `DATABASE_URL` al suo interno.

### 1.3 Collega il database al backend
1. Apri il servizio **backend → Variables**.
2. Aggiungi una variabile:
   - **Nome:** `DATABASE_URL`
   - **Valore:** `${{Postgres.DATABASE_URL}}`  ← riferimento al database (Railway lo autocompleta)

### 1.4 Imposta le altre variabili (sempre in backend → Variables)
| Variabile | Valore |
|-----------|--------|
| `JWT_SECRET` | la stringa casuale generata prima |
| `INVITE_CODE` | il codice che darai agli amici (es. `villastellone2026`) |
| `ADMIN_USERNAME` | `admin` |
| `ADMIN_PASSWORD` | una password robusta per l'admin |
| `FRONTEND_URL` | lascialo vuoto per ora (lo metti nella Parte 3) |

> `PORT` lo gestisce Railway da solo, non serve impostarlo.

### 1.5 Deploy
Railway fa il deploy in automatico. Grazie al file `railway.json` userà il comando giusto, che:
- crea le tabelle nel database (`prisma db push`),
- crea l'utente **admin** con le credenziali sopra,
- avvia il server.

### 1.6 Esponi l'URL pubblico
1. Backend → **Settings → Networking → Generate Domain**.
2. Copia l'URL, sarà tipo: `https://commander-tracker-production.up.railway.app`
3. **Verifica** aprendo `https://…railway.app/api/stats/players` → deve rispondere `[]` (lista vuota, ok!).

📌 **Annota questo URL backend**, serve nella Parte 2.

---

## Parte 2 — Frontend su Vercel

1. Su Vercel: **Add New → Project** → importa `commander-tracker`.
2. **Root Directory** → seleziona **`frontend`**.
3. Framework: Vercel rileva **Vite** da solo (Build: `npm run build`, Output: `dist`).
4. Apri **Environment Variables** e aggiungi:
   - **Nome:** `VITE_API_URL`
   - **Valore:** l'URL backend + `/api` → es. `https://commander-tracker-production.up.railway.app/api`
5. **Deploy**.
6. A fine deploy Vercel ti dà l'URL del sito, tipo: `https://commanderone.vercel.app`

📌 **Annota questo URL frontend.**

---

## Parte 3 — Collega i due servizi (CORS)

Il backend accetta richieste solo dal frontend autorizzato.

1. Torna su Railway → backend → **Variables**.
2. Imposta `FRONTEND_URL` = l'URL Vercel (senza `/` finale), es. `https://commanderone.vercel.app`
3. Salva: Railway ri-deploya da solo.

---

## Parte 4 — Primo accesso

1. Apri l'URL Vercel.
2. **Accedi** con `admin` e la `ADMIN_PASSWORD` impostata.
3. Dal pannello **Admin** crea gli utenti, oppure condividi l'**INVITE_CODE** e lascia che si registrino da soli.
4. Inserite mazzi e partite: il database è già pronto e vuoto.

---

## Aggiornamenti futuri

Da ora in poi ti basta:
```
git push
```
Railway e Vercel rilevano il push e ri-deployano automaticamente. Nessun altro passaggio.

---

## Dominio personalizzato (opzionale)

- **Vercel** → Project → **Settings → Domains** → aggiungi il tuo dominio (es. `commanderone.it`) e segui le istruzioni DNS.
- Se cambi dominio del frontend, aggiorna `FRONTEND_URL` su Railway.

---

## Risoluzione problemi

| Sintomo | Causa / soluzione |
|---------|-------------------|
| Il sito carica ma il login dà errore di rete | `VITE_API_URL` sbagliato su Vercel, o manca `/api` in fondo. |
| Errore CORS nella console | `FRONTEND_URL` su Railway non combacia con l'URL Vercel (controlla http**s** e niente `/` finale). |
| 500 al login / "Internal server error" | Il backend non vede il database: controlla che `DATABASE_URL` = `${{Postgres.DATABASE_URL}}`. |
| Il backend non parte | Guarda i **Deploy Logs** su Railway. Se lamenta `JWT_SECRET`, impostalo (≥ 32 caratteri). |
| Le rotte (es. /mazzi) danno 404 ricaricando | Manca il routing SPA: il file `frontend/vercel.json` lo gestisce, assicurati sia stato deployato. |
| Primo accesso lento | Normale su free tier dopo inattività; dal secondo accesso è veloce. |

---

## Variabili d'ambiente — riepilogo

**Railway (backend):**
`DATABASE_URL`, `JWT_SECRET`, `INVITE_CODE`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `FRONTEND_URL`

**Vercel (frontend):**
`VITE_API_URL`
