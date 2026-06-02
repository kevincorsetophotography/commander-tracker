const router = require('express').Router();
const auth = require('../middleware/auth');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const parseGameId = (value) => {
  const id = Number.parseInt(value, 10);
  return Number.isInteger(id) ? id : null;
};

// Converte una data in input in Date valida; null se assente, undefined se invalida
const parsePlayedAt = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
};

const validateGamePayload = async ({ players, winnerId, winnerDeckId }) => {
  const normalizedWinnerId = Number.parseInt(winnerId, 10);
  const normalizedWinnerDeckId = Number.parseInt(winnerDeckId, 10);

  if (!players || players.length < 3 || players.length > 5) {
    return { error: 'Servono 3-5 giocatori' };
  }

  if (!normalizedWinnerId || !normalizedWinnerDeckId) {
    return { error: 'Vincitore richiesto' };
  }

  const normalizedPlayers = players.map((player) => ({
    userId: Number.parseInt(player.userId, 10),
    deckId: Number.parseInt(player.deckId, 10)
  }));

  if (normalizedPlayers.some((player) => !player.userId || !player.deckId)) {
    return { error: 'Ogni giocatore deve avere utente e mazzo validi' };
  }

  const uniqueUsers = new Set(normalizedPlayers.map((player) => player.userId));
  if (uniqueUsers.size !== normalizedPlayers.length) {
    return { error: 'Lo stesso giocatore non può essere al tavolo due volte' };
  }

  const winnerInGame = normalizedPlayers.some(
    (player) => player.userId === normalizedWinnerId && player.deckId === normalizedWinnerDeckId
  );
  if (!winnerInGame) {
    return { error: 'Il vincitore deve essere nel tavolo' };
  }

  const deckIds = normalizedPlayers.map((player) => player.deckId);
  const decks = await prisma.deck.findMany({
    where: { id: { in: deckIds } },
    select: { id: true, userId: true }
  });
  const decksById = new Map(decks.map((deck) => [deck.id, deck]));

  const invalidDeckOwnership = normalizedPlayers.some((player) => {
    const deck = decksById.get(player.deckId);
    return !deck || deck.userId !== player.userId;
  });

  if (invalidDeckOwnership) {
    return { error: 'Ogni deck deve appartenere al giocatore selezionato' };
  }

  return {
    normalizedPlayers,
    normalizedWinnerId,
    normalizedWinnerDeckId
  };
};

const gameInclude = {
  createdBy: { select: { id: true, username: true } },
  players: {
    include: {
      user: { select: { id: true, username: true } },
      deck: true
    }
  }
};

router.get('/', auth, async (req, res) => {
  const games = await prisma.game.findMany({
    orderBy: { playedAt: 'desc' },
    include: gameInclude
  });

  res.json(games);
});

router.post('/', auth, async (req, res) => {
  const { players, winnerId, winnerDeckId, notes, playedAt } = req.body;
  const validation = await validateGamePayload({ players, winnerId, winnerDeckId });

  if (validation.error) {
    return res.status(400).json({ error: validation.error });
  }

  const parsedDate = parsePlayedAt(playedAt);
  if (parsedDate === undefined) {
    return res.status(400).json({ error: 'Data partita non valida' });
  }

  const { normalizedPlayers, normalizedWinnerId, normalizedWinnerDeckId } = validation;

  const game = await prisma.game.create({
    data: {
      notes,
      ...(parsedDate ? { playedAt: parsedDate } : {}),
      createdByUserId: req.user.id,
      players: {
        create: normalizedPlayers.map((player) => ({
          userId: player.userId,
          deckId: player.deckId,
          isWinner: player.userId === normalizedWinnerId && player.deckId === normalizedWinnerDeckId
        }))
      }
    },
    include: gameInclude
  });

  res.json(game);
});

router.patch('/:id', auth, async (req, res) => {
  const gameId = parseGameId(req.params.id);
  if (!gameId) return res.status(400).json({ error: 'ID partita non valido' });

  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: { id: true, createdByUserId: true }
  });

  if (!game) return res.status(404).json({ error: 'Partita non trovata' });
  if (req.user.role !== 'ADMIN' && game.createdByUserId !== req.user.id) {
    return res.status(403).json({ error: 'Solo admin o creatore possono modificare la partita' });
  }

  const { players, winnerId, winnerDeckId, notes, playedAt } = req.body;
  const validation = await validateGamePayload({ players, winnerId, winnerDeckId });

  if (validation.error) {
    return res.status(400).json({ error: validation.error });
  }

  const parsedDate = parsePlayedAt(playedAt);
  if (parsedDate === undefined) {
    return res.status(400).json({ error: 'Data partita non valida' });
  }

  const { normalizedPlayers, normalizedWinnerId, normalizedWinnerDeckId } = validation;

  const updated = await prisma.$transaction(async (tx) => {
    await tx.gamePlayer.deleteMany({ where: { gameId: game.id } });

    return tx.game.update({
      where: { id: game.id },
      data: {
        notes,
        ...(parsedDate ? { playedAt: parsedDate } : {}),
        players: {
          create: normalizedPlayers.map((player) => ({
            userId: player.userId,
            deckId: player.deckId,
            isWinner: player.userId === normalizedWinnerId && player.deckId === normalizedWinnerDeckId
          }))
        }
      },
      include: gameInclude
    });
  });

  res.json(updated);
});

router.delete('/:id', auth, async (req, res) => {
  const gameId = parseGameId(req.params.id);
  if (!gameId) return res.status(400).json({ error: 'ID partita non valido' });

  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: { id: true, createdByUserId: true }
  });

  if (!game) return res.status(404).json({ error: 'Partita non trovata' });
  if (req.user.role !== 'ADMIN' && (!game.createdByUserId || game.createdByUserId !== req.user.id)) {
    return res.status(403).json({ error: 'Solo admin o creatore possono eliminare la partita' });
  }

  await prisma.game.delete({ where: { id: game.id } });
  res.json({ ok: true });
});

module.exports = router;
