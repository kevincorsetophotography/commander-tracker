import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { useTheme } from '../hooks/useTheme'
import { SkeletonList, Skeleton } from '../components/Skeleton'
import EmptyState from '../components/EmptyState'

const COLOR_MAP = { W: '#f5f0e0', U: '#b8d4e8', B: '#c8b8d8', R: '#e8c0b0', G: '#b8d8b8' }

const commanderArtUrl = (name) =>
  `https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(name)}&format=image&version=art_crop`

function WinBar({ pct, t }) {
  return (
    <div style={{ height: 6, borderRadius: 3, background: t.bgMuted, overflow: 'hidden', marginTop: 6 }}>
      <div style={{ height: '100%', width: `${pct}%`, background: t.primary, borderRadius: 3, transition: 'width 0.4s' }} />
    </div>
  )
}

export default function PlayerProfilePage() {
  const { id } = useParams()
  const pid = Number.parseInt(id, 10)
  const navigate = useNavigate()
  const { t } = useTheme()

  const [games, setGames] = useState([])
  const [deckStats, setDeckStats] = useState([])
  const [players, setPlayers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([api.getGames(), api.statsDecks(), api.statsPlayers()])
      .then(([g, d, p]) => { setGames(g); setDeckStats(d); setPlayers(p) })
      .catch(() => setError('Errore nel caricamento del profilo'))
      .finally(() => setLoading(false))
  }, [])

  const profile = useMemo(() => {
    const player = players.find(p => p.id === pid)
    const myGames = games
      .filter(g => g.players.some(p => p.user.id === pid))
      .sort((a, b) => new Date(b.playedAt) - new Date(a.playedAt))

    const wins = myGames.filter(g => g.players.find(p => p.user.id === pid)?.isWinner).length
    const total = myGames.length
    const winRate = total ? Math.round(wins / total * 100) : 0

    // Streak attuale (vittorie consecutive partendo dalla più recente)
    let streak = 0
    for (const g of myGames) {
      if (g.players.find(p => p.user.id === pid)?.isWinner) streak++
      else break
    }

    // Nemesi: chi ha vinto di più nelle partite in cui ho perso
    const nemesisTally = {}
    for (const g of myGames) {
      const me = g.players.find(p => p.user.id === pid)
      if (me?.isWinner) continue
      const winner = g.players.find(p => p.isWinner)
      if (winner && winner.user.id !== pid) {
        nemesisTally[winner.user.username] = (nemesisTally[winner.user.username] || 0) + 1
      }
    }
    const nemesis = Object.entries(nemesisTally).sort((a, b) => b[1] - a[1])[0] || null

    // Mazzo preferito (più giocato)
    const deckTally = {}
    for (const g of myGames) {
      const me = g.players.find(p => p.user.id === pid)
      if (me) deckTally[me.deck.name] = (deckTally[me.deck.name] || 0) + 1
    }
    const favDeck = Object.entries(deckTally).sort((a, b) => b[1] - a[1])[0] || null

    const myDecks = deckStats.filter(d => d.ownerId === pid).sort((a, b) => b.winRate - a.winRate)

    // Piazzamenti (solo partite con placement registrato)
    const placed = myGames.filter(g => g.players.find(p => p.user.id === pid)?.placement != null)
    const avgPlacement = placed.length
      ? (placed.reduce((s, g) => s + g.players.find(p => p.user.id === pid).placement, 0) / placed.length)
      : null
    const firstOuts = placed.filter(g => {
      const me = g.players.find(p => p.user.id === pid)
      return me.placement === g.players.length
    }).length

    // Trend win rate cumulativo (cronologico)
    const chrono = [...myGames].reverse()
    let cw = 0
    const trend = chrono.map((g, i) => {
      if (g.players.find(p => p.user.id === pid)?.isWinner) cw++
      return Math.round(cw / (i + 1) * 100)
    })

    return { player, myGames, wins, total, winRate, streak, nemesis, favDeck, myDecks, trend, avgPlacement, firstOuts, placed }
  }, [games, deckStats, players, pid])

  const card = {
    background: t.bgSurface,
    backdropFilter: 'blur(14px) saturate(150%)',
    WebkitBackdropFilter: 'blur(14px) saturate(150%)',
    border: `1px solid ${t.border}`,
    borderRadius: 16,
    padding: '1.15rem 1.35rem',
    marginBottom: 12,
    boxShadow: t.shadow,
  }

  const backBtn = (
    <button
      onClick={() => navigate(-1)}
      style={{ padding: '6px 14px', borderRadius: 10, border: `1px solid ${t.border}`, background: t.bgMuted, color: t.textSub, fontSize: 13, fontWeight: 600, cursor: 'pointer', marginBottom: 16 }}
    >
      ← Indietro
    </button>
  )

  if (loading) return (<div>{backBtn}<Skeleton h={120} r={16} style={{ marginBottom: 16 }} /><SkeletonList rows={4} /></div>)
  if (error)   return (<div>{backBtn}<EmptyState icon="⚠️" title="Errore" message={error} /></div>)
  if (!profile.player) return (<div>{backBtn}<EmptyState icon="🔍" title="Giocatore non trovato" message="Questo profilo non esiste o non ha ancora dati." /></div>)

  const { player, myGames, wins, total, winRate, streak, nemesis, favDeck, myDecks, trend, avgPlacement, firstOuts, placed } = profile

  const stat = (label, value, sub) => (
    <div style={{ flex: 1, minWidth: 120 }}>
      <div style={{ fontSize: 11, color: t.textSub, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color: t.text, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: t.textMuted, marginTop: 3 }}>{sub}</div>}
    </div>
  )

  return (
    <div>
      {backBtn}

      {/* Header profilo */}
      <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <div style={{
          width: 60, height: 60, borderRadius: '50%', flexShrink: 0,
          background: t.primaryBg, color: t.primary,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22, fontWeight: 800, border: `2px solid ${t.primaryBorder}`,
        }}>
          {player.username.substring(0, 2).toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 160 }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: t.text }}>{player.username}</div>
          <div style={{ fontSize: 13, color: t.textSub }}>{total} partite giocate</div>
        </div>
        <div style={{ fontSize: 38, fontWeight: 900, color: winRate >= 50 ? t.win : t.primary }}>
          {winRate}%
        </div>
      </div>

      {/* Statistiche chiave */}
      <div style={{ ...card, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {stat('Vittorie', wins, `${total - wins} sconfitte`)}
        {stat('Streak', streak > 0 ? `${streak} 🔥` : '—', streak > 0 ? 'vittorie di fila' : 'nessuna serie attiva')}
        {stat('Nemesi', nemesis ? nemesis[0] : '—', nemesis ? `ti ha battuto ${nemesis[1]} volte` : 'nessuna')}
        {stat('Mazzo preferito', favDeck ? favDeck[0] : '—', favDeck ? `${favDeck[1]} partite` : '')}
        {stat('Piazz. medio', avgPlacement ? avgPlacement.toFixed(1) + '°' : '—', placed.length ? `su ${placed.length} partite` : 'nessun dato')}
        {stat('Primo eliminato', placed.length ? `${firstOuts}×` : '—', placed.length ? 'volte fuori per primo' : 'nessun dato')}
      </div>

      {/* Trend win rate */}
      {trend.length >= 2 && (
        <div style={card}>
          <div style={{ fontSize: 14, fontWeight: 700, color: t.text, marginBottom: 4 }}>Andamento win rate</div>
          <div style={{ fontSize: 12, color: t.textMuted, marginBottom: 12 }}>win rate cumulativo nel corso delle {trend.length} partite</div>
          {(() => {
            const W = 600, H = 120, pad = 6
            const n = trend.length
            const x = (i) => pad + (i / (n - 1)) * (W - pad * 2)
            const y = (v) => pad + (1 - v / 100) * (H - pad * 2)
            const line = trend.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ')
            const area = `${line} L ${x(n - 1).toFixed(1)} ${H - pad} L ${x(0).toFixed(1)} ${H - pad} Z`
            return (
              <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }} preserveAspectRatio="none">
                {/* griglia 50% */}
                <line x1={pad} y1={y(50)} x2={W - pad} y2={y(50)} stroke={t.border} strokeWidth="1" strokeDasharray="4 4" />
                <defs>
                  <linearGradient id="ct-trend" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={t.primary} stopOpacity="0.30" />
                    <stop offset="100%" stopColor={t.primary} stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d={area} fill="url(#ct-trend)" />
                <path d={line} fill="none" stroke={t.primary} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
                <circle cx={x(n - 1)} cy={y(trend[n - 1])} r="4" fill={t.primary} />
              </svg>
            )
          })()}
        </div>
      )}

      {/* Mazzi del giocatore */}
      <div style={{ fontSize: 15, fontWeight: 700, color: t.text, margin: '20px 0 10px' }}>Mazzi</div>
      {myDecks.length === 0 ? (
        <EmptyState icon="🎴" title="Nessun mazzo con partite" message="Questo giocatore non ha ancora mazzi che hanno giocato." />
      ) : (
        myDecks.map(d => (
          <div key={d.id} style={{ ...card, marginBottom: 10, display: 'flex', gap: 12, alignItems: 'center' }}>
            {d.commander && (
              <img
                src={commanderArtUrl(d.commander)} alt=""
                onError={e => { e.currentTarget.style.display = 'none' }}
                style={{ width: 64, height: 46, objectFit: 'cover', objectPosition: 'center top', borderRadius: 8, flexShrink: 0 }}
              />
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, color: t.text, display: 'flex', alignItems: 'center', gap: 6 }}>
                {d.name}
                {d.colors && (
                  <span style={{ display: 'inline-flex', gap: 2 }}>
                    {d.colors.split('').map(c => (
                      <span key={c} style={{ width: 11, height: 11, borderRadius: '50%', background: COLOR_MAP[c] || '#eee', border: '1px solid rgba(0,0,0,0.15)' }} />
                    ))}
                  </span>
                )}
              </div>
              <div style={{ fontSize: 12, color: t.textSub }}>
                {d.commander || 'Nessun commander'} · {d.wins}V / {d.games - d.wins}P
              </div>
              {d.games > 0 && <WinBar pct={d.winRate} t={t} />}
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: d.winRate >= 50 ? t.win : d.winRate > 0 ? t.primary : t.textMuted, flexShrink: 0 }}>
              {d.games > 0 ? `${d.winRate}%` : 'n/a'}
            </div>
          </div>
        ))
      )}

      {/* Storico personale */}
      <div style={{ fontSize: 15, fontWeight: 700, color: t.text, margin: '20px 0 10px' }}>Storico partite</div>
      {myGames.length === 0 ? (
        <EmptyState icon="🃏" title="Nessuna partita" message="Questo giocatore non ha ancora giocato." />
      ) : (
        myGames.map(g => {
          const me = g.players.find(p => p.user.id === pid)
          const won = me?.isWinner
          const winner = g.players.find(p => p.isWinner)
          const date = new Date(g.playedAt).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })
          return (
            <div key={g.id} style={{ ...card, marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <div style={{ fontSize: 12, color: t.textMuted }}>{date} · {g.players.length} giocatori</div>
                <span style={{
                  fontSize: 12, fontWeight: 700, padding: '3px 12px', borderRadius: 20,
                  background: won ? t.winBg : t.bgMuted,
                  color: won ? t.win : t.textSub,
                }}>
                  {won ? 'Vittoria' : 'Sconfitta'}{me?.placement ? ` · ${me.placement}°` : ''}
                </span>
              </div>
              <div style={{ fontSize: 13, color: t.text }}>
                {me?.deck.name}
                {!won && winner && <span style={{ color: t.textSub }}> · ha vinto {winner.user.username} ({winner.deck.name})</span>}
              </div>
              {g.notes && <div style={{ fontSize: 12, color: t.textMuted, marginTop: 4, fontStyle: 'italic' }}>{g.notes}</div>}
            </div>
          )
        })
      )}
    </div>
  )
}
