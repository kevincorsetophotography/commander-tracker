import { useNavigate } from 'react-router-dom'
import { useTheme } from '../hooks/useTheme'

export default function GiocaPage() {
  const { t } = useTheme()
  const navigate = useNavigate()

  const card = (icon, title, sub, to) => (
    <button
      onClick={() => navigate(to)}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        width: '100%', textAlign: 'left',
        background: t.bgSurface,
        backdropFilter: 'blur(14px) saturate(150%)',
        WebkitBackdropFilter: 'blur(14px) saturate(150%)',
        border: `1px solid ${t.border}`,
        borderRadius: 18,
        padding: '1.6rem 1.5rem',
        boxShadow: t.shadow,
        cursor: 'pointer',
        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = t.shadowHover || t.shadow }}
      onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = t.shadow }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.1rem' }}>
        <span style={{
          fontSize: 38, lineHeight: 1,
          width: 64, height: 64, borderRadius: 16,
          background: t.primaryBg,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          {icon}
        </span>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: t.text, marginBottom: 4 }}>{title}</div>
          <div style={{ fontSize: 13, color: t.textSub }}>{sub}</div>
        </div>
      </div>
      <span style={{ fontSize: 22, color: t.primary, fontWeight: 700, flexShrink: 0 }}>›</span>
    </button>
  )

  return (
    <div style={{ maxWidth: 520, margin: '0 auto' }}>
      <div style={{ fontSize: 22, fontWeight: 800, color: t.text, marginBottom: 6 }}>Gioca</div>
      <div style={{ fontSize: 14, color: t.textSub, marginBottom: '2rem' }}>
        Cosa vuoi fare stasera?
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {card('⚖', 'Judge Bot', 'Ruling Commander · Comprehensive Rules + Scryfall', '/giudice')}
        {card('＋', 'Registra Partita', 'Aggiungi il risultato di una partita appena finita', '/nuova-partita')}
      </div>
    </div>
  )
}
