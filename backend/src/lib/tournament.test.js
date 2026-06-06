import { describe, it, expect } from 'vitest'
import { podSizes, makePods, makePairings } from './tournament.js'

describe('podSizes (3-5, preferendo 4)', () => {
  it('casi noti', () => {
    expect(podSizes(3)).toEqual([3])
    expect(podSizes(4)).toEqual([4])
    expect(podSizes(5)).toEqual([5])
    expect(podSizes(6)).toEqual([3, 3])
    expect(podSizes(7)).toEqual([4, 3])
    expect(podSizes(8)).toEqual([4, 4])
    expect(podSizes(9)).toEqual([4, 5])
    expect(podSizes(10)).toEqual([4, 3, 3])
    expect(podSizes(11)).toEqual([4, 4, 3])
    expect(podSizes(12)).toEqual([4, 4, 4])
    expect(podSizes(13)).toEqual([4, 4, 5])
  })

  it('meno di 3 giocatori: nessun pod', () => {
    expect(podSizes(0)).toEqual([])
    expect(podSizes(1)).toEqual([])
    expect(podSizes(2)).toEqual([])
  })

  it('per ogni n da 3 a 40: tutti i pod tra 3 e 5 e somma = n', () => {
    for (let n = 3; n <= 40; n++) {
      const sizes = podSizes(n)
      expect(sizes.reduce((a, b) => a + b, 0)).toBe(n)
      for (const s of sizes) expect(s >= 3 && s <= 5).toBe(true)
    }
  })
})

describe('makePods', () => {
  it('usa tutti i giocatori una sola volta, con pod validi', () => {
    const ids = Array.from({ length: 11 }, (_, i) => i + 1)
    const pods = makePods(ids)
    expect(pods.map(p => p.length).sort()).toEqual([3, 4, 4])
    expect(pods.flat().sort((a, b) => a - b)).toEqual(ids)
  })
})

describe('makePairings (turno 1)', () => {
  it('pari: tutti accoppiati, nessun bye', () => {
    const { pairs, bye } = makePairings([1, 2, 3, 4])
    expect(bye).toBeNull()
    expect(pairs.length).toBe(2)
    expect(pairs.flat().sort((a, b) => a - b)).toEqual([1, 2, 3, 4])
  })

  it('dispari: un bye, gli altri accoppiati', () => {
    const { pairs, bye } = makePairings([1, 2, 3, 4, 5])
    expect(bye).not.toBeNull()
    expect(pairs.length).toBe(2)
    const used = [...pairs.flat(), bye].sort((a, b) => a - b)
    expect(used).toEqual([1, 2, 3, 4, 5])
  })
})
