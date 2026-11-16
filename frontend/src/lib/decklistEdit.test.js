import { describe, it, expect } from 'vitest'
import { stripCommander, countCards, buildDecklist, MAIN_TOTAL } from './decklistEdit'

const lines = (n, prefix = 'Card') => Array.from({ length: n }, (_, i) => `1 ${prefix} ${i + 1}`).join('\n')

describe('stripCommander', () => {
  it('toglie solo la prima riga del commander', () => {
    expect(stripCommander('1 Atraxa, Praetors\' Voice\n1 Sol Ring\n1 Atraxa, Praetors\' Voice', "Atraxa, Praetors' Voice"))
      .toBe("1 Sol Ring\n1 Atraxa, Praetors' Voice")
  })
  it('riconosce le bifronte scritte con una sola faccia', () => {
    expect(stripCommander('1 Esika, God of the Tree\n1 Sol Ring', 'Esika, God of the Tree // The Prismatic Bridge')).toBe('1 Sol Ring')
    expect(stripCommander('1x Esika, God of the Tree // The Prismatic Bridge\n1 Sol Ring', 'Esika, God of the Tree')).toBe('1 Sol Ring')
  })
  it('senza commander lascia la lista com\'è (righe vuote tolte)', () => {
    expect(stripCommander('1 Sol Ring\n\n 1 Island ', '')).toBe('1 Sol Ring\n1 Island')
  })
})

describe('countCards', () => {
  it('somma le quantità, ignora le righe non valide', () => {
    expect(countCards('1 Sol Ring\n30x Island\nSideboard\n\n2 Forest')).toBe(33)
  })
})

describe('buildDecklist', () => {
  it('sezione mazzo vuota: si salva solo il commander', () => {
    expect(buildDecklist('Atraxa', '  \n')).toEqual({ ok: true, decklist: '', count: 0 })
  })
  it('99 carte: lista completa con il commander in testa', () => {
    const r = buildDecklist('Atraxa', lines(MAIN_TOTAL))
    expect(r.ok).toBe(true)
    expect(r.decklist.split('\n')[0]).toBe('1 Atraxa')
    expect(countCards(r.decklist)).toBe(100)
  })
  it('100 carte incollate compreso il commander: il commander viene tolto e restano 99', () => {
    const r = buildDecklist('Atraxa', `1 Atraxa\n${lines(99)}`)
    expect(r.ok).toBe(true)
    expect(countCards(r.decklist)).toBe(100)
  })
  it('numero sbagliato: errore che parla di 99', () => {
    const r = buildDecklist('Atraxa', lines(98))
    expect(r.ok).toBe(false)
    expect(r.count).toBe(98)
    expect(r.error).toMatch(/98 carte: ne servono 99/)
    expect(buildDecklist('Atraxa', lines(100)).ok).toBe(false)
  })
})
