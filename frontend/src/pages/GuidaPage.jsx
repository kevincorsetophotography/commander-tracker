import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import * as Dialog from '@radix-ui/react-dialog'
import { Search, X, Lightbulb, TriangleAlert, ArrowUp, ChevronDown, Maximize2 } from 'lucide-react'
import { useTheme } from '../hooks/useTheme'
import { useAuth } from '../hooks/useAuth'
import { Icon } from '../components/ui'
import { CHAPTERS, FAQ, MANA, DIMS, IMG } from './guida/guideContent'

// Guida utente: indice a carte (proporzioni di una carta Magic, 63×88), capitoli con screenshot
// ritagliati dall'app, gesti del segnapunti annotati sull'immagine, ricerca e domande frequenti.
// I contenuti stanno in ./guida/guideContent.js.

// accento del capitolo: tinte chiare sul tema scuro, sature sul chiaro (leggibili sul bianco)
const MANA_LIGHT = { W: '#A57F1F', U: '#1F78BC', B: '#6B4FA0', R: '#C9502B', G: '#14894B', C: '#66627E' }
const manaColor = (m, dark) => (dark ? MANA[m].hex : MANA_LIGHT[m])

// Dove porta il pulsante in fondo al capitolo
const routeFor = (id, user) => ({
  navigazione: null, feed: ['/', 'Apri il Feed'], gioca: ['/gioca', 'Apri Gioca'], tavoli: ['/gioca', 'Vai ai tavoli aperti'],
  'segnapunti-libero': ['/segnapunti', 'Apri il segnapunti libero'], registra: ['/nuova-partita', 'Registra una partita'],
  mazzi: ['/mazzi', 'Apri i tuoi mazzi'], gruppo: ['/gruppo', 'Apri Gruppo'], profilo: user ? [`/giocatore/${user.id}`, 'Apri il tuo profilo'] : null,
  eventi: ['/eventi', 'Apri gli eventi'], giudice: ['/giudice', 'Chiedi al Giudice'],
}[id] || null)

// ── testo con **grassetto** e `codice` ────────────────────────────────────────
function Rich({ text, t }) {
  const parts = String(text).split(/(\*\*[^*]+\*\*|`[^`]+`)/g)
  return parts.map((p, i) => {
    if (p.startsWith('**') && p.endsWith('**')) return <strong key={i} style={{ color: t.text, fontWeight: 700 }}>{p.slice(2, -2)}</strong>
    if (p.startsWith('`') && p.endsWith('`')) return <code key={i} style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '0.9em', background: t.bgMuted, borderRadius: 6, padding: '1px 6px', color: t.text }}>{p.slice(1, -1)}</code>
    return p
  })
}

// testo "piatto" di un capitolo per la ricerca
function chapterText(ch) {
  const out = [ch.title, ch.lede]
  for (const b of ch.blocks) {
    if (b.p) out.push(b.p)
    if (b.h) out.push(b.h)
    if (b.tip) out.push(b.tip)
    if (b.warn) out.push(b.warn)
    if (b.steps) out.push(...b.steps)
    if (b.list) out.push(...b.list)
    if (b.table) out.push(...b.table.rows.flat())
    if (b.gestures) out.push(...b.gestures.items)
    if (b.caption) out.push(b.caption)
  }
  return out.join(' ').replace(/\*\*|`/g, '').toLowerCase()
}
const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

// ── immagine con zoom ─────────────────────────────────────────────────────────
function Shot({ name, alt, caption, narrow, flat, optional, t, dark, accent, onZoom, children }) {
  const [missing, setMissing] = useState(false)
  if (missing && optional) return null
  const [w, h] = DIMS[name] || [780, 1200]
  return (
    <figure style={{ margin: '18px auto', maxWidth: flat ? '100%' : narrow ? 300 : 420 }}>
      <button
        type="button"
        onClick={() => onZoom({ name, alt, caption })}
        aria-label={`Ingrandisci: ${alt}`}
        className="ct-press"
        style={{
          position: 'relative', display: 'block', width: '100%', padding: 0, cursor: 'zoom-in',
          borderRadius: flat ? 14 : 20, overflow: 'hidden', background: dark ? '#05060d' : '#0b0d20',
          border: `1px solid ${dark ? 'rgba(255,255,255,0.10)' : t.borderStrong}`,
          boxShadow: dark ? `0 18px 40px rgba(0,0,0,0.45), 0 0 0 4px ${accent}14` : '0 12px 30px rgba(20,20,42,0.16)',
        }}
      >
        <img
          src={IMG(name)} alt={alt} width={w / 2} height={h / 2} loading="lazy" decoding="async"
          onError={() => setMissing(true)}
          style={{ display: 'block', width: '100%', height: 'auto' }}
        />
        {children}
        {!flat && (
          <span aria-hidden="true" style={{ position: 'absolute', right: 8, bottom: 8, width: 30, height: 30, borderRadius: 10, background: 'rgba(5,6,13,0.6)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
            <Maximize2 size={15} />
          </span>
        )}
      </button>
      {caption && <figcaption style={{ fontSize: 13, color: t.textSub, lineHeight: 1.45, marginTop: 8, textAlign: flat ? 'left' : 'center' }}>{caption}</figcaption>}
    </figure>
  )
}

// ── blocchi di contenuto ──────────────────────────────────────────────────────
function Block({ b, t, dark, accent, onZoom }) {
  const body = { color: t.textSub, fontSize: 15.5, lineHeight: 1.65, margin: '10px 0' }

  if (b.h) return <h3 style={{ fontSize: 17, fontWeight: 800, color: t.text, margin: '26px 0 6px', letterSpacing: '-0.01em' }}>{b.h}</h3>
  if (b.p) return <p style={body}><Rich text={b.p} t={t} /></p>

  if (b.steps) return (
    <ol style={{ listStyle: 'none', padding: 0, margin: '12px 0', display: 'grid', gap: 10 }}>
      {b.steps.map((s, i) => (
        <li key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <span aria-hidden="true" style={{ width: 26, height: 26, borderRadius: '50%', flexShrink: 0, marginTop: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 900, background: accent, color: '#0b0d1c' }}>{i + 1}</span>
          <span style={{ ...body, margin: 0 }}><Rich text={s} t={t} /></span>
        </li>
      ))}
    </ol>
  )

  if (b.list) return (
    <ul style={{ listStyle: 'none', padding: 0, margin: '12px 0', display: 'grid', gap: 8 }}>
      {b.list.map((s, i) => (
        <li key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <span aria-hidden="true" style={{ width: 7, height: 7, flexShrink: 0, marginTop: 10, transform: 'rotate(45deg)', borderRadius: 1.5, background: accent }} />
          <span style={{ ...body, margin: 0 }}><Rich text={s} t={t} /></span>
        </li>
      ))}
    </ul>
  )

  if (b.tip || b.warn) {
    const warn = !!b.warn
    return (
      <div role="note" style={{
        display: 'flex', gap: 12, alignItems: 'flex-start', margin: '16px 0', padding: '12px 14px', borderRadius: 14,
        background: warn ? t.dangerBg : t.bgSurfaceAlt, border: `1px solid ${warn ? t.dangerBorder : t.border}`,
      }}>
        <span style={{ color: warn ? t.danger : accent, display: 'flex', marginTop: 2 }}>{warn ? <TriangleAlert size={18} /> : <Lightbulb size={18} />}</span>
        <span style={{ fontSize: 14.5, lineHeight: 1.6, color: t.textSub }}><Rich text={b.tip || b.warn} t={t} /></span>
      </div>
    )
  }

  if (b.table) return (
    <div style={{ margin: '14px 0', borderRadius: 14, border: `1px solid ${t.border}`, overflow: 'hidden', background: t.bgSurface }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14.5 }}>
        <thead>
          <tr>{b.table.head.map((h, i) => (
            <th key={i} scope="col" style={{ textAlign: 'left', padding: '10px 12px', fontWeight: 800, color: t.text, background: t.bgMuted, fontSize: 13 }}>{h}</th>
          ))}</tr>
        </thead>
        <tbody>
          {b.table.rows.map((r, ri) => (
            <tr key={ri} style={{ borderTop: `1px solid ${t.border}` }}>
              {r.map((c, ci) => <td key={ci} style={{ padding: '10px 12px', color: t.textSub, verticalAlign: 'top', lineHeight: 1.5 }}><Rich text={c} t={t} /></td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )

  if (b.shot) return <Shot {...b} name={b.shot} t={t} dark={dark} accent={accent} onZoom={onZoom} />

  if (b.shots) return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12, margin: '6px 0' }}>
      {b.shots.map(s => <Shot key={s.shot} {...s} name={s.shot} t={t} dark={dark} accent={accent} onZoom={onZoom} />)}
    </div>
  )

  if (b.gestures) {
    const g = b.gestures
    const badge = (n, size = 26) => (
      <span aria-hidden="true" style={{
        width: size, height: size, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: size * 0.5, fontWeight: 900, background: accent, color: '#0b0d1c', border: '2px solid #0b0d1c',
        boxShadow: `0 0 0 3px ${accent}55, 0 4px 12px rgba(0,0,0,0.5)`,
      }}>{n}</span>
    )
    return (
      <div style={{ margin: '8px 0 6px' }}>
        <Shot name={g.shot} alt={g.alt} narrow t={t} dark={dark} accent={accent} onZoom={onZoom}>
          {g.marks.map(m => (
            <span key={m.n} style={{ position: 'absolute', left: `${m.x}%`, top: `${m.y}%`, transform: 'translate(-50%, -50%)' }}>{badge(m.n)}</span>
          ))}
        </Shot>
        <ol style={{ listStyle: 'none', padding: 0, margin: '4px 0 0', display: 'grid', gap: 10 }}>
          {g.items.map((s, i) => (
            <li key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              {badge(i + 1, 24)}
              <span style={{ ...body, margin: 0 }}><Rich text={s} t={t} /></span>
            </li>
          ))}
        </ol>
      </div>
    )
  }
  return null
}

// ── carta dell'indice ─────────────────────────────────────────────────────────
function IndexCard({ ch, n, t, dark, onGo }) {
  const accent = manaColor(ch.mana, dark)
  return (
    <a href={`#${ch.id}`} onClick={(e) => { e.preventDefault(); onGo(ch.id) }} className="ct-press"
      style={{
        flex: '0 0 auto', width: 118, aspectRatio: '63 / 88', borderRadius: 12, padding: 5, boxSizing: 'border-box',
        scrollSnapAlign: 'start', textDecoration: 'none', display: 'flex', flexDirection: 'column',
        background: `linear-gradient(160deg, ${accent}, ${accent}66 55%, ${accent}22)`,
        boxShadow: dark ? '0 10px 24px rgba(0,0,0,0.45)' : '0 8px 20px rgba(20,20,42,0.18)',
      }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '2px 4px 5px', color: '#0b0d1c' }}>
        <span style={{ flex: 1, minWidth: 0, fontSize: 11, fontWeight: 900, lineHeight: 1.15, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{ch.title}</span>
        <img src={`/mana/${ch.mana}.svg`} alt="" width={14} height={14} style={{ flexShrink: 0, borderRadius: '50%' }} />
      </span>
      <span style={{ flex: 1, borderRadius: 7, overflow: 'hidden', background: '#05060d', border: '1px solid rgba(0,0,0,0.35)' }}>
        <img src={IMG(ch.cover)} alt="" loading="lazy" decoding="async"
          onError={(e) => { e.currentTarget.style.visibility = 'hidden' }}
          style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top', display: 'block' }} />
      </span>
      <span style={{ fontSize: 10, fontWeight: 800, color: '#0b0d1c', padding: '4px 4px 0', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{n}/{CHAPTERS.length}</span>
    </a>
  )
}

export default function GuidaPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { t, dark } = useTheme()
  const { user } = useAuth()
  const [query, setQuery] = useState('')
  const [zoom, setZoom] = useState(null)
  const [openFaq, setOpenFaq] = useState(null)

  const indexed = useMemo(() => CHAPTERS.map((ch, i) => ({ ch, n: i + 1, text: norm(chapterText(ch)) })), [])
  const q = norm(query.trim())
  const visible = q ? indexed.filter(c => c.text.includes(q)) : indexed
  const faq = q ? FAQ.filter(([a, b]) => norm(a + ' ' + b).includes(q)) : FAQ

  const goTo = (id) => {
    const el = document.getElementById(id)
    if (!el) return
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
    history.replaceState(null, '', `#${id}`)
  }

  // /guida#tavoli → apre direttamente il capitolo
  useEffect(() => {
    const id = location.hash.slice(1)
    if (!id) return
    const tm = setTimeout(() => document.getElementById(id)?.scrollIntoView({ block: 'start' }), 120)
    return () => clearTimeout(tm)
  }, [location.hash])

  const anchor = { scrollMarginTop: 'calc(var(--sat, 0px) + var(--sat-gap, 0px) + 78px)' }

  return (
    <div style={{ maxWidth: 680, margin: '0 auto' }}>
      <button onClick={() => navigate(-1)} className="ct-press" style={{
        display: 'inline-flex', alignItems: 'center', gap: 8, minHeight: 40, padding: '0 14px', borderRadius: 12,
        border: `1px solid ${t.border}`, background: t.bgSurface, color: t.text, fontSize: 14, fontWeight: 700, cursor: 'pointer',
      }}>
        <Icon name="back" size={17} /> Indietro
      </button>

      {/* ── testata ── */}
      <header id="indice" style={{ ...anchor, margin: '22px 0 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <img src="/logo-192.webp" alt="" width={64} height={64} style={{ width: 64, height: 64, borderRadius: '50%', flexShrink: 0, boxShadow: dark ? `0 0 28px ${t.primary}40` : t.shadow }} />
          <div style={{ minWidth: 0 }}>
            <h1 style={{ margin: 0, fontSize: 'clamp(28px, 8vw, 40px)', lineHeight: 1.02, fontWeight: 900, letterSpacing: '-0.035em', color: t.text }}>
              Guida all’app
            </h1>
            <div style={{ fontSize: 15, color: t.textSub, marginTop: 6 }}>Commanderone Villastellone</div>
          </div>
        </div>
        <p style={{ color: t.textSub, fontSize: 16, lineHeight: 1.6, margin: '16px 0 0', maxWidth: 560 }}>
          Tutto quello che puoi fare, dal primo accesso al segnapunti in mezzo al tavolo. Scorri l’indice o cerca una parola.
        </p>

        <label style={{ position: 'relative', display: 'block', marginTop: 16 }}>
          <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: t.textMuted, display: 'flex' }}><Search size={18} /></span>
          <input
            type="search" value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Cerca: veleno, tavolo, avatar…" aria-label="Cerca nella guida"
            style={{
              width: '100%', boxSizing: 'border-box', minHeight: 48, padding: '0 44px', borderRadius: 14, fontSize: 16,
              border: `1px solid ${t.border}`, background: t.inputBg, color: t.text, outline: 'none',
            }}
          />
          {query && (
            <button type="button" onClick={() => setQuery('')} aria-label="Cancella ricerca" style={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)', width: 40, height: 40, border: 'none', background: 'transparent', color: t.textSub, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <X size={18} />
            </button>
          )}
        </label>
      </header>

      {/* ── indice: il mazzo dei capitoli ── */}
      {visible.length > 0 && (
        <nav aria-label="Capitoli della guida" className="ct-scroll-x" style={{
          display: 'flex', gap: 10, overflowX: 'auto', scrollSnapType: 'x mandatory', padding: '4px 2px 14px', margin: '0 -2px 8px',
        }}>
          {visible.map(({ ch, n }) => <IndexCard key={ch.id} ch={ch} n={n} t={t} dark={dark} onGo={goTo} />)}
        </nav>
      )}

      {q && visible.length === 0 && faq.length === 0 && (
        <div style={{ padding: '22px 16px', borderRadius: 16, border: `1px dashed ${t.borderStrong}`, color: t.textSub, fontSize: 15, textAlign: 'center', margin: '8px 0 24px' }}>
          Nessun capitolo parla di “{query.trim()}”. Prova con un’altra parola, per esempio <strong style={{ color: t.text }}>mazzo</strong> o <strong style={{ color: t.text }}>stagione</strong>.
        </div>
      )}

      {/* ── capitoli ── */}
      {visible.map(({ ch, n }) => {
        const accent = manaColor(ch.mana, dark)
        const route = routeFor(ch.id, user)
        return (
          <section key={ch.id} id={ch.id} aria-labelledby={`${ch.id}-t`} style={{
            ...anchor, marginTop: 30, padding: '22px 18px 18px', borderRadius: 24, position: 'relative',
            background: t.bgSurface, border: `1px solid ${t.border}`, boxShadow: t.shadow,
            backdropFilter: 'blur(14px) saturate(150%)', WebkitBackdropFilter: 'blur(14px) saturate(150%)',
          }}>
            <span aria-hidden="true" style={{ position: 'absolute', left: 18, right: 18, top: -1, height: 3, borderRadius: 3, background: `linear-gradient(90deg, ${accent}, transparent)` }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: accent, fontSize: 13, fontWeight: 800 }}>
              <img src={`/mana/${ch.mana}.svg`} alt="" width={20} height={20} style={{ borderRadius: '50%', boxShadow: '0 1px 3px rgba(0,0,0,0.4)' }} />
              Capitolo {n}
            </div>
            <h2 id={`${ch.id}-t`} style={{ margin: '8px 0 6px', fontSize: 'clamp(24px, 6.4vw, 30px)', lineHeight: 1.1, fontWeight: 900, letterSpacing: '-0.025em', color: t.text }}>
              {ch.title}
            </h2>
            <p style={{ margin: '0 0 6px', fontSize: 16.5, lineHeight: 1.55, color: t.text, opacity: 0.86 }}>{ch.lede}</p>

            {ch.blocks.map((b, i) => <Block key={i} b={b} t={t} dark={dark} accent={accent} onZoom={setZoom} />)}

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginTop: 18, paddingTop: 14, borderTop: `1px solid ${t.border}` }}>
              {route ? (
                <button onClick={() => navigate(route[0])} className="ct-press" style={{
                  minHeight: 44, padding: '0 16px', borderRadius: 14, border: `1px solid ${accent}`, background: 'transparent',
                  color: t.text, fontSize: 14.5, fontWeight: 800, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
                }}>
                  {route[1]} <Icon name="chevron" size={16} />
                </button>
              ) : <span />}
              <button onClick={() => goTo('indice')} className="ct-press" style={{
                minHeight: 44, padding: '0 12px', borderRadius: 14, border: 'none', background: 'transparent',
                color: t.textSub, fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
              }}>
                <ArrowUp size={16} /> Indice
              </button>
            </div>
          </section>
        )
      })}

      {/* ── domande frequenti ── */}
      {faq.length > 0 && (
        <section id="faq" aria-labelledby="faq-t" style={{ ...anchor, marginTop: 40 }}>
          <h2 id="faq-t" style={{ margin: '0 0 12px', fontSize: 'clamp(24px, 6.4vw, 30px)', fontWeight: 900, letterSpacing: '-0.025em', color: t.text }}>Domande frequenti</h2>
          <div style={{ borderRadius: 20, border: `1px solid ${t.border}`, background: t.bgSurface, overflow: 'hidden' }}>
            {faq.map(([qq, a], i) => {
              const open = openFaq === qq
              return (
                <div key={qq} style={{ borderTop: i ? `1px solid ${t.border}` : 'none' }}>
                  <button onClick={() => setOpenFaq(open ? null : qq)} aria-expanded={open} style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '15px 16px', minHeight: 54,
                    background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', color: t.text, fontSize: 15.5, fontWeight: 700,
                  }}>
                    <span style={{ flex: 1 }}>{qq}</span>
                    <ChevronDown size={18} style={{ flexShrink: 0, color: t.textMuted, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
                  </button>
                  {open && <p className="ct-section-open" style={{ margin: 0, padding: '0 16px 16px', color: t.textSub, fontSize: 15, lineHeight: 1.6 }}>{a}</p>}
                </div>
              )
            })}
          </div>
        </section>
      )}

      <p style={{ textAlign: 'center', color: t.textMuted, fontSize: 14, margin: '32px 0 8px' }}>
        Buone partite, e che vinca il mazzo migliore. 🐸
      </p>

      {/* ── zoom immagine ── */}
      <Dialog.Root open={!!zoom} onOpenChange={(o) => { if (!o) setZoom(null) }}>
        <Dialog.Portal>
          <Dialog.Overlay style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(3,4,12,0.88)', backdropFilter: 'blur(6px)' }} />
          <Dialog.Content aria-describedby={undefined} className="ct-modal-in" onClick={() => setZoom(null)} style={{
            position: 'fixed', inset: 0, zIndex: 81, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            padding: 'calc(var(--sat, 0px) + 56px) 16px calc(16px + env(safe-area-inset-bottom))', boxSizing: 'border-box', outline: 'none', cursor: 'zoom-out',
          }}>
            <Dialog.Title style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>{zoom?.alt}</Dialog.Title>
            <Dialog.Close aria-label="Chiudi" style={{
              position: 'absolute', top: 'calc(var(--sat, 0px) + 8px)', right: 12, width: 44, height: 44, borderRadius: 14,
              border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.08)', color: '#fff', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}><X size={20} /></Dialog.Close>
            {zoom && (
              <>
                <img src={IMG(zoom.name)} alt={zoom.alt} style={{ maxWidth: '100%', maxHeight: '100%', minHeight: 0, objectFit: 'contain', borderRadius: 16, boxShadow: '0 20px 60px rgba(0,0,0,0.6)' }} />
                {zoom.caption && <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14, marginTop: 12, textAlign: 'center', maxWidth: 420 }}>{zoom.caption}</div>}
              </>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}
