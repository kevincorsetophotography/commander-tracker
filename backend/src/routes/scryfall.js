const express = require('express');
const router = express.Router();

// Proxy per immagini Scryfall: risolve il problema CORS su cards.scryfall.io (CDN senza CORS headers).
// Il client non può fetchare le immagini direttamente (redirect al CDN blocca il fetch), ma il server sì.
router.get('/art', async (req, res) => {
  const { name } = req.query;
  if (!name || typeof name !== 'string' || name.length > 200) {
    return res.status(400).json({ error: 'name required' });
  }
  try {
    const url = `https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(name)}&format=image&version=art_crop`;
    const r = await fetch(url, {
      redirect: 'follow',
      headers: { 'User-Agent': 'CommanderoneTracker/1.0; contact=github.com/commanderone' },
    });
    if (!r.ok) return res.status(404).json({ error: 'Card not found' });
    const ct = r.headers.get('content-type') || 'image/jpeg';
    res.set('Content-Type', ct);
    res.set('Cache-Control', 'public, max-age=604800'); // 7 giorni — le immagini Scryfall sono immutabili per ID
    const buf = await r.arrayBuffer();
    res.send(Buffer.from(buf));
  } catch (e) {
    console.error('[scryfall proxy]', e.message);
    res.status(502).json({ error: 'Scryfall unreachable' });
  }
});

module.exports = router;
