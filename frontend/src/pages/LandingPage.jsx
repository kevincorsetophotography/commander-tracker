import { useEffect, useRef, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { m, AnimatePresence, useMotionValue, useSpring } from 'motion/react'
import {
  Crown, Box, Layers, Dices, CalendarDays, MapPin, Check, ChevronLeft, ChevronRight, ChevronDown,
  Camera, X, ArrowRight, ShieldCheck, Sparkles, MessagesSquare, Users,
} from 'lucide-react'
import { HeroTrail, CrestSparks, useFrogTaps, FrogRain, CommunityStats, Countdown, BracketDial, DieRoller, TanaCard, useSeen, prefersReduced } from './LandingExtras'
import './LandingPage.css'

// Landing pubblica /info — restyle dal mockup Stitch "Deck Carte Interattive in Primo Piano".
// Solo contenuti reali (gli stessi della versione precedente), palette dell'app (lib/theme.js dark).
// Pagina scollegata dal portale: nessuna dipendenza da useAuth, nessun redirect.

// Se in futuro viene aperta una pagina Instagram ufficiale, basta valorizzare
// questa costante: il pulsante compare automaticamente in fondo alla pagina.
const INSTAGRAM_URL = ''

const ADDRESS_LINE1 = 'Unstable – Tana dei Goblin di Villastellone'
const ADDRESS_LINE2 = 'Via Artemisia Gentileschi, 1'
const ADDRESS_LINE3 = '10029 Villastellone (TO)'
// Link "ricerca" di Google Maps costruito dall'indirizzo reale (nessuna coordinata inventata).
const MAPS_URL = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
  `${ADDRESS_LINE1}, ${ADDRESS_LINE2}, ${ADDRESS_LINE3}`
)}`

// Foto reali delle serate. Per aggiungerne altre: copiare il file in
// frontend/public/Foto Commanderone/ e aggiungere una riga qui sotto.
// `web: true` = esistono anche le versioni leggere in Foto Commanderone/web/<nome>-800.webp e -1600.webp
// (generate a parte); senza, si usa il file originale. Se un file manca, il tile mostra "Foto in arrivo".
const PHOTO_DIR = '/Foto%20Commanderone'
const GALLERY_SLOTS = [
  // caption = didascalia breve mostrata; alt = descrizione per screen reader
  { src: `${PHOTO_DIR}/DSC00807.jpg`, web: true, caption: 'Carte in mostra', alt: 'Due giocatori mostrano una carta ciascuno' },
  { src: `${PHOTO_DIR}/DSC00834.jpg`, web: true, caption: 'Tavolo pieno', alt: 'Un tavolo lungo pieno di giocatori, playmat, carte e dadi' },
  { src: `${PHOTO_DIR}/DSC00820.jpg`, web: true, caption: 'La mano iniziale', alt: 'Un giocatore tiene in mano le sue carte sopra il playmat' },
  { src: `${PHOTO_DIR}/DSC00881.jpg`, web: true, caption: 'Prima che arrivino tutti', alt: 'La sala quasi vuota, un giocatore già seduto al tavolo' },
  { src: `${PHOTO_DIR}/DSC00822.jpg`, web: true, caption: 'Carta in fronte', alt: 'Un giocatore con una carta appoggiata sulla fronte' },
  { src: `${PHOTO_DIR}/DSC00826.jpg`, web: true, caption: 'Carta sul collo', alt: 'Un giocatore al tavolo con una carta infilata nel colletto' },
]
const photo = (slot, w) => (slot.web ? slot.src.replace(`${PHOTO_DIR}/`, `${PHOTO_DIR}/web/`).replace(/\.jpg$/i, `-${w}.webp`) : slot.src)

// Simboli di mana ufficiali (SVG Scryfall salvati in public/mana).
const MANA = {
  W: { glow: 'rgba(248,246,216,0.45)', name: 'Bianco' },
  U: { glow: 'rgba(14,104,171,0.60)', name: 'Blu' },
  B: { glow: 'rgba(139,92,246,0.50)', name: 'Nero' },
  R: { glow: 'rgba(211,32,42,0.55)', name: 'Rosso' },
  G: { glow: 'rgba(0,115,62,0.55)', name: 'Verde' },
  C: { glow: 'rgba(185,195,208,0.45)', name: 'Incolore' },
}
function ManaSymbol({ c, size = 32, className = '', style }) {
  return <img src={`/mana/${c}.svg`} alt={c} title={MANA[c].name} width={size} height={size} className={`lp-mana-svg ${className}`} style={{ '--glow': MANA[c].glow, ...style }} />
}

// I formati, presentati come carte da gioco (testi identici alla versione precedente).
// Illustrazioni: art_crop Scryfall di carte iconiche, salvate in WebP in public/landing-art/ (credito artista sulla carta).
const FORMAT_CARDS = [
  { key: 'commander', name: 'Commander', type: 'Formato principale', rarity: 'mythic', Icon: Crown, cost: ['G', 'U', 'R'],
    art: { src: '/landing-art/commander.webp', card: 'Flubs, the Fool', artist: 'Adam Rex' },
    text: 'Il cuore del gruppo. Si gioca principalmente for fun, con grande attenzione alla Rule 0 e alla compatibilità tra i giocatori del pod.' },
  { key: 'cube', name: 'Vintage Cube', type: 'Draft', rarity: 'rare', Icon: Box, cost: ['C'], badge: 'Completo di terre',
    art: { src: '/landing-art/cube.webp', card: 'Black Lotus', artist: 'Chris Rahn' },
    text: "Il gruppo ha un Vintage Cube completo, terre incluse. Basta un tavolo e un po' di tempo per fare draft." },
  { key: 'constructed', name: 'Constructed', type: 'Pauper · Modern', rarity: 'uncommon', Icon: Layers, cost: ['R'],
    art: { src: '/landing-art/constructed.webp', card: 'Lightning Bolt', artist: 'Christopher Moeller' },
    text: 'Principalmente Pauper e Modern, ma non chiudiamo la porta ad altri formati se qualcuno si organizza.' },
  { key: 'eventi', name: 'Eventi e serate speciali', type: 'Draft · tornei · sfide', rarity: 'common', Icon: Dices, cost: ['W'],
    art: { src: '/landing-art/eventi.webp', card: 'Wedding Announcement', artist: 'Caroline Gariba' },
    text: "Draft, tornei, sfide, serate a tema: quando c'è voglia di organizzare qualcosa di diverso, lo facciamo." },
]

// Cinque principi del tavolo: frasi reali della community; il colore è solo decorativo.
const PRINCIPLES = [
  { c: 'W', title: 'Il pod ha spazio per tutti', text: 'Non serve appartenere a una categoria per essere parte del gruppo: mazzi casual o ottimizzati, giocatori esperti o alle prime armi.' },
  { c: 'U', title: 'Parliamone prima', text: 'Meglio parlarne prima che discuterne dopo. Prima di sedersi al tavolo vale la pena allinearsi con il pod.' },
  { c: 'B', title: 'Giochiamo seriamente', text: 'Non ci prendiamo troppo sul serio. Ironia, battute, trash talking e goliardia sono benvenuti — sempre nel rispetto di chi hai davanti.' },
  { c: 'R', title: 'Competizione sì, ma tra amici', text: "Quando c'è un torneo ha una struttura seria, ma resta un torneo tra amici. Niente montepremi: gli eventuali premi sono simbolici." },
  { c: 'G', title: '100% proxy friendly', text: 'Il valore economico di una carta non determina il valore di chi la gioca.' },
]

// Scroll animato verso una sezione, con offset per non finire sotto la nav sticky.
function smoothScrollTo(id) {
  const el = document.getElementById(id)
  if (!el) return
  const navHeight = document.querySelector('.lp-nav')?.offsetHeight || 0
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const y = el.getBoundingClientRect().top + window.scrollY - navHeight - 14
  window.scrollTo({ top: y, behavior: prefersReduced ? 'auto' : 'smooth' })
  if (window.history.pushState) window.history.pushState(null, '', `#${id}`)
}

function ScrollLink({ to, className, children, ...rest }) {
  return (
    <a href={`#${to}`} className={className} onClick={(e) => { e.preventDefault(); smoothScrollTo(to) }} {...rest}>
      {children}
    </a>
  )
}

function ManaRow() {
  return (
    <div className="lp-mana-row" aria-hidden="true">
      {['W', 'U', 'B', 'R', 'G'].map((l, i) => (
        <ManaSymbol key={l} c={l} size={34} className="lp-mana-float" style={{ animationDelay: `${i * 0.25}s` }} />
      ))}
    </div>
  )
}

// ── reveal-on-scroll (IntersectionObserver) ────────────────────────────────
function Reveal({ as: Tag = 'div', className = '', children, ...rest }) {
  const ref = useRef(null)
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setInView(true); io.disconnect() } },
      { threshold: 0.15, rootMargin: '0px 0px -8% 0px' }
    )
    io.observe(el)
    // Rete di sicurezza: se l'observer non scatta mai, il contenuto non deve restare invisibile.
    const fallback = setTimeout(() => setInView(true), 2500)
    return () => { io.disconnect(); clearTimeout(fallback) }
  }, [])
  return <Tag ref={ref} className={`lp-reveal ${inView ? 'in' : ''} ${className}`} {...rest}>{children}</Tag>
}

function Section({ id, alt, children, className = '' }) {
  return (
    <section id={id} className={`lp-section ${alt ? 'lp-alt' : ''} ${className}`}>
      <div className="lp-section-inner">{children}</div>
    </section>
  )
}

// lucide-react 1.x non include più i loghi dei brand: icona Instagram inline.
function Instagram({ size = 17 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.2" cy="6.8" r="1" fill="currentColor" stroke="none" />
    </svg>
  )
}

// Stemma grande a ogni apertura della pagina (~1,3 s, non blocca nulla): atterra con rimbalzo e rotazione, poi onda d'urto,
// raggi rotanti, alone che pulsa e i cinque simboli di mana in orbita.
// Con "riduci animazioni" (MotionConfig + CSS) resta statico.
function HeroCrest({ onTap }) {
  return (
    <div className="lp-crest" onPointerUp={onTap} onMouseDown={e => { if (e.detail > 1) e.preventDefault() }}>
      <CrestSparks />
      <span className="lp-crest-rays" aria-hidden="true" />
      <span className="lp-crest-halo" aria-hidden="true" />
      <span className="lp-crest-shock" aria-hidden="true" />
      <span className="lp-crest-shock two" aria-hidden="true" />
      <div className="lp-crest-orbit" aria-hidden="true">
        {['W', 'U', 'B', 'R', 'G'].map((c, i) => (
          <span key={c} className="lp-crest-orbit-slot" style={{ '--i': i }}>
            <ManaSymbol c={c} size={30} />
          </span>
        ))}
      </div>
      <m.img
        src="/logo-384.webp" alt="Stemma di Commanderone Villastellone" width="200" height="200"
        className="lp-crest-logo" fetchpriority="high" draggable={false}
        initial={{ scale: 0.2, rotate: -200, opacity: 0, y: -80 }}
        animate={{ scale: [0.2, 1.25, 0.94, 1], rotate: 0, opacity: 1, y: 0 }}
        transition={{ duration: 0.9, times: [0, 0.55, 0.8, 1], ease: 'easeOut' }}
      />
      <span className="lp-crest-foil" aria-hidden="true" />
    </div>
  )
}

function Kicker({ children }) {
  return <span className="lp-kicker"><span className="lp-kicker-dot" />{children}</span>
}

// ── Ventaglio di carte (formati) ────────────────────────────────────────────
// ordine in cui le carte lasciano il mazzo (attiva, poi le laterali, poi le nascoste)
const DEAL_ORDER = { 0: 0, '-1': 1, 1: 2 }
function CardFan() {
  const [active, setActive] = useState(0)
  const touch = useRef(null)
  const wrapRef = useRef(null)
  const n = FORMAT_CARDS.length
  const go = useCallback((i) => setActive(((i % n) + n) % n), [n])

  // pescata: quando il ventaglio entra in vista le carte escono dal mazzo una alla volta
  const seen = useSeen(wrapRef, 0.25)
  const [dealt, setDealt] = useState(() => (prefersReduced() ? n : 0))
  useEffect(() => {
    if (!seen || dealt >= n) return
    const t = setTimeout(() => setDealt(d => d + 1), dealt === 0 ? 250 : 170)
    return () => clearTimeout(t)
  }, [seen, dealt, n])

  // tilt 3D della carta attiva (mouse/dito; giroscopio solo dove non serve un permesso)
  const rx = useMotionValue(0), ry = useMotionValue(0)
  const srx = useSpring(rx, { stiffness: 220, damping: 20 }), sry = useSpring(ry, { stiffness: 220, damping: 20 })
  const activeRef = useRef(null)
  const setFoil = (px, py) => { const el = activeRef.current; if (el) { el.style.setProperty('--mx', `${px * 100}%`); el.style.setProperty('--my', `${py * 100}%`) } }
  const onTiltMove = (e) => {
    if (prefersReduced()) return
    const r = e.currentTarget.getBoundingClientRect()
    const px = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), py = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))
    ry.set((px - 0.5) * 18); rx.set((0.5 - py) * 14); setFoil(px, py)
  }
  const onTiltLeave = () => { rx.set(0); ry.set(0) }
  useEffect(() => {
    if (prefersReduced() || typeof DeviceOrientationEvent === 'undefined') return
    if (typeof DeviceOrientationEvent.requestPermission === 'function') return // iOS: niente prompt, solo tocco
    if (!window.matchMedia('(pointer: coarse)').matches) return
    let base = null
    const onOri = (e) => {
      if (e.beta == null || e.gamma == null) return
      base ??= { b: e.beta, g: e.gamma }
      const g = Math.max(-1, Math.min(1, (e.gamma - base.g) / 25)), b = Math.max(-1, Math.min(1, (e.beta - base.b) / 25))
      ry.set(g * 10); rx.set(-b * 8); setFoil(0.5 + g / 2, 0.5 + b / 2)
    }
    window.addEventListener('deviceorientation', onOri)
    return () => window.removeEventListener('deviceorientation', onOri)
  }, [rx, ry])

  const onKey = (e) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(active - 1) }
    if (e.key === 'ArrowRight') { e.preventDefault(); go(active + 1) }
  }
  const onTouchStart = (e) => { touch.current = e.touches[0].clientX }
  const onTouchEnd = (e) => {
    if (touch.current == null) return
    const dx = e.changedTouches[0].clientX - touch.current
    if (Math.abs(dx) > 40) go(active + (dx < 0 ? 1 : -1))
    touch.current = null
  }

  return (
    <div className="lp-fan-wrap" ref={wrapRef}>
      <div className="lp-fan" role="group" aria-roledescription="carosello" aria-label="I nostri formati"
        tabIndex={0} onKeyDown={onKey} onMouseDown={e => { if (e.detail > 1) e.preventDefault() }} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        {FORMAT_CARDS.map((card, i) => {
          // posizione relativa alla carta attiva, sul cerchio (−2..+2)
          let off = i - active
          if (off > n / 2) off -= n
          if (off < -n / 2) off += n
          const isActive = off === 0
          const hidden = Math.abs(off) > 1
          const inDeck = (DEAL_ORDER[off] ?? 3) >= dealt
          return (
            <m.article
              key={card.key}
              ref={isActive ? activeRef : undefined}
              className={`lp-mtg-card ${card.rarity} ${isActive ? 'is-active' : ''}`}
              aria-hidden={!isActive}
              onClick={() => !isActive && go(i)}
              onPointerMove={isActive ? onTiltMove : undefined}
              onPointerLeave={isActive ? onTiltLeave : undefined}
              onPointerUp={isActive ? onTiltLeave : undefined}
              initial={false}
              animate={inDeck ? {
                x: `${(i - 1.5) * 2}%`, rotate: (i - 1.5) * 3, scale: 0.84, y: 30 - i * 4,
                opacity: 1, zIndex: 20 + i,
              } : {
                x: `${off * 62}%`,
                rotate: off * 9,
                scale: isActive ? 1 : 0.84,
                y: isActive ? 0 : 18,
                opacity: hidden ? 0 : isActive ? 1 : 0.62,
                zIndex: 10 - Math.abs(off),
              }}
              transition={{ type: 'spring', stiffness: 260, damping: 28 }}
              style={{
                pointerEvents: hidden ? 'none' : 'auto', cursor: isActive ? 'default' : 'pointer',
                ...(isActive ? { rotateX: srx, rotateY: sry, transformPerspective: 900 } : {}),
              }}
            >
              <div className="lp-mtg-frame">
                <header className="lp-mtg-title">
                  <span>{card.name}</span>
                  <span className="lp-mtg-cost" aria-hidden="true">
                    {card.cost.map(c => <ManaSymbol key={c} c={c} size={16} />)}
                  </span>
                </header>
                <div className="lp-mtg-art">
                  <img src={card.art.src} alt={`Illustrazione di ${card.art.card} (${card.art.artist})`} title={`${card.art.card} — illustrazione di ${card.art.artist}`}
                    loading={i === 0 ? 'eager' : 'lazy'} decoding="async" draggable={false} />
                  <span className="lp-mtg-credit">Illus. {card.art.artist}</span>
                  <span className="lp-mtg-foil" aria-hidden="true" />
                </div>
                <div className="lp-mtg-type">
                  <span>{card.type}</span>
                  <card.Icon size={16} aria-hidden="true" />
                </div>
                <div className="lp-mtg-text">
                  <p>{card.text}</p>
                  {card.badge && <span className="lp-mtg-badge">{card.badge}</span>}
                </div>
                <footer className="lp-mtg-foot">
                  <span>Commanderone · Villastellone</span>
                  <span className={`lp-gem ${card.rarity}`} aria-hidden="true" />
                </footer>
              </div>
            </m.article>
          )
        })}
      </div>

      <div className="lp-fan-controls">
        <button type="button" className="lp-round-btn" onClick={() => go(active - 1)} aria-label="Formato precedente"><ChevronLeft size={20} /></button>
        <div className="lp-dots" role="tablist" aria-label="Scegli il formato">
          {FORMAT_CARDS.map((c, i) => (
            <button key={c.key} type="button" role="tab" aria-selected={i === active} aria-label={c.name}
              className={`lp-dot ${i === active ? 'on' : ''}`} onClick={() => go(i)} />
          ))}
        </div>
        <button type="button" className="lp-round-btn" onClick={() => go(active + 1)} aria-label="Formato successivo"><ChevronRight size={20} /></button>
      </div>
      <p className="lp-fan-hint">Tocca una carta laterale o usa le frecce per scorrere i formati</p>
      <p className="sr-only" aria-live="polite">{FORMAT_CARDS[active].name}: {FORMAT_CARDS[active].text}</p>
    </div>
  )
}

// ── Cinque principi (selettore WUBRG) ───────────────────────────────────────
function Principles() {
  const [sel, setSel] = useState('W')
  const p = PRINCIPLES.find(x => x.c === sel)
  return (
    <div className="lp-principles">
      <div className="lp-pip-picker" role="tablist" aria-label="I cinque principi del tavolo">
        {PRINCIPLES.map(x => (
          <button key={x.c} type="button" role="tab" aria-selected={sel === x.c} aria-label={`${MANA[x.c].name}: ${x.title}`}
            className={`lp-pip-btn ${sel === x.c ? 'on' : ''}`} onClick={() => setSel(x.c)}
            style={{ '--glow': MANA[x.c].glow }}>
            <ManaSymbol c={x.c} size={40} className="lp-pip-btn-dot" />
            <span className="lp-pip-btn-name">{MANA[x.c].name}</span>
          </button>
        ))}
      </div>
      <AnimatePresence mode="wait">
        <m.div key={sel} className="lp-principle-card" role="tabpanel"
          style={{ '--glow': MANA[sel].glow }}
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.22 }}>
          <ManaSymbol c={sel} size={34} className="lp-principle-pip" />
          <h3>{p.title}</h3>
          <p>{p.text}</p>
        </m.div>
      </AnimatePresence>
    </div>
  )
}

// ── Rullino foto + lightbox ─────────────────────────────────────────────────
function FilmTile({ slot, index, onOpen, clone }) {
  const [broken, setBroken] = useState(false)
  return (
    <figure className="lp-film-frame" aria-hidden={clone || undefined}>
      <button type="button" className="lp-film-btn" onClick={broken ? undefined : onOpen} disabled={broken} tabIndex={clone ? -1 : undefined}
        aria-label={`Apri la foto: ${slot.caption}`} draggable={false}>
        {!broken ? (
          <img src={photo(slot, 800)} alt={slot.alt} loading="lazy" decoding="async" draggable={false} onError={() => setBroken(true)} />
        ) : (
          <span className="lp-gallery-placeholder"><Camera size={24} /> Foto in arrivo</span>
        )}
      </button>
      <figcaption><span className="lp-film-num">{String(index + 1).padStart(2, '0')}</span>{slot.caption}</figcaption>
    </figure>
  )
}

// Rullino: scorre da solo, lento e continuo (foto duplicate per un giro senza scatti).
// Si ferma sotto il mouse/dito, a scheda nascosta, fuori schermo e con "riduci animazioni".
// Trascinabile con mouse e dito, con un po' di inerzia; un tocco senza trascinare apre la foto.
const FILM_SPEED = 24 // px/s
function FilmStrip({ onOpen }) {
  const viewRef = useRef(null), trackRef = useRef(null)
  const st = useRef({ x: 0, v: 0, hover: false, drag: null, moved: false, visible: true, focus: false })
  useEffect(() => {
    const view = viewRef.current, track = trackRef.current, S = st.current
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)')
    // periodo = distanza tra la prima foto e la sua copia (include il gap, niente scatti)
    const wrap = () => { const k = track.children, h = k.length > GALLERY_SLOTS.length ? k[GALLERY_SLOTS.length].offsetLeft - k[0].offsetLeft : 0; if (h > 0) { S.x %= h; if (S.x > 0) S.x -= h } }
    let raf = 0, last = performance.now()
    const tick = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now
      if (!S.drag) {
        if (Math.abs(S.v) > 5) { S.x += S.v * dt; S.v *= Math.pow(0.04, dt) } // inerzia
        else {
          S.v = 0
          if (!S.hover && !S.focus && S.visible && !document.hidden && !reduce.matches) S.x -= FILM_SPEED * dt
        }
      }
      wrap(); track.style.transform = `translate3d(${S.x}px,0,0)`
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    const io = new IntersectionObserver(([e]) => { S.visible = e.isIntersecting })
    io.observe(view)
    const down = (e) => {
      if (e.button !== 0) return
      if (e.pointerType !== 'mouse') S.hover = true // dito appoggiato: pausa
      S.drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, xs: S.x, lastX: e.clientX, lastT: performance.now() }
      S.moved = false; S.v = 0
    }
    const move = (e) => {
      const d = S.drag; if (!d || d.id !== e.pointerId) return
      const dx = e.clientX - d.x0
      if (!S.moved) {
        if (Math.abs(dx) < 6) return
        if (Math.abs(e.clientY - d.y0) > Math.abs(dx)) { S.drag = null; return } // è uno scroll verticale
        S.moved = true; view.setPointerCapture(e.pointerId); view.classList.add('is-dragging')
      }
      const now = performance.now(), dt = Math.max(1, now - d.lastT)
      S.v = 0.7 * S.v + 0.3 * ((e.clientX - d.lastX) / dt * 1000)
      d.lastX = e.clientX; d.lastT = now
      S.x = d.xs + dx
    }
    const up = (e) => {
      if (e.pointerType !== 'mouse') S.hover = false
      const d = S.drag; if (!d || d.id !== e.pointerId) return
      S.drag = null; view.classList.remove('is-dragging')
      if (performance.now() - d.lastT > 80) S.v = 0
      S.v = Math.max(-1500, Math.min(1500, S.v))
    }
    const click = (e) => { if (S.moved) { e.preventDefault(); e.stopPropagation(); S.moved = false } }
    const enter = (e) => { if (e.pointerType === 'mouse') S.hover = true }
    const leave = (e) => { if (e.pointerType === 'mouse') S.hover = false }
    const focusIn = (e) => {
      S.focus = true
      const fig = e.target.closest('.lp-film-frame'); if (!fig) return
      const left = fig.offsetLeft + S.x, right = left + fig.offsetWidth
      if (left < 0 || right > view.clientWidth) S.x = -(fig.offsetLeft - 16)
    }
    const focusOut = () => { S.focus = false }
    const on = [['pointerdown', down], ['pointermove', move], ['pointerup', up], ['pointercancel', up],
      ['pointerenter', enter], ['pointerleave', leave], ['focusin', focusIn], ['focusout', focusOut]]
    on.forEach(([t, f]) => view.addEventListener(t, f))
    view.addEventListener('click', click, true)
    return () => {
      cancelAnimationFrame(raf); io.disconnect()
      on.forEach(([t, f]) => view.removeEventListener(t, f))
      view.removeEventListener('click', click, true)
    }
  }, [])
  return (
    <div className="lp-film" ref={viewRef} role="group" aria-label="Foto delle serate (trascina per scorrere)">
      <div className="lp-film-track" ref={trackRef}>
        {[0, 1].map(copy => GALLERY_SLOTS.map((slot, i) => (
          <FilmTile key={`${copy}-${slot.src}`} slot={slot} index={i} clone={copy === 1} onOpen={() => onOpen(i)} />
        )))}
      </div>
    </div>
  )
}

function Lightbox({ index, onClose, onPrev, onNext }) {
  const [broken, setBroken] = useState(false)
  const closeRef = useRef(null)
  useEffect(() => { setBroken(false) }, [index])
  useEffect(() => { closeRef.current?.focus() }, [])
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') onPrev()
      if (e.key === 'ArrowRight') onNext()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, onPrev, onNext])

  const slot = GALLERY_SLOTS[index]
  return (
    <div className="lp-lightbox" onClick={onClose} role="dialog" aria-modal="true" aria-label={slot.alt}>
      <button ref={closeRef} className="lp-lightbox-close" onClick={onClose} aria-label="Chiudi"><X size={22} /></button>
      <button className="lp-lightbox-nav prev" onClick={(e) => { e.stopPropagation(); onPrev() }} aria-label="Precedente"><ChevronLeft size={26} /></button>
      <figure className="lp-lightbox-figure" onClick={(e) => e.stopPropagation()}>
        {!broken ? (
          <img src={photo(slot, 1600)} alt={slot.alt} onError={() => setBroken(true)} />
        ) : (
          <span className="lp-gallery-placeholder" style={{ width: 320, aspectRatio: '3 / 2', borderRadius: 14 }}><Camera size={24} /> Foto in arrivo</span>
        )}
        <figcaption>{slot.caption} <span>· {index + 1}/{GALLERY_SLOTS.length}</span></figcaption>
      </figure>
      <button className="lp-lightbox-nav next" onClick={(e) => { e.stopPropagation(); onNext() }} aria-label="Successiva"><ChevronRight size={26} /></button>
    </div>
  )
}

export default function LandingPage() {
  const [lightboxIndex, setLightboxIndex] = useState(null)
  const heroRef = useRef(null)
  const { rain, onTap } = useFrogTaps()

  useEffect(() => {
    const prevTitle = document.title
    document.title = 'Commanderone Villastellone — Magic: The Gathering, Commander for fun'
    const setMeta = (name, content, isProp = false) => {
      const attr = isProp ? 'property' : 'name'
      let el = document.head.querySelector(`meta[${attr}="${name}"]`)
      if (!el) { el = document.createElement('meta'); el.setAttribute(attr, name); document.head.appendChild(el) }
      el.dataset.lpTemp = '1'
      el.setAttribute('content', content)
    }
    setMeta('description', 'Commanderone Villastellone è una community di Magic: The Gathering. Commander for fun, Vintage Cube, Pauper, Modern, eventi e serate di gioco a Villastellone.')
    setMeta('og:title', 'Commanderone Villastellone — Magic: The Gathering', true)
    setMeta('og:description', 'Più rane. Più mana. Più divertimento. Una community di Magic: The Gathering a Villastellone: Commander for fun, Vintage Cube, Pauper, Modern.', true)
    setMeta('og:type', 'website', true)
    setMeta('og:image', '/logo.png', true)
    setMeta('twitter:card', 'summary_large_image')
    return () => {
      document.title = prevTitle
      document.head.querySelectorAll('meta[data-lp-temp="1"]').forEach(el => el.remove())
    }
  }, [])

  return (
    <div className="lp">
      <div className="lp-grain" />
      <div className="lp-glow" />

      <div className="lp-content">
        {/* ── NAV ── */}
        <nav className="lp-nav" aria-label="Sezioni">
          <div className="lp-nav-inner">
            <ScrollLink to="top" className="lp-nav-brand">
              <img src="/logo-192.webp" alt="Commanderone Villastellone" width="30" height="30" />
              <span className="lp-nav-brand-word">COMMANDERONE<small>VILLASTELLONE</small></span>
            </ScrollLink>
            <div className="lp-nav-links">
              <ScrollLink className="lp-nav-link" to="chi-siamo">Chi siamo</ScrollLink>
              <ScrollLink className="lp-nav-link" to="cosa-facciamo">Cosa facciamo</ScrollLink>
              <ScrollLink className="lp-nav-link" to="rule-0">Rule 0</ScrollLink>
              <ScrollLink className="lp-nav-link" to="quando-dove">Quando e dove</ScrollLink>
              <ScrollLink className="lp-nav-link" to="foto">Foto</ScrollLink>
            </div>
            <Link to="/login" className="lp-nav-login" title="Sei già dei nostri? Accedi al portale">
              Accedi <ArrowRight size={14} strokeWidth={2.4} />
            </Link>
          </div>
        </nav>

        {/* ── HERO ── */}
        <header id="top" className="lp-hero lp-intro" ref={heroRef}>
          <HeroTrail hostRef={heroRef} />
          <HeroCrest onTap={onTap} />
          <span className="lp-live-pill"><span className="lp-live-dot" />Il pod ti aspetta · ogni venerdì a Villastellone</span>
          <h1 className="lp-hero-title">
            <span className="lp-hero-line">Il tavolo da 4.</span>
            <span className="lp-hero-line">Il tuo pod.</span>
            <span className="lp-hero-brand lp-grad-text">COMMANDERONE</span>
            <span className="lp-hero-place">Villastellone</span>
          </h1>
          <p className="lp-hero-tagline">Più rane. Più mana. Più divertimento.</p>
          <p className="lp-hero-desc">
            Una community di giocatori di Magic: The Gathering nata dalla passione per il Commander
            e dalla voglia di condividere serate di gioco vere, ogni venerdì sera.
          </p>
          <div className="lp-hero-ctas">
            <Link to="/login" className="lp-cta-primary">Entra nel pod <ArrowRight size={18} strokeWidth={2.6} /></Link>
            <ScrollLink to="chi-siamo" className="lp-cta-ghost">Scopri chi siamo <ChevronDown size={17} /></ScrollLink>
          </div>
          <ManaRow />
        </header>

        {/* ── COSA FACCIAMO: ventaglio di carte ── */}
        <Section id="cosa-facciamo" className="lp-fan-section">
          <Reveal className="lp-center">
            <Kicker>Cosa facciamo</Kicker>
            <h2 className="lp-h2">Commander prima di tutto. Non solo Commander.</h2>
            <p className="lp-lead lp-center-lead">Il formato principale è Commander, ma le nostre serate non finiscono lì.</p>
          </Reveal>
          <CardFan />
        </Section>

        {/* ── FOTO: rullino ── */}
        <Section id="foto" alt>
          <Reveal>
            <Kicker>Dalle nostre serate</Kicker>
            <h2 className="lp-h2">Non solo un nome online.</h2>
            <p className="lp-lead">Commanderone è un gruppo di persone reali che si trova davvero, ogni settimana, attorno a un tavolo.</p>
          </Reveal>
          <FilmStrip onOpen={setLightboxIndex} />
        </Section>

        {/* ── CHI SIAMO ── */}
        <Section id="chi-siamo">
          <Reveal>
            <Kicker>Chi siamo</Kicker>
            <h2 className="lp-h2">Una community, non un torneo.</h2>
            <p className="lp-lead">
              Commanderone Villastellone è un gruppo di giocatori di Magic: The Gathering. Il Commander è il
              cuore di tutto, ma il motivo per cui ci troviamo ogni settimana non è vincere: è giocare,
              condividere la passione per questo gioco assurdo, conoscere gente e avere un appuntamento fisso
              che non salta mai.
            </p>
          </Reveal>
          <Reveal className="lp-tag-row" style={{ transitionDelay: '0.08s' }}>
            {['Mazzi casual', 'Mazzi ottimizzati', 'Deck tematici', 'Strategie competitive', 'Giocatori esperti', 'Giocatori alle prime armi'].map(tg => (
              <span key={tg} className="lp-tag">{tg}</span>
            ))}
          </Reveal>
          <Reveal className="lp-callout" style={{ transitionDelay: '0.14s' }}>
            <Users size={20} aria-hidden="true" />
            <span>Non serve appartenere a una categoria per essere parte del gruppo. Il pod ha spazio per tutti.</span>
          </Reveal>
          <CommunityStats />
        </Section>

        {/* ── CINQUE PRINCIPI ── */}
        <Section alt>
          <Reveal className="lp-center">
            <Kicker>La filosofia del tavolo</Kicker>
            <h2 className="lp-h2">Cinque colori, un solo tavolo.</h2>
            <p className="lp-lead lp-center-lead">Tocca un colore per leggere uno dei principi del gruppo.</p>
          </Reveal>
          <Reveal style={{ transitionDelay: '0.08s' }}><Principles /></Reveal>
        </Section>

        {/* ── PROXY FRIENDLY ── */}
        <Section>
          <Reveal className="lp-proxy">
            <span className="lp-proxy-icon"><ShieldCheck size={26} /></span>
            <div className="lp-proxy-percent lp-grad-text">100%</div>
            <div className="lp-proxy-label">Proxy Friendly</div>
            <p className="lp-proxy-desc">
              Nessuno viene giudicato o discriminato per l'uso di proxy. Servono per provare mazzi nuovi,
              testare carte, giocare pezzi dal valore elevato senza svenarsi, sperimentare. Il valore economico
              di una carta non determina il valore di chi la gioca.
            </p>
            <span className="lp-proxy-req"><Layers size={15} /> Unico requisito: leggibili e riconoscibili</span>
          </Reveal>
        </Section>

        {/* ── IL NOSTRO MODO DI GIOCARE + MOOD ── */}
        <Section id="modo-di-giocare" alt>
          <div className="lp-split">
            <Reveal>
              <Kicker>Il nostro modo di giocare</Kicker>
              <h2 className="lp-h2">For fun. Ma con le regole chiare.</h2>
              <p className="lp-lead" style={{ marginBottom: 22 }}>
                Commanderone nasce come gruppo for fun. Questo non significa che il gioco competitivo sia
                escluso: possono esistere tornei, classifiche, eventi strutturati e partite molto combattute.
                Ma il contesto resta quello di una community e di un tavolo da kitchen table.
              </p>
              <ul className="lp-check-list">
                <li><Check size={18} /> Niente montepremi: gli eventuali premi sono simbolici.</li>
                <li><Check size={18} /> Quando c'è un torneo, ha una struttura seria — ma resta un torneo tra amici.</li>
                <li><Check size={18} /> L'obiettivo non è eliminare la competitività, ma non lasciarle rovinare il divertimento.</li>
              </ul>
            </Reveal>
            <Reveal className="lp-die-panel" style={{ transitionDelay: '0.1s' }}>
              <div className="row"><span>Formato principale</span><span>Commander</span></div>
              <div className="row"><span>Spirito</span><span>Kitchen table</span></div>
              <div className="row"><span>Montepremi</span><span>Simbolico</span></div>
              <div className="row"><span>Chi può giocare</span><span>Chiunque abbia voglia</span></div>
              <DieRoller />
            </Reveal>
          </div>
          <Reveal className="lp-mood" style={{ transitionDelay: '0.12s' }}>
            <span className="lp-kicker-inline"><Sparkles size={15} /> Mood e comunità</span>
            <p>
              Giochiamo seriamente. Non ci prendiamo troppo sul serio. Ironia, battute, trash talking e
              goliardia sono benvenuti — sempre nel rispetto di chi hai davanti al tavolo.
            </p>
            <div className="lp-mood-rule">L'unica regola che conta: <span className="lp-grad-text">Non fare lo stronzo.</span></div>
            <p>
              Si può scherzare con gli altri senza mettere gli altri a disagio. Un ambiente rilassato, adulto,
              inclusivo e rispettoso — questo è il vero regolamento del gruppo.
            </p>
          </Reveal>
        </Section>

        {/* ── RULE 0 + BRACKET ── */}
        <Section id="rule-0">
          <div className="lp-split">
            <Reveal>
              <Kicker>Rule 0</Kicker>
              <h2 className="lp-h2">Parliamone prima.</h2>
              <p className="lp-lead" style={{ marginBottom: 0 }}>
                Usiamo il sistema ufficiale dei Bracket come riferimento per il power level dei mazzi. Ma il
                Bracket non sostituisce la comunicazione: prima di sedersi al tavolo vale la pena allinearsi
                con il pod. Non serve rivelare la decklist — basta evitare aspettative incompatibili.
              </p>
              <div className="lp-quote"><MessagesSquare size={18} /> Meglio parlarne prima che discuterne dopo.</div>
            </Reveal>
            <Reveal style={{ transitionDelay: '0.1s' }}>
              <BracketDial />
              <ul className="lp-check-list">
                <li><Check size={18} /> Power level e Bracket del mazzo</li>
                <li><Check size={18} /> Combo particolari in gioco</li>
                <li><Check size={18} /> Strategie molto forti o veloci</li>
                <li><Check size={18} /> Condizioni di vittoria rilevanti</li>
                <li><Check size={18} /> Qualsiasi cosa possa cambiare l'esperienza degli altri al tavolo</li>
              </ul>
            </Reveal>
          </div>
        </Section>

        {/* ── QUANDO E DOVE ── */}
        <Section id="quando-dove" alt>
          <Reveal>
            <Kicker>Quando e dove</Kicker>
            <h2 className="lp-h2">Un appuntamento fisso.</h2>
          </Reveal>
          <Reveal className="lp-tana">
            <TanaCard />
            <div className="lp-tana-body">
              <Countdown />
              <div className="lp-tana-grid">
                <div className="lp-when-card">
                  <span className="lp-when-icon"><CalendarDays size={20} /></span>
                  <span className="lp-when-label">Quando</span>
                  <span className="lp-when-big">Ogni venerdì</span>
                  <span className="lp-when-sub">Dalle 21:30</span>
                </div>
                <div className="lp-when-card">
                  <span className="lp-when-icon"><MapPin size={20} /></span>
                  <span className="lp-when-label">Dove</span>
                  <span className="lp-when-big">{ADDRESS_LINE1}</span>
                  <span className="lp-when-sub">{ADDRESS_LINE2}<br />{ADDRESS_LINE3}</span>
                </div>
              </div>
              <a className="lp-map-btn" href={MAPS_URL} target="_blank" rel="noopener noreferrer">
                <MapPin size={16} /> Apri in Google Maps
              </a>
            </div>
          </Reveal>
        </Section>

        {/* ── CONCLUSIONE ── */}
        <footer className="lp-footer">
          <img src="/logo-384.webp" alt="Commanderone Villastellone" className="lp-footer-logo" width="96" height="96" loading="lazy" />
          <ManaRow />
          <h2 className="lp-footer-title">Ci vediamo al tavolo.</h2>
          <p className="lp-footer-desc">
            Commanderone Villastellone — Magic: The Gathering, Commander e una community con cui condividere
            la passione per il gioco.
          </p>
          <div className="lp-footer-links">
            <Link to="/login" className="lp-cta-primary">Entra nel pod <ArrowRight size={18} strokeWidth={2.6} /></Link>
            {INSTAGRAM_URL && (
              <a className="lp-footer-link" href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer">
                <Instagram size={17} /> Seguici su Instagram
              </a>
            )}
            <ScrollLink className="lp-footer-link" to="quando-dove"><MapPin size={15} /> Vieni a trovarci il venerdì sera</ScrollLink>
          </div>
          <div className="lp-footer-fine">Commanderone Villastellone · Villastellone (TO)</div>
        </footer>
      </div>

      <FrogRain rain={rain} />
      {lightboxIndex !== null && (
        <Lightbox
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onPrev={() => setLightboxIndex(i => (i - 1 + GALLERY_SLOTS.length) % GALLERY_SLOTS.length)}
          onNext={() => setLightboxIndex(i => (i + 1) % GALLERY_SLOTS.length)}
        />
      )}
    </div>
  )
}
