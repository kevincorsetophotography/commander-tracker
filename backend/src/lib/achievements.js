// Logica achievement lato server — rispecchia frontend/src/lib/achievements.js.
// Serve a rilevare i traguardi appena sbloccati e generare le notifiche.

// Metadati (titolo + icona) usati nei testi delle notifiche.
const ACHIEVEMENT_META = {
  first_win:  { icon: '🏆', title: 'Prima vittoria' },
  rookie:     { icon: '🃏', title: 'Esordiente' },
  streak3:    { icon: '🔥', title: 'Sul fuoco' },
  streak5:    { icon: '💎', title: 'Implacabile' },
  collector:  { icon: '🎴', title: 'Collezionista' },
  rainbow:    { icon: '🌈', title: 'Arcobaleno' },
  survivor:   { icon: '🛡️', title: 'Sopravvissuto' },
  veteran:    { icon: '⚔️', title: 'Veterano' },
  dominator:  { icon: '👑', title: 'Dominatore' },
};

// Calcola gli id degli achievement sbloccati da un utente, leggendo dal DB.
async function computeUnlockedIds(prisma, userId) {
  const [rows, deckCount] = await Promise.all([
    prisma.gamePlayer.findMany({
      where: { userId },
      select: {
        isWinner: true,
        placement: true,
        game: { select: { playedAt: true } },
        deck: { select: { colors: true } },
      },
    }),
    prisma.deck.count({ where: { userId } }),
  ]);

  const total = rows.length;
  const wins = rows.filter(r => r.isWinner).length;

  // streak migliore (cronologico)
  const chrono = [...rows].sort((a, b) => new Date(a.game.playedAt) - new Date(b.game.playedAt));
  let cur = 0, best = 0;
  for (const r of chrono) {
    if (r.isWinner) { cur++; best = Math.max(best, cur); } else cur = 0;
  }

  // colori con cui ha vinto
  const wonColors = new Set();
  for (const r of rows) {
    if (r.isWinner) (r.deck.colors || '').split('').forEach(c => wonColors.add(c));
  }

  // piazzamento medio (partite con placement)
  const placed = rows.filter(r => r.placement != null);
  const avgPlacement = placed.length
    ? placed.reduce((s, r) => s + r.placement, 0) / placed.length
    : null;

  const winRate = total ? Math.round(wins / total * 100) : 0;

  const unlocked = {
    first_win: wins >= 1,
    rookie:    total >= 1,
    streak3:   best >= 3,
    streak5:   best >= 5,
    collector: deckCount >= 3,
    rainbow:   ['W', 'U', 'B', 'R', 'G'].every(c => wonColors.has(c)),
    survivor:  placed.length >= 3 && avgPlacement != null && avgPlacement <= 2,
    veteran:   total >= 20,
    dominator: total >= 10 && winRate >= 40,
  };

  return Object.keys(unlocked).filter(id => unlocked[id]);
}

module.exports = { ACHIEVEMENT_META, computeUnlockedIds };
