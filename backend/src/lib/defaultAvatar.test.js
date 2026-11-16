import { describe, it, expect } from 'vitest'
import { pickDefaultCommander } from './defaultAvatar'

describe('pickDefaultCommander', () => {
  it('vince il commander con più partite', () => {
    expect(pickDefaultCommander([
      { commander: 'Atraxa', createdAt: '2026-01-01', playedAts: ['2026-02-01'] },
      { commander: 'Edgar Markov', createdAt: '2025-01-01', playedAts: ['2026-01-01', '2026-01-02'] },
    ])).toBe('Edgar Markov')
  })
  it('somma più mazzi con lo stesso commander (case-insensitive)', () => {
    expect(pickDefaultCommander([
      { commander: 'Krenko, Mob Boss', createdAt: '2026-01-01', playedAts: ['2026-02-01'] },
      { commander: 'krenko, mob boss ', createdAt: '2026-01-02', playedAts: ['2026-02-02'] },
      { commander: 'Atraxa', createdAt: '2026-01-03', playedAts: ['2026-02-03'] },
    ])?.toLowerCase()).toBe('krenko, mob boss')
  })
  it('a parità di partite vince il giocato più di recente', () => {
    expect(pickDefaultCommander([
      { commander: 'A', createdAt: '2026-01-01', playedAts: ['2026-03-01'] },
      { commander: 'B', createdAt: '2026-01-01', playedAts: ['2026-04-01'] },
    ])).toBe('B')
  })
  it('senza partite vince il mazzo creato per ultimo', () => {
    expect(pickDefaultCommander([
      { commander: 'Vecchio', createdAt: '2026-01-01', playedAts: [] },
      { commander: 'Nuovo', createdAt: '2026-06-01', playedAts: [] },
    ])).toBe('Nuovo')
  })
  it('un mazzo giocato batte uno nuovo mai giocato', () => {
    expect(pickDefaultCommander([
      { commander: 'Giocato', createdAt: '2026-01-01', playedAts: ['2026-01-05'] },
      { commander: 'Appena creato', createdAt: '2026-11-16', playedAts: [] },
    ])).toBe('Giocato')
  })
  it('nessun commander → null (resta il fallback a iniziali)', () => {
    expect(pickDefaultCommander([])).toBeNull()
    expect(pickDefaultCommander([{ commander: '  ', createdAt: '2026-01-01', playedAts: [] }])).toBeNull()
    expect(pickDefaultCommander([{ commander: null, createdAt: '2026-01-01', playedAts: [] }])).toBeNull()
  })
})
