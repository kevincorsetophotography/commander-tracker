// Pezzi interattivi della landing /info (separati da LandingPage.jsx per leggibilità).
// Tutti hanno una versione ferma con "riduci animazioni" e nessuna libreria esterna.
import { useEffect, useRef, useState } from 'react'
import { MapPin, Dices } from 'lucide-react'
import { BRACKETS, BRACKET_OPTIONS } from '../lib/brackets'
import { nightStatus, splitMs } from '../lib/nextNight'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'
export const prefersReduced = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

// Osserva un elemento e restituisce true la prima volta che entra in vista
export function useSeen(ref, threshold = 0.3) {
  const [seen, setSeen] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || seen) return
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setSeen(true); io.disconnect() } }, { threshold })
    io.observe(el)
    return () => io.disconnect()
  }, [ref, seen, threshold])
  return seen
}

// ── Scia di mana che segue dito/mouse nell'hero (canvas, max 40 particelle, rAF solo se serve) ──
const TRAIL_COLORS = ['#F3E9B5', '#3FA2F0', '#B79BFF', '#FF5A5F', '#34F08F']
export function HeroTrail({ hostRef }) {
  const canvasRef = useRef(null)
  useEffect(() => {
    const host = hostRef.current, cv = canvasRef.current
    if (!host || !cv || prefersReduced()) return
    const ctx = cv.getContext('2d')
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const size = () => { cv.width = host.clientWidth * dpr; cv.height = host.clientHeight * dpr }
    size()
    const ro = new ResizeObserver(size); ro.observe(host)
    const parts = []
    let raf = 0, last = null, ci = 0
    const draw = () => {
      ctx.clearRect(0, 0, cv.width, cv.height)
      ctx.globalCompositeOperation = 'lighter'
      const now = performance.now()
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i], t = (now - p.t0) / 750
        if (t >= 1) { parts.splice(i, 1); continue }
        const r = p.r * (1 - t * 0.6) * dpr
        const x = (p.x + p.vx * t * 30) * dpr, y = (p.y - t * 26) * dpr
        ctx.globalAlpha = (1 - t) * 0.22; ctx.fillStyle = p.c
        ctx.beginPath(); ctx.arc(x, y, r * 2.6, 0, Math.PI * 2); ctx.fill()
        ctx.globalAlpha = (1 - t) * 0.9
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill()
      }
      raf = parts.length ? requestAnimationFrame(draw) : 0
      if (!raf) ctx.clearRect(0, 0, cv.width, cv.height)
    }
    const add = (cx, cy) => {
      const b = host.getBoundingClientRect(), x = cx - b.left, y = cy - b.top
      if (last && Math.hypot(x - last.x, y - last.y) < 14) return
      last = { x, y }
      if (parts.length >= 40) parts.shift()
      parts.push({ x, y, vx: Math.random() - 0.5, r: 2.5 + Math.random() * 2.5, c: TRAIL_COLORS[ci++ % 5], t0: performance.now() })
      if (!raf) raf = requestAnimationFrame(draw)
    }
    const onPointer = (e) => { if (e.pointerType === 'mouse') add(e.clientX, e.clientY) }
    const onTouch = (e) => { const t = e.touches[0]; if (t) add(t.clientX, t.clientY) }
    host.addEventListener('pointermove', onPointer, { passive: true })
    host.addEventListener('touchmove', onTouch, { passive: true })
    host.addEventListener('touchstart', onTouch, { passive: true })
    return () => {
      cancelAnimationFrame(raf); ro.disconnect()
      host.removeEventListener('pointermove', onPointer); host.removeEventListener('touchmove', onTouch); host.removeEventListener('touchstart', onTouch)
    }
  }, [hostRef])
  return <canvas ref={canvasRef} className="lp-trail" aria-hidden="true" />
}

// ── Scintille che salgono lente dietro lo stemma (8 elementi CSS) ──
const SPARKS = [[18, 0, 'W'], [30, 2.2, 'U'], [44, 1.1, 'B'], [58, 3.1, 'R'], [70, 0.6, 'G'], [82, 2.6, 'W'], [24, 4, 'R'], [64, 4.6, 'U']]
export function CrestSparks() {
  return (
    <span className="lp-sparks" aria-hidden="true">
      {SPARKS.map(([l, d, c], i) => <i key={i} className={`c-${c}`} style={{ left: `${l}%`, animationDelay: `${d}s` }} />)}
    </span>
  )
}

// ── Pioggia di rane: 5 tocchi sullo stemma ──
export function useFrogTaps() {
  const [rain, setRain] = useState(0)
  const taps = useRef([])
  const onTap = () => {
    const now = Date.now()
    taps.current = [...taps.current.filter(t => now - t < 2500), now]
    if (taps.current.length >= 5) { taps.current = []; setRain(r => r + 1) }
  }
  useEffect(() => {
    if (!rain) return
    const t = setTimeout(() => setRain(0), 2600)
    return () => clearTimeout(t)
  }, [rain])
  return { rain, onTap }
}
export function FrogRain({ rain }) {
  if (!rain) return null
  return (
    <div className="lp-frogs" key={rain} aria-hidden="true">
      {Array.from({ length: 24 }, (_, i) => (
        <span key={i} style={{
          left: `${(i * 41) % 100}%`, animationDelay: `${(i % 6) * 0.1}s`,
          animationDuration: `${1.2 + (i % 5) * 0.12}s`, fontSize: `${22 + (i % 4) * 7}px`, '--spin': `${(i % 2 ? 1 : -1) * (120 + i * 9)}deg`,
        }}>🐸</span>
      ))}
    </div>
  )
}

// ── Numeri veri della community (endpoint pubblico con soli totali) ──
function CountUp({ to, run }) {
  const [v, setV] = useState(0)
  useEffect(() => {
    if (!run) return
    if (prefersReduced()) { setV(to); return }
    let raf, t0
    const step = (t) => {
      t0 ??= t
      const k = Math.min(1, (t - t0) / 1200)
      setV(Math.round(to * (1 - Math.pow(1 - k, 3))))
      if (k < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [to, run])
  return <>{v.toLocaleString('it-IT')}</>
}
const STAT_LABELS = [['nights', 'Serate'], ['games', 'Partite registrate'], ['players', 'Giocatori'], ['decks', 'Mazzi']]
export function CommunityStats() {
  const [data, setData] = useState(null)
  useEffect(() => {
    let alive = true
    fetch(`${API}/public/stats`).then(r => (r.ok ? r.json() : null)).then(d => {
      if (alive && d && STAT_LABELS.every(([k]) => Number.isFinite(d[k])) && d.games > 0) setData(d)
    }).catch(() => {})
    return () => { alive = false }
  }, [])
  if (!data) return null
  return <StatsBlock data={data} />
}
function StatsBlock({ data }) {
  const ref = useRef(null)
  const seen = useSeen(ref, 0.4)
  return (
    <div className="lp-stats" ref={ref}>
      <span className="lp-stats-title">Dal nostro portale, finora</span>
      <div className="lp-stats-grid">
        {STAT_LABELS.map(([k, label]) => (
          <div key={k} className="lp-stat">
            <span className="lp-stat-num lp-grad-text"><CountUp to={data[k]} run={seen} /></span>
            <span className="lp-stat-label">{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Conto alla rovescia alla prossima serata (venerdì 21:30, ora di Roma) ──
export function Countdown() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t) }, [])
  const st = nightStatus(now)
  if (st.live) {
    return (
      <div className="lp-countdown is-live" role="status">
        <span className="lp-live-dot" /> <b>Stasera si gioca</b> <span>· siamo al tavolo dalle 21:30</span>
      </div>
    )
  }
  const { d, h, m, s } = splitMs(st.ms)
  const pad = (n) => String(n).padStart(2, '0')
  return (
    <div className="lp-countdown" aria-label={`Prossima serata tra ${d} giorni, ${h} ore e ${m} minuti`}>
      <span className="lp-countdown-label">Prossima serata tra</span>
      <div className="lp-countdown-row" aria-hidden="true">
        {[[d, 'giorni'], [pad(h), 'ore'], [pad(m), 'min'], [pad(s), 'sec']].map(([n, u]) => (
          <span key={u} className="lp-cd-cell"><b>{n}</b><small>{u}</small></span>
        ))}
      </div>
    </div>
  )
}

// ── Rule 0: manopola B1→B4 ──
const BRACKET_TEXT = {
  1: 'Mazzi tematici e precon: si gioca per ridere e per vedere cose strane.',
  2: 'Mazzi curati ma senza combo veloci: partite lunghe ed equilibrate.',
  3: 'Mazzi ottimizzati, carte forti e qualche combo: meglio dirlo al tavolo.',
  4: 'Il massimo della potenza, vittorie rapide: va concordato con tutto il pod.',
}
export function BracketDial() {
  const [b, setB] = useState(2)
  return (
    <div className="lp-dial" style={{ '--bc': BRACKETS[b].color, '--lvl': b }}>
      <div className="lp-dial-head">
        <span className="lp-dial-badge">B{b}</span>
        <span className="lp-dial-name">{BRACKETS[b].label}</span>
      </div>
      <p className="lp-dial-text" aria-live="polite">{BRACKET_TEXT[b]}</p>
      <input type="range" min="1" max="4" step="1" value={b} onChange={e => setB(+e.target.value)}
        className="lp-dial-range" aria-label="Livello di potenza del mazzo" aria-valuetext={`B${b} ${BRACKETS[b].label}`}
        style={{ '--pct': `${((b - 1) / 3) * 100}%` }} />
      <div className="lp-dial-ticks">
        {BRACKET_OPTIONS.map(x => (
          <button key={x} type="button" className={x === b ? 'on' : ''} onClick={() => setB(x)} style={{ '--tc': BRACKETS[x].color }}>
            B{x}<small>{BRACKETS[x].label}</small>
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Dado che rotola: chi comincia? ──
const rand20 = () => {
  const a = new Uint32Array(1); (window.crypto || {}).getRandomValues?.(a)
  return (a[0] ? a[0] % 20 : Math.floor(Math.random() * 20)) + 1
}
export function DieRoller() {
  const [val, setVal] = useState(20)
  const [rolling, setRolling] = useState(false)
  const timer = useRef(null)
  useEffect(() => () => clearInterval(timer.current), [])
  const roll = () => {
    if (rolling) return
    const final = rand20()
    if (prefersReduced()) { setVal(final); return }
    setRolling(true)
    let n = 0
    timer.current = setInterval(() => {
      n++
      if (n >= 12) { clearInterval(timer.current); setVal(final); setRolling(false) } else setVal(rand20())
    }, 60)
  }
  return (
    <div className="lp-die-roll">
      <button type="button" className={`lp-d20 ${rolling ? 'is-rolling' : ''}`} onClick={roll} onMouseDown={e => { if (e.detail > 1) e.preventDefault() }} aria-label="Tira il d20">
        <span>{val}</span>
      </button>
      <div>
        <b>Chi comincia?</b>
        <span className="lp-die-hint" aria-live="polite">{rolling ? 'Il dado rotola…' : <><Dices size={14} aria-hidden="true" /> Tocca il d20 e tira</>}</span>
      </div>
    </div>
  )
}

// ── La Tana: carta terra che si "tappa" e rivela la mappa ──
export function TanaCard() {
  const [tapped, setTapped] = useState(false)
  return (
    <button type="button" className={`lp-tana-map ${tapped ? 'is-tapped' : ''}`} onClick={() => setTapped(t => !t)} onMouseDown={e => { if (e.detail > 1) e.preventDefault() }}
      aria-pressed={tapped} aria-label={tapped ? 'Stappa la carta La Tana' : 'Tappa la carta La Tana e mostra la mappa'}>
      <span className="lp-tana-pin" aria-hidden="true"><MapPin size={26} /></span>
      <span className="lp-tana-ring" aria-hidden="true" />
      <span className="lp-land" aria-hidden="true">
        <span className="lp-land-title">La Tana</span>
        <span className="lp-land-art" />
        <span className="lp-land-type">Terra — Villastellone</span>
      </span>
      <span className="lp-tana-hint">{tapped ? 'Tocca di nuovo per stapparla' : 'Tocca la carta per vedere la mappa'}</span>
    </button>
  )
}
