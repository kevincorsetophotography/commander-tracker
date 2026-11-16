import { describe, it, expect } from 'vitest'
import { layoutFor, localSize, toLocal, swipeStep, targetsFor, stepIndex, valueOf, actionFor, describeEntry, normalizeOrder, swapSeats, rotateOrder, panelAt, GAP } from './lifeCounter'

const W = 390, H = 844

const overlaps = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h

describe('layoutFor', () => {
  for (const n of [2, 3, 4, 5, 6]) {
    it(`${n} giocatori: ${n} pannelli dentro lo schermo, senza sovrapposizioni`, () => {
      const { panels, center } = layoutFor(n, W, H)
      expect(panels).toHaveLength(n)
      for (const p of panels) {
        expect(p.x).toBeGreaterThanOrEqual(0); expect(p.y).toBeGreaterThanOrEqual(0)
        expect(p.x + p.w).toBeLessThanOrEqual(W + 0.01); expect(p.y + p.h).toBeLessThanOrEqual(H + 0.01)
      }
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) expect(overlaps(panels[i], panels[j])).toBe(false)
      expect(center.x).toBe(W / 2)
    })
  }

  it('4 giocatori: griglia 2×2, sinistra guarda a sinistra (90), destra a destra (-90)', () => {
    const { panels } = layoutFor(4, W, H)
    expect(panels.map(p => p.rot)).toEqual([90, -90, -90, 90])
    expect(panels[0]).toMatchObject({ x: 0, y: 0 })
    expect(panels[1].x).toBeCloseTo((W - GAP) / 2 + GAP)
  })

  it('3 giocatori: uno largo in alto ruotato 180 e due sotto', () => {
    const { panels, center } = layoutFor(3, W, H)
    expect(panels[0]).toMatchObject({ x: 0, y: 0, w: W, rot: 180 })
    expect(panels.slice(1).map(p => p.rot).sort()).toEqual([-90, 90])
    expect(center.y).toBeCloseTo(panels[0].h + GAP / 2)
  })

  it('5 giocatori: due colonne da due + uno largo in fondo dritto', () => {
    const { panels } = layoutFor(5, W, H)
    const bottom = panels[3]
    expect(bottom).toMatchObject({ x: 0, w: W, rot: 0 })
    expect(bottom.y + bottom.h).toBeCloseTo(H)
    expect(panels.filter(p => p.rot === 90)).toHaveLength(2)
    expect(panels.filter(p => p.rot === -90)).toHaveLength(2)
  })

  it('6 giocatori: due colonne da tre, in senso orario attorno al telefono', () => {
    const { panels } = layoutFor(6, W, H)
    expect(panels.map(p => p.rot)).toEqual([90, -90, -90, -90, 90, 90])
    expect(panels[3].y + panels[3].h).toBeCloseTo(H)
    expect(panels[5].y).toBeCloseTo(panels[2].y)
  })

  it('localSize scambia i lati per i pannelli ruotati di 90', () => {
    expect(localSize({ w: 100, h: 300, rot: 90 })).toEqual({ w: 300, h: 100 })
    expect(localSize({ w: 100, h: 300, rot: 180 })).toEqual({ w: 100, h: 300 })
  })
})

describe('swipe nel verso del pannello', () => {
  it('toLocal: il pannello a sinistra (90) ha la sua "destra" verso il basso dello schermo', () => {
    expect(toLocal(0, 50, 90)).toEqual({ x: 50, y: 0 })
    expect(toLocal(0, 50, -90)).toEqual({ x: -50, y: 0 })
    expect(toLocal(50, 0, 180).x).toBe(-50)
  })

  it('pannello dritto: dito a sinistra = pagina dopo, a destra = pagina prima', () => {
    expect(swipeStep(-60, 5, 0)).toBe(1)
    expect(swipeStep(60, 5, 0)).toBe(-1)
  })

  it('pannello ruotato di 90: lo swipe "orizzontale" è verticale sullo schermo', () => {
    expect(swipeStep(0, -60, 90)).toBe(1)  // verso l'alto dello schermo = verso sinistra del giocatore a sinistra
    expect(swipeStep(0, -60, -90)).toBe(-1)
    expect(swipeStep(-60, 0, 90)).toBe(0)  // perpendicolare per quel giocatore: non è uno swipe
  })

  it('pannello capovolto (180): direzioni invertite', () => {
    expect(swipeStep(60, 0, 180)).toBe(1)
  })

  it('movimenti corti o troppo obliqui non sono swipe', () => {
    expect(swipeStep(-20, 0, 0)).toBe(0)
    expect(swipeStep(-50, 50, 0)).toBe(0)
  })
})

describe('pagine del contatore', () => {
  const targets = targetsFor(2, [1, 2, 3, 4])

  it('vita → veleno → danni da ciascun avversario (non da sé stesso)', () => {
    expect(targets).toEqual([{ kind: 'life' }, { kind: 'poison' }, { kind: 'cmd', from: 1 }, { kind: 'cmd', from: 3 }, { kind: 'cmd', from: 4 }])
  })

  it('scorrimento ciclico', () => {
    expect(stepIndex(0, 1, 5)).toBe(1)
    expect(stepIndex(4, 1, 5)).toBe(0)
    expect(stepIndex(0, -1, 5)).toBe(4)
  })

  it('valore e azione seguono la pagina scelta', () => {
    const p = { life: 31, poison: 2, cmd: { 1: 0, 3: 9, 4: 0 } }
    expect(valueOf(p, targets[0])).toBe(31)
    expect(valueOf(p, targets[1])).toBe(2)
    expect(valueOf(p, targets[3])).toBe(9)
    expect(actionFor(targets[3], 2, 1)).toEqual({ type: 'cmd', userId: 2, fromUserId: 3, delta: 1 })
    expect(actionFor(targets[1], 2, -1)).toEqual({ type: 'poison', userId: 2, delta: -1 })
    expect(actionFor(targets[0], 2, -10)).toEqual({ type: 'life', userId: 2, delta: -10 })
  })
})

describe('describeEntry', () => {
  const names = { 1: 'Ramuh', 2: 'Shiva', 3: 'Ifrit' }
  const nameOf = (id) => names[id]
  it('descrive chi, cosa e quanto', () => {
    expect(describeEntry({ by: 2, type: 'life', userId: 1, d: { life: -5, poison: 0, cmd: 0 } }, nameOf)).toBe('Shiva: −5 vita a Ramuh')
    expect(describeEntry({ by: 1, type: 'poison', userId: 3, d: { life: 0, poison: 2, cmd: 0 } }, nameOf)).toBe('Ramuh: +2 veleno a Ifrit')
    expect(describeEntry({ by: 3, type: 'cmd', userId: 1, fromUserId: 3, d: { life: -7, poison: 0, cmd: 7 } }, nameOf)).toBe('Ifrit: +7 danni da Ifrit a Ramuh')
  })
})

describe('ordine dei posti', () => {
  it('normalizeOrder: permutazione dei seduti, nuovi in fondo, assenti tolti, doppioni ignorati', () => {
    expect(normalizeOrder(undefined, [1, 2, 3])).toEqual([1, 2, 3])
    expect(normalizeOrder([3, 1, 2], [1, 2, 3])).toEqual([3, 1, 2])
    expect(normalizeOrder([3, 9, 3, 1], [1, 2, 3, 4])).toEqual([3, 1, 2, 4])
  })

  it('swapSeats scambia solo i due posti', () => {
    expect(swapSeats([1, 2, 3, 4], 1, 3)).toEqual([3, 2, 1, 4])
    expect(swapSeats([1, 2, 3, 4, 5], 5, 2)).toEqual([1, 5, 3, 4, 2])
    const o = [1, 2, 3]
    expect(swapSeats(o, 2, 2)).toBe(o)
    expect(swapSeats(o, 2, 9)).toBe(o)
  })

  it('rotateOrder sposta tutti di un posto', () => {
    expect(rotateOrder([1, 2, 3, 4])).toEqual([2, 3, 4, 1])
    expect(rotateOrder([7])).toEqual([7])
  })

  it('panelAt trova il pannello sotto il dito per 2-6 giocatori', () => {
    for (const n of [2, 3, 4, 5, 6]) {
      const { panels } = layoutFor(n, W, H)
      panels.forEach((p, i) => expect(panelAt(panels, p.x + p.w / 2, p.y + p.h / 2)).toBe(i))
      expect(panelAt(panels, -5, -5)).toBe(-1)
      expect(panelAt(panels, W + 10, H / 2)).toBe(-1)
    }
  })
})
