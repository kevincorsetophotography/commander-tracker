const router = require('express').Router();
const prisma = require('../lib/prisma');
const auth = require('../middleware/auth');
const { createNotifications } = require('../lib/notify');
const { findEventForTime, joinError, canEditTable, resultMatchesSeats, MAX_SEATS } = require('../lib/openTables');

// Tavoli aperti creati dai giocatori (separati dai pod di torneo generati dall'admin).

const userSel = { select: { id: true, username: true, avatarCardName: true, avatarScryfallId: true } };
const tableInclude = {
  createdBy: userSel,
  seats: { orderBy: { createdAt: 'asc' }, include: { user: userSel } },
  event: { select: { id: true, title: true, startsAt: true, allDay: true } },
  game: {
    select: {
      id: true,
      players: { where: { isWinner: true }, select: { user: { select: { id: true, username: true } }, deck: { select: { name: true } } } },
    },
  },
};

const parseId = (v) => { const n = Number.parseInt(v, 10); return Number.isInteger(n) ? n : null; };

const loadTable = (id) => prisma.openTable.findUnique({ where: { id }, include: tableInclude });

// Eventi "vicini" a un orario (per agganciare il tavolo alla serata giusta).
async function eventNear(when) {
  const t = new Date(when);
  const from = new Date(t.getTime() - 2 * 86400000), to = new Date(t.getTime() + 2 * 86400000);
  const events = await prisma.event.findMany({ where: { startsAt: { gte: from, lte: to } }, select: { id: true, startsAt: true, allDay: true } });
  return findEventForTime(events, t);
}

// GET /api/tables?eventId= — tavoli di un evento, oppure quelli attivi (senza risultato, dalle ultime 12 ore)
router.get('/', auth, async (req, res) => {
  try {
    const eventId = parseId(req.query.eventId);
    const where = eventId
      ? { eventId }
      : { gameId: null, startsAt: { gte: new Date(Date.now() - 12 * 3600000) } };
    const tables = await prisma.openTable.findMany({ where, include: tableInclude, orderBy: { startsAt: 'asc' } });
    res.json(tables);
  } catch (error) {
    console.error('list tables error', error);
    res.status(500).json({ error: 'Errore durante il caricamento dei tavoli' });
  }
});

// POST /api/tables { eventId? } — un tocco: tavolo aperto, orario adesso, creatore seduto
router.post('/', auth, async (req, res) => {
  try {
    let startsAt = new Date();
    let eventId = parseId(req.body.eventId);
    if (eventId) {
      const ev = await prisma.event.findUnique({ where: { id: eventId }, select: { id: true, startsAt: true } });
      if (!ev) return res.status(404).json({ error: 'Evento non trovato' });
      // evento futuro: il tavolo parte all'orario dell'evento
      if (new Date(ev.startsAt) > startsAt) startsAt = new Date(ev.startsAt);
    } else {
      const ev = await eventNear(startsAt);
      eventId = ev ? ev.id : null;
    }
    const table = await prisma.openTable.create({
      data: {
        startsAt, isOpen: true, maxSeats: MAX_SEATS, createdById: req.user.id, eventId,
        seats: { create: [{ userId: req.user.id }] },
      },
      include: tableInclude,
    });
    res.json(table);
  } catch (error) {
    console.error('create table error', error);
    res.status(500).json({ error: 'Errore durante la creazione del tavolo' });
  }
});

// PATCH /api/tables/:id { isOpen?, startsAt? } — creatore o admin
router.patch('/:id', auth, async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: 'ID tavolo non valido' });
  try {
    const table = await loadTable(id);
    if (!table) return res.status(404).json({ error: 'Tavolo non trovato' });
    if (!canEditTable(req.user, table)) return res.status(403).json({ error: 'Solo chi ha aperto il tavolo può modificarlo' });
    if (table.gameId) return res.status(400).json({ error: 'Il tavolo ha già un risultato' });
    const data = {};
    if (typeof req.body.isOpen === 'boolean') data.isOpen = req.body.isOpen;
    if (req.body.startsAt) {
      const when = new Date(req.body.startsAt);
      if (Number.isNaN(when.getTime())) return res.status(400).json({ error: 'Orario non valido' });
      data.startsAt = when;
      const ev = await eventNear(when);
      data.eventId = ev ? ev.id : null;
    }
    if (!Object.keys(data).length) return res.status(400).json({ error: 'Nessun dato da aggiornare' });
    await prisma.openTable.update({ where: { id }, data });
    res.json(await loadTable(id));
  } catch (error) {
    console.error('update table error', error);
    res.status(500).json({ error: 'Errore durante l\'aggiornamento del tavolo' });
  }
});

// DELETE /api/tables/:id — creatore o admin, solo senza risultato
router.delete('/:id', auth, async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: 'ID tavolo non valido' });
  try {
    const table = await loadTable(id);
    if (!table) return res.status(404).json({ error: 'Tavolo non trovato' });
    if (!canEditTable(req.user, table)) return res.status(403).json({ error: 'Solo chi ha aperto il tavolo può cancellarlo' });
    if (table.gameId) return res.status(400).json({ error: 'Un tavolo con risultato non si cancella (la partita resta)' });
    await prisma.openTable.delete({ where: { id } });
    res.json({ ok: true });
  } catch (error) {
    console.error('delete table error', error);
    res.status(500).json({ error: 'Errore durante la cancellazione del tavolo' });
  }
});

// POST /api/tables/:id/join — siediti (tavolo aperto, max 5 creatore incluso)
router.post('/:id/join', auth, async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: 'ID tavolo non valido' });
  try {
    const table = await loadTable(id);
    if (!table) return res.status(404).json({ error: 'Tavolo non trovato' });
    const err = joinError({ ...table, seats: table.seats.map(s => ({ userId: s.userId })) }, req.user.id);
    if (err) return res.status(400).json({ error: err });
    try {
      await prisma.openTableSeat.create({ data: { tableId: id, userId: req.user.id } });
    } catch (e) {
      if (e.code === 'P2002') return res.status(400).json({ error: 'Sei già seduto a questo tavolo' });
      throw e;
    }
    // doppio controllo contro due ingressi simultanei sull'ultimo posto
    const count = await prisma.openTableSeat.count({ where: { tableId: id } });
    if (count > (table.maxSeats || MAX_SEATS)) {
      await prisma.openTableSeat.deleteMany({ where: { tableId: id, userId: req.user.id } });
      return res.status(400).json({ error: 'Il tavolo è pieno' });
    }
    await createNotifications(prisma, [table.createdById].filter(uid => uid !== req.user.id), {
      type: 'table',
      title: `${req.user.username} si è seduto al tuo tavolo`,
      body: `${count}/${table.maxSeats || MAX_SEATS} giocatori`,
      link: table.eventId ? `/evento/${table.eventId}` : '/gioca',
      fromUserId: req.user.id,
    });
    res.json(await loadTable(id));
  } catch (error) {
    console.error('join table error', error);
    res.status(500).json({ error: 'Errore durante l\'ingresso al tavolo' });
  }
});

// POST /api/tables/:id/leave — alzati. Se esce il creatore, passa al primo seduto; tavolo vuoto = cancellato.
router.post('/:id/leave', auth, async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: 'ID tavolo non valido' });
  try {
    const table = await loadTable(id);
    if (!table) return res.status(404).json({ error: 'Tavolo non trovato' });
    if (table.gameId) return res.status(400).json({ error: 'Il tavolo ha già un risultato' });
    if (!table.seats.some(s => s.userId === req.user.id)) return res.status(400).json({ error: 'Non sei seduto a questo tavolo' });
    await prisma.openTableSeat.deleteMany({ where: { tableId: id, userId: req.user.id } });
    const rest = table.seats.filter(s => s.userId !== req.user.id)
    if (rest.length === 0) {
      await prisma.openTable.delete({ where: { id } });
      return res.json({ deleted: true });
    }
    if (table.createdById === req.user.id) {
      await prisma.openTable.update({ where: { id }, data: { createdById: rest[0].userId } });
    }
    res.json(await loadTable(id));
  } catch (error) {
    console.error('leave table error', error);
    res.status(500).json({ error: 'Errore durante l\'uscita dal tavolo' });
  }
});

// DELETE /api/tables/:id/seats/:userId — il creatore (o admin) toglie un giocatore
router.delete('/:id/seats/:userId', auth, async (req, res) => {
  const id = parseId(req.params.id);
  const userId = parseId(req.params.userId);
  if (!id || !userId) return res.status(400).json({ error: 'Parametri non validi' });
  try {
    const table = await loadTable(id);
    if (!table) return res.status(404).json({ error: 'Tavolo non trovato' });
    if (!canEditTable(req.user, table)) return res.status(403).json({ error: 'Solo chi ha aperto il tavolo può togliere giocatori' });
    if (table.gameId) return res.status(400).json({ error: 'Il tavolo ha già un risultato' });
    if (userId === table.createdById) return res.status(400).json({ error: 'Il creatore lascia il tavolo con "Alzati"' });
    await prisma.openTableSeat.deleteMany({ where: { tableId: id, userId } });
    res.json(await loadTable(id));
  } catch (error) {
    console.error('remove seat error', error);
    res.status(500).json({ error: 'Errore durante la rimozione del giocatore' });
  }
});

// POST /api/tables/:id/result { gameId } — collega la partita registrata (giocatori = seduti)
router.post('/:id/result', auth, async (req, res) => {
  const id = parseId(req.params.id);
  const gameId = parseId(req.body.gameId);
  if (!id || !gameId) return res.status(400).json({ error: 'Parametri non validi' });
  try {
    const table = await loadTable(id);
    if (!table) return res.status(404).json({ error: 'Tavolo non trovato' });
    const seated = table.seats.some(s => s.userId === req.user.id);
    if (!seated && req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Solo i giocatori del tavolo o un admin possono registrare il risultato' });
    if (table.gameId) return res.status(400).json({ error: 'Il tavolo ha già un risultato' });
    const game = await prisma.game.findUnique({ where: { id: gameId }, select: { id: true, players: { select: { userId: true } } } });
    if (!game) return res.status(404).json({ error: 'Partita non trovata' });
    if (!resultMatchesSeats(game.players.map(p => p.userId), table.seats.map(s => s.userId))) {
      return res.status(400).json({ error: 'I giocatori della partita non corrispondono a quelli del tavolo' });
    }
    await prisma.openTable.update({ where: { id }, data: { gameId, isOpen: false } });
    res.json(await loadTable(id));
  } catch (error) {
    if (error.code === 'P2002') return res.status(400).json({ error: 'Questa partita è già collegata a un altro tavolo' });
    console.error('table result error', error);
    res.status(500).json({ error: 'Errore durante il salvataggio del risultato' });
  }
});

module.exports = router;
