// Migrazione una tantum (idempotente): corregge gli achievement stagionali
// assegnati per errore (la vecchia logica premiava anche il leader della
// stagione IN CORSO). Per ogni utente con season_champion / season_perfect nello
// snapshot, ricalcola con la logica corretta (solo stagioni concluse) e rimuove
// lo sblocco — e la relativa notifica — se non spetta davvero.
const prisma = require('./lib/prisma');
const { ACHIEVEMENT_META, loadData, unlockedForUser } = require('./lib/achievements');

const SEASONAL = ['season_champion', 'season_perfect'];

async function main() {
  const rows = await prisma.achievementUnlock.findMany({ where: { achievementId: { in: SEASONAL } } });
  if (rows.length === 0) { console.log('Achievement stagionali: niente da correggere.'); return; }

  const data = await loadData(prisma);
  const byUser = new Map();
  for (const r of rows) {
    if (!byUser.has(r.userId)) byUser.set(r.userId, []);
    byUser.get(r.userId).push(r);
  }

  let removed = 0, notifs = 0;
  for (const [userId, urows] of byUser) {
    const ok = new Set(unlockedForUser(data, userId));
    for (const r of urows) {
      if (ok.has(r.achievementId)) continue; // legittimo (stagione conclusa vinta)
      await prisma.achievementUnlock.delete({ where: { id: r.id } });
      removed++;
      const meta = ACHIEVEMENT_META[r.achievementId];
      if (meta) {
        const del = await prisma.notification.deleteMany({
          where: { userId, type: 'achievement', title: `Achievement sbloccato: ${meta.title} ${meta.icon}` },
        });
        notifs += del.count;
      }
    }
  }

  console.log(`Achievement stagionali corretti: rimossi ${removed} sblocchi errati e ${notifs} notifiche.`);
}

main()
  .catch((e) => { console.error('migrateSeasonAchievements error', e); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); });
