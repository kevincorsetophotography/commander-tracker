// Primitive UI condivise dal restyle v2 (nav a pillola, Feed, Registra partita).
// Icone lucide-react, stili inline.

import {
  Rows3, CalendarDays, Swords, Users, User, Bell, Sun, Moon, BookOpen, ShieldCheck, LogOut, Layers,
  MapPin, Check, Trophy, ChevronRight, X, MessageCircle, Flame, ChartColumn, Sparkles, Plus, Skull,
} from 'lucide-react'

// Nomi stabili usati nel codice → icone lucide (tree-shaken: entrano nel bundle solo queste).
const ICONS = {
  feed: Rows3, calendar: CalendarDays, swords: Swords, groups: Users, person: User, bell: Bell,
  sun: Sun, moon: Moon, book: BookOpen, shield: ShieldCheck, logout: LogOut, cards: Layers,
  pin: MapPin, check: Check, trophy: Trophy, chevron: ChevronRight, close: X, comment: MessageCircle,
  flame: Flame, chart: ChartColumn, sparkle: Sparkles, plus: Plus, skull: Skull,
}

export function Icon({ name, size = 22, stroke = 1.9, style }) {
  const C = ICONS[name]
  if (!C) return null
  return <C size={size} strokeWidth={stroke} aria-hidden="true" style={{ flexShrink: 0, ...style }} />
}

// Pip di mana con la lettera (W U B R G). Colori fissi: sono l'identità del mazzo, non del tema.
const MANA = {
  W: { bg: '#F8F6D8', fg: '#2a2618' },
  U: { bg: '#3B82F6', fg: '#fff' },
  B: { bg: '#2B2533', fg: '#E8E2F0', ring: 'rgba(232,226,240,0.45)' },
  R: { bg: '#EF4444', fg: '#fff' },
  G: { bg: '#16A34A', fg: '#fff' },
}

export function ManaPips({ colors, size = 18 }) {
  const list = (colors || '').toUpperCase().split('').filter(c => MANA[c])
  if (!list.length) return null
  return (
    <span style={{ display: 'inline-flex', gap: 3, flexShrink: 0 }} aria-label={`Colori: ${list.join(' ')}`}>
      {list.map((c, i) => (
        <span key={i} style={{
          width: size, height: size, borderRadius: '50%', background: MANA[c].bg, color: MANA[c].fg,
          border: `1px solid ${MANA[c].ring || 'rgba(0,0,0,0.25)'}`,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          fontSize: Math.max(10, Math.round(size * 0.58)), fontWeight: 800, lineHeight: 1,
        }}>{c}</span>
      ))}
    </span>
  )
}

// Anello percentuale (win rate). Si riempie al mount (stroke-dashoffset animato).
export function Ring({ pct, size = 64, stroke = 6, color, track, label }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const off = c * (1 - Math.max(0, Math.min(100, pct)) / 100)
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle className="ct-ring-fill" cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color}
          strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c}
          style={{ strokeDashoffset: off, '--ct-ring-from': c }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: Math.round(size * 0.24), fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
        {label ?? `${pct}%`}
      </div>
    </div>
  )
}

// Superficie "bento" condivisa (card).
export const bento = (t, extra = {}) => ({
  background: t.bgSurface,
  backdropFilter: 'blur(14px) saturate(150%)',
  WebkitBackdropFilter: 'blur(14px) saturate(150%)',
  border: `1px solid ${t.border}`,
  borderRadius: 20,
  boxShadow: t.shadow,
  ...extra,
})

// Etichetta di sezione (≥12px, maiuscoletto).
export function SectionLabel({ t, icon, children, right }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: t.textSub }}>
        {icon && <span style={{ color: t.primary, display: 'flex' }}><Icon name={icon} size={16} /></span>}
        {children}
      </div>
      {right}
    </div>
  )
}
