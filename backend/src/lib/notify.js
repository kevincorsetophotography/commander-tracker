const { ACHIEVEMENT_META, loadData, unlockedForUser } = require('./achievements');

// Crea una notifica uguale per più destinatari (bulk). Ignora lista vuota.
async function createNotifications(prisma, recipientIds, { type, title, body = null, link = null, fromUserId = null }) {
  const ids = [...new Set(recipientIds)].filter(Boolean);
  if (ids.length === 0) return;
  await prisma.notification.createMany({
    data: ids.map(userId => ({ userId, type, title, body, link, fromUserId })),
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
  if (unique.length === 0) return;
  try {
    const data = await loadData(prisma);
    for (const userId of unique) {
      const unlocked = unlockedForUser(data, userId);
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
            link: `/giocatore/${userId}?ach=1`,
          },
        });
      }
    }
  } catch (e) {
    console.error('checkAchievements error', e);
  }
}

// Registra (in silenzio, senza notifiche) gli achievement già sbloccati che non
// sono ancora nello snapshot. Idempotente: gira a ogni avvio, così quando si
// aggiungono nuovi achievement quelli già maturati non generano un diluvio di
// notifiche al primo trigger.
async function initAchievementSnapshots(prisma) {
  try {
    const data = await loadData(prisma);
    const users = await prisma.user.findMany({ select: { id: true } });
    let added = 0;
    for (const u of users) {
      const unlocked = unlockedForUser(data, u.id);
      if (unlocked.length === 0) continue;
      const res = await prisma.achievementUnlock.createMany({
        data: unlocked.map(achievementId => ({ userId: u.id, achievementId })),
        skipDuplicates: true,
      });
      added += res.count || 0;
    }
    if (added > 0) console.log(`Snapshot achievement aggiornato (+${added}).`);
  } catch (e) {
    console.error('initAchievementSnapshots error', e);
  }
}

module.exports = { createNotifications, gameParticipantIds, checkAchievements, initAchievementSnapshots };
