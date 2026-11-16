// Avatar di default: se l'utente non ha scelto un'immagine profilo, si usa
// l'art del commander con più partite giocate; a parità vince quello giocato
// più di recente. Senza partite: il commander del mazzo creato per ultimo.
// Calcolato al volo, mai salvato sul profilo (la scelta esplicita resta intatta).

const norm = (s) => (typeof s === 'string' ? s.trim() : '');
const ts = (d) => (d ? new Date(d).getTime() : 0);

// decks: [{ commander, createdAt, playedAts: [Date|string] }] → nome commander | null
function pickDefaultCommander(decks) {
  const byCmd = new Map(); // chiave case-insensitive: più mazzi con lo stesso commander si sommano
  for (const d of decks || []) {
    const name = norm(d.commander);
    if (!name) continue;
    const k = name.toLowerCase();
    const cur = byCmd.get(k) || { name, games: 0, lastPlayed: 0, lastCreated: 0 };
    const played = d.playedAts || [];
    cur.games += played.length;
    for (const p of played) cur.lastPlayed = Math.max(cur.lastPlayed, ts(p));
    if (ts(d.createdAt) >= cur.lastCreated) { cur.lastCreated = ts(d.createdAt); cur.name = name; }
    byCmd.set(k, cur);
  }
  const list = [...byCmd.values()];
  if (!list.length) return null;
  const anyPlayed = list.some(c => c.games > 0);
  list.sort(anyPlayed
    ? (a, b) => b.games - a.games || b.lastPlayed - a.lastPlayed || b.lastCreated - a.lastCreated
    : (a, b) => b.lastCreated - a.lastCreated);
  return list[0].name;
}

// { [username]: commander } per gli utenti SENZA avatar scelto e con almeno un commander
async function loadDefaultAvatars(prisma) {
  const users = await prisma.user.findMany({
    where: { avatarCardName: null, avatarScryfallId: null },
    select: {
      username: true,
      decks: {
        where: { commander: { not: null } },
        select: {
          commander: true,
          createdAt: true,
          gamePlayers: { select: { game: { select: { playedAt: true } } } },
        },
      },
    },
  });
  const out = {};
  for (const u of users) {
    const cmd = pickDefaultCommander(u.decks.map(d => ({
      commander: d.commander,
      createdAt: d.createdAt,
      playedAts: d.gamePlayers.map(gp => gp.game.playedAt),
    })));
    if (cmd) out[u.username] = cmd;
  }
  return out;
}

module.exports = { pickDefaultCommander, loadDefaultAvatars };
