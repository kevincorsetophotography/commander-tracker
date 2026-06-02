import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { useTheme } from '../hooks/useTheme'
import { Skeleton, SkeletonList } from '../components/Skeleton'
import EmptyState from '../components/EmptyState'
import DeckThumb from '../components/DeckThumb'
import BracketBadge from '../components/BracketBadge'

const COLOR_MAP = { W: '#f5f0e0', U: '#b8d4e8', B: '#c8b8d8', R: '#e8c0b0', G: '#b8d8b8' }
const artUrl = (name) => `https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(name)}&format=image&version=art_crop`

function WinBar({ pct, t }) {
  return (
    <div style={{ height: 6, borderRadius: 3, background: t.bgMuted, overflow: 'hidden', marginTop: 6 }}>
      <div style={{ height: '100%', width: `${pct}%`, background: t.primary, borderRadius: 3, transition: 'width 0.4s' }} />
    </div>
  )
}

export default function DeckProfilePage() {
  const { id } = useParams()
  const did = Number.parseInt(id, 10)
  const navigate = useNavigate()
  const { t } = useTheme()

  const [games, setGames] = useState([])
  const [deckStats, setDeckStats] = useState([])
  const [matchups, setMatchups] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([api.getGames(), api.statsDecks(), api.statsMatchups()])
      .then(([g, d, m]) => { setGames(g); setDeckStats(d); setMatchups(m) })
      .catch(() => setError('Errore nel caricamento del mazzo'))
      .finally(() => setLoading(false))
  }, [])

  const commanderById = useMemo(() => Object.fromEntries(deckStats.map(d => [d.id, d.commander])), [deckStats])

  const data = useMemo(() => {
    const deck = deckStats.find(d => d.id === did)
    const myGames = games
      .filter(g => g.players.some(p => p.deck.id === did))
      .sort((a, b) => new Date(b.playedAt) - new Date(a.playedAt))

    // trend win rate cumulativo
    const chrono = [...myGames].reverse()
    let cw = 0
    const trend = chrono.map((g, i) => {
      if (g.players.find(p => p.deck.id === did)?.isWinner) cw++
      return Math.round(cw / (i + 1) * 100)
    })

    const mine = matchups.filter(m => m.deckA.id === did).sort((a, b) => b.winRate - a.winRate || b.games - a.games)
    const best = mine[0] || null
    const worst = mine.length > 1 ? mine[mine.length - 1] : null

    return { deck, myGames, trend, matchups: mine, best, worst }
  }, [games, deckStats, matchups, did])

  const card = {
    background: t.bgSurface, backdropFilter: 'blur(14px) saturate(150%)', WebkitBackdropFilter: 'blur(14px) saturate(150%)',
    border: `1px solid ${t.border}`, borderRadius: 16, padding: '1.15rem 1.35rem', marginBottom: 12, boxShadow: t.shadow,
  }
  const back = (
    <button onClick={() => navigate(-1)} style={{ padding: '6px 14px', borderRadius: 10, border: `1px solid ${t.border}`, background: t.bgMuted, color: t.textSub, fontSize: 13, fontWeight: 600, cursor: 'pointer', marginBottom: 16 }}>← Indietro</button>
  )

  if (loading) return (<div>{back}<Skeleton h={140} r={16} style={{ marginBottom: 12 }} /><SkeletonList rows={4} /></div>)
  if (error) return (<div>{back}<EmptyState icon="⚠️" title="Errore" message={error} /></div>)
  if (!data.deck) return (<div>{back}<EmptyState icon="🔍" title="Mazzo non trovato" message="Questo mazzo non esiste o non ha ancora dati." /></div>)

  const { deck, myGames, trend, matchups: mine, best, worst } = data

  const stat = (label, value, sub) => (
    <div style={{ flex: 1, minWidth: 110 }}>
      <div style={{ fontSize: 11, color: t.textSub, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: t.text, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: t.textMuted, marginTop: 3 }}>{sub}</div>}
    </div>
  )

  return (
    <div>
      {back}

      {/* Banner commander */}
      <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
        <div style={{ position: 'relative', height: 150, background: '#1a1640' }}>
          {deck.commander && (
            <img src={artUrl(deck.commander)} alt="" onError={e => { e.currentTarget.style.display = 'none' }}
              style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 22%' }} />
          )}
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.15) 60%, transparent 100%)' }} />
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 8 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 800, fontSize: 22, color: '#fff', textShadow: '0 1px 6px rgba(0,0,0,0.8)' }}>{deck.name}</span>
                <BracketBadge bracket={deck.bracket} size="lg" />
              </div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)' }}>{deck.commander || 'Nessun commander'} · di {deck.owner}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {deck.colors && deck.colors.split('').map(c => (
                <span key={c} style={{ width: 20, height: 20, borderRadius: '50%', background: COLOR_MAP[c] || '#eee', border: '1px solid rgba(0,0,0,0.2)' }} />
              ))}
              <span style={{ fontSize: 30, fontWeight: 900, color: deck.winRate >= 50 ? '#34F08F' : '#fff', textShadow: '0 1px 6px rgba(0,0,0,0.8)' }}>
                {deck.games > 0 ? `${deck.winRate}%` : 'n/a'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Statistiche */}
      <div style={{ ...card, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {stat('Partite', deck.games)}
        {stat('Vittorie', deck.wins, `${deck.games - deck.wins} sconfitte`)}
        {stat('Miglior matchup', best ? `${best.winRate}%` : '—', best ? `vs ${best.deckB.name}` : 'nessun dato')}
        {stat('Peggior matchup', worst ? `${worst.winRate}%` : '—', worst ? `vs ${worst.deckB.name}` : 'nessun dato')}
      </div>

      {/* Trend */}
      {trend.length >= 2 && (
        <div style={card}>
          <div style={{ fontSize: 14, fontWeight: 700, color: t.text, marginBottom: 4 }}>Andamento win rate</div>
          <div style={{ fontSize: 12, color: t.textMuted, marginBottom: 12 }}>nel corso delle {trend.length} partite</div>
          {(() => {
            const W = 600, H = 120, pad = 6, n = trend.length
            const x = (i) => pad + (i / (n - 1)) * (W - pad * 2)
            const y = (v) => pad + (1 - v / 100) * (H - pad * 2)
            const line = trend.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ')
            const area = `${line} L ${x(n - 1).toFixed(1)} ${H - pad} L ${x(0).toFixed(1)} ${H - pad} Z`
            return (
              <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }} preserveAspectRatio="none">
                <line x1={pad} y1={y(50)} x2={W - pad} y2={y(50)} stroke={t.border} strokeWidth="1" strokeDasharray="4 4" />
                <defs><linearGradient id="ct-dtrend" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={t.primary} stopOpacity="0.30" /><stop offset="100%" stopColor={t.primary} stopOpacity="0" /></linearGradient></defs>
                <path d={area} fill="url(#ct-dtrend)" />
                <path d={line} fill="none" stroke={t.primary} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
                <circle cx={x(n - 1)} cy={y(trend[n - 1])} r="4" fill={t.primary} />
              </svg>
            )
          })()}
        </div>
      )}

      {/* Matchup */}
      {mine.length > 0 && (
        <>
          <div style={{ fontSize: 15, fontWeight: 700, color: t.text, margin: '20px 0 10px' }}>Matchup</div>
          {mine.map((m, i) => (
            <div key={i} style={{ ...card, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
              <DeckThumb commander={commanderById[m.deckB.id]} w={48} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 500, color: t.text }}>{m.deckB.name}</div>
                <div style={{ fontSize: 12, color: t.textSub }}>di {m.deckB.owner} · {m.games} {m.games === 1 ? 'partita' : 'partite'}</div>
                <WinBar pct={m.winRate} t={t} />
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, color: m.winRate >= 50 ? t.win : m.winRate > 0 ? t.primary : t.textMuted }}>{m.winRate}%</div>
            </div>
          ))}
        </>
      )}

      {/* Storico */}
      <div style={{ fontSize: 15, fontWeight: 700, color: t.text, margin: '20px 0 10px' }}>Storico partite</div>
      {myGames.length === 0 ? (
        <EmptyState icon="🃏" title="Nessuna partita" message="Questo mazzo non ha ancora giocato." />
      ) : myGames.map(g => {
        const me = g.players.find(p => p.deck.id === did)
        const won = me?.isWinner
        const winner = g.players.find(p => p.isWinner)
        const date = new Date(g.playedAt).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })
        return (
          <div key={g.id} style={{ ...card, marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <div style={{ fontSize: 12, color: t.textMuted }}>{date} · {g.players.length} giocatori · {me?.user.username}</div>
              <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 12px', borderRadius: 20, background: won ? t.winBg : t.bgMuted, color: won ? t.win : t.textSub }}>
                {won ? 'Vittoria' : 'Sconfitta'}{me?.placement ? ` · ${me.placement}°` : ''}
              </span>
            </div>
            {!won && winner && <div style={{ fontSize: 13, color: t.textSub }}>Ha vinto {winner.user.username} ({winner.deck.name})</div>}
            {g.notes && <div style={{ fontSize: 12, color: t.textMuted, marginTop: 4, fontStyle: 'italic' }}>{g.notes}</div>}
          </div>
        )
      })}
    </div>
  )
}
