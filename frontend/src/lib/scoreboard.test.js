import { describe, it, expect } from 'vitest'
import { applyLocal, eliminationOf } from './scoreboard'

const base = () => ({
  players: {
    1: { life: 40, poison: 0, cmd: { 2: 0 }, eliminated: false, reason: null },
    2: { life: 40, poison: 0, cmd: { 1: 0 }, eliminated: false, reason: null },
  },
})

describe('applyLocal (specchio del server)', () => {
  it('vita e veleno', () => {
    let v = applyLocal(base(), { type: 'life', userId: 1, delta: -5 })
    v = applyLocal(v, { type: 'poison', userId: 1, delta: -1 })
    expect(v.players[1]).toMatchObject({ life: 35, poison: 0 })
  })
  it('danno da commander toglie vita; 21 elimina', () => {
    let v = applyLocal(base(), { type: 'cmd', userId: 1, fromUserId: 2, delta: 21 })
    expect(v.players[1]).toMatchObject({ life: 19, cmd: { 2: 21 }, eliminated: true, reason: 'commander' })
    v = applyLocal(v, { type: 'cmd', userId: 1, fromUserId: 2, delta: -30 })
    expect(v.players[1]).toMatchObject({ life: 40, cmd: { 2: 0 }, eliminated: false })
  })
  it('elimination: vita, veleno', () => {
    expect(eliminationOf({ life: 0, poison: 0, cmd: {} }).reason).toBe('life')
    expect(eliminationOf({ life: 3, poison: 10, cmd: {} }).reason).toBe('poison')
  })
  it('giocatore sconosciuto: nessun cambiamento', () => {
    const v = base()
    expect(applyLocal(v, { type: 'life', userId: 9, delta: 1 })).toBe(v)
  })
})
