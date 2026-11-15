import { describe, it, expect } from 'vitest'
import { computeTotals, romeNightKey } from './publicStats'

describe('publicStats', () => {
  it('conta partite, giocatori distinti, mazzi e serate', () => {
    const t = computeTotals({
      playedAts: ['2026-11-13T21:00:00Z', '2026-11-13T23:30:00Z', '2026-11-20T20:45:00Z'],
      playerIds: [1, 2, 3, 1, 2, 4],
      decks: 9,
    })
    expect(t).toEqual({ games: 3, players: 4, decks: 9, nights: 2 })
  })
  it('una partita dopo mezzanotte appartiene alla stessa serata', () => {
    // venerdì 13 alle 22:00 e sabato 14 all'1:30 ora di Roma
    expect(romeNightKey('2026-11-13T21:00:00Z')).toBe(romeNightKey('2026-11-14T00:30:00Z'))
  })
  it('giorni diversi = serate diverse', () => {
    expect(romeNightKey('2026-11-13T21:00:00Z')).not.toBe(romeNightKey('2026-11-20T21:00:00Z'))
  })
  it('vuoto = tutti zero', () => {
    expect(computeTotals({})).toEqual({ games: 0, players: 0, decks: 0, nights: 0 })
  })
  it('restituisce solo numeri', () => {
    const t = computeTotals({ playedAts: [new Date()], playerIds: [7], decks: 1 })
    Object.values(t).forEach(v => expect(typeof v).toBe('number'))
  })
})
