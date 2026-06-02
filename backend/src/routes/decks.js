const router = require('express').Router();
const auth = require('../middleware/auth');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const parseDeckId = (value) => {
  const id = Number.parseInt(value, 10);
  return Number.isInteger(id) ? id : null;
};

// GET /api/decks — tutti i mazzi (visibili a tutti per comporre il tavolo)
router.get('/', auth, async (req, res) => {
  const decks = await prisma.deck.findMany({
    include: { user: { select: { id: true, username: true } } },
    orderBy: [{ userId: 'asc' }, { name: 'asc' }]
  });
  res.json(decks);
});

// GET /api/decks/mine
router.get('/mine', auth, async (req, res) => {
  const decks = await prisma.deck.findMany({
    where: { userId: req.user.id },
    orderBy: { name: 'asc' }
  });
  res.json(decks);
});

// POST /api/decks
router.post('/', auth, async (req, res) => {
  const { name, commander, colors, userId } = req.body;
  if (!name) return res.status(400).json({ error: 'name richiesto' });

  const ownerId = req.user.role === 'ADMIN' && Number.parseInt(userId, 10)
    ? Number.parseInt(userId, 10)
    : req.user.id;

  try {
    const deck = await prisma.deck.create({
      data: { name, commander, colors, userId: ownerId }
    });
    res.json(deck);
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'Hai già un mazzo con questo nome' });
    }

    console.error('create deck error', error);
    res.status(500).json({ error: 'Errore durante la creazione del mazzo' });
  }
});

// PATCH /api/decks/:id
router.patch('/:id', auth, async (req, res) => {
  const deckId = parseDeckId(req.params.id);
  if (!deckId) return res.status(400).json({ error: 'ID mazzo non valido' });

  const deck = await prisma.deck.findUnique({ where: { id: deckId } });
  if (!deck) return res.status(404).json({ error: 'Mazzo non trovato' });
  if (req.user.role !== 'ADMIN' && deck.userId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

  const { name, commander, colors, decklist, userId } = req.body;
  const nextOwnerId = req.user.role === 'ADMIN' && Number.parseInt(userId, 10)
    ? Number.parseInt(userId, 10)
    : deck.userId;

  try {
    const updated = await prisma.deck.update({
      where: { id: deck.id },
      data: { name, commander, colors, decklist: decklist ?? undefined, userId: nextOwnerId }
    });
    res.json(updated);
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'Hai già un mazzo con questo nome' });
    }

    console.error('update deck error', error);
    res.status(500).json({ error: 'Errore durante l\'aggiornamento del mazzo' });
  }
});

// DELETE /api/decks/:id
router.delete('/:id', auth, async (req, res) => {
  const deckId = parseDeckId(req.params.id);
  if (!deckId) return res.status(400).json({ error: 'ID mazzo non valido' });

  const deck = await prisma.deck.findUnique({ where: { id: deckId } });
  if (!deck) return res.status(404).json({ error: 'Mazzo non trovato' });
  if (req.user.role !== 'ADMIN' && deck.userId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

  try {
    await prisma.deck.delete({ where: { id: deck.id } });
    res.json({ ok: true });
  } catch (error) {
    if (error.code === 'P2003') {
      return res.status(409).json({ error: 'Non puoi eliminare un mazzo già usato in partita' });
    }

    console.error('delete deck error', error);
    res.status(500).json({ error: 'Errore durante l\'eliminazione del mazzo' });
  }
});

module.exports = router;
