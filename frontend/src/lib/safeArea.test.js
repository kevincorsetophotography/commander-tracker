import { describe, it, expect } from 'vitest'
import { statusBarFallback, headerTopGap, IOS_APP_TOP_GAP } from './safeArea'

describe('headerTopGap', () => {
  it('margine in più solo nella web app iOS da Home', () => {
    expect(headerTopGap({ ios: true, standalone: true })).toBe(IOS_APP_TOP_GAP)
    expect(headerTopGap({ ios: true, standalone: false })).toBe(0)
    expect(headerTopGap({ ios: false, standalone: true })).toBe(0)
  })
})

const base = { ios: true, standalone: true, portrait: true, innerHeight: 844, screenH: 844 }

describe('statusBarFallback', () => {
  it('iPhone con notch in standalone a schermo pieno: riserva 50px', () => {
    expect(statusBarFallback(base)).toBe(50)
  })
  it('iPhone senza notch (SE): riserva 20px', () => {
    expect(statusBarFallback({ ...base, innerHeight: 667, screenH: 667 })).toBe(20)
  })
  it('niente riserva nel browser, fuori da iOS o in orizzontale', () => {
    expect(statusBarFallback({ ...base, standalone: false })).toBe(0)
    expect(statusBarFallback({ ...base, ios: false })).toBe(0)
    expect(statusBarFallback({ ...base, portrait: false })).toBe(0)
  })
  it('status bar opaca (pagina più bassa dello schermo): niente riserva', () => {
    expect(statusBarFallback({ ...base, innerHeight: 797 })).toBe(0)
  })
})
