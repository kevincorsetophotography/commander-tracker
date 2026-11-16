const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma');

// Ruolo e permessi si rileggono dal DB (non dal JWT, che resterebbe vecchio dopo un
// cambio dell'admin), ma con una cache breve per utente: il polling del segnapunti
// (ogni ~3s per giocatore) e le pagine con più chiamate non pagano una query in più
// a ogni richiesta. Le modifiche fatte da questo server (admin, profilo) svuotano
// subito la voce dell'utente con forgetUser(), quindi la revoca resta immediata.
const TTL_MS = 30 * 1000;
const cache = new Map(); // id -> { user, at }

function forgetUser(id) {
  if (id == null) cache.clear();
  else cache.delete(Number(id));
}

async function loadUser(id) {
  const hit = cache.get(id);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.user;
  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, username: true, role: true, isOrganizer: true },
  });
  if (user) cache.set(id, { user, at: Date.now() });
  else cache.delete(id);
  if (cache.size > 500) cache.clear(); // gruppo piccolo: un tetto di sicurezza basta
  return user;
}

module.exports = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await loadUser(payload.id);
    if (!user) return res.status(401).json({ error: 'Utente non trovato' });
    req.user = { ...user };
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
};

module.exports.forgetUser = forgetUser;
