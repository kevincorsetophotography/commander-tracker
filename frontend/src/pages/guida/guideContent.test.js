import { describe, it, expect } from 'vitest'
import { existsSync } from 'fs'
import { resolve } from 'path'
import { CHAPTERS, FAQ, DIMS, MANA } from './guideContent'

const IMG_DIR = resolve(__dirname, '../../../../docs/img/guida')

function shotsOf(ch) {
  const out = [{ name: ch.cover }]
  for (const b of ch.blocks) {
    if (b.shot) out.push({ name: b.shot, optional: !!b.optional })
    if (b.shots) b.shots.forEach(s => out.push({ name: s.shot }))
    if (b.gestures) out.push({ name: b.gestures.shot })
  }
  return out
}

describe('guida: contenuti', () => {
  it('capitoli con id unici, titolo, sommario e colore di mana valido', () => {
    const ids = CHAPTERS.map(c => c.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const c of CHAPTERS) {
      expect(c.title, c.id).toBeTruthy()
      expect(c.lede, c.id).toBeTruthy()
      expect(MANA[c.mana], c.id).toBeTruthy()
      expect(c.blocks.length, c.id).toBeGreaterThan(0)
    }
  })

  it('ogni screenshot citato ha le dimensioni e il file in docs/img/guida', () => {
    for (const c of CHAPTERS) {
      for (const s of shotsOf(c)) {
        expect(DIMS[s.name], `${c.id}: ${s.name} senza DIMS`).toBeTruthy()
        if (!s.optional) expect(existsSync(resolve(IMG_DIR, `${s.name}.webp`)), `${c.id}: manca ${s.name}.webp`).toBe(true)
      }
    }
  })

  it('i segni sul segnapunti stanno dentro l’immagine e corrispondono alle voci', () => {
    const g = CHAPTERS.flatMap(c => c.blocks).find(b => b.gestures).gestures
    expect(g.marks.length).toBe(g.items.length)
    for (const m of g.marks) {
      expect(m.x).toBeGreaterThanOrEqual(0); expect(m.x).toBeLessThanOrEqual(100)
      expect(m.y).toBeGreaterThanOrEqual(0); expect(m.y).toBeLessThanOrEqual(100)
    }
  })

  it('le tabelle hanno righe della stessa larghezza dell’intestazione', () => {
    for (const b of CHAPTERS.flatMap(c => c.blocks).filter(b => b.table)) {
      for (const r of b.table.rows) expect(r.length).toBe(b.table.head.length)
    }
  })

  it('domande frequenti con domanda e risposta', () => {
    for (const [q, a] of FAQ) { expect(q).toBeTruthy(); expect(a).toBeTruthy() }
  })
})
