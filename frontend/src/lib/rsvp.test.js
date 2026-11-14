import { describe, it, expect } from 'vitest'
import { mergeRsvps } from './rsvp'

const prev = [
  { userId: 1, user: { username: 'Shiva', avatarCardName: 'Atraxa', avatarScryfallId: 'aaa' } },
  { userId: 2, user: { username: 'Ifrit', avatarCardName: null, avatarScryfallId: 'bbb' } },
]
const me = { id: 3, username: 'Ramuh', avatarCardName: 'The Ur-Dragon', avatarScryfallId: 'ccc' }

describe('mergeRsvps', () => {
  it('mantiene gli avatar degli iscritti già noti quando la risposta ha solo lo username', () => {
    const next = [{ userId: 1, user: { username: 'Shiva' } }, { userId: 2, user: { username: 'Ifrit' } }]
    const out = mergeRsvps(prev, next, me)
    expect(out[0].user).toMatchObject({ username: 'Shiva', avatarCardName: 'Atraxa', avatarScryfallId: 'aaa' })
    expect(out[1].user).toMatchObject({ username: 'Ifrit', avatarScryfallId: 'bbb' })
  })

  it("aggiunge l'utente corrente con il suo avatar quando si iscrive", () => {
    const next = [...prev.map(r => ({ userId: r.userId, user: { username: r.user.username } })), { userId: 3, user: { username: 'Ramuh' } }]
    const out = mergeRsvps(prev, next, me)
    expect(out).toHaveLength(3)
    expect(out[2].user).toMatchObject({ username: 'Ramuh', avatarCardName: 'The Ur-Dragon', avatarScryfallId: 'ccc' })
  })

  it("toglie l'utente che annulla e non tocca gli altri", () => {
    const withMe = [...prev, { userId: 3, user: { username: 'Ramuh', avatarScryfallId: 'ccc' } }]
    const next = [{ userId: 1, user: { username: 'Shiva' } }, { userId: 2, user: { username: 'Ifrit' } }]
    const out = mergeRsvps(withMe, next, me)
    expect(out.map(r => r.userId)).toEqual([1, 2])
    expect(out[0].user.avatarScryfallId).toBe('aaa')
  })

  it('usa gli avatar della risposta se presenti', () => {
    const next = [{ userId: 1, user: { username: 'Shiva', avatarCardName: 'Nuovo', avatarScryfallId: 'zzz' } }]
    expect(mergeRsvps(prev, next, me)[0].user).toMatchObject({ avatarCardName: 'Nuovo', avatarScryfallId: 'zzz' })
  })
})
