const router = require('express').Router();
const prisma = require('../lib/prisma');
const auth = require('../middleware/auth');
const { publicUser } = require('./auth');

// GET /api/me — utente aggiornato (ruolo, organizzatore, avatar) senza rifare il login.
// Montato fuori da /api/auth per non consumare il rate limit del login.
router.get('/', auth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) return res.status(404).json({ error: 'Utente non trovato' });
    res.json(publicUser(user));
  } catch (error) {
    console.error('me error', error);
    res.status(500).json({ error: 'Errore' });
  }
});

module.exports = router;
