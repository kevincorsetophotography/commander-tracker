const express = require('express');
const cors = require('cors');
require('dotenv').config();

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
