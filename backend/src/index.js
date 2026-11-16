// Commanderne API — registrazione protetta da INVITE_CODE
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

// Guard di sicurezza: il server non parte con un JWT_SECRET assente o debole
const WEAK_SECRETS = new Set(['change-me-in-production', 'secret', 'changeme', '']);
if (!process.env.JWT_SECRET || WEAK_SECRETS.has(process.env.JWT_SECRET) || process.env.JWT_SECRET.length < 32) {
  console.error('\n[FATAL] JWT_SECRET mancante o troppo debole.');
  console.error('Imposta una stringa casuale di almeno 32 caratteri nel file .env.');
  console.error('Puoi generarne una con: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'base64url\'))"\n');
  process.exit(1);
}

const authRoutes         = require('./routes/auth');
const adminRoutes        = require('./routes/admin');
const deckRoutes         = require('./routes/decks');
const gameRoutes         = require('./routes/gamesV2');
const statsRoutes        = require('./routes/stats');
const eventRoutes        = require('./routes/events');
const notificationRoutes = require('./routes/notifications');
const judgeRoutes        = require('./routes/judge');
const scryfallRoutes     = require('./routes/scryfall');
const { rateLimit } = require('express-rate-limit');
const { loadComprehensiveRules } = require('./lib/judge');
const { wrapRouter, errorHandler } = require('./lib/asyncRoutes');

// Ultima rete di sicurezza: una Promise rifiutata e non gestita viene loggata
// invece di abbattere il processo (default di Node >= 15).
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', (reason && reason.stack) || reason);
});

const app = express();

// Dietro il proxy di Railway: necessario perché il rate limiter veda l'IP reale
// del client (e non quello del proxy, condiviso da tutti).
app.set('trust proxy', 1);

// HTTP security headers (X-Content-Type-Options, X-Frame-Options, HSTS, etc.)
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

// Anti brute-force su login/registrazione
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Troppi tentativi, riprova tra qualche minuto.' },
});

// Limite generale sulle API autenticate (anti-scraping, anti-flood)
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Troppo traffico, rallenta un po\'.' },
});

// Endpoint pubblici (landing /info): pochi accessi, limite più stretto
const publicLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Troppo traffico, riprova tra poco.' },
});

const allowedOrigins = new Set([
  process.env.FRONTEND_URL || 'http://localhost:5173',
  'http://localhost:5173',
  'http://127.0.0.1:5173'
]);

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) {
      return callback(null, true);
    }

    return callback(new Error(`Origin non consentita: ${origin}`));
  }
}));
app.use(express.json());

app.use('/api/auth',          authLimiter, wrapRouter(authRoutes));
app.use('/api/admin',         apiLimiter, wrapRouter(adminRoutes));
app.use('/api/decks',         apiLimiter, wrapRouter(deckRoutes));
app.use('/api/games',         apiLimiter, wrapRouter(gameRoutes));
app.use('/api/stats',         apiLimiter, wrapRouter(statsRoutes));
app.use('/api/events',        apiLimiter, wrapRouter(eventRoutes));
app.use('/api/me',            apiLimiter, wrapRouter(require('./routes/me')));
app.use('/api/tables',        apiLimiter, wrapRouter(require('./routes/tables')));
app.use('/api/notifications', apiLimiter, wrapRouter(notificationRoutes));
app.use('/api/judge',         wrapRouter(judgeRoutes));
app.use('/api/public',        publicLimiter, wrapRouter(require('./routes/public')));
app.use('/api/scryfall',      apiLimiter, wrapRouter(scryfallRoutes));

// Global error handler: logga e risponde 500 JSON senza stack
app.use(errorHandler);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Commander Tracker API on :${PORT}`));

// Registra in silenzio gli achievement già maturati (anti-flood notifiche)
const prisma = require('./lib/prisma');
const { initAchievementSnapshots } = require('./lib/notify');
initAchievementSnapshots(prisma);

// Carica le Comprehensive Rules in memoria (best-effort, fallback silenzioso)
loadComprehensiveRules();
