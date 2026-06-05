const router = require('express').Router();
const auth = require('../middleware/auth');
const { createNotifications } = require('../lib/notify');

const prisma = require('../lib/prisma');

// Data leggibile per il corpo della notifica evento
const formatEventDate = (d, allDay) => {
  const date = new Date(d).toLocaleDateString('it-IT', { day: 'numeric', month: 'long' });
  if (allDay) return date;
  const time = new Date(d).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  return `${date} · ${time}`;
};

const MAX_TITLE = 120;
const MAX_LOCATION = 160;
const MAX_DESCRIPTION = 2000;

const parseEventId = (value) => {
  const id = Number.parseInt(value, 10);
  return Number.isInteger(id) ? id : null;
};

const eventInclude = {
  createdBy: { select: { id: true, username: true } },
  rsvps: { select: { userId: true, user: { select: { username: true } } } }
};

// Normalizza/valida il payload di un evento. Ritorna { error } oppure { data }
const buildEventData = (body) => {
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  if (!title) return { error: 'Titolo richiesto' };
  if (title.length > MAX_TITLE) return { error: `Titolo troppo lungo (max ${MAX_TITLE})` };

  const startsAt = body.startsAt ? new Date(body.startsAt) : null;
  if (!startsAt || Number.isNaN(startsAt.getTime())) return { error: 'Data evento non valida' };

  const description = typeof body.description === 'string' && body.description.trim()
    ? body.description.trim().slice(0, MAX_DESCRIPTION)
    : null;
  const location = typeof body.location === 'string' && body.location.trim()
    ? body.location.trim().slice(0, MAX_LOCATION)
    : null;

  return {
    data: {
      title,
      description,
      location,
      startsAt,
      allDay: body.allDay === true || body.allDay === 'true'
    }
  };
};

// GET /api/events — tutti gli eventi (ordinati per data crescente)
router.get('/', auth, async (req, res) => {
  try {
    const events = await prisma.event.findMany({
      orderBy: { startsAt: 'asc' },
      include: eventInclude
    });
    res.json(events);
  } catch (error) {
    console.error('list events error', error);
    res.status(500).json({ error: 'Errore durante il caricamento degli eventi' });
  }
});

// POST /api/events — crea un evento (solo admin)
router.post('/', auth, async (req, res) => {
  if (req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Solo gli admin possono creare eventi' });

  const { error, data } = buildEventData(req.body);
  if (error) return res.status(400).json({ error });

  try {
    const event = await prisma.event.create({
      data: { ...data, createdByUserId: req.user.id },
      include: eventInclude
    });

    // Notifica tutti gli utenti tranne il creatore
    const users = await prisma.user.findMany({ select: { id: true } });
    await createNotifications(prisma, users.map(u => u.id).filter(id => id !== req.user.id), {
      type: 'event',
      title: `📅 Nuovo evento: ${event.title}`,
      body: formatEventDate(event.startsAt, event.allDay) + (event.location ? ` · ${event.location}` : ''),
      link: '/eventi',
    });

    res.json(event);
  } catch (error) {
    console.error('create event error', error);
    res.status(500).json({ error: 'Errore durante la creazione dell\'evento' });
  }
});

// PATCH /api/events/:id — modifica un evento (solo admin)
router.patch('/:id', auth, async (req, res) => {
  if (req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Solo gli admin possono modificare eventi' });

  const eventId = parseEventId(req.params.id);
  if (!eventId) return res.status(400).json({ error: 'ID evento non valido' });

  const { error, data } = buildEventData(req.body);
  if (error) return res.status(400).json({ error });

  try {
    const existing = await prisma.event.findUnique({ where: { id: eventId }, select: { id: true } });
    if (!existing) return res.status(404).json({ error: 'Evento non trovato' });

    const event = await prisma.event.update({
      where: { id: eventId },
      data,
      include: eventInclude
    });
    res.json(event);
  } catch (error) {
    console.error('update event error', error);
    res.status(500).json({ error: 'Errore durante l\'aggiornamento dell\'evento' });
  }
});

// DELETE /api/events/:id — elimina un evento (solo admin)
router.delete('/:id', auth, async (req, res) => {
  if (req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Solo gli admin possono eliminare eventi' });

  const eventId = parseEventId(req.params.id);
  if (!eventId) return res.status(400).json({ error: 'ID evento non valido' });

  try {
    const existing = await prisma.event.findUnique({ where: { id: eventId }, select: { id: true } });
    if (!existing) return res.status(404).json({ error: 'Evento non trovato' });

    await prisma.event.delete({ where: { id: eventId } });
    res.json({ ok: true });
  } catch (error) {
    console.error('delete event error', error);
    res.status(500).json({ error: 'Errore durante l\'eliminazione dell\'evento' });
  }
});

// POST /api/events/:id/rsvp — toggle "ci sono" dell'utente corrente
router.post('/:id/rsvp', auth, async (req, res) => {
  const eventId = parseEventId(req.params.id);
  if (!eventId) return res.status(400).json({ error: 'ID evento non valido' });

  try {
    const event = await prisma.event.findUnique({ where: { id: eventId }, select: { id: true } });
    if (!event) return res.status(404).json({ error: 'Evento non trovato' });

    const existing = await prisma.eventRsvp.findUnique({
      where: { eventId_userId: { eventId, userId: req.user.id } }
    });
    if (existing) {
      await prisma.eventRsvp.delete({ where: { id: existing.id } });
    } else {
      await prisma.eventRsvp.create({ data: { eventId, userId: req.user.id } });
    }

    const rsvps = await prisma.eventRsvp.findMany({
      where: { eventId },
      select: { userId: true, user: { select: { username: true } } }
    });
    res.json({ rsvps });
  } catch (error) {
    console.error('toggle rsvp error', error);
    res.status(500).json({ error: 'Errore durante l\'adesione' });
  }
});

module.exports = router;
