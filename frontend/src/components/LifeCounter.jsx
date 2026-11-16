import { useState, useEffect, useRef, useLayoutEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Undo2, RotateCcw, X, Dices, Crown, Droplet, Swords, Skull, Repeat, GripHorizontal, ArrowLeftRight } from 'lucide-react'
import { useCardArt } from '../lib/cardCache'
import { REASON_LABEL } from '../lib/scoreboard'
import { layoutFor, localSize, swipeStep, targetsFor, stepIndex, valueOf, actionFor, describeEntry, SWIPE_MIN, DRAG_HOLD_MS, DRAG_SLOP, normalizeOrder, swapSeats, rotateOrder, panelAt } from '../lib/lifeCounter'

// Segnapunti a schermo intero: il telefono sta al centro del tavolo, un pannello per giocatore
// ruotato verso di lui. Tocco sulla metà sinistra/destra = −1/+1, tenere premuto = −10/+10 ripetuto,
// swipe nel verso del pannello = cambia contatore (vita → veleno → danni da ciascun avversario).
// Tenere premuto il NOME (la striscia con la maniglia) = afferra il pannello: trascinandolo su un altro
// posto i due si scambiano. L'ordine dei posti è condiviso (scoreboard.seatOrder sul server).
// Stato condiviso lato server (vedi TablePage): qui solo UI e gesti.

const HOLD_MS = 450
const REPEAT_MS = 550
const BACK_TO_LIFE_MS = 5000
const FLASH_MS = 1400
// colori pieni per chi non ha scelto il mazzo (uno per posto)
const SOLID = ['#7c3aed', '#0e7490', '#b45309', '#be123c', '#15803d']
const GOLD = '#f5c451'

const vibrate = (ms) => { try { navigator.vibrate?.(ms) } catch { /* non supportato */ } }

// Schermo intero (va chiamato dentro il gesto dell'utente) — best effort, iOS Safari non lo supporta
export function enterFullscreen() {
  const el = document.documentElement
  try { const p = el.requestFullscreen?.({ navigationUI: 'hide' }); p?.catch?.(() => {}) } catch { /* non supportato */ }
}
function exitFullscreen() {
  try { if (document.fullscreenElement) document.exitFullscreen?.()?.catch?.(() => {}) } catch { /* niente */ }
}

// ── zona tocco (metà sinistra = meno, destra = più) ─────────────────────────────
function useTouchZone({ sign, rot, onDelta, onSwipe, onTouch }) {
  const st = useRef(null)
  const clear = () => {
    const s = st.current
    if (s) { clearTimeout(s.hold); clearInterval(s.rep) }
  }
  useEffect(() => clear, [])
  return {
    onPointerDown: (e) => {
      e.preventDefault()
      clear()
      try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* niente */ }
      onTouch()
      const s = { x: e.clientX, y: e.clientY, fired: false, swiped: false, moved: false }
      s.hold = setTimeout(() => {
        s.fired = true
        onDelta(sign * 10)
        s.rep = setInterval(() => onDelta(sign * 10), REPEAT_MS)
      }, HOLD_MS)
      st.current = s
    },
    onPointerMove: (e) => {
      const s = st.current
      if (!s || s.swiped) return
      const dx = e.clientX - s.x, dy = e.clientY - s.y
      if (Math.hypot(dx, dy) > 14) { s.moved = true; if (!s.fired) clearTimeout(s.hold) }
      if (s.fired) return
      const step = swipeStep(dx, dy, rot, SWIPE_MIN)
      if (step) { s.swiped = true; clear(); onSwipe(step) }
    },
    onPointerUp: () => {
      const s = st.current
      clear()
      st.current = null
      if (s && !s.fired && !s.swiped && !s.moved) onDelta(sign)
    },
    onPointerCancel: () => { clear(); st.current = null },
    onContextMenu: (e) => e.preventDefault(),
  }
}

// ── pannello di un giocatore ────────────────────────────────────────────────────
function Panel({ rect, seat, index, p, seatIds, nameOf, onAct, starter, nameInset = 0, grip, drag }) {
  const { w: lw, h: lh } = localSize(rect)
  const targets = targetsFor(seat.userId, seatIds)
  const [ti, setTi] = useState(0)
  const [tick, setTick] = useState(0)
  const [flash, setFlash] = useState(null) // { sum, key }
  const flashTimer = useRef(null)
  const art = useCardArt(seat.deck?.commander || null)
  const idx = ti < targets.length ? ti : 0
  const target = targets[idx]

  // dopo qualche secondo senza tocchi si torna sulla vita
  useEffect(() => {
    if (idx === 0) return
    const tm = setTimeout(() => setTi(0), BACK_TO_LIFE_MS)
    return () => clearTimeout(tm)
  }, [idx, tick])
  useEffect(() => () => clearTimeout(flashTimer.current), [])

  const onDelta = useCallback((d) => {
    setTick(x => x + 1)
    onAct(actionFor(target, seat.userId, d))
    setFlash(f => ({ sum: (f?.key === idx ? f.sum : 0) + d, key: idx }))
    clearTimeout(flashTimer.current)
    flashTimer.current = setTimeout(() => setFlash(null), FLASH_MS)
  }, [target, seat.userId, onAct, idx])
  const onSwipe = (step) => { setTick(x => x + 1); setFlash(null); setTi(i => stepIndex(i < targets.length ? i : 0, step, targets.length)) }
  const onTouch = () => setTick(x => x + 1)
  const minus = useTouchZone({ sign: -1, rot: rect.rot, onDelta, onSwipe, onTouch })
  const plus = useTouchZone({ sign: 1, rot: rect.rot, onDelta, onSwipe, onTouch })

  if (!p) return null
  const out = p.eliminated
  const value = valueOf(p, target)
  const small = Math.max(12, Math.min(17, Math.round(lh * 0.075)))
  // il numero sta tra la maniglia col nome (in alto) e i pallini (in basso), senza sovrapporsi
  const gripTop = Math.max(Math.round(lh * 0.05), nameInset)
  const padTop = gripTop + 46
  const padBottom = Math.round(lh * 0.07) + 10
  const big = Math.round(Math.max(40, Math.min(lh * 0.5, lw * 0.3, 150, lh - padTop - padBottom - (small + 4 + Math.round(lh * 0.03)))))
  const opponents = seatIds.filter(id => id !== seat.userId)
  const maxCmd = Math.max(0, ...opponents.map(o => p.cmd?.[o] || 0))
  const label = target.kind === 'poison' ? 'Veleno' : target.kind === 'cmd' ? `Danni da ${nameOf(target.from)}` : null
  const artUrl = art.status === 'ready' ? art.art : null
  const solid = SOLID[index % SOLID.length]
  // durante un trascinamento: 'source' = pannello afferrato, 'over' = destinazione sotto il dito, 'zone' = altro posto
  const dragRole = !drag ? null : drag.from === seat.userId ? 'source' : drag.over === seat.userId ? 'over' : 'zone'

  return (
    <div style={{ position: 'absolute', left: rect.x, top: rect.y, width: rect.w, height: rect.h, overflow: 'hidden', borderRadius: 14, background: solid,
      boxShadow: 'none', opacity: dragRole === 'source' ? 0.38 : 1, transition: 'opacity .15s' }}>
      <div
        aria-label={`${seat.user.username}: ${label || 'vita'} ${value}`}
        style={{ position: 'absolute', left: (rect.w - lw) / 2, top: (rect.h - lh) / 2, width: lw, height: lh, transform: `rotate(${rect.rot}deg)` }}>
        {/* sfondo: art del commander o colore pieno, con velatura per leggere il numero */}
        {artUrl && (
          <img src={artUrl} alt="" draggable={false} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 30%',
            filter: out ? 'grayscale(1) brightness(.55)' : 'none', transition: 'filter .4s' }} />
        )}
        <div style={{ position: 'absolute', inset: 0, background: artUrl
          ? 'radial-gradient(ellipse at center, rgba(5,6,16,.35) 0%, rgba(5,6,16,.62) 75%), linear-gradient(180deg, rgba(5,6,16,.55) 0%, rgba(5,6,16,.15) 35%, rgba(5,6,16,.6) 100%)'
          : 'linear-gradient(180deg, rgba(0,0,0,.18), rgba(0,0,0,.32))',
          filter: 'none' }} />
        {out && !artUrl && <div style={{ position: 'absolute', inset: 0, background: 'rgba(30,30,36,.82)' }} />}

        {/* contenuto (non riceve tocchi: li gestiscono le due metà) */}
        {/* sopra le due metà (zIndex) ma trasparente ai tocchi, tranne la maniglia col nome */}
        <div style={{ position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none', color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textShadow: '0 2px 10px rgba(0,0,0,.55)',
          boxSizing: 'border-box', paddingTop: padTop, paddingBottom: padBottom }}>
          <div style={{ position: 'absolute', top: gripTop, left: 8, right: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1.15 }}>
            <div {...grip} role="button" aria-label={`Posto di ${seat.user.username}: tieni premuto e trascina su un altro posto per scambiarli`}
              style={{ pointerEvents: 'auto', touchAction: 'none', cursor: 'grab', boxSizing: 'border-box', maxWidth: '100%', minWidth: 116, minHeight: 40, padding: '6px 14px 6px 10px',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 999, background: 'rgba(0,0,0,.34)', border: '1px solid rgba(255,255,255,.3)',
                fontSize: small, fontWeight: 800 }}>
              <GripHorizontal size={small + 2} style={{ flexShrink: 0, opacity: 0.75 }} />
              {starter && <Crown size={small} color={GOLD} style={{ flexShrink: 0 }} />}
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{seat.user.username}</span>
            </div>
            {seat.deck?.commander && lh > 200 && (
              <div style={{ maxWidth: '100%', marginTop: 4, fontSize: small - 3, fontWeight: 600, opacity: 0.72, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{seat.deck.commander}</div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', width: '100%' }}>
            <span aria-hidden="true" style={{ position: 'absolute', left: '9%', fontSize: big * 0.42, fontWeight: 300, opacity: 0.42 }}>−</span>
            <span style={{ fontSize: big, fontWeight: 900, lineHeight: 1, letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums',
              color: out ? '#c9c9d1' : target.kind === 'poison' ? '#b9f6a8' : target.kind === 'cmd' ? '#ffd38a' : '#fff' }}>{value}</span>
            <span aria-hidden="true" style={{ position: 'absolute', right: '9%', fontSize: big * 0.42, fontWeight: 300, opacity: 0.42 }}>+</span>
            {flash && flash.sum !== 0 && (
              <span key={flash.key} style={{ position: 'absolute', top: -small * 0.6, left: '50%', marginLeft: big * 0.55, fontSize: small + 4, fontWeight: 900,
                color: flash.sum > 0 ? '#86efac' : '#fca5a5' }}>{flash.sum > 0 ? `+${flash.sum}` : `−${-flash.sum}`}</span>
            )}
          </div>

          <div style={{ marginTop: Math.round(lh * 0.03), minHeight: small + 4, fontSize: small, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 6, maxWidth: '86%' }}>
            {out ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, letterSpacing: '0.08em', color: '#fca5a5' }}><Skull size={small} /> ELIMINATO · {REASON_LABEL[p.reason]}</span>
            ) : label ? (
              <>
                {target.kind === 'poison' ? <Droplet size={small} color="#b9f6a8" /> : <Swords size={small} color="#ffd38a" />}
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
                <span style={{ opacity: 0.75, fontWeight: 700, whiteSpace: 'nowrap' }}>· vita {p.life}</span>
              </>
            ) : (
              <>
                {p.poison > 0 && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: '#b9f6a8' }}><Droplet size={small - 1} />{p.poison}</span>}
                {maxCmd > 0 && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: '#ffd38a' }}><Swords size={small - 1} />{maxCmd}</span>}
              </>
            )}
          </div>

          {/* indicatore pagina: vita, veleno, un pallino per avversario */}
          <div aria-hidden="true" style={{ position: 'absolute', bottom: Math.round(lh * 0.07), display: 'flex', gap: 6 }}>
            {targets.map((tg, i) => (
              <span key={i} style={{ width: i === idx ? 16 : 6, height: 6, borderRadius: 3, transition: 'width .2s', background: i === idx ? '#fff' : 'rgba(255,255,255,.4)' }} />
            ))}
          </div>
        </div>

        {starter && <div aria-hidden="true" style={{ position: 'absolute', inset: 0, borderRadius: 14, boxShadow: `inset 0 0 0 5px ${GOLD}, inset 0 0 40px rgba(245,196,81,.55)`, pointerEvents: 'none' }} />}
        {(dragRole === 'over' || dragRole === 'zone') && (
          <div aria-hidden="true" style={{ position: 'absolute', inset: 0, zIndex: 2, borderRadius: 14, pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: dragRole === 'over' ? 'rgba(255,255,255,.22)' : 'rgba(5,6,16,.25)',
            boxShadow: dragRole === 'over' ? 'inset 0 0 0 5px #fff, inset 0 0 50px rgba(255,255,255,.45)' : 'none',
            outline: dragRole === 'zone' ? '2px dashed rgba(255,255,255,.7)' : 'none', outlineOffset: -10 }}>
            {dragRole === 'over' && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 999, background: '#fff', color: '#0e122b', fontSize: small + 1, fontWeight: 900 }}>
                <ArrowLeftRight size={small + 2} /> Scambia
              </span>
            )}
          </div>
        )}
        <div {...minus} role="button" aria-label={`${seat.user.username}: meno 1 ${label || 'vita'}`} style={{ position: 'absolute', left: 0, top: 0, width: '50%', height: '100%', touchAction: 'none', cursor: 'pointer' }} />
        <div {...plus} role="button" aria-label={`${seat.user.username}: più 1 ${label || 'vita'}`} style={{ position: 'absolute', right: 0, top: 0, width: '50%', height: '100%', touchAction: 'none', cursor: 'pointer' }} />
      </div>
    </div>
  )
}

// ── menu centrale ────────────────────────────────────────────────────────────────
function Menu({ lastEntry, nameOf, isOwner, onUndo, onReset, onClose, onExit, onStarter, onRotate, canRotate }) {
  const [confirmReset, setConfirmReset] = useState(false)
  const [d20, setD20] = useState(null)
  const row = (extra = {}) => ({
    width: '100%', boxSizing: 'border-box', minHeight: 54, display: 'flex', alignItems: 'center', gap: 12, padding: '8px 14px', borderRadius: 14, cursor: 'pointer', textAlign: 'left',
    border: '1px solid rgba(255,255,255,.12)', background: 'rgba(255,255,255,.06)', color: '#fff', font: 'inherit', fontSize: 15, fontWeight: 800, ...extra,
  })
  const sub = { display: 'block', fontSize: 12, fontWeight: 600, opacity: 0.7, marginTop: 2 }
  return (
    <div onPointerDown={(e) => { if (e.target === e.currentTarget) onClose() }} style={{ position: 'absolute', inset: 0, zIndex: 3, background: 'rgba(3,4,12,.62)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, touchAction: 'none' }}>
      <div role="dialog" aria-label="Menu segnapunti" className="ct-modal-in" style={{ width: '100%', maxWidth: 340, borderRadius: 22, padding: 14, background: '#0e122b', border: '1px solid rgba(255,255,255,.12)', boxShadow: '0 20px 60px rgba(0,0,0,.6)', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 2 }}>
          <img src="/logo.png" alt="" style={{ width: 34, height: 34, borderRadius: '50%' }} />
          <span style={{ flex: 1, color: '#fff', fontSize: 17, fontWeight: 900 }}>Segnapunti</span>
          <button onClick={onClose} aria-label="Chiudi menu" style={{ width: 40, height: 40, borderRadius: 12, border: 'none', background: 'transparent', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={20} /></button>
        </div>

        <button onClick={onUndo} disabled={!lastEntry} style={row({ opacity: lastEntry ? 1 : 0.45, cursor: lastEntry ? 'pointer' : 'default' })}>
          <Undo2 size={20} />
          <span style={{ minWidth: 0 }}>Annulla ultima azione<span style={{ ...sub, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lastEntry ? describeEntry(lastEntry, nameOf) : 'Niente da annullare'}</span></span>
        </button>

        {!confirmReset ? (
          <button onClick={() => isOwner && setConfirmReset(true)} disabled={!isOwner} style={row({ opacity: isOwner ? 1 : 0.45, cursor: isOwner ? 'pointer' : 'default' })}>
            <RotateCcw size={20} />
            <span>Ripristina punti vita<span style={sub}>{isOwner ? 'Tutti a 40, veleno e danni da commander a 0' : 'Solo chi ha aperto il tavolo'}</span></span>
          </button>
        ) : (
          <div style={{ ...row({ cursor: 'default', flexDirection: 'column', alignItems: 'stretch', background: 'rgba(239,68,68,.12)', border: '1px solid rgba(239,68,68,.45)' }) }}>
            <span style={{ fontSize: 14 }}>Ripristinare per tutto il tavolo?<span style={sub}>Vita a 40, veleno e danni da commander a 0. Lo storico per annullare si azzera.</span></span>
            <span style={{ display: 'flex', gap: 8, marginTop: 6 }}>
              <button onClick={() => setConfirmReset(false)} style={row({ minHeight: 44, justifyContent: 'center' })}>No</button>
              <button onClick={onReset} style={row({ minHeight: 44, justifyContent: 'center', background: '#dc2626', border: 'none' })}>Ripristina</button>
            </span>
          </div>
        )}

        {canRotate && (
          <button onClick={onRotate} style={row({ fontSize: 14 })}><Repeat size={20} style={{ flexShrink: 0 }} /><span>Ruota i posti<span style={sub}>Tutti scalano di un posto, per tutto il tavolo. Per scambiarne due: tieni premuto un nome e trascinalo.</span></span></button>
        )}

        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', color: 'rgba(255,255,255,.5)', margin: '6px 4px 0' }}>STRUMENTI · SOLO SU QUESTO TELEFONO</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onStarter} style={row({ flex: 1, minWidth: 0, justifyContent: 'center', fontSize: 14 })}><Crown size={18} color={GOLD} /> Chi inizia?</button>
          <button onClick={() => setD20(1 + Math.floor(Math.random() * 20))} style={row({ flex: 1, minWidth: 0, justifyContent: 'center', fontSize: 14 })}>
            <Dices size={18} /> {d20 ? <span style={{ fontSize: 18, fontWeight: 900 }}>{d20}</span> : 'Tira d20'}
          </button>
        </div>
        <button onClick={onExit} style={row({ marginTop: 4, justifyContent: 'center', background: '#fff', color: '#0e122b', border: 'none' })}>
          Chiudi segnapunti
        </button>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,.55)', textAlign: 'center' }}>Chiuderlo non azzera nulla: i punteggi restano per tutto il tavolo.</div>
      </div>
    </div>
  )
}

// ── schermo intero ───────────────────────────────────────────────────────────────
export default function LifeCounter({ seats, score, isOwner, onAct, onUndo, onReset, onReorder, onClose }) {
  const area = useRef(null)
  const [size, setSize] = useState(null)
  const [menu, setMenu] = useState(false)
  const [starter, setStarter] = useState(null)
  const [drag, setDrag] = useState(null) // { from, over, x, y } mentre un pannello è afferrato
  const dragRef = useRef(null)
  const press = useRef(null)             // pressione in corso sulla maniglia (prima/durante il drag)

  useLayoutEffect(() => {
    const el = area.current
    if (!el) return
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // niente scroll della pagina sotto, schermo sempre acceso finché è aperto
  useEffect(() => {
    const prev = { html: document.documentElement.style.overflow, body: document.body.style.overflow }
    document.documentElement.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'
    let lock = null
    const wake = () => { navigator.wakeLock?.request?.('screen').then(l => { lock = l }).catch(() => {}) }
    wake()
    const onVis = () => { if (!document.hidden) wake() }
    document.addEventListener('visibilitychange', onVis)
    const onKey = (e) => { if (e.key === 'Escape') setMenu(m => !m) }
    window.addEventListener('keydown', onKey)
    return () => {
      document.documentElement.style.overflow = prev.html
      document.body.style.overflow = prev.body
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('keydown', onKey)
      lock?.release?.().catch?.(() => {})
      exitFullscreen()
    }
  }, [])

  useEffect(() => {
    if (starter == null) return
    const tm = setTimeout(() => setStarter(null), 4000)
    return () => clearTimeout(tm)
  }, [starter])

  const n = seats.length
  const seatIds = seats.map(s => s.userId)
  const byId = Object.fromEntries(seats.map(s => [s.userId, s]))
  const order = normalizeOrder(score?.seatOrder, seatIds)
  const ordered = order.map(id => byId[id])
  const names = Object.fromEntries(seats.map(s => [s.userId, s.user.username]))
  const nameOf = (id) => names[id] || 'qualcuno'
  const layout = size ? layoutFor(n, size.w, size.h) : null
  const history = score?.history || []
  const lastEntry = [...history].reverse().find(e => seatIds.includes(e.userId)) || null
  const BTN = 66
  // il nome sta sul bordo "alto" del pannello (dal punto di vista del giocatore): se lì c'è il pulsante
  // centrale (es. il capotavola nel layout a 3) lo si sposta più in dentro
  const nameInsetFor = (r) => {
    if (!layout) return 0
    const edge = r.rot === 180 ? { x: r.x + r.w / 2, y: r.y + r.h } : r.rot === 90 ? { x: r.x + r.w, y: r.y + r.h / 2 } : r.rot === -90 ? { x: r.x, y: r.y + r.h / 2 } : { x: r.x + r.w / 2, y: r.y }
    return Math.hypot(edge.x - layout.center.x, edge.y - layout.center.y) < BTN ? BTN / 2 + 14 : 0
  }

  // ── trascinamento dei posti: pressione prolungata sulla maniglia, poi il pannello segue il dito ──
  const setDragBoth = (d) => { dragRef.current = d; setDrag(d) }
  const toArea = (e) => { const r = area.current.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top } }
  const endPress = (commit) => {
    const s = press.current
    press.current = null
    if (!s) return
    clearTimeout(s.timer)
    const d = dragRef.current
    if (!s.started || !d) return
    setDragBoth(null)
    if (commit && d.over != null && d.over !== d.from) { vibrate(25); onReorder(swapSeats(order, d.from, d.over)) }
  }
  useEffect(() => () => clearTimeout(press.current?.timer), [])
  const gripFor = (userId) => ({
    onPointerDown: (e) => {
      e.preventDefault()
      endPress(false)
      try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* niente */ }
      const start = toArea(e)
      const s = { pointerId: e.pointerId, x0: e.clientX, y0: e.clientY, started: false }
      s.timer = setTimeout(() => { s.started = true; vibrate(15); setDragBoth({ from: userId, over: null, ...start }) }, DRAG_HOLD_MS)
      press.current = s
    },
    onPointerMove: (e) => {
      const s = press.current
      if (!s || s.pointerId !== e.pointerId) return
      if (!s.started) {
        // il dito si muove prima della presa: non è un trascinamento
        if (Math.hypot(e.clientX - s.x0, e.clientY - s.y0) > DRAG_SLOP) { clearTimeout(s.timer); press.current = null }
        return
      }
      const pt = toArea(e)
      const i = layout ? panelAt(layout.panels, pt.x, pt.y) : -1
      const over = i >= 0 && order[i] !== userId ? order[i] : null
      if (over != null && over !== dragRef.current?.over) vibrate(8)
      setDragBoth({ from: userId, over, ...pt })
    },
    onPointerUp: () => endPress(true),        // rilascio fuori da un altro posto = annullato
    onPointerCancel: () => endPress(false),
    onContextMenu: (e) => e.preventDefault(),
  })
  const dragSeat = drag ? byId[drag.from] : null
  const dragRect = drag && layout ? layout.panels[order.indexOf(drag.from)] : null

  // portale sul body: il contenuto della pagina vive in un contesto di impilamento (z-index 1) sotto la dock
  return createPortal(
    <div role="application" aria-label="Segnapunti" style={{
      position: 'fixed', inset: 0, zIndex: 1000, background: '#05060d', userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none',
      touchAction: 'none', overscrollBehavior: 'none', WebkitTapHighlightColor: 'transparent',
      padding: 'env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)', boxSizing: 'border-box',
    }}>
      <div ref={area} style={{ position: 'relative', width: '100%', height: '100%' }}>
        {layout && score && ordered.map((s, i) => (
          <Panel key={s.userId} rect={layout.panels[i]} seat={s} index={seats.indexOf(s)} p={score.players[s.userId]} seatIds={seatIds} nameOf={nameOf} onAct={onAct} starter={starter === s.userId} nameInset={nameInsetFor(layout.panels[i])}
            grip={gripFor(s.userId)} drag={drag} />
        ))}
        {/* il pannello afferrato segue il dito, girato come il suo posto */}
        {drag && dragSeat && dragRect && (
          <div aria-hidden="true" style={{ position: 'absolute', left: drag.x, top: drag.y, zIndex: 4, pointerEvents: 'none', transform: `translate(-50%, -50%) rotate(${dragRect.rot}deg) scale(1.04)` }}>
            <div style={{ width: 168, minHeight: 84, boxSizing: 'border-box', padding: '10px 14px', borderRadius: 16, color: '#fff', textAlign: 'center',
              background: SOLID[seats.indexOf(dragSeat) % SOLID.length], border: '2px solid #fff', boxShadow: '0 18px 40px rgba(0,0,0,.6)', textShadow: '0 2px 8px rgba(0,0,0,.45)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 15, fontWeight: 800, overflow: 'hidden', whiteSpace: 'nowrap' }}>
                <GripHorizontal size={16} style={{ flexShrink: 0, opacity: 0.8 }} /><span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{dragSeat.user.username}</span>
              </div>
              <div style={{ fontSize: 38, fontWeight: 900, lineHeight: 1.05, fontVariantNumeric: 'tabular-nums' }}>{score?.players?.[drag.from]?.life ?? ''}</div>
            </div>
          </div>
        )}
        {layout && (
          <button onClick={() => setMenu(true)} aria-label="Menu segnapunti" style={{
            position: 'absolute', left: layout.center.x - BTN / 2, top: layout.center.y - BTN / 2, width: BTN, height: BTN, zIndex: 2, borderRadius: '50%', padding: 0, cursor: 'pointer',
            border: '3px solid #05060d', background: '#0e122b', boxShadow: '0 4px 18px rgba(0,0,0,.6), 0 0 0 1px rgba(255,255,255,.18)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', touchAction: 'manipulation',
          }}>
            <img src="/logo.png" alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </button>
        )}
        {menu && (
          <Menu
            lastEntry={lastEntry} nameOf={nameOf} isOwner={isOwner} canRotate={n > 1}
            onClose={() => setMenu(false)}
            onUndo={() => onUndo()}
            onReset={async () => { if (await onReset()) setMenu(false) }}
            onStarter={() => { setStarter(seatIds[Math.floor(Math.random() * n)]); setMenu(false) }}
            onRotate={() => onReorder(rotateOrder(order))}
            onExit={onClose}
          />
        )}
      </div>
    </div>,
    document.body,
  )
}
