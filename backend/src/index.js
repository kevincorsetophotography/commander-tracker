const express = require('express');
const cors = require('cors');
require('dotenv').config();

// Guard di sicurezza: il server non parte con un JWT_SECRET assente o debole
const WEAK_SECRETS = new Set(['change-me-in-production', 'secret', 'changeme', '']);
if (!process.env.JWT_SECRET || WEAK_SECRETS.has(process.env.JWT_SECRET) || process.env.JWT_SECRET.length < 32) {
  console.error('\n[FATAL] JWT_SECRET mancante o troppo debole.');
  console.error('Imposta una stringa casuale di almeno 32 caratteri nel file .env.');
  console.error('Puoi generarne una con: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'base64url\'))"\n');
  process.exit(1);
}

const authRoutes  = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const deckRoutes  = require('./routes/decks');
const gameRoutes  = require('./routes/gamesV2');
const statsRoutes = require('./routes/stats');

const app = express();

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

app.use('/api/auth',  authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/decks', deckRoutes);
app.use('/api/games', gameRoutes);
app.use('/api/stats', statsRoutes);

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Commander Tracker API on :${PORT}`));
