import { describe, it, expect } from 'vitest'
import { normalize, matchName, searchPlayers, splitHighlight } from './playerSearch'

const players = [
  { id: 1, username: 'Ramuh' },
  { id: 2, username: 'Shiva' },
  { id: 3, username: 'Bahamut' },
  { id: 4, username: 'Niccolò' },
  { id: 5, username: 'gian_marco' },
  { id: 6, username: 'Marco' },
]

describe('normalize', () => {
  it('ignora maiuscole e accenti', () => {
    expect(normalize('NiCCOLÒ')).toBe('niccolo')
  })
})

describe('matchName', () => {
  it('trova la query a inizio nome, a inizio parola o in mezzo', () => {
    expect(matchName('Ramuh', 'ra').score).toBe(0)
    expect(matchName('gian_marco', 'mar').score).toBe(1)
    expect(matchName('Bahamut', 'ham').score).toBe(2)
    expect(matchName('Shiva', 'xyz')).toBeNull()
  })
  it('è insensibile agli accenti in entrambe le direzioni', () => {
    expect(matchName('Niccolò', 'colo')).not.toBeNull()
    expect(matchName('Niccolo', 'colò')).not.toBeNull()
  })
})

describe('searchPlayers', () => {
  it('con query vuota restituisce tutti, ordinati per partite e poi per nome', () => {
    const out = searchPlayers(players, '', { 2: 10, 1: 3 })
    expect(out.slice(0, 2).map(p => p.username)).toEqual(['Shiva', 'Ramuh'])
    expect(out).toHaveLength(players.length)
  })
  it('mette prima chi inizia con la query', () => {
    const out = searchPlayers(players, 'mar')
    expect(out.map(p => p.username)).toEqual(['Marco', 'gian_marco'])
  })
})

describe('splitHighlight', () => {
  it('spezza il nome intorno alla corrispondenza', () => {
    expect(splitHighlight('Bahamut', matchName('Bahamut', 'ham'))).toEqual(['Ba', 'ham', 'ut'])
  })
  it('funziona anche con lettere accentate', () => {
    expect(splitHighlight('Niccolò', matchName('Niccolò', 'colo'))).toEqual(['Nic', 'colò', ''])
  })
})
