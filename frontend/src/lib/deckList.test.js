import { describe, it, expect } from 'vitest'
import { filterSortDecks } from './deckList'

const decks = [
  { id: 1, name: 'Zombi', commander: 'Wilhelt, the Rotcleaver', archetype: 'Aristocrats' },
  { id: 2, name: 'Draghi', commander: 'The Ur-Dragon', archetype: 'Ramp' },
  { id: 3, name: 'Élfi', commander: 'Lathril, Blade of the Elves', archetype: 'Tokens' },
  { id: 4, name: 'Nuovo', commander: null, archetype: null },
]
const stats = {
  1: { games: 10, wins: 5, winRate: 50 },
  2: { games: 4, wins: 3, winRate: 75 },
  3: { games: 2, wins: 1, winRate: 50 },
}
const ids = (l) => l.map(d => d.id)

describe('filterSortDecks', () => {
  it('ordina per recenti (id decrescente) di default', () => {
    expect(ids(filterSortDecks(decks, stats))).toEqual([4, 3, 2, 1])
  })
  it('win rate: mai giocati in fondo, parità decisa dalle partite', () => {
    expect(ids(filterSortDecks(decks, stats, { sort: 'winrate' }))).toEqual([2, 1, 3, 4])
  })
  it('partite e nome', () => {
    expect(ids(filterSortDecks(decks, stats, { sort: 'games' }))).toEqual([1, 2, 3, 4])
    expect(ids(filterSortDecks(decks, stats, { sort: 'name' }))).toEqual([2, 3, 4, 1])
  })
  it('cerca su nome, commander e archetipo, senza accenti né maiuscole', () => {
    expect(ids(filterSortDecks(decks, stats, { q: 'elfi' }))).toEqual([3])
    expect(ids(filterSortDecks(decks, stats, { q: 'ur-drag' }))).toEqual([2])
    expect(ids(filterSortDecks(decks, stats, { q: 'ARISTO' }))).toEqual([1])
    expect(filterSortDecks(decks, stats, { q: 'nessuno' })).toEqual([])
  })
  it('non modifica l\'array di partenza', () => {
    const copy = [...decks]
    filterSortDecks(decks, stats, { sort: 'name' })
    expect(decks).toEqual(copy)
  })
})
