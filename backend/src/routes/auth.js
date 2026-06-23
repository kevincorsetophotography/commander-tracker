const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma');
const auth = require('../middleware/auth');

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
  avatarCardName: user.avatarCardName ?? null,
});

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { username, password, inviteCode } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: 'username e password richiesti' });

  const expected = process.env.INVITE_CODE;
  if (!expected) {
    return res.status(403).json({ error: 'Registrazione disabilitata. Contatta un amministratore.' });
  }
  if (!inviteCode || inviteCode.trim() !== expected) {
    return res.status(403).json({ error: 'Codice d\'invito non valido' });
  }

  const hash = await bcrypt.hash(password, 10);
  try {
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
  const { username, password } = req.body;
  const user = await prisma.user.findUnique({ where: { username } });
  if (!user || !(await bcrypt.compare(password, user.password)))
    return res.status(401).json({ error: 'Credenziali non valide' });

  const token = signToken(user);
  res.json({ token, user: publicUser(user) });
});

// PATCH /api/auth/profile — aggiorna avatar (autenticato)
router.patch('/profile', auth, async (req, res) => {
  const { avatarCardName } = req.body;
  try {
    const updated = await prisma.user.update({
      where: { id: req.user.id },
      data: { avatarCardName: avatarCardName ?? null },
    });
    res.json({ ok: true, avatarCardName: updated.avatarCardName });
  } catch (e) {
    console.error('update profile error', e);
    res.status(500).json({ error: 'Errore aggiornamento profilo' });
  }
});

module.exports = router;
