import { useTheme } from '../hooks/useTheme'

const artUrl = (name) =>
  `https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(name)}&format=image&version=art_crop`

/**
 * Miniatura del commander (art_crop di Scryfall) usata ovunque appaia un mazzo.
 * props: commander (nome), w (larghezza px), radius, round (cerchio invece di landscape)
 */
export default function DeckThumb({ commander, w = 56, radius = 8, round = false }) {
  const { t } = useTheme()
  const h = round ? w : Math.round(w * 0.72)
  const r = round ? '50%' : radius

  const base = {
    width: w, height: h, borderRadius: r, flexShrink: 0,
    objectFit: 'cover', objectPosition: 'center top', display: 'block',
  }

  if (!commander) {
    return (
      <div style={{
        ...base, background: t.bgMuted, border: `1px solid ${t.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: Math.max(10, w * 0.4),
      }}>🎴</div>
    )
  }

  return (
    <img
      src={artUrl(commander)}
      alt=""
      title={commander}
      loading="lazy"
      onError={e => {
        e.currentTarget.onerror = null
        e.currentTarget.replaceWith(Object.assign(document.createElement('div'), {
          style: `width:${w}px;height:${h}px;border-radius:${typeof r === 'string' ? r : r + 'px'};background:${t.bgMuted};display:flex;align-items:center;justify-content:center;font-size:${Math.max(10, w * 0.4)}px;flex-shrink:0`,
          textContent: '🎴',
        }))
      }}
      style={base}
    />
  )
}
