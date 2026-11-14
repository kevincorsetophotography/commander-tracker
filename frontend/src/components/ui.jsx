// Primitive UI condivise dal restyle v2 (nav a pillola, Feed, Registra partita).
// Solo SVG inline e stili inline: nessuna dipendenza esterna.

const PATHS = {
  feed: <><rect x="3" y="4" width="18" height="6" rx="2" /><rect x="3" y="14" width="18" height="6" rx="2" /></>,
  calendar: <><rect x="3" y="4.5" width="18" height="16.5" rx="2.5" /><line x1="16" y1="2.5" x2="16" y2="6.5" /><line x1="8" y1="2.5" x2="8" y2="6.5" /><line x1="3" y1="10" x2="21" y2="10" /></>,
  swords: <><path d="M14.5 17.5 3 6V3h3l11.5 11.5" /><line x1="13" y1="19" x2="19" y2="13" /><line x1="16" y1="16" x2="20" y2="20" /><line x1="19" y1="21" x2="21" y2="19" /><path d="M14.5 6.5 18 3h3v3l-3.5 3.5" /><line x1="5" y1="14" x2="9" y2="18" /><line x1="7" y1="17" x2="4" y2="20" /><line x1="3" y1="19" x2="5" y2="21" /></>,
  groups: <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>,
  person: <><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></>,
  bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></>,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" /></>,
  moon: <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />,
  book: <><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></>,
  shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />,
  logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></>,
  cards: <><rect x="7" y="3" width="12" height="16" rx="2" /><path d="M5 7v12a2 2 0 0 0 2 2h9" /></>,
  pin: <><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></>,
  check: <polyline points="20 6 9 17 4 12" />,
  trophy: <><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4z" /><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3" /></>,
  chevron: <polyline points="9 18 15 12 9 6" />,
  close: <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>,
  comment: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />,
  flame: <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z" />,
  chart: <><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></>,
  sparkle: <path d="M12 3l1.9 5.6L19.5 10.5l-5.6 1.9L12 18l-1.9-5.6L4.5 10.5l5.6-1.9z" />,
  plus: <><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></>,
  skull: <><circle cx="9" cy="12" r="1" /><circle cx="15" cy="12" r="1" /><path d="M8 20v2h8v-2M12.5 17l-.5-1-.5 1h1z" /><path d="M16 20a2 2 0 0 0 1.56-3.25 8 8 0 1 0-11.12 0A2 2 0 0 0 8 20" /></>,
}

export function Icon({ name, size = 22, stroke = 1.9, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0, ...style }}>
      {PATHS[name]}
    </svg>
  )
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
