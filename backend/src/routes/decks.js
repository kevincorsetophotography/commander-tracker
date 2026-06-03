const router = require('express').Router();
const auth = require('../middleware/auth');
const { PrismaClient } = require('@prisma/client');
const { validateDecklist } = require('../lib/decklist');
const prisma = new PrismaClient();

const parseDeckId = (value) => {
  const id = Number.parseInt(value, 10);
  return Number.isInteger(id) ? id : null;
};

// GET /api/decks — mazzi dei soli PLAYER (esclude admin), usato per comporre il tavolo
router.get('/', auth, async (req, res) => {
  const decks = await prisma.deck.findMany({
    where:   { user: { role: 'PLAYER' } },
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

// GET /api/decks/:id — singolo mazzo con decklist (per il profilo mazzo)
router.get('/:id', auth, async (req, res) => {
  const deckId = parseDeckId(req.params.id);
  if (!deckId) return res.status(400).json({ error: 'ID mazzo non valido' });

  const deck = await prisma.deck.findUnique({
    where: { id: deckId },
    include: { user: { select: { id: true, username: true } } }
  });
  if (!deck) return res.status(404).json({ error: 'Mazzo non trovato' });
  res.json(deck);
});

const parseBracket = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const b = Number.parseInt(value, 10);
  return b >= 1 && b <= 4 ? b : null;
};

// POST /api/decks
router.post('/', auth, async (req, res) => {
  const { name, commander, colors, userId, bracket } = req.body;
  if (!name) return res.status(400).json({ error: 'name richiesto' });

  const ownerId = req.user.role === 'ADMIN' && Number.parseInt(userId, 10)
    ? Number.parseInt(userId, 10)
    : req.user.id;

  try {
    const deck = await prisma.deck.create({
      data: { name, commander, colors, bracket: parseBracket(bracket), userId: ownerId }
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

  const { name, commander, colors, decklist, userId, bracket } = req.body;
  const nextOwnerId = req.user.role === 'ADMIN' && Number.parseInt(userId, 10)
    ? Number.parseInt(userId, 10)
    : deck.userId;

  // Valida la decklist se viene fornita una lista non vuota
  if (typeof decklist === 'string' && decklist.trim()) {
    const result = await validateDecklist(decklist);
    if (!result.valid) {
      return res.status(400).json({ error: result.errors.join(' · ') });
    }
  }

  try {
    const updated = await prisma.deck.update({
      where: { id: deck.id },
      data: {
        name, commander, colors,
        decklist: decklist ?? undefined,
        bracket: bracket === undefined ? undefined : parseBracket(bracket),
        userId: nextOwnerId
      }
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

// POST /api/decks/import — importa una lista da Archidekt o Moxfield via URL
router.post('/import', auth, async (req, res) => {
  const { url } = req.body;
  if (!url || typeof url !== 'string') return res.status(400).json({ error: 'URL richiesto' });

  try {
    if (/archidekt\.com/i.test(url)) {
      const m = url.match(/decks\/(\d+)/);
      if (!m) return res.status(400).json({ error: 'URL Archidekt non valido' });
      const r = await fetch(`https://archidekt.com/api/decks/${m[1]}/`, {
        headers: { 'User-Agent': 'CommanderoneTracker/1.0' }
      });
      if (!r.ok) return res.status(502).json({ error: 'Mazzo Archidekt non raggiungibile' });
      const data = await r.json();
      const lines = [];
      let commander = null;
      for (const c of data.cards || []) {
        const name = c.card?.oracleCard?.name;
        if (!name) continue;
        const cats = c.categories || [];
        const isCommander = cats.includes('Commander') || c.modifier === 'Commander';
        if (isCommander && !commander) commander = name;
        else lines.push(`${c.quantity || 1} ${name}`);
      }
      const decklist = [commander ? `1 ${commander}` : null, ...lines].filter(Boolean).join('\n');
      return res.json({ commander, decklist, name: data.name || null });
    }

    if (/moxfield\.com/i.test(url)) {
      const m = url.match(/decks\/([A-Za-z0-9_-]+)/);
      if (!m) return res.status(400).json({ error: 'URL Moxfield non valido' });
      const r = await fetch(`https://api.moxfield.com/v2/decks/all/${m[1]}`, {
        headers: { 'User-Agent': 'CommanderoneTracker/1.0', 'Accept': 'application/json' }
      });
      if (!r.ok) return res.status(502).json({ error: 'Moxfield blocca l\'import automatico. Apri il mazzo su Moxfield → More → Export → Text, copia tutto e incollalo qui sotto.' });
      const data = await r.json();
      const commanderName = Object.values(data.commanders || {})[0]?.card?.name || null;
      const lines = Object.values(data.mainboard || {}).map(c => `${c.quantity || 1} ${c.card?.name}`).filter(l => !l.endsWith('undefined'));
      const decklist = [commanderName ? `1 ${commanderName}` : null, ...lines].filter(Boolean).join('\n');
      return res.json({ commander: commanderName, decklist, name: data.name || null });
    }

    return res.status(400).json({ error: 'Supportati solo URL Archidekt o Moxfield' });
  } catch (error) {
    console.error('import deck error', error);
    return res.status(500).json({ error: 'Errore durante l\'import' });
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
