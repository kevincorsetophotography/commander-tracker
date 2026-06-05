const { ACHIEVEMENT_META, computeUnlockedIds } = require('./achievements');

// Crea una notifica uguale per più destinatari (bulk). Ignora lista vuota.
async function createNotifications(prisma, recipientIds, { type, title, body = null, link = null }) {
  const ids = [...new Set(recipientIds)].filter(Boolean);
  if (ids.length === 0) return;
  await prisma.notification.createMany({
    data: ids.map(userId => ({ userId, type, title, body, link })),
  });
}

// userId distinti dei partecipanti a una partita (per notifiche commento/reazione).
async function gameParticipantIds(prisma, gameId) {
  const players = await prisma.gamePlayer.findMany({ where: { gameId }, select: { userId: true } });
  return [...new Set(players.map(p => p.userId))];
}

// Ricalcola gli achievement degli utenti indicati e notifica SOLO i nuovi sblocchi.
// Il vincolo unique su (userId, achievementId) fa da lock atomico: chi riesce a
// creare lo snapshot è l'unico a notificare, anche con chiamate concorrenti.
async function checkAchievements(prisma, userIds) {
  const unique = [...new Set(userIds)].filter(Boolean);
  for (const userId of unique) {
    try {
      const unlocked = await computeUnlockedIds(prisma, userId);
      for (const id of unlocked) {
        if (!ACHIEVEMENT_META[id]) continue;
        try {
          await prisma.achievementUnlock.create({ data: { userId, achievementId: id } });
        } catch (e) {
          if (e.code === 'P2002') continue; // già sbloccato: niente notifica
          throw e;
        }
        await prisma.notification.create({
          data: {
            userId,
            type: 'achievement',
            title: `Achievement sbloccato: ${ACHIEVEMENT_META[id].title} ${ACHIEVEMENT_META[id].icon}`,
            link: `/giocatore/${userId}`,
          },
        });
      }
    } catch (e) {
      console.error('checkAchievements error', e);
    }
  }
}

// Inizializza (una sola volta) lo snapshot degli achievement già sbloccati,
// SENZA creare notifiche: evita il diluvio sui dati preesistenti al rilascio.
async function initAchievementSnapshots(prisma) {
  try {
    const count = await prisma.achievementUnlock.count();
    if (count > 0) return;
    const users = await prisma.user.findMany({ select: { id: true } });
    for (const u of users) {
      const unlocked = await computeUnlockedIds(prisma, u.id);
      if (unlocked.length === 0) continue;
      await prisma.achievementUnlock.createMany({
        data: unlocked.map(achievementId => ({ userId: u.id, achievementId })),
        skipDuplicates: true,
      });
    }
    console.log('Snapshot achievement inizializzato.');
  } catch (e) {
    console.error('initAchievementSnapshots error', e);
  }
}

module.exports = { createNotifications, gameParticipantIds, checkAchievements, initAchievementSnapshots };
