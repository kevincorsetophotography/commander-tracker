const router = require('express').Router();
const auth   = require('../middleware/auth');
const prisma = require('../lib/prisma');
const { askJudge } = require('../lib/judge');

// POST /api/judge — domanda al judge bot
router.post('/', auth, async (req, res) => {
  const { question } = req.body;

  if (!question || typeof question !== 'string' || question.trim().length < 5) {
    return res.status(400).json({ error: 'Domanda troppo corta o mancante (minimo 5 caratteri)' });
  }

  const q = question.trim().slice(0, 500);

  try {
    const result = await askJudge(q);

    await prisma.judgeQuestion.create({
      data: {
        userId:      req.user.id,
        question:    q,
        answer:      result.answer,
        explanation: result.explanation,
        confidence:  result.confidence,
        sourcesJson: JSON.stringify(result.sources),
        rulesUsed:   JSON.stringify(result.rulesUsed)
      }
    });

    res.json(result);
  } catch (err) {
    console.error('judge error:', err.message);
    if (err.message?.includes('GROQ_API_KEY')) {
      return res.status(503).json({ error: 'Servizio judge non configurato (GROQ_API_KEY mancante)' });
    }
    res.status(500).json({ error: 'Errore durante la consulenza. Riprova tra qualche istante.' });
  }
});

module.exports = router;
