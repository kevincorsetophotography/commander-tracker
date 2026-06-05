const router = require('express').Router();
const bcrypt = require('bcryptjs');
const auth = require('../middleware/auth');
const requireAdmin = require('../middleware/requireAdmin');

const prisma = require('../lib/prisma');

const parseId = (value) => {
  const id = Number.parseInt(value, 10);
  return Number.isInteger(id) ? id : null;
};

const normalizeRole = (role) => role === 'ADMIN' ? 'ADMIN' : 'PLAYER';

router.use(auth, requireAdmin);

// GET /api/admin/export — backup completo (senza password)
router.get('/export', async (req, res) => {
  const [users, decks, games] = await Promise.all([
    prisma.user.findMany({
      orderBy: { id: 'asc' },
      select: { id: true, username: true, role: true, createdAt: true }
    }),
    prisma.deck.findMany({
      orderBy: { id: 'asc' },
      include: { user: { select: { username: true } } }
    }),
    prisma.game.findMany({
      orderBy: { id: 'asc' },
      include: {
        createdBy: { select: { username: true } },
        players: { include: { user: { select: { username: true } }, deck: { select: { name: true } } } }
      }
    })
  ]);

  const payload = {
    exportedAt: new Date().toISOString(),
    counts: { users: users.length, decks: decks.length, games: games.length },
    users,
    decks: decks.map(d => ({ id: d.id, name: d.name, commander: d.commander, colors: d.colors, bracket: d.bracket, owner: d.user.username, hasDecklist: !!d.decklist })),
    games: games.map(g => ({
      id: g.id,
      playedAt: g.playedAt,
      notes: g.notes,
      createdBy: g.createdBy?.username || null,
      players: g.players
        .sort((a, b) => (a.placement || 99) - (b.placement || 99))
        .map(p => ({ player: p.user.username, deck: p.deck.name, placement: p.placement, isWinner: p.isWinner }))
    }))
  };

  res.setHeader('Content-Disposition', `attachment; filename="commanderone-backup-${new Date().toISOString().slice(0, 10)}.json"`);
  res.setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify(payload, null, 2));
});

router.get('/users', async (req, res) => {
  const users = await prisma.user.findMany({
    orderBy: { username: 'asc' },
    select: {
      id: true,
      username: true,
      role: true,
      createdAt: true,
      _count: {
        select: {
          decks: true,
          gamePlayers: true,
          createdGames: true
        }
      }
    }
  });

  res.json(users);
});

router.post('/users', async (req, res) => {
  const { username, password, role } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username e password sono obbligatori' });
  }

  const hash = await bcrypt.hash(password, 10);

  try {
    const user = await prisma.user.create({
      data: {
        username,
        password: hash,
        role: normalizeRole(role)
      },
      select: { id: true, username: true, role: true, createdAt: true }
    });

    res.json(user);
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'Username già esistente' });
    }

    console.error('admin create user error', error);
    res.status(500).json({ error: 'Errore durante la creazione utente' });
  }
});

router.patch('/users/:id', async (req, res) => {
  const userId = parseId(req.params.id);
  if (!userId) return res.status(400).json({ error: 'ID utente non valido' });

  const { username, password, role } = req.body;
  const data = {};

  if (typeof username === 'string' && username.trim()) {
    data.username = username.trim();
  }

  if (typeof role === 'string') {
    data.role = normalizeRole(role);
  }

  if (typeof password === 'string' && password.trim()) {
    data.password = await bcrypt.hash(password, 10);
  }

  if (Object.keys(data).length === 0) {
    return res.status(400).json({ error: 'Nessun dato da aggiornare' });
  }

  if (req.user.id === userId && data.role === 'PLAYER') {
    return res.status(400).json({ error: 'Non puoi rimuovere il ruolo admin dal tuo account attuale' });
  }

  try {
    const user = await prisma.user.update({
      where: { id: userId },
      data,
      select: { id: true, username: true, role: true, createdAt: true }
    });

    res.json(user);
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Utente non trovato' });
    }

    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'Username già esistente' });
    }

    console.error('admin update user error', error);
    res.status(500).json({ error: 'Errore durante l\'aggiornamento utente' });
  }
});

router.delete('/users/:id', async (req, res) => {
  const userId = parseId(req.params.id);
  if (!userId) return res.status(400).json({ error: 'ID utente non valido' });
  if (req.user.id === userId) {
    return res.status(400).json({ error: 'Non puoi eliminare il tuo account admin attuale' });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      _count: {
        select: {
          decks: true,
          gamePlayers: true,
          createdGames: true
        }
      }
    }
  });

  if (!user) return res.status(404).json({ error: 'Utente non trovato' });

  if (user._count.decks > 0 || user._count.gamePlayers > 0 || user._count.createdGames > 0) {
    return res.status(409).json({ error: 'Elimina prima mazzi e partite collegate a questo utente' });
  }

  await prisma.user.delete({ where: { id: userId } });
  res.json({ ok: true });
});

module.exports = router;
