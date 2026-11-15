import { describe, it, expect } from 'vitest'
import { nightStatus, romeOffset, splitMs } from './nextNight'

const iso = (s) => new Date(s)

describe('nextNight', () => {
  it('ora solare (+1) e legale (+2)', () => {
    expect(romeOffset(iso('2026-01-15T12:00:00Z'))).toBe(60)
    expect(romeOffset(iso('2026-07-15T12:00:00Z'))).toBe(120)
  })
  it('domenica → venerdì successivo alle 21:30 ora di Roma (inverno = 20:30 UTC)', () => {
    const r = nightStatus(iso('2026-11-15T10:00:00Z')) // domenica
    expect(r.live).toBe(false)
    expect(r.start.toISOString()).toBe('2026-11-20T20:30:00.000Z')
  })
  it('in estate le 21:30 di Roma sono le 19:30 UTC', () => {
    const r = nightStatus(iso('2026-07-14T10:00:00Z')) // martedì
    expect(r.start.toISOString()).toBe('2026-07-17T19:30:00.000Z')
  })
  it('venerdì pomeriggio → stessa sera', () => {
    const r = nightStatus(iso('2026-11-20T15:00:00Z'))
    expect(r.start.toISOString()).toBe('2026-11-20T20:30:00.000Z')
    expect(splitMs(r.ms)).toEqual({ d: 0, h: 5, m: 30, s: 0 })
  })
  it('durante la serata, anche dopo mezzanotte → "stasera si gioca"', () => {
    expect(nightStatus(iso('2026-11-20T21:00:00Z')).live).toBe(true) // ven 22:00
    expect(nightStatus(iso('2026-11-21T01:30:00Z')).live).toBe(true) // sab 02:30
  })
  it('sabato dopo le 4:00 → venerdì successivo', () => {
    const r = nightStatus(iso('2026-11-21T04:00:00Z')) // sab 05:00
    expect(r.live).toBe(false)
    expect(r.start.toISOString()).toBe('2026-11-27T20:30:00.000Z')
  })
  it('settimana del cambio d\'ora (ottobre): venerdì dopo è già ora solare', () => {
    // domenica 25/10/2026 cambio ora; dal lunedì 26 il venerdì 30 alle 21:30 = 20:30 UTC
    expect(nightStatus(iso('2026-10-24T10:00:00Z')).start.toISOString()).toBe('2026-10-30T20:30:00.000Z')
  })
})
