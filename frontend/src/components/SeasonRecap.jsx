import { useRef, useMemo, useEffect, useState } from 'react'
import html2canvas from 'html2canvas'
import { useTheme } from '../hooks/useTheme'
import { seasonOf } from '../lib/seasons'

// ─── brand palette (infografica sempre dark, indipendente dal tema) ─────────
const C = {
  bg:      '#080A1C',
  surface: '#0D1020',
  card:    '#111524',
  border:  'rgba(86,94,150,0.28)',
  text:    '#ECEDFB',
  sub:     '#929BC4',
  muted:   '#5A6391',
  green:   '#34F08F',
  purple:  '#8B5CF6',
  gold:    '#F5C542',
  silver:  '#A8B2CC',
  bronze:  '#C87F4A',
  gradGP:  'linear-gradient(135deg, #34F08F 0%, #8B5CF6 100%)',
  gradGold:'linear-gradient(135deg, #2C2000 0%, #1A1500 100%)',
}

const SCRYFALL_ART = (name) =>
  `https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(name)}&format=image&version=art_crop`

// ─── utils ──────────────────────────────────────────────────────────────────

function blobToDataUrl(blob) {
  return new Promise(res => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(blob) })
}

async function fetchDataUrl(url) {
  const r = await fetch(url, { mode: 'cors' })
  return blobToDataUrl(await r.blob())
}

function hue(name = '') {
  return [...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) & 0xffffff, 0) % 360
}

// ─── sub-components dell'infografica ────────────────────────────────────────

function AvatarCircle({ src, name, size, borderColor = 'rgba(255,255,255,0.15)', ring }) {
  const initials = (name || '?').slice(0, 2).toUpperCase()
  const bg = `hsl(${hue(name)},52%,33%)`
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0, overflow: 'hidden',
      border: `2px solid ${ring || borderColor}`,
      boxShadow: ring ? `0 0 0 2px ${ring}44` : 'none',
      background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {src
        ? <img src={src} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 15%' }} />
        : <span style={{ fontSize: size * 0.36, fontWeight: 800, color: '#fff' }}>{initials}</span>
      }
    </div>
  )
}

function DotRow({ label, value, color = C.text }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, gap: 8 }}>
      <span style={{ fontSize: 12, color: C.sub }}>{label}</span>
      <div style={{ flex: 1, borderBottom: `1px dashed ${C.border}`, margin: '0 6px', marginBottom: 2 }} />
      <span style={{ fontSize: 12, fontWeight: 700, color, flexShrink: 0 }}>{value}</span>
    </div>
  )
}

// ─── corpo infografica (catturato da html2canvas) ────────────────────────────

function SeasonCard({ season, seasonLabel, seasonGames, top3, spotlightDeck, topStreak, topKiller, avgTable, uniquePlayers, imgUrls, statsMap }) {
  const champion = top3[0]
  const second   = top3[1]
  const third    = top3[2]

  const primati = [
    topStreak?.best > 1 && { icon: '🔥', label: 'Streak', value: `${topStreak.username} (${topStreak.best})` },
    topKiller          && { icon: '⚔️', label: 'Più spietato', value: `${topKiller[0]} (${topKiller[1]} kill)` },
    champion           && { icon: '📈', label: 'Top win rate', value: `${champion.username} (${champion.games ? Math.round(champion.wins / champion.games * 100) : 0}%)` },
    season.standings.length > 0 && (() => { const mp = [...season.standings].sort((a,b)=>b.games-a.games)[0]; return { icon: '🎮', label: 'Più presente', value: `${mp.username} (${mp.games} gg)` } })(),
  ].filter(Boolean)

  const gap = 10

  return (
    <div style={{ width: 420, background: C.bg, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', color: C.text, overflow: 'hidden' }}>

      {/* accent bar */}
      <div style={{ height: 4, background: C.gradGP }} />

      {/* header */}
      <div style={{ padding: '18px 20px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${C.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src="/logo.png" alt="logo" style={{ width: 36, height: 36, objectFit: 'contain' }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 900, letterSpacing: '0.12em', color: C.green, textTransform: 'uppercase', lineHeight: 1 }}>Commanderone</div>
            <div style={{ fontSize: 10, color: C.sub, letterSpacing: '0.08em', marginTop: 2 }}>Villastellone</div>
          </div>
        </div>
        <div style={{
          padding: '5px 12px', borderRadius: 20, fontSize: 10, fontWeight: 800, letterSpacing: '0.1em',
          background: 'rgba(52,240,143,0.12)', border: `1px solid rgba(52,240,143,0.35)`, color: C.green,
          textTransform: 'uppercase',
        }}>
          Recap Stagione
        </div>
      </div>

      {/* season label */}
      <div style={{ padding: '10px 20px 0', fontSize: 18, fontWeight: 900, color: C.text }}>{seasonLabel}</div>
      <div style={{ padding: '2px 20px 16px', fontSize: 11, color: C.muted }}>{seasonGames.length} partite disputate</div>

      <div style={{ padding: `0 ${gap}px ${gap}px` }}>

        {/* champion */}
        {champion && (
          <div style={{
            borderRadius: 16, overflow: 'hidden', marginBottom: gap,
            background: C.gradGold, border: `1px solid ${C.gold}44`,
            boxShadow: `0 0 32px ${C.gold}18`,
          }}>
            <div style={{ padding: '10px 16px 6px', fontSize: 9, fontWeight: 800, letterSpacing: '0.2em', color: C.gold, textTransform: 'uppercase' }}>
              🏆 Campione Stagionale
            </div>
            <div style={{ padding: '6px 16px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
              <AvatarCircle
                src={imgUrls[`player_${champion.id}`]}
                name={champion.username}
                size={64}
                ring={C.gold}
              />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 26, fontWeight: 900, color: C.text, lineHeight: 1 }}>{champion.username}</div>
                <div style={{ fontSize: 12, color: C.sub, marginTop: 5 }}>
                  {champion.wins} vitt. · {champion.games ? Math.round(champion.wins / champion.games * 100) : 0}% win rate · {champion.games} partite
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 42, fontWeight: 900, color: C.gold, lineHeight: 1, filter: `drop-shadow(0 0 12px ${C.gold}88)` }}>{champion.points}</div>
                <div style={{ fontSize: 9, color: C.sub, letterSpacing: '0.08em', textTransform: 'uppercase' }}>punti</div>
              </div>
            </div>
          </div>
        )}

        {/* podio 2°/3° */}
        {(second || third) && (
          <div style={{ display: 'flex', gap: gap, marginBottom: gap }}>
            {[{ p: second, medal: '🥈', col: C.silver }, { p: third, medal: '🥉', col: C.bronze }].map(({ p, medal, col }) => p && (
              <div key={p.id} style={{
                flex: 1, borderRadius: 14, padding: '12px 14px',
                background: C.card, border: `1px solid ${C.border}`,
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <AvatarCircle
                  src={imgUrls[`player_${p.id}`]}
                  name={p.username}
                  size={44}
                  ring={col}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: col, textTransform: 'uppercase', letterSpacing: '0.12em' }}>{medal} {p === second ? '2° posto' : '3° posto'}</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.username}</div>
                  <div style={{ fontSize: 11, color: C.sub }}>{p.points} pt · {p.wins} vittorie</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* deck spotlight */}
        {spotlightDeck && (
          <div style={{ borderRadius: 16, overflow: 'hidden', marginBottom: gap, position: 'relative', minHeight: 130 }}>
            {/* commander art background */}
            {imgUrls.deck
              ? <img src={imgUrls.deck} alt={spotlightDeck.commander} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 20%' }} />
              : <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(135deg, ${C.purple}33, ${C.green}22)` }} />
            }
            {/* gradient overlay */}
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(8,10,28,0.95) 30%, rgba(8,10,28,0.55) 70%, rgba(8,10,28,0.35) 100%)' }} />
            {/* label top */}
            <div style={{ position: 'relative', padding: '10px 14px 0', fontSize: 9, fontWeight: 800, letterSpacing: '0.2em', color: C.green, textTransform: 'uppercase' }}>
              ✨ Deck della Stagione
            </div>
            {/* content bottom */}
            <div style={{ position: 'relative', padding: '8px 14px 14px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 50 }}>
              <div>
                <div style={{ fontSize: 22, fontWeight: 900, color: C.text, lineHeight: 1 }}>{spotlightDeck.name}</div>
                <div style={{ fontSize: 11, color: C.sub, marginTop: 3 }}>{spotlightDeck.commander}</div>
                <div style={{ fontSize: 11, color: C.sub }}>di {spotlightDeck.owner} · {spotlightDeck.games} partite</div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 36, fontWeight: 900, color: C.green, lineHeight: 1, filter: `drop-shadow(0 0 10px ${C.green}88)` }}>{spotlightDeck.winRate}%</div>
                <div style={{ fontSize: 9, color: C.sub, textTransform: 'uppercase', letterSpacing: '0.08em' }}>win rate</div>
              </div>
            </div>
          </div>
        )}

        {/* stats row */}
        <div style={{ display: 'flex', gap: gap, marginBottom: gap }}>
          {[
            { val: seasonGames.length, label: 'Partite' },
            { val: uniquePlayers,      label: 'Giocatori' },
            { val: avgTable,           label: 'Media tavolo' },
          ].map(({ val, label }) => (
            <div key={label} style={{ flex: 1, borderRadius: 12, padding: '12px 8px', textAlign: 'center', background: C.card, border: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 26, fontWeight: 900, color: C.text, lineHeight: 1 }}>{val}</div>
              <div style={{ fontSize: 9, color: C.muted, marginTop: 5, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
            </div>
          ))}
        </div>

        {/* primati */}
        {primati.length > 0 && (
          <div style={{ borderRadius: 14, padding: '12px 16px', background: C.card, border: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.2em', color: C.muted, textTransform: 'uppercase', marginBottom: 10 }}>Primati</div>
            {primati.map(({ icon, label, value }) => (
              <DotRow key={label} label={`${icon}  ${label}`} value={value} />
            ))}
          </div>
        )}

        {/* footer */}
        <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 9, color: C.muted, letterSpacing: '0.08em' }}>commanderone · villastellone</div>
          <div style={{ height: 1, flex: 1, margin: '0 10px', background: C.border }} />
          <div style={{ fontSize: 9, color: C.muted }}>{seasonLabel}</div>
        </div>

      </div>
    </div>
  )
}

// ─── compute stagione ───────────────────────────────────────────────────────

function computeSeasonData(games, seasonKey) {
  const seasonGames = games.filter(g => seasonOf(g.playedAt).key === seasonKey)

  const deckTally = {}
  const killTally = {}
  for (const g of seasonGames) {
    for (const p of g.players) {
      if (!deckTally[p.deck.id]) deckTally[p.deck.id] = { id: p.deck.id, name: p.deck.name, commander: p.deck.commander, colors: p.deck.colors || '', owner: p.user.username, games: 0, wins: 0 }
      deckTally[p.deck.id].games++
      if (p.isWinner) deckTally[p.deck.id].wins++

      if (p.eliminatedById) {
        const killer = g.players.find(x => x.user.id === p.eliminatedById)
        if (killer) killTally[killer.user.username] = (killTally[killer.user.username] || 0) + 1
      }
    }
  }

  const spotlightDeck = Object.values(deckTally)
    .filter(d => d.games >= 3)
    .map(d => ({ ...d, winRate: Math.round(d.wins / d.games * 100) }))
    .sort((a, b) => b.winRate - a.winRate || b.wins - a.wins)[0] || null

  const sorted = [...seasonGames].sort((a, b) => new Date(a.playedAt) - new Date(b.playedAt))
  const streakMap = {}
  for (const g of sorted) {
    for (const p of g.players) {
      if (!streakMap[p.user.id]) streakMap[p.user.id] = { username: p.user.username, cur: 0, best: 0 }
      const r = streakMap[p.user.id]
      if (p.isWinner) { r.cur++; r.best = Math.max(r.best, r.cur) } else r.cur = 0
    }
  }
  const topStreak = Object.values(streakMap).sort((a, b) => b.best - a.best)[0] || null
  const topKiller = Object.entries(killTally).sort((a, b) => b[1] - a[1])[0] || null
  const avgTable = seasonGames.length ? (seasonGames.reduce((s, g) => s + g.players.length, 0) / seasonGames.length).toFixed(1) : '–'
  const uniquePlayers = new Set(seasonGames.flatMap(g => g.players.map(p => p.user.id))).size

  return { seasonGames, spotlightDeck, topStreak, topKiller, avgTable, uniquePlayers }
}

// ─── modal wrapper ───────────────────────────────────────────────────────────

export default function SeasonRecap({ season, seasonKey, seasons, games, playerStats, onClose }) {
  const { t } = useTheme()
  const recapRef = useRef(null)
  const [imgUrls, setImgUrls] = useState({})
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)

  const seasonMeta = seasons.find(s => s.key === seasonKey)
  const seasonLabel = seasonMeta?.label || seasonKey

  const { seasonGames, spotlightDeck, topStreak, topKiller, avgTable, uniquePlayers } =
    useMemo(() => computeSeasonData(games, seasonKey), [games, seasonKey])

  const top3 = season.standings.filter(s => s.qualified).slice(0, 3)
  const statsMap = useMemo(() => Object.fromEntries((playerStats || []).map(p => [p.id, p])), [playerStats])

  // Pre-carica tutte le immagini come data URL → html2canvas le cattura senza CORS
  useEffect(() => {
    setLoading(true)
    setImgUrls({})

    const toLoad = {}
    for (const s of top3) {
      const ps = statsMap[s.id]
      if (ps?.avatarCardName) toLoad[`player_${s.id}`] = SCRYFALL_ART(ps.avatarCardName)
    }
    if (spotlightDeck?.commander) toLoad.deck = SCRYFALL_ART(spotlightDeck.commander)

    Promise.allSettled(
      Object.entries(toLoad).map(([key, url]) =>
        fetchDataUrl(url).then(du => [key, du]).catch(() => [key, null])
      )
    ).then(results => {
      const loaded = {}
      for (const r of results) if (r.status === 'fulfilled' && r.value[1]) loaded[r.value[0]] = r.value[1]
      setImgUrls(loaded)
      setLoading(false)
    })
  }, [seasonKey])

  async function handleDownload() {
    if (!recapRef.current || downloading) return
    setDownloading(true)
    try {
      const canvas = await html2canvas(recapRef.current, {
        scale: 2,
        backgroundColor: C.bg,
        useCORS: false,   // data URLs già embedded, niente CORS
        logging: false,
        imageTimeout: 0,
      })
      const link = document.createElement('a')
      link.download = `commanderone-${seasonKey}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
    } finally {
      setDownloading(false)
    }
  }

  const cardProps = { season, seasonLabel, seasonGames, top3, spotlightDeck, topStreak, topKiller, avgTable, uniquePlayers, imgUrls, statsMap }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        overflowY: 'auto', padding: '20px 12px 40px',
      }}
    >
      <div onClick={e => e.stopPropagation()} className="ct-modal-in" style={{ width: '100%', maxWidth: 450 }}>

        {/* barra azioni */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: t.text }}>Infografica Stagione</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handleDownload}
              disabled={loading || downloading}
              style={{
                padding: '8px 16px', borderRadius: 20, border: 'none',
                background: loading || downloading ? t.bgMuted : t.primary,
                color: loading || downloading ? t.textMuted : '#04111A',
                fontWeight: 800, fontSize: 13, cursor: loading || downloading ? 'default' : 'pointer',
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              {downloading ? '⏳ Download…' : loading ? '⏳ Caricamento…' : '⬇ Scarica PNG'}
            </button>
            <button
              onClick={onClose}
              style={{
                width: 36, height: 36, borderRadius: '50%', border: `1px solid ${t.border}`,
                background: t.bgSurface, color: t.text, fontSize: 18, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >×</button>
          </div>
        </div>

        {/* infografica — scroll orizzontale se più larga del viewport */}
        <div style={{ overflowX: 'auto', borderRadius: 18, boxShadow: '0 12px 48px rgba(0,0,0,0.7)' }}>
          <div ref={recapRef} style={{ display: 'inline-block' }}>
            <SeasonCard {...cardProps} />
          </div>
        </div>

        <p style={{ textAlign: 'center', fontSize: 11, color: t.textMuted, marginTop: 10 }}>
          Tocca fuori per chiudere
        </p>
      </div>
    </div>
  )
}
