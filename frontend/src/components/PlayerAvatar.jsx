import { useState } from 'react'
import { useTheme } from '../hooks/useTheme'
import { useCardArt } from '../lib/cardCache'
import { useDefaultAvatar } from '../lib/defaultAvatars'

const cdnArt = (id) =>
  `https://cards.scryfall.io/art_crop/front/${id[0]}/${id[1]}/${id}.jpg`

const scryfallArt = (name) =>
  `https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(name)}&format=image&version=art_crop`

export default function PlayerAvatar({ username, avatarCardName, avatarScryfallId, size = 32, highlight = false }) {
  const { t } = useTheme()
  const [errSrc, setErrSrc] = useState(null)

  // Avatar scelto dall'utente: ha sempre la precedenza. Con l'id Scryfall è un URL CDN
  // diretto; col solo nome passa dalla cache carte (URL CDN salvato), non dall'API a ogni avatar.
  const chosenSrc = avatarScryfallId ? cdnArt(avatarScryfallId) : null

  // Nessuna scelta: commander più giocato (o creato per ultimo), risolto via cache Scryfall
  const defaultCmd = useDefaultAvatar(avatarScryfallId || avatarCardName ? null : username)
  const cardName = chosenSrc ? null : (avatarCardName || defaultCmd)
  const art = useCardArt(cardName)
  const cardSrc = !cardName ? null
    : art.status === 'ready' ? art.art
    : art.status === 'missing' ? scryfallArt(cardName)
    : null // in risoluzione: per un attimo restano le iniziali

  const imgSrc = chosenSrc || cardSrc
  const showImg = !!imgSrc && errSrc !== imgSrc

  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
      background: showImg ? '#1a1a2e' : (highlight ? t.primary : t.primaryBg),
      border: `1px solid ${highlight ? t.primaryBorder : t.primaryBorder}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: highlight && showImg ? `0 0 0 2px ${t.primary}` : 'none',
    }}>
      {showImg
        ? <img
            src={imgSrc}
            alt={username}
            title={!chosenSrc && !avatarCardName && defaultCmd ? defaultCmd : undefined}
            style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 15%' }}
            onError={() => setErrSrc(imgSrc)}
          />
        : <span style={{
            fontSize: size * 0.4, fontWeight: 700,
            color: highlight ? t.primaryFg : t.primary,
            textTransform: 'uppercase', userSelect: 'none', lineHeight: 1,
          }}>
            {(username || '?').substring(0, 2)}
          </span>
      }
    </div>
  )
}
