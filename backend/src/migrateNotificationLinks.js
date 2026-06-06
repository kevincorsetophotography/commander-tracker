// Migrazione una tantum (idempotente): aggiorna il `link` delle notifiche già
// esistenti ai nuovi deep-link puntuali.
//   achievement: /giocatore/:id            -> /giocatore/:id?ach=1
//   evento:      /eventi                   -> /eventi?focus=:id   (per titolo)
//   commento:    /?tab=storico             -> /partita/:id        (per autore+testo+orario)
//   reazione:    /?tab=storico             -> /partita/:id        (per emoji+autore+orario)
// Ciò che non è ricostruibile (es. reazione poi tolta, evento eliminato) resta com'è.
const prisma = require('./lib/prisma');

const WINDOW_MS = 15000; // tolleranza tra orario notifica e commento/reazione

function pickClosest(rows, when) {
  if (!rows || rows.length === 0) return null;
  const t = new Date(when).getTime();
  return rows.reduce((best, r) => {
    const d = Math.abs(new Date(r.createdAt).getTime() - t);
    return (!best || d < best._d) ? { ...r, _d: d } : best;
  }, null);
}

async function newLinkFor(n) {
  if (n.type === 'achievement') {
    const m = (n.link || '').match(/^\/giocatore\/(\d+)/);
    return m ? `/giocatore/${m[1]}?ach=1` : null;
  }

  if (n.type === 'event') {
    const title = (n.title || '').replace(/^📅\s*Nuovo evento:\s*/, '').trim();
    if (!title) return null;
    const ev = await prisma.event.findFirst({ where: { title }, orderBy: { createdAt: 'desc' }, select: { id: true } });
    return ev ? `/eventi?focus=${ev.id}` : null;
  }

  const since = new Date(new Date(n.createdAt).getTime() - WINDOW_MS);
  const until = new Date(new Date(n.createdAt).getTime() + WINDOW_MS);

  if (n.type === 'comment') {
    const actor = (n.title.match(/^💬\s*(.+?)\s+ha commentato/) || [])[1];
    if (!actor) return null;
    const snippet = (n.body || '').replace(/…$/, '');
    const cands = await prisma.comment.findMany({
      where: {
        user: { username: actor },
        createdAt: { gte: since, lte: until },
        game: { players: { some: { userId: n.userId } } },
      },
      select: { gameId: true, body: true, createdAt: true },
    });
    const byBody = snippet ? cands.filter(c => c.body.startsWith(snippet)) : cands;
    const g = pickClosest(byBody.length ? byBody : cands, n.createdAt);
    return g ? `/partita/${g.gameId}` : null;
  }

  if (n.type === 'reaction') {
    const m = n.title.match(/^(\S+)\s+(.+?)\s+ha reagito/);
    const emoji = m && m[1];
    const actor = m && m[2];
    if (!emoji || !actor) return null;
    const cands = await prisma.reaction.findMany({
      where: {
        emoji,
        user: { username: actor },
        createdAt: { gte: since, lte: until },
        game: { players: { some: { userId: n.userId } } },
      },
      select: { gameId: true, createdAt: true },
    });
    const g = pickClosest(cands, n.createdAt);
    return g ? `/partita/${g.gameId}` : null;
  }

  return null;
}

async function main() {
  // Solo le notifiche con link "vecchio stile"
  const legacy = await prisma.notification.findMany({
    where: {
      OR: [
        { link: '/?tab=storico' },
        { link: '/eventi' },
        { AND: [{ type: 'achievement' }, { link: { startsWith: '/giocatore/' } }, { NOT: { link: { contains: 'ach=' } } }] },
      ],
    },
  });

  let updated = 0;
  const byType = {};
  for (const n of legacy) {
    const link = await newLinkFor(n);
    byType[n.type] = byType[n.type] || { upgraded: 0, total: 0 };
    byType[n.type].total++;
    if (link && link !== n.link) {
      await prisma.notification.update({ where: { id: n.id }, data: { link } });
      byType[n.type].upgraded++;
      updated++;
    }
  }

  console.log(`Migrazione link notifiche: ${updated}/${legacy.length} aggiornati.`);
  for (const [type, s] of Object.entries(byType)) console.log(`  ${type}: ${s.upgraded}/${s.total}`);
}

main()
  .catch((e) => { console.error('migrateNotificationLinks error', e); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); });
