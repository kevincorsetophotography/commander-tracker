// Ricerca + ordinamento dei propri mazzi (pagina Mazzi e profilo). Puro, con test.

export const DECK_SORTS = [
  { id: 'recent', label: 'Recenti' },
  { id: 'winrate', label: 'Win rate' },
  { id: 'games', label: 'Partite' },
  { id: 'name', label: 'Nome' },
]

const norm = (s) => (s || '').toString().normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

// stats: mappa deckId → { games, wins, winRate }
export function filterSortDecks(decks, stats = {}, { q = '', sort = 'recent' } = {}) {
  const needle = norm(q.trim())
  const st = (d) => stats[d.id] || { games: 0, wins: 0, winRate: 0 }
  const list = (decks || []).filter(d => !needle
    || norm(d.name).includes(needle)
    || norm(d.commander).includes(needle)
    || norm(d.archetype).includes(needle))
  const byName = (a, b) => (a.name || '').localeCompare(b.name || '', 'it', { sensitivity: 'base' })
  const cmp = {
    recent: (a, b) => b.id - a.id,
    name: byName,
    games: (a, b) => st(b).games - st(a).games || byName(a, b),
    // Mazzi mai giocati in fondo; a parità di win rate conta chi ha più partite
    winrate: (a, b) => (st(b).games > 0) - (st(a).games > 0) || st(b).winRate - st(a).winRate || st(b).games - st(a).games || byName(a, b),
  }[sort] || ((a, b) => b.id - a.id)
  return [...list].sort(cmp)
}
