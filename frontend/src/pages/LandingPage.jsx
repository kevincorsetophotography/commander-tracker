import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import './LandingPage.css'

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

// Foto reali delle serate. Per aggiungerne altre in futuro: mettere il file in
// frontend/public/Foto Commanderone/ e aggiungere una riga qui sotto.
// Finché un file non esiste (o viene rimosso), il tile mostra un placeholder invece di un'icona rotta.
const PHOTO_DIR = '/Foto%20Commanderone'
const GALLERY_SLOTS = [
  { src: `${PHOTO_DIR}/DSC00807.jpg`, alt: 'Due giocatori mostrano orgogliosi le loro carte al tavolo' },
  { src: `${PHOTO_DIR}/DSC00834.jpg`, alt: 'Un pod al completo: carte, dadi e box ovunque sul tavolo' },
  { src: `${PHOTO_DIR}/DSC00820.jpg`, alt: 'Una mano di carte pronta a scendere in campo sul playmat di Unstable' },
  { src: `${PHOTO_DIR}/DSC00881.jpg`, alt: 'Una serata qualunque negli spazi di Unstable' },
  { src: `${PHOTO_DIR}/DSC00822.jpg`, alt: 'Quando la partita si fa surreale (sì, quella è una carta in fronte)' },
  { src: `${PHOTO_DIR}/DSC00826.jpg`, alt: 'Anche il collo, a quanto pare, può essere zona di gioco' },
]

const MANA_PIPS = [
  { l: 'W', bg: '#F8F6D8', fg: '#4A4630', glow: 'rgba(248,246,216,0.35)' },
  { l: 'U', bg: '#0E68AB', fg: '#EAF4FF', glow: 'rgba(14,104,171,0.45)' },
  { l: 'B', bg: '#1B1B22', fg: '#ECEDFB', glow: 'rgba(139,92,246,0.35)' },
  { l: 'R', bg: '#D3202A', fg: '#FFF3F0', glow: 'rgba(211,32,42,0.4)' },
  { l: 'G', bg: '#00733E', fg: '#EAFFF3', glow: 'rgba(0,115,62,0.4)' },
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
      {MANA_PIPS.map((m, i) => (
        <span key={m.l} className="lp-mana-pip" style={{ background: m.bg, color: m.fg, '--glow': m.glow, animationDelay: `${i * 0.25}s` }}>{m.l}</span>
      ))}
    </div>
  )
}

// ── reveal-on-scroll (IntersectionObserver, niente librerie) ───────────────
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
    // Rete di sicurezza: se per qualsiasi motivo l'observer non scatta mai
    // (browser bizzarro, tab in background, ecc.) il contenuto non deve restare invisibile.
    const fallback = setTimeout(() => setInView(true), 2500)
    return () => { io.disconnect(); clearTimeout(fallback) }
  }, [])

  return (
    <Tag ref={ref} className={`lp-reveal ${inView ? 'in' : ''} ${className}`} {...rest}>
      {children}
    </Tag>
  )
}

function Section({ id, alt, children }) {
  return (
    <section id={id} className={`lp-section ${alt ? 'lp-alt' : ''}`}>
      <div className="lp-section-inner">{children}</div>
    </section>
  )
}

// ── icone (inline SVG, nessun asset esterno) ───────────────────────────────
const Icon = {
  check: (p) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M20 6L9 17l-5-5" />
    </svg>
  ),
  crown: (p) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M3 18h18l-1.5-9-4.5 4-3-6-3 6-4.5-4L3 18z" />
      <path d="M5 21h14" />
    </svg>
  ),
  cube: (p) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M21 8l-9-5-9 5 9 5 9-5z" /><path d="M3 8v8l9 5 9-5V8" /><path d="M12 13v8" />
    </svg>
  ),
  cards: (p) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <rect x="7" y="3" width="10" height="15" rx="1.5" transform="rotate(-8 12 10)" />
      <rect x="5" y="6" width="10" height="15" rx="1.5" />
    </svg>
  ),
  dice: (p) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M12 2l9 5v10l-9 5-9-5V7l9-5z" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
    </svg>
  ),
  calendar: (p) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  ),
  pin: (p) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M21 10c0 6-9 12-9 12s-9-6-9-12a9 9 0 0118 0z" /><circle cx="12" cy="10" r="3" />
    </svg>
  ),
  frog: (p) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <ellipse cx="12" cy="14" rx="8" ry="6" /><circle cx="7" cy="7" r="2.4" /><circle cx="17" cy="7" r="2.4" />
      <circle cx="7" cy="7" r="0.6" fill="currentColor" /><circle cx="17" cy="7" r="0.6" fill="currentColor" />
    </svg>
  ),
  instagram: (p) => (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...p}>
      <rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.2" cy="6.8" r="1" fill="currentColor" stroke="none" />
    </svg>
  ),
}

function GalleryTile({ src, alt, onOpen }) {
  const [broken, setBroken] = useState(false)
  return (
    <div
      className="lp-gallery-tile ct-press"
      onClick={broken ? undefined : onOpen}
      style={broken ? { cursor: 'default' } : undefined}
    >
      {!broken ? (
        <img src={src} alt={alt} loading="lazy" onError={() => setBroken(true)} />
      ) : (
        <div className="lp-gallery-placeholder">
          <Icon.frog />
          <span>Foto in arrivo</span>
        </div>
      )}
    </div>
  )
}

function Lightbox({ index, onClose, onPrev, onNext }) {
  const [broken, setBroken] = useState(false)
  useEffect(() => { setBroken(false) }, [index])

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
    <div className="lp-lightbox" onClick={onClose}>
      <button className="lp-lightbox-close" onClick={onClose} aria-label="Chiudi">✕</button>
      <button className="lp-lightbox-nav prev" onClick={(e) => { e.stopPropagation(); onPrev() }} aria-label="Precedente">‹</button>
      {!broken ? (
        <img src={slot.src} alt={slot.alt} onClick={(e) => e.stopPropagation()} onError={() => setBroken(true)} />
      ) : (
        <div className="lp-gallery-placeholder" style={{ position: 'static', width: 320, aspectRatio: '3 / 2', borderRadius: 14 }} onClick={(e) => e.stopPropagation()}>
          <Icon.frog />
          <span>Foto in arrivo</span>
        </div>
      )}
      <button className="lp-lightbox-nav next" onClick={(e) => { e.stopPropagation(); onNext() }} aria-label="Successiva">›</button>
    </div>
  )
}

export default function LandingPage() {
  const [lightboxIndex, setLightboxIndex] = useState(null)

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
        <nav className="lp-nav">
          <div className="lp-nav-inner">
            <ScrollLink to="top" className="lp-nav-brand">
              <img src="/logo.png" alt="Commanderone Villastellone" />
              <span className="lp-nav-brand-word">COMMANDERONE</span>
            </ScrollLink>
            <div className="lp-nav-links">
              <ScrollLink className="lp-nav-link" to="chi-siamo">Chi siamo</ScrollLink>
              <ScrollLink className="lp-nav-link" to="cosa-facciamo">Cosa facciamo</ScrollLink>
              <ScrollLink className="lp-nav-link" to="rule-0">Rule 0</ScrollLink>
              <ScrollLink className="lp-nav-link" to="quando-dove">Quando e dove</ScrollLink>
              <ScrollLink className="lp-nav-link" to="foto">Foto</ScrollLink>
            </div>
            <Link to="/login" className="lp-nav-login" title="Sei già dei nostri? Accedi al portale">
              Accedi
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
            </Link>
          </div>
        </nav>

        {/* ── HERO ── */}
        <header id="top" className="lp-hero">
          <div className="lp-float-card a" /><div className="lp-float-card b" /><div className="lp-float-card c" /><div className="lp-float-card d" />
          <img src="/logo.png" alt="Commanderone Villastellone" className="lp-hero-logo" />
          <h1 className="lp-hero-title">
            COMMANDERONE <span className="lp-grad-text">VILLASTELLONE</span>
          </h1>
          <p className="lp-hero-tagline">Più rane. Più mana. Più divertimento.</p>
          <ManaRow />
          <p className="lp-hero-desc">
            Una community di giocatori di Magic: The Gathering nata dalla passione per il Commander
            e dalla voglia di condividere serate di gioco vere, ogni venerdì sera.
          </p>
          <ScrollLink to="chi-siamo" className="lp-hero-cta">
            Scopri chi siamo
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12l7 7 7-7" /></svg>
          </ScrollLink>
        </header>

        {/* ── CHI SIAMO ── */}
        <Section id="chi-siamo">
          <Reveal>
            <span className="lp-kicker">Chi siamo</span>
            <h2 className="lp-h2">Una community, non un torneo.</h2>
            <p className="lp-lead">
              Commanderone Villastellone è un gruppo di giocatori di Magic: The Gathering. Il Commander è il
              cuore di tutto, ma il motivo per cui ci troviamo ogni settimana non è vincere: è giocare,
              condividere la passione per questo gioco assurdo, conoscere gente e avere un appuntamento fisso
              che non salta mai.
            </p>
          </Reveal>
          <Reveal className="lp-tag-row" style={{ transitionDelay: '0.08s' }}>
            <span className="lp-tag">Mazzi casual</span>
            <span className="lp-tag">Mazzi ottimizzati</span>
            <span className="lp-tag">Deck tematici</span>
            <span className="lp-tag">Strategie competitive</span>
            <span className="lp-tag">Giocatori esperti</span>
            <span className="lp-tag">Giocatori alle prime armi</span>
          </Reveal>
          <Reveal className="lp-callout" style={{ transitionDelay: '0.14s' }}>
            Non serve appartenere a una categoria per essere parte del gruppo. Il pod ha spazio per tutti.
          </Reveal>
        </Section>

        {/* ── COSA FACCIAMO ── */}
        <Section id="cosa-facciamo" alt>
          <Reveal>
            <span className="lp-kicker">Cosa facciamo</span>
            <h2 className="lp-h2">Commander prima di tutto. Non solo Commander.</h2>
            <p className="lp-lead">
              Il formato principale è Commander, ma le nostre serate non finiscono lì.
            </p>
          </Reveal>
          <div className="lp-cards">
            <Reveal className="lp-card" as="div">
              <span className="lp-card-rarity mythic" title="Mythic" />
              <div className="lp-card-icon"><Icon.crown /></div>
              <h3>Commander</h3>
              <p>Il cuore del gruppo. Si gioca principalmente for fun, con grande attenzione alla Rule 0 e alla compatibilità tra i giocatori del pod.</p>
            </Reveal>
            <Reveal className="lp-card" style={{ transitionDelay: '0.06s' }}>
              <span className="lp-card-rarity rare" title="Rare" />
              <div className="lp-card-icon"><Icon.cube /></div>
              <h3>Vintage Cube</h3>
              <p>Il gruppo ha un Vintage Cube completo, terre incluse. Basta un tavolo e un po' di tempo per fare draft.</p>
              <span className="lp-card-badge">Completo di terre</span>
            </Reveal>
            <Reveal className="lp-card" style={{ transitionDelay: '0.12s' }}>
              <span className="lp-card-rarity uncommon" title="Uncommon" />
              <div className="lp-card-icon"><Icon.cards /></div>
              <h3>Constructed</h3>
              <p>Principalmente Pauper e Modern, ma non chiudiamo la porta ad altri formati se qualcuno si organizza.</p>
            </Reveal>
            <Reveal className="lp-card" style={{ transitionDelay: '0.18s' }}>
              <span className="lp-card-rarity common" title="Common" />
              <div className="lp-card-icon"><Icon.dice /></div>
              <h3>Eventi e serate speciali</h3>
              <p>Draft, tornei, sfide, serate a tema: quando c'è voglia di organizzare qualcosa di diverso, lo facciamo.</p>
            </Reveal>
          </div>
        </Section>

        {/* ── IL NOSTRO MODO DI GIOCARE ── */}
        <Section id="modo-di-giocare">
          <div className="lp-split">
            <Reveal>
              <span className="lp-kicker">Il nostro modo di giocare</span>
              <h2 className="lp-h2">For fun. Ma con le regole chiare.</h2>
              <p className="lp-lead" style={{ marginBottom: 22 }}>
                Commanderone nasce come gruppo for fun. Questo non significa che il gioco competitivo sia
                escluso: possono esistere tornei, classifiche, eventi strutturati e partite molto combattute.
                Ma il contesto resta quello di una community e di un tavolo da kitchen table.
              </p>
              <ul className="lp-check-list">
                <li><Icon.check /> Niente montepremi: gli eventuali premi sono simbolici.</li>
                <li><Icon.check /> Quando c'è un torneo, ha una struttura seria — ma resta un torneo tra amici.</li>
                <li><Icon.check /> L'obiettivo non è eliminare la competitività, ma non lasciarle rovinare il divertimento.</li>
              </ul>
            </Reveal>
            <Reveal className="lp-die-panel" style={{ transitionDelay: '0.1s' }}>
              <div className="row"><span>Formato principale</span><span>Commander</span></div>
              <div className="row"><span>Spirito</span><span>Kitchen table</span></div>
              <div className="row"><span>Montepremi</span><span>Simbolico</span></div>
              <div className="row"><span>Chi può giocare</span><span>Chiunque abbia voglia</span></div>
            </Reveal>
          </div>
        </Section>

        {/* ── PROXY FRIENDLY ── */}
        <Section alt>
          <Icon.cards width={130} height={130} className="lp-corner-deco" style={{ top: 12, left: 24, color: '#8B5CF6', transform: 'rotate(-12deg)' }} />
          <Icon.dice width={110} height={110} className="lp-corner-deco" style={{ bottom: 8, right: 28, color: '#34F08F', transform: 'rotate(14deg)' }} />
          <Reveal className="lp-proxy">
            <div className="lp-proxy-percent lp-grad-text">100%</div>
            <div className="lp-proxy-label">Proxy Friendly</div>
            <p className="lp-proxy-desc">
              Nessuno viene giudicato o discriminato per l'uso di proxy. Servono per provare mazzi nuovi,
              testare carte, giocare pezzi dal valore elevato senza svenarsi, sperimentare. Il valore economico
              di una carta non determina il valore di chi la gioca.
            </p>
            <span className="lp-proxy-req"><Icon.cards width={15} height={15} /> Unico requisito: leggibili e riconoscibili</span>
          </Reveal>
        </Section>

        {/* ── RULE 0 ── */}
        <Section id="rule-0">
          <Icon.dice width={120} height={120} className="lp-corner-deco" style={{ top: 20, right: 20, color: '#34F08F', transform: 'rotate(-8deg)' }} />
          <div className="lp-split">
            <Reveal>
              <span className="lp-kicker">Rule 0</span>
              <h2 className="lp-h2">Parliamone prima.</h2>
              <p className="lp-lead" style={{ marginBottom: 0 }}>
                Usiamo il sistema ufficiale dei Bracket come riferimento per il power level dei mazzi. Ma il
                Bracket non sostituisce la comunicazione: prima di sedersi al tavolo vale la pena allinearsi
                con il pod. Non serve rivelare la decklist — basta evitare aspettative incompatibili.
              </p>
              <div className="lp-quote">Meglio parlarne prima che discuterne dopo.</div>
            </Reveal>
            <Reveal style={{ transitionDelay: '0.1s' }}>
              <ul className="lp-check-list">
                <li><Icon.check /> Power level e Bracket del mazzo</li>
                <li><Icon.check /> Combo particolari in gioco</li>
                <li><Icon.check /> Strategie molto forti o veloci</li>
                <li><Icon.check /> Condizioni di vittoria rilevanti</li>
                <li><Icon.check /> Qualsiasi cosa possa cambiare l'esperienza degli altri al tavolo</li>
              </ul>
            </Reveal>
          </div>
        </Section>

        {/* ── MOOD ── */}
        <Section alt>
          <Reveal style={{ textAlign: 'center' }}>
            <span className="lp-kicker">Mood e comunità</span>
            <p className="lp-lead" style={{ margin: '0 auto' }}>
              Giochiamo seriamente. Non ci prendiamo troppo sul serio. Ironia, battute, trash talking e
              goliardia sono benvenuti — sempre nel rispetto di chi hai davanti al tavolo.
            </p>
            <div className="lp-mood-rule">
              L'unica regola che conta:<br /><span className="lp-grad-text">Non fare lo stronzo.</span>
            </div>
            <p className="lp-lead" style={{ margin: '0 auto' }}>
              Si può scherzare con gli altri senza mettere gli altri a disagio. Un ambiente rilassato, adulto,
              inclusivo e rispettoso — questo è il vero regolamento del gruppo.
            </p>
          </Reveal>
        </Section>

        {/* ── QUANDO E DOVE ── */}
        <Section id="quando-dove">
          <Reveal>
            <span className="lp-kicker">Quando e dove</span>
            <h2 className="lp-h2">Un appuntamento fisso.</h2>
          </Reveal>
          <div className="lp-when-grid">
            <Reveal as="div" className="lp-when-card day">
              <div className="lp-when-icon"><Icon.calendar /></div>
              <h3>Quando</h3>
              <p className="lp-when-big">Ogni venerdì</p>
              <p className="lp-when-sub">Dalle 21:30</p>
            </Reveal>
            <Reveal as="div" className="lp-when-card place" style={{ transitionDelay: '0.08s' }}>
              <div className="lp-when-icon"><Icon.pin /></div>
              <h3>Dove</h3>
              <p className="lp-when-big">{ADDRESS_LINE1}</p>
              <p className="lp-when-sub">{ADDRESS_LINE2}<br />{ADDRESS_LINE3}</p>
              <a className="lp-map-btn" href={MAPS_URL} target="_blank" rel="noopener noreferrer">
                <Icon.pin width={15} height={15} /> Apri in Google Maps
              </a>
            </Reveal>
          </div>
        </Section>

        {/* ── FOTO ── */}
        <Section id="foto" alt>
          <Reveal>
            <span className="lp-kicker">Dalle nostre serate</span>
            <h2 className="lp-h2">Non solo un nome online.</h2>
            <p className="lp-lead">
              Commanderone è un gruppo di persone reali che si trova davvero, ogni settimana, attorno a un tavolo.
            </p>
          </Reveal>
          <Reveal className="lp-gallery">
            {GALLERY_SLOTS.map((slot, i) => (
              <GalleryTile key={slot.src} src={slot.src} alt={slot.alt} onOpen={() => setLightboxIndex(i)} />
            ))}
          </Reveal>
        </Section>

        {/* ── CONCLUSIONE ── */}
        <footer className="lp-footer">
          <img src="/logo.png" alt="Commanderone Villastellone" className="lp-footer-logo" />
          <ManaRow />
          <h2 className="lp-footer-title">Ci vediamo al tavolo.</h2>
          <p className="lp-footer-desc">
            Commanderone Villastellone — Magic: The Gathering, Commander e una community con cui condividere
            la passione per il gioco.
          </p>
          <div className="lp-footer-links">
            {INSTAGRAM_URL && (
              <a className="lp-footer-link" href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer">
                <Icon.instagram /> Seguici su Instagram
              </a>
            )}
            <ScrollLink className="lp-footer-link" to="quando-dove"><Icon.pin width={15} height={15} /> Vieni a trovarci il venerdì sera</ScrollLink>
          </div>
          <div className="lp-footer-fine">Commanderone Villastellone · Villastellone (TO)</div>
        </footer>
      </div>

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
