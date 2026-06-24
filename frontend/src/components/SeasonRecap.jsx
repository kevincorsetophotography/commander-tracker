import { useRef, useMemo } from 'react'
import html2canvas from 'html2canvas'
import { useTheme } from '../hooks/useTheme'
import { seasonOf } from '../lib/seasons'

// ─── helpers ────────────────────────────────────────────────

const COLOR_GRADIENTS = {
  W: '#f5f0c0', U: '#4a90d9', B: '#9b59b6', R: '#e74c3c', G: '#27ae60',
}

function colorsToGradient(colors = '') {
  const cols = [...new Set(colors.split('').filter(c => COLOR_GRADIENTS[c]))]
  if (cols.length === 0) return 'linear-gradient(135deg, #34f08f22, #1a8c5322)'
  if (cols.length === 1) return `linear-gradient(135deg, ${COLOR_GRADIENTS[cols[0]]}44, ${COLOR_GRADIENTS[cols[0]]}11)`
  return `linear-gradient(135deg, ${cols.map((c, i) => `${COLOR_GRADIENTS[c]}${i === 0 ? '55' : '33'}`).join(', ')})`
}

function InitialsAvatar({ name, size = 36, fontSize = 14 }) {
  const initials = (name || '?').slice(0, 2).toUpperCase()
  const hue = [...(name || '')].reduce((h, c) => (h * 31 + c.charCodeAt(0)) & 0xffffff, 0) % 360
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: `hsl(${hue},55%,40%)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize, fontWeight: 800, color: '#fff', flexShrink: 0,
    }}>{initials}</div>
  )
}

function computeSeasonData(games, seasonKey) {
  const seasonGames = games.filter(g => seasonOf(g.playedAt).key === seasonKey)

  // Deck Spotlight
  const deckTally = {}
  const killTally = {}
  for (const g of seasonGames) {
    for (const p of g.players) {
      if (!deckTally[p.deck.id]) {
        deckTally[p.deck.id] = { id: p.deck.id, name: p.deck.name, commander: p.deck.commander, colors: p.deck.colors || '', owner: p.user.username, games: 0, wins: 0 }
      }
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

  // Streak
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

  // Top killer
  const topKiller = Object.entries(killTally).sort((a, b) => b[1] - a[1])[0] || null

  // Avg table size
  const avgTable = seasonGames.length ? (seasonGames.reduce((s, g) => s + g.players.length, 0) / seasonGames.length).toFixed(1) : '–'

  // Unique players
  const uniquePlayers = new Set(seasonGames.flatMap(g => g.players.map(p => p.user.id))).size

  return { seasonGames, spotlightDeck, topStreak, topKiller, avgTable, uniquePlayers }
}

// ─── infographic card (exported for html2canvas) ────────────

function SeasonInfographic({ season, seasonKey, seasonLabel, games }) {
  const data = useMemo(() => computeSeasonData(games, seasonKey), [games, seasonKey])

  const top3 = season.standings.filter(s => s.qualified).slice(0, 3)
  const champion = top3[0]
  const second   = top3[1]
  const third    = top3[2]

  const DARK = '#0e1117'
  const SURFACE = '#161c26'
  const BORDER = 'rgba(255,255,255,0.09)'
  const PRIMARY = '#34f08f'
  const TEXT = '#e8eaf0'
  const MUTED = '#8892a4'
  const GOLD = '#f5c542'
  const SILVER = '#b0b8cc'
  const BRONZE = '#c8845a'

  const row = { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }

  const primatiItems = [
    data.topStreak?.best > 1 && { icon: '🔥', label: 'Streak', value: `${data.topStreak.username} (${data.topStreak.best})` },
    data.topKiller && { icon: '⚔️', label: 'Più spietato', value: `${data.topKiller[0]} (${data.topKiller[1]} kill)` },
    champion && { icon: '📈', label: 'Top win rate', value: `${champion.username} (${champion.games > 0 ? Math.round(champion.wins / champion.games * 100) : 0}%)` },
    season.standings[0] && { icon: '🎮', label: 'Più presente', value: `${[...season.standings].sort((a,b) => b.games-a.games)[0].username} (${[...season.standings].sort((a,b) => b.games-a.games)[0].games} gg)` },
  ].filter(Boolean)

  return (
    <div style={{
      width: 380, background: DARK, borderRadius: 20, overflow: 'hidden',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      color: TEXT,
    }}>
      {/* Header */}
      <div style={{
        background: `linear-gradient(135deg, #0e1117 0%, #1a2535 100%)`,
        borderBottom: `1px solid ${BORDER}`,
        padding: '20px 24px 16px',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <div style={{ fontSize: 28, lineHeight: 1 }}>🐸</div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.18em', color: PRIMARY, textTransform: 'uppercase' }}>Commanderone · Villastellone</div>
          <div style={{ fontSize: 18, fontWeight: 900, color: TEXT, lineHeight: 1.2, marginTop: 2 }}>Recap Stagione</div>
          <div style={{ fontSize: 13, color: MUTED, marginTop: 2 }}>{seasonLabel}</div>
        </div>
      </div>

      <div style={{ padding: '0 16px 20px' }}>

        {/* Champion */}
        {champion && (
          <div style={{
            marginTop: 16, borderRadius: 14, overflow: 'hidden',
            background: `linear-gradient(135deg, #2a200a 0%, #1a1508 100%)`,
            border: `1px solid ${GOLD}44`,
            boxShadow: `0 0 24px ${GOLD}22`,
          }}>
            <div style={{ padding: '10px 16px 6px', fontSize: 10, fontWeight: 800, letterSpacing: '0.15em', color: GOLD, textTransform: 'uppercase' }}>
              🏆 Campione stagionale
            </div>
            <div style={{ padding: '0 16px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <InitialsAvatar name={champion.username} size={48} fontSize={18} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 22, fontWeight: 900, color: TEXT }}>{champion.username}</div>
                <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>
                  {champion.wins} vittorie · {champion.games > 0 ? Math.round(champion.wins / champion.games * 100) : 0}% win rate
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 34, fontWeight: 900, color: GOLD, lineHeight: 1 }}>{champion.points}</div>
                <div style={{ fontSize: 10, color: MUTED }}>punti</div>
              </div>
            </div>
          </div>
        )}

        {/* Podio 2°/3° */}
        {(second || third) && (
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            {[{ p: second, medal: '🥈', color: SILVER }, { p: third, medal: '🥉', color: BRONZE }].map(({ p, medal, color }) => p && (
              <div key={p.id} style={{
                flex: 1, borderRadius: 12, padding: '10px 12px',
                background: SURFACE, border: `1px solid ${BORDER}`,
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <span style={{ fontSize: 18 }}>{medal}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: TEXT, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.username}</div>
                  <div style={{ fontSize: 11, color: MUTED }}>{p.points} pt</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Deck Spotlight */}
        {data.spotlightDeck && (
          <div style={{
            marginTop: 14, borderRadius: 14, overflow: 'hidden',
            background: colorsToGradient(data.spotlightDeck.colors),
            border: `1px solid ${PRIMARY}33`,
          }}>
            <div style={{ padding: '10px 16px 6px', fontSize: 10, fontWeight: 800, letterSpacing: '0.15em', color: PRIMARY, textTransform: 'uppercase' }}>
              ✨ Deck della stagione
            </div>
            <div style={{ padding: '0 16px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 10, flexShrink: 0,
                background: `linear-gradient(135deg, ${PRIMARY}33, ${PRIMARY}11)`,
                border: `1px solid ${PRIMARY}44`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 22,
              }}>🃏</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: TEXT, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{data.spotlightDeck.name}</div>
                <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>{data.spotlightDeck.commander}</div>
                <div style={{ fontSize: 11, color: MUTED }}>di {data.spotlightDeck.owner} · {data.spotlightDeck.games} partite</div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 26, fontWeight: 900, color: PRIMARY }}>{data.spotlightDeck.winRate}%</div>
                <div style={{ fontSize: 10, color: MUTED }}>win rate</div>
              </div>
            </div>
          </div>
        )}

        {/* Stats globali */}
        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          {[
            { label: 'Partite', value: data.seasonGames.length },
            { label: 'Giocatori', value: data.uniquePlayers },
            { label: 'Media tavolo', value: data.avgTable },
          ].map(({ label, value }) => (
            <div key={label} style={{
              flex: 1, borderRadius: 12, padding: '10px 0', textAlign: 'center',
              background: SURFACE, border: `1px solid ${BORDER}`,
            }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: TEXT }}>{value}</div>
              <div style={{ fontSize: 10, color: MUTED, marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Primati */}
        {primatiItems.length > 0 && (
          <div style={{ marginTop: 14, borderRadius: 14, padding: '12px 16px', background: SURFACE, border: `1px solid ${BORDER}` }}>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.15em', color: MUTED, textTransform: 'uppercase', marginBottom: 10 }}>Primati</div>
            {primatiItems.map(({ icon, label, value }) => (
              <div key={label} style={{ ...row, justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 14 }}>{icon}</span>
                  <span style={{ fontSize: 12, color: MUTED }}>{label}</span>
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: TEXT }}>{value}</span>
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <div style={{ marginTop: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 10, color: MUTED, letterSpacing: '0.1em' }}>commanderone · villastellone · {seasonLabel}</div>
        </div>
      </div>
    </div>
  )
}

// ─── Modal wrapper ───────────────────────────────────────────

export default function SeasonRecap({ season, seasonKey, seasons, games, onClose }) {
  const { t } = useTheme()
  const recapRef = useRef(null)
  const seasonMeta = seasons.find(s => s.key === seasonKey)
  const seasonLabel = seasonMeta?.label || seasonKey

  async function handleDownload() {
    if (!recapRef.current) return
    const canvas = await html2canvas(recapRef.current, {
      scale: 2,
      backgroundColor: '#0e1117',
      useCORS: true,
      logging: false,
    })
    const link = document.createElement('a')
    link.download = `commanderone-stagione-${seasonKey}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        overflowY: 'auto', padding: '24px 16px 40px',
      }}
    >
      <div onClick={e => e.stopPropagation()} className="ct-modal-in" style={{ width: '100%', maxWidth: 420 }}>

        {/* Header modal */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: t.text }}>Infografica stagione</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handleDownload}
              style={{
                padding: '8px 16px', borderRadius: 20, border: 'none',
                background: t.primary, color: '#000', fontWeight: 800, fontSize: 13, cursor: 'pointer',
              }}
            >
              ⬇ Scarica PNG
            </button>
            <button
              onClick={onClose}
              style={{
                width: 36, height: 36, borderRadius: '50%', border: `1px solid ${t.border}`,
                background: t.bgSurface, color: t.text, fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >×</button>
          </div>
        </div>

        {/* Infographic */}
        <div ref={recapRef} style={{ borderRadius: 20, overflow: 'hidden', boxShadow: '0 8px 40px rgba(0,0,0,0.6)' }}>
          <SeasonInfographic
            season={season}
            seasonKey={seasonKey}
            seasonLabel={seasonLabel}
            games={games}
          />
        </div>

        <p style={{ textAlign: 'center', fontSize: 11, color: t.textMuted, marginTop: 12 }}>
          Tocca fuori per chiudere
        </p>
      </div>
    </div>
  )
}
