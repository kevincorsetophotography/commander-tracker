import { describe, it, expect } from 'vitest'
import { allowsOpenTables, findEventForTime, joinError, canEditTable, resultMatchesSeats, eventWindow, isTableClosed, canPickDeck } from './openTables'
import { canCreateEvent, canManageEvent } from './permissions'

const at = (s) => new Date(s)

describe('eventWindow / findEventForTime', () => {
  const ev = { id: 1, startsAt: at('2026-11-20T21:00:00'), allDay: false }
  const allDay = { id: 2, startsAt: at('2026-11-22T00:00:00'), allDay: true }

  it('aggancia un tavolo da 1 ora prima fino alle 4 di notte', () => {
    expect(findEventForTime([ev], at('2026-11-20T20:00:00'))?.id).toBe(1)
    expect(findEventForTime([ev], at('2026-11-21T03:59:00'))?.id).toBe(1)
    expect(findEventForTime([ev], at('2026-11-20T19:59:00'))).toBeNull()
    expect(findEventForTime([ev], at('2026-11-21T04:00:00'))).toBeNull()
  })

  it('evento tutto il giorno: tutta la giornata', () => {
    expect(findEventForTime([allDay], at('2026-11-22T00:30:00'))?.id).toBe(2)
    expect(findEventForTime([allDay], at('2026-11-22T23:30:00'))?.id).toBe(2)
    const { from } = eventWindow(allDay)
    expect(from.getHours()).toBe(0)
  })

  it('non aggancia mai un torneo 1v1 (svizzera)', () => {
    const duel = { id: 9, startsAt: at('2026-11-20T21:00:00'), allDay: false, format: '1v1' }
    expect(findEventForTime([duel], at('2026-11-20T21:30:00'))).toBeNull()
    expect(findEventForTime([duel, ev], at('2026-11-20T21:30:00'))?.id).toBe(1)
    expect(allowsOpenTables(duel)).toBe(false)
    expect(allowsOpenTables({ format: 'multiplayer' })).toBe(true)
    expect(allowsOpenTables({ format: null })).toBe(true)
  })

  it("con più eventi sceglie quello che inizia più vicino all'orario del tavolo", () => {
    const pomeriggio = { id: 3, startsAt: at('2026-11-20T15:00:00'), allDay: false }
    expect(findEventForTime([pomeriggio, ev], at('2026-11-20T21:30:00'))?.id).toBe(1)
  })
})

describe('joinError', () => {
  const seats = (n) => Array.from({ length: n }, (_, i) => ({ userId: i + 1 }))
  it('consente di sedersi a un tavolo aperto con posti liberi', () => {
    expect(joinError({ isOpen: true, maxSeats: 5, seats: seats(2), gameId: null }, 99)).toBeNull()
  })
  it('massimo 5 posti, creatore incluso', () => {
    expect(joinError({ isOpen: true, maxSeats: 5, seats: seats(5), gameId: null }, 99)).toBe('Il tavolo è pieno')
  })
  it('tavolo chiuso: nessun altro entra', () => {
    expect(joinError({ isOpen: false, maxSeats: 5, seats: seats(2), gameId: null }, 99)).toBe('Il tavolo è chiuso')
  })
  it('non ci si siede due volte né a un tavolo concluso', () => {
    expect(joinError({ isOpen: true, maxSeats: 5, seats: seats(2), gameId: null }, 1)).toBe('Sei già seduto a questo tavolo')
    expect(joinError({ isOpen: true, maxSeats: 5, seats: seats(2), gameId: 7 }, 99)).toMatch(/risultato/)
  })
})

describe('canEditTable / resultMatchesSeats', () => {
  it('solo il creatore o un admin modificano il tavolo', () => {
    const table = { createdById: 1 }
    expect(canEditTable({ id: 1, role: 'PLAYER' }, table)).toBe(true)
    expect(canEditTable({ id: 2, role: 'PLAYER' }, table)).toBe(false)
    expect(canEditTable({ id: 2, role: 'ADMIN' }, table)).toBe(true)
  })
  it('la partita deve avere esattamente i giocatori seduti', () => {
    expect(resultMatchesSeats([3, 1, 2], [1, 2, 3])).toBe(true)
    expect(resultMatchesSeats([1, 2], [1, 2, 3])).toBe(false)
    expect(resultMatchesSeats([1, 2, 4], [1, 2, 3])).toBe(false)
  })
})

describe('permessi eventi (organizzatore)', () => {
  const admin = { id: 1, role: 'ADMIN' }
  const orga = { id: 2, role: 'PLAYER', isOrganizer: true }
  const player = { id: 3, role: 'PLAYER', isOrganizer: false }
  it('admin e organizzatori creano eventi, i player no', () => {
    expect(canCreateEvent(admin)).toBe(true)
    expect(canCreateEvent(orga)).toBe(true)
    expect(canCreateEvent(player)).toBe(false)
  })
  it("l'organizzatore gestisce solo i propri eventi (altrui = 403)", () => {
    expect(canManageEvent(orga, { createdByUserId: 2 })).toBe(true)
    expect(canManageEvent(orga, { createdByUserId: 1 })).toBe(false)
    expect(canManageEvent(admin, { createdByUserId: 2 })).toBe(true)
    expect(canManageEvent(player, { createdByUserId: 3 })).toBe(false)
  })
})

describe('isTableClosed', () => {
  const seats = (n) => Array.from({ length: n }, (_, i) => ({ userId: i + 1 }));
  it('chiuso dal creatore o pieno; mai se ha già un risultato', () => {
    expect(isTableClosed({ isOpen: true, maxSeats: 5, seats: seats(3) })).toBe(false);
    expect(isTableClosed({ isOpen: false, maxSeats: 5, seats: seats(3) })).toBe(true);
    expect(isTableClosed({ isOpen: true, maxSeats: 5, seats: seats(5) })).toBe(true);
    expect(isTableClosed({ isOpen: false, maxSeats: 5, seats: seats(3), gameId: 7 })).toBe(false);
  });
});

describe('canPickDeck', () => {
  const table = { createdById: 1, seats: [{ userId: 1 }, { userId: 2 }, { userId: 3 }] };
  it('ognuno per sé, il creatore per tutti, i non seduti mai', () => {
    expect(canPickDeck({ id: 2 }, table, 2)).toBe(true);
    expect(canPickDeck({ id: 2 }, table, 3)).toBe(false);
    expect(canPickDeck({ id: 1 }, table, 3)).toBe(true);
    expect(canPickDeck({ id: 9, role: 'ADMIN' }, table, 2)).toBe(false);
    expect(canPickDeck({ id: 1 }, table, 9)).toBe(false);
  });
});
