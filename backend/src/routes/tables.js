const router = require('express').Router();
const { Prisma } = require('@prisma/client');
const prisma = require('../lib/prisma');
const auth = require('../middleware/auth');
const { createNotifications } = require('../lib/notify');
const { allowsOpenTables, findEventForTime, joinError, canEditTable, resultMatchesSeats, isTableClosed, canPickDeck, MAX_SEATS } = require('../lib/openTables');
const { viewFor, applyAction, undoLast } = require('../lib/scoreboard');

// Tavoli aperti creati dai giocatori (separati dai pod di torneo generati dall'admin).

const userSel = { select: { id: true, username: true, avatarCardName: true, avatarScryfallId: true } };
const deckSel = { select: { id: true, name: true, commander: true, colors: true, bracket: true } };
const tableInclude = {
  createdBy: userSel,
  seats: { orderBy: { createdAt: 'asc' }, include: { user: userSel, deck: deckSel } },
  event: { select: { id: true, title: true, startsAt: true, allDay: true } },
  game: {
    select: {
      id: true,
      players: { where: { isWinner: true }, select: { user: { select: { id: true, username: true } }, deck: { select: { name: true } } } },
    },
  },
};

const parseId = (v) => { const n = Number.parseInt(v, 10); return Number.isInteger(n) ? n : null; };

// Il segnapunti (JSON grezzo) non va nelle liste: lo espone solo la pagina del tavolo, ai membri.
const publicTable = (table) => {
  if (!table) return table;
  const { scoreboard, scoreVersion, ...rest } = table;
  return { ...rest, closed: isTableClosed(table) };
};
const loadRaw = (id) => prisma.openTable.findUnique({ where: { id }, include: tableInclude });
const loadTable = async (id) => publicTable(await loadRaw(id));

const isMember = (table, user) => !!table && table.seats.some(s => s.userId === user.id);
const scoreboardOf = (table) => ({
  ...viewFor(table.scoreboard, table.seats.map(s => s.userId)),
  version: table.scoreVersion,
});
// Campi minimi per il segnapunti (polling leggero)
const scoreSel = { gameId: true, scoreboard: true, scoreVersion: true, createdById: true, seats: { orderBy: { createdAt: 'asc' }, select: { userId: true } } };

// Eventi "vicini" a un orario (per agganciare il tavolo alla serata giusta).
// I tornei 1v1 (svizzera) non prevedono tavoli aperti: esclusi dall'aggancio.
async function eventNear(when) {
  const t = new Date(when);
  const from = new Date(t.getTime() - 2 * 86400000), to = new Date(t.getTime() + 2 * 86400000);
  const events = await prisma.event.findMany({
    where: { startsAt: { gte: from, lte: to }, OR: [{ format: null }, { format: { not: '1v1' } }] },
    select: { id: true, startsAt: true, allDay: true, format: true },
  });
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
    res.json(tables.map(publicTable));
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
      const ev = await prisma.event.findUnique({ where: { id: eventId }, select: { id: true, startsAt: true, format: true } });
      if (!ev) return res.status(404).json({ error: 'Evento non trovato' });
      if (!allowsOpenTables(ev)) return res.status(400).json({ error: 'I tornei 1v1 (svizzera) non prevedono tavoli aperti' });
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
    res.json(publicTable(table));
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
    // Tavolo concluso: la partita e il legame tavolo→evento→partita restano (storico),
    // lo stato "di gioco" sparisce: segnapunti e mazzi scelti vengono cancellati.
    await prisma.$transaction([
      prisma.openTable.update({ where: { id }, data: { gameId, isOpen: false, scoreboard: Prisma.DbNull, scoreVersion: { increment: 1 } } }),
      prisma.openTableSeat.updateMany({ where: { tableId: id }, data: { deckId: null } }),
    ]);
    res.json(await loadTable(id));
  } catch (error) {
    if (error.code === 'P2002') return res.status(400).json({ error: 'Questa partita è già collegata a un altro tavolo' });
    console.error('table result error', error);
    res.status(500).json({ error: 'Errore durante il salvataggio del risultato' });
  }
});

// ── Pagina del tavolo (solo membri seduti) ────────────────────────────────────

// GET /api/tables/:id — dettaglio per la pagina del tavolo: posti, mazzi scelti,
// mazzi disponibili dei seduti, segnapunti. 403 per chi non è seduto.
router.get('/:id', auth, async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: 'ID tavolo non valido' });
  try {
    const table = await loadRaw(id);
    if (!table) return res.status(404).json({ error: 'Tavolo non trovato' });
    if (!isMember(table, req.user)) return res.status(403).json({ error: 'Solo chi è seduto al tavolo può aprirlo' });
    const decks = await prisma.deck.findMany({
      where: { userId: { in: table.seats.map(s => s.userId) } },
      select: { ...deckSel.select, userId: true },
      orderBy: { name: 'asc' },
    });
    res.json({ ...publicTable(table), decks, scoreboard: scoreboardOf(table) });
  } catch (error) {
    console.error('get table error', error);
    res.status(500).json({ error: 'Errore durante il caricamento del tavolo' });
  }
});

// PUT /api/tables/:id/seats/:userId/deck { deckId|null } — il giocatore per sé, chi ha aperto per tutti
router.put('/:id/seats/:userId/deck', auth, async (req, res) => {
  const id = parseId(req.params.id);
  const userId = parseId(req.params.userId);
  if (!id || !userId) return res.status(400).json({ error: 'Parametri non validi' });
  const raw = req.body.deckId;
  const deckId = raw == null || raw === '' ? null : parseId(raw);
  if (raw != null && raw !== '' && !deckId) return res.status(400).json({ error: 'Mazzo non valido' });
  try {
    const table = await loadRaw(id);
    if (!table) return res.status(404).json({ error: 'Tavolo non trovato' });
    if (!isMember(table, req.user)) return res.status(403).json({ error: 'Solo chi è seduto al tavolo può aprirlo' });
    if (table.gameId) return res.status(400).json({ error: 'Il tavolo ha già un risultato' });
    if (!canPickDeck(req.user, table, userId)) return res.status(403).json({ error: 'Puoi scegliere solo il tuo mazzo (chi ha aperto il tavolo li sceglie per tutti)' });
    if (deckId) {
      const deck = await prisma.deck.findUnique({ where: { id: deckId }, select: { userId: true } });
      if (!deck || deck.userId !== userId) return res.status(400).json({ error: 'Il mazzo non appartiene a questo giocatore' });
    }
    await prisma.openTableSeat.update({ where: { tableId_userId: { tableId: id, userId } }, data: { deckId } });
    res.json(await loadTable(id));
  } catch (error) {
    console.error('pick deck error', error);
    res.status(500).json({ error: 'Errore durante la scelta del mazzo' });
  }
});

// GET /api/tables/:id/scoreboard — leggero, per il polling (~3s) mentre il segnapunti è aperto
router.get('/:id/scoreboard', auth, async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: 'ID tavolo non valido' });
  try {
    const table = await prisma.openTable.findUnique({ where: { id }, select: scoreSel });
    if (!table) return res.status(404).json({ error: 'Tavolo non trovato' });
    if (!isMember(table, req.user)) return res.status(403).json({ error: 'Solo chi è seduto al tavolo può aprirlo' });
    res.json({ ...scoreboardOf(table), concluded: !!table.gameId });
  } catch (error) {
    console.error('get scoreboard error', error);
    res.status(500).json({ error: 'Errore durante il caricamento del segnapunti' });
  }
});

// POST /api/tables/:id/scoreboard { type, userId, fromUserId?, delta } — qualsiasi membro.
// { type: 'undo' } annulla l'ultima azione dello storico condiviso (anche questo: qualsiasi membro).
// Lock di riga (SELECT … FOR UPDATE): tocchi simultanei di più giocatori vengono applicati
// uno dopo l'altro, nessuno si perde. scoreVersion cresce a ogni modifica (il client scarta
// le letture più vecchie di quello che ha già).
class HttpError extends Error { constructor(status, msg) { super(msg); this.status = status; } }
router.post('/:id/scoreboard', auth, async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: 'ID tavolo non valido' });
  try {
    const result = await prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw`SELECT "gameId", "scoreboard", "scoreVersion" FROM "OpenTable" WHERE "id" = ${id} FOR UPDATE`;
      const row = rows[0];
      if (!row) throw new HttpError(404, 'Tavolo non trovato');
      const seats = await tx.openTableSeat.findMany({ where: { tableId: id }, orderBy: { createdAt: 'asc' }, select: { userId: true } });
      if (!seats.some(s => s.userId === req.user.id)) throw new HttpError(403, 'Solo chi è seduto al tavolo può aprirlo');
      if (row.gameId) throw new HttpError(400, 'Il tavolo ha già un risultato');
      const seatIds = seats.map(s => s.userId);
      const out = req.body?.type === 'undo'
        ? undoLast(row.scoreboard, seatIds)
        : applyAction(row.scoreboard, seatIds, req.body, req.user.id);
      if (out.error) throw new HttpError(400, out.error);
      const updated = await tx.openTable.update({
        where: { id },
        data: { scoreboard: out.state, scoreVersion: { increment: 1 } },
        select: { scoreVersion: true },
      });
      return { ...viewFor(out.state, seatIds), version: updated.scoreVersion, ...(out.undone ? { undone: out.undone } : {}) };
    }, { maxWait: 10000, timeout: 10000 });
    res.json(result);
  } catch (error) {
    if (error instanceof HttpError) return res.status(error.status).json({ error: error.message });
    console.error('update scoreboard error', error);
    res.status(500).json({ error: 'Errore durante l\'aggiornamento del segnapunti' });
  }
});

// DELETE /api/tables/:id/scoreboard — reset a 40 (solo chi ha aperto il tavolo)
router.delete('/:id/scoreboard', auth, async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: 'ID tavolo non valido' });
  try {
    const table = await prisma.openTable.findUnique({ where: { id }, select: scoreSel });
    if (!table) return res.status(404).json({ error: 'Tavolo non trovato' });
    if (!isMember(table, req.user)) return res.status(403).json({ error: 'Solo chi è seduto al tavolo può aprirlo' });
    if (table.createdById !== req.user.id) return res.status(403).json({ error: 'Solo chi ha aperto il tavolo può azzerare il segnapunti' });
    if (table.gameId) return res.status(400).json({ error: 'Il tavolo ha già un risultato' });
    const updated = await prisma.openTable.update({
      where: { id },
      data: { scoreboard: Prisma.DbNull, scoreVersion: { increment: 1 } },
      select: { scoreVersion: true },
    });
    res.json({ ...viewFor(null, table.seats.map(s => s.userId)), version: updated.scoreVersion });
  } catch (error) {
    console.error('reset scoreboard error', error);
    res.status(500).json({ error: 'Errore durante l\'azzeramento del segnapunti' });
  }
});

module.exports = router;
