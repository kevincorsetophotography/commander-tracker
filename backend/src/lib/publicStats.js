// Totali pubblici per la landing /info: SOLO numeri aggregati, nessun nome né dato personale.

// Data di calendario a Roma (le serate finiscono dopo mezzanotte: fino alle 6 conta il giorno prima)
function romeNightKey(date) {
  const shifted = new Date(new Date(date).getTime() - 6 * 3600 * 1000)
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit' }).format(shifted)
}

function computeTotals({ playedAts = [], playerIds = [], decks = 0 }) {
  return {
    games: playedAts.length,
    players: new Set(playerIds).size,
    decks,
    nights: new Set(playedAts.map(romeNightKey)).size,
  }
}

module.exports = { computeTotals, romeNightKey }
