const router = require('express').Router();
const prisma = require('../lib/prisma');
const { computeTotals } = require('../lib/publicStats');

// GET /api/public/stats — totali aggregati per la landing pubblica (nessun login).
// Solo numeri: partite, giocatori, mazzi, serate. Cache in memoria 5 minuti.
const TTL = 5 * 60 * 1000;
let cache = { at: 0, data: null };

router.get('/stats', async (req, res) => {
  try {
    if (!cache.data || Date.now() - cache.at > TTL) {
      const [games, players, decks] = await Promise.all([
        prisma.game.findMany({ select: { playedAt: true } }),
        prisma.gamePlayer.findMany({ select: { userId: true }, distinct: ['userId'] }),
        prisma.deck.count(),
      ]);
      cache = {
        at: Date.now(),
        data: computeTotals({ playedAts: games.map(g => g.playedAt), playerIds: players.map(p => p.userId), decks }),
      };
    }
    res.set('Cache-Control', 'public, max-age=300');
    res.json(cache.data);
  } catch (err) {
    console.error('public stats', err);
    res.status(500).json({ error: 'Statistiche non disponibili' });
  }
});

module.exports = router;
