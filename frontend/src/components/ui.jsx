// Primitive UI condivise dal restyle v2 (nav, Feed, Registra partita, Eventi, Gruppo).
// Icone lucide-react, stili inline.

import {
  Rows3, CalendarDays, Swords, Users, User, Bell, Sun, Moon, BookOpen, ShieldCheck, LogOut, Layers,
  MapPin, Check, Trophy, ChevronRight, X, MessageCircle, Flame, ChartColumn, Sparkles, Plus, Skull,
  Pencil, Trash2, Clock, Crown, Medal, Shuffle, ArrowLeft,
} from 'lucide-react'
import * as Dialog from '@radix-ui/react-dialog'

// Nomi stabili usati nel codice → icone lucide (tree-shaken: entrano nel bundle solo queste).
const ICONS = {
  feed: Rows3, calendar: CalendarDays, swords: Swords, groups: Users, person: User, bell: Bell,
  sun: Sun, moon: Moon, book: BookOpen, shield: ShieldCheck, logout: LogOut, cards: Layers,
  pin: MapPin, check: Check, trophy: Trophy, chevron: ChevronRight, close: X, comment: MessageCircle,
  flame: Flame, chart: ChartColumn, sparkle: Sparkles, plus: Plus, skull: Skull,
  edit: Pencil, trash: Trash2, clock: Clock, crown: Crown, medal: Medal, shuffle: Shuffle, back: ArrowLeft,
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

// Pannello modale accessibile (Radix Dialog): dal basso su mobile, centrato su desktop.
export function Sheet({ open, onOpenChange, title, children, t, dark, isMobile, maxWidth = 520 }) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(4,6,18,0.62)', backdropFilter: 'blur(3px)' }} />
        <Dialog.Content aria-describedby={undefined} className={isMobile ? 'ct-sheet-in' : 'ct-modal-in'} style={{
          position: 'fixed', zIndex: 61, boxSizing: 'border-box', outline: 'none', overflowY: 'auto',
          background: dark ? '#0e122b' : '#FFFFFF', border: `1px solid ${t.border}`,
          boxShadow: '0 -12px 40px rgba(0,0,0,0.45)',
          ...(isMobile
            ? { left: 0, right: 0, bottom: 0, maxHeight: '92vh', borderRadius: '24px 24px 0 0', borderBottom: 'none', padding: '4px 16px calc(20px + env(safe-area-inset-bottom))' }
            : { left: '50%', top: '50%', transform: 'translate(-50%, -50%)', width: 'calc(100vw - 32px)', maxWidth, maxHeight: '90vh', borderRadius: 22, padding: '8px 22px 22px' }),
        }}>
          {isMobile && <div style={{ width: 40, height: 4, borderRadius: 4, background: t.borderStrong, margin: '8px auto 2px' }} />}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '10px 0 12px' }}>
            <Dialog.Title style={{ margin: 0, fontSize: 19, fontWeight: 800, color: t.text }}>{title}</Dialog.Title>
            <Dialog.Close aria-label="Chiudi" style={{ width: 44, height: 44, border: 'none', borderRadius: 12, background: 'transparent', color: t.textSub, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="close" size={21} />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

// Segmented control (tab a pillola).
export function Segmented({ t, value, onChange, options }) {
  return (
    <div role="tablist" className="ct-scroll-x" style={{ display: 'flex', gap: 4, padding: 4, borderRadius: 16, background: t.bgSurfaceAlt, border: `1px solid ${t.border}`, overflowX: 'auto' }}>
      {options.map(o => {
        const active = o.value === value
        return (
          <button key={o.value} role="tab" aria-selected={active} onClick={() => onChange(o.value)} className="ct-press" style={{
            flex: '1 0 auto', minHeight: 42, borderRadius: 12, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700,
            background: active ? t.primary : 'transparent', color: active ? t.primaryFg : t.textSub,
            boxShadow: active ? t.glow : 'none', transition: 'all 0.18s ease', whiteSpace: 'nowrap', padding: '0 10px',
          }}>
            {o.label}{o.count != null && <span style={{ marginLeft: 6, opacity: 0.75 }}>{o.count}</span>}
          </button>
        )
      })}
    </div>
  )
}

// Avatar sovrapposti.
export function AvatarStack({ users, size = 30, max = 5, ring, PlayerAvatar }) {
  const shown = users.slice(0, max)
  const extra = users.length - shown.length
  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      {shown.map((u, i) => (
        <div key={u.id ?? i} style={{ marginLeft: i ? -size / 3 : 0, borderRadius: '50%', boxShadow: `0 0 0 2px ${ring}` }}>
          <PlayerAvatar username={u.username} avatarCardName={u.avatarCardName} avatarScryfallId={u.avatarScryfallId} size={size} />
        </div>
      ))}
      {extra > 0 && (
        <span style={{ marginLeft: -size / 3, width: size, height: size, borderRadius: '50%', boxShadow: `0 0 0 2px ${ring}`, background: '#8B5CF6', color: '#fff', fontSize: 12, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+{extra}</span>
      )}
    </div>
  )
}
