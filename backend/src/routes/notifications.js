const router = require('express').Router();
const auth = require('../middleware/auth');
const prisma = require('../lib/prisma');

const LIST_LIMIT = 40;

// GET /api/notifications — le mie, più recenti
router.get('/', auth, async (req, res) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: LIST_LIMIT,
      include: { fromUser: { select: { id: true, username: true, avatarCardName: true, avatarScryfallId: true } } },
    });
    res.json(notifications);
  } catch (error) {
    console.error('list notifications error', error);
    res.status(500).json({ error: 'Errore durante il caricamento delle notifiche' });
  }
});

// GET /api/notifications/unread-count — conteggio non lette (per il polling)
router.get('/unread-count', auth, async (req, res) => {
  try {
    const count = await prisma.notification.count({
      where: { userId: req.user.id, read: false },
    });
    res.json({ count });
  } catch (error) {
    console.error('unread-count error', error);
    res.status(500).json({ error: 'Errore' });
  }
});

// POST /api/notifications/read — segna tutte come lette
router.post('/read', auth, async (req, res) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.user.id, read: false },
      data: { read: true },
    });
    res.json({ ok: true });
  } catch (error) {
    console.error('mark read error', error);
    res.status(500).json({ error: 'Errore' });
  }
});

module.exports = router;
