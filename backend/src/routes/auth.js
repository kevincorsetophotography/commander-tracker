const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma');
const auth = require('../middleware/auth');

const USERNAME_MAX = 32;
const PASSWORD_MAX = 128;
const INVITE_MAX = 200;
const AVATAR_NAME_MAX = 200;

const signToken = (user) =>
  jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '30d' }
  );

const publicUser = (user) => ({
  id: user.id,
  username: user.username,
  role: user.role,
  isOrganizer: !!user.isOrganizer,
  avatarCardName: user.avatarCardName ?? null,
  avatarScryfallId: user.avatarScryfallId ?? null,
});

// Valida username/password del body: stringhe non vuote e di lunghezza ragionevole.
// Ritorna il messaggio d'errore (→ 400) oppure null se va tutto bene.
function credentialsError(body) {
  const { username, password } = body || {};
  if (typeof username !== 'string' || typeof password !== 'string' || !username || !password)
    return 'username e password richiesti';
  if (username.length > USERNAME_MAX)
    return `Username troppo lungo (max ${USERNAME_MAX} caratteri)`;
  if (password.length > PASSWORD_MAX)
    return `Password troppo lunga (max ${PASSWORD_MAX} caratteri)`;
  return null;
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const invalid = credentialsError(req.body);
  if (invalid) return res.status(400).json({ error: invalid });
  const { username, password, inviteCode } = req.body;

  const expected = process.env.INVITE_CODE;
  if (!expected) {
    return res.status(403).json({ error: 'Registrazione disabilitata. Contatta un amministratore.' });
  }
  if (typeof inviteCode !== 'string' || inviteCode.length > INVITE_MAX || inviteCode.trim() !== expected) {
    return res.status(403).json({ error: 'Codice d\'invito non valido' });
  }

  try {
    const hash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { username, password: hash, role: 'PLAYER' }
    });
    const token = signToken(user);
    res.json({ token, user: publicUser(user) });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'Username già esistente' });
    }
    console.error('register error', error);
    res.status(500).json({ error: 'Errore durante la registrazione' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const invalid = credentialsError(req.body);
  if (invalid) return res.status(400).json({ error: invalid });
  const { username, password } = req.body;

  try {
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user || !(await bcrypt.compare(password, user.password)))
      return res.status(401).json({ error: 'Credenziali non valide' });

    const token = signToken(user);
    res.json({ token, user: publicUser(user) });
  } catch (error) {
    console.error('login error', error);
    res.status(500).json({ error: 'Errore durante il login' });
  }
});

// PATCH /api/auth/profile — aggiorna avatar (autenticato)
router.patch('/profile', auth, async (req, res) => {
  const { avatarCardName, avatarScryfallId } = req.body || {};
  if (avatarCardName !== undefined && avatarCardName !== null) {
    if (typeof avatarCardName !== 'string' || avatarCardName.length > AVATAR_NAME_MAX) {
      return res.status(400).json({ error: 'avatarCardName non valido' });
    }
  }
  if (avatarScryfallId !== undefined && avatarScryfallId !== null) {
    if (typeof avatarScryfallId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(avatarScryfallId)) {
      return res.status(400).json({ error: 'avatarScryfallId non valido' });
    }
  }
  try {
    const updated = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        avatarCardName: avatarCardName ?? null,
        avatarScryfallId: avatarScryfallId ?? null,
      },
    });
    res.json({ ok: true, avatarCardName: updated.avatarCardName, avatarScryfallId: updated.avatarScryfallId });
  } catch (e) {
    console.error('update profile error', e);
    res.status(500).json({ error: 'Errore aggiornamento profilo' });
  }
});

module.exports = router;
module.exports.publicUser = publicUser;
