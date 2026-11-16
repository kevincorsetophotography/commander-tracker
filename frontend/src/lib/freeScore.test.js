import { describe, it, expect } from 'vitest'
import { validateSetup, buildSeats, canRegister, initialScore, applyFree, undoFree, resetFree, loadFree, saveFree, clearFree, MAX_PLAYERS } from './freeScore'

const me = { kind: 'user', userId: 7, username: 'Ramuh', deck: { id: 3, name: 'Elfi', commander: 'Lathril, Blade of the Elves' } }
const shiva = { kind: 'user', userId: 9, username: 'Shiva' }
const guest = (name, commander) => ({ kind: 'guest', name, commander })

function memStore() {
  const m = new Map()
  return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), size: () => m.size }
}

describe('setup', () => {
  it('servono da 2 a 6 giocatori', () => {
    expect(validateSetup([me])).toMatch(/almeno 2/)
    expect(validateSetup([me, shiva])).toBeNull()
    const many = Array.from({ length: MAX_PLAYERS + 1 }, (_, i) => guest(`O${i}`))
    expect(validateSetup(many)).toMatch(/Massimo 6/)
    expect(validateSetup(many.slice(0, 6))).toBeNull()
  })
  it('ospite senza nome, nomi doppi e utente doppio non passano', () => {
    expect(validateSetup([me, guest('  ')])).toMatch(/nome/)
    expect(validateSetup([me, guest('ramuh')])).toMatch(/due volte/)
    expect(validateSetup([me, { ...me }])).toMatch(/due volte/)
  })
  it('posti: utenti con id veri e mazzo, ospiti con id negativi e commander facoltativo', () => {
    const seats = buildSeats([me, guest(' Luca ', 'Atraxa, Praetors\' Voice'), shiva, guest('Sara')])
    expect(seats.map(s => s.userId)).toEqual([7, -1, 9, -2])
    expect(seats[0].deck).toEqual({ id: 3, name: 'Elfi', commander: 'Lathril, Blade of the Elves' })
    expect(seats[1]).toMatchObject({ guest: true, user: { username: 'Luca' }, deck: { commander: 'Atraxa, Praetors\' Voice' } })
    expect(seats[2].deck).toBeNull()
    expect(seats[3].deck).toBeNull()
  })
  it('Registra risultati solo se tutti registrati e almeno 3', () => {
    expect(canRegister(buildSeats([me, shiva]))).toBe(false)
    expect(canRegister(buildSeats([me, shiva, { kind: 'user', userId: 11, username: 'Ifrit' }]))).toBe(true)
    expect(canRegister(buildSeats([me, shiva, guest('Luca')]))).toBe(false)
  })
})

describe('punteggi locali', () => {
  const ids = [7, -1, 9]
  it('stato iniziale: 40 vita, 0 veleno, danni da commander per ogni avversario', () => {
    const s = initialScore(ids)
    expect(s.seatOrder).toEqual(ids)
    expect(s.players[-1]).toMatchObject({ life: 40, poison: 0, cmd: { 7: 0, 9: 0 }, eliminated: false })
  })
  it('vita, veleno, commander (che toglie anche vita) ed eliminazione', () => {
    let s = initialScore(ids)
    s = applyFree(s, { type: 'life', userId: 7, delta: -5 }, 1000)
    s = applyFree(s, { type: 'poison', userId: 9, delta: 10 }, 20000)
    s = applyFree(s, { type: 'cmd', userId: -1, fromUserId: 7, delta: 21 }, 40000)
    expect(s.players[7].life).toBe(35)
    expect(s.players[9]).toMatchObject({ poison: 10, eliminated: true, reason: 'poison' })
    expect(s.players[-1]).toMatchObject({ life: 19, eliminated: true, reason: 'commander' })
    expect(s.history).toHaveLength(3)
  })
  it('tocchi ravvicinati sullo stesso contatore = una voce; annulla la toglie in un colpo', () => {
    let s = initialScore(ids)
    for (let i = 0; i < 5; i++) s = applyFree(s, { type: 'life', userId: 9, delta: -1 }, 1000 + i * 500)
    expect(s.history).toHaveLength(1)
    s = undoFree(s)
    expect(s.players[9].life).toBe(40)
    expect(s.history).toHaveLength(0)
    expect(undoFree(s)).toBe(s)
  })
  it('azioni non valide non cambiano nulla', () => {
    const s = initialScore(ids)
    expect(applyFree(s, { type: 'life', userId: 99, delta: 1 })).toBe(s)
    expect(applyFree(s, { type: 'cmd', userId: 7, fromUserId: 7, delta: 1 })).toBe(s)
    expect(applyFree(s, { type: 'boh', userId: 7, delta: 1 })).toBe(s)
  })
  it('ripristino: punteggi e storico azzerati, ordine dei posti conservato', () => {
    let s = { ...initialScore(ids), seatOrder: [9, 7, -1] }
    s = applyFree(s, { type: 'life', userId: -1, delta: -10 })
    const r = resetFree(s)
    expect(r.players[-1].life).toBe(40)
    expect(r.history).toEqual([])
    expect(r.seatOrder).toEqual([9, 7, -1])
  })
})

describe('sessionStorage', () => {
  it('salva, sopravvive al ricaricamento (JSON) e si distrugge alla chiusura', () => {
    const store = memStore()
    const seats = buildSeats([me, guest('Luca')])
    let score = initialScore(seats.map(s => s.userId))
    score = applyFree(score, { type: 'cmd', userId: -1, fromUserId: 7, delta: 3 })
    saveFree({ seats, score }, store)
    const back = loadFree(store)
    expect(back.seats).toEqual(seats)
    expect(back.score.players[-1]).toMatchObject({ life: 37, cmd: { 7: 3 } })
    // dopo il round-trip JSON le azioni continuano a funzionare (chiavi stringa)
    expect(undoFree(back.score).players[-1].life).toBe(40)
    clearFree(store)
    expect(loadFree(store)).toBeNull()
    expect(store.size()).toBe(0)
  })
  it('dati rovinati o incompleti = nessuno stato', () => {
    const store = memStore()
    store.setItem('ct_free_score', '{rotto')
    expect(loadFree(store)).toBeNull()
    store.setItem('ct_free_score', JSON.stringify({ seats: [{ userId: 1, user: { username: 'A' } }], score: { players: {} } }))
    expect(loadFree(store)).toBeNull()
    expect(loadFree(null)).toBeNull()
  })
})
