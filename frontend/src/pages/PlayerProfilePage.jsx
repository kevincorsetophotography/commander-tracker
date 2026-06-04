import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { useTheme } from '../hooks/useTheme'
import { SkeletonList, Skeleton } from '../components/Skeleton'
import EmptyState from '../components/EmptyState'
import DeckThumb from '../components/DeckThumb'
import { getAchievements } from '../lib/achievements'

const COLOR_MAP = { W: '#f5f0e0', U: '#b8d4e8', B: '#c8b8d8', R: '#e8c0b0', G: '#b8d8b8' }

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

    // Kill tracking
    let kills = 0, deaths = 0
    const eliminatorTally = {}, preyTally = {}
    for (const g of myGames) {
      for (const p of g.players) {
        if (p.eliminatedById === pid && p.user.id !== pid) {
          kills++
          preyTally[p.user.username] = (preyTally[p.user.username] || 0) + 1
        }
      }
      const me = g.players.find(p => p.user.id === pid)
      if (me?.eliminatedById) {
        deaths++
        const killer = g.players.find(p => p.user.id === me.eliminatedById)
        if (killer) eliminatorTally[killer.user.username] = (eliminatorTally[killer.user.username] || 0) + 1
      }
    }
    const archNemesis = Object.entries(eliminatorTally).sort((a, b) => b[1] - a[1])[0] || null
    const favoritePrey = Object.entries(preyTally).sort((a, b) => b[1] - a[1])[0] || null
    const hasKillData = kills > 0 || deaths > 0

    const achievements = getAchievements({ myGames, myDecks, pid })

    return { player, myGames, wins, total, winRate, streak, nemesis, favDeck, myDecks, trend, avgPlacement, firstOuts, placed, achievements, kills, deaths, archNemesis, favoritePrey, hasKillData }
  }, [games, deckStats, players, pid])

  // ── RIVALITÀ (scontri diretti) ──
  const [rivalId, setRivalId] = useState(null)

  const opponents = useMemo(() => {
    const seen = new Map()
    for (const g of profile.myGames) {
      for (const p of g.players) {
        if (p.user.id !== pid && !seen.has(p.user.id)) seen.set(p.user.id, p.user.username)
      }
    }
    return [...seen].map(([id, username]) => ({ id, username })).sort((a, b) => a.username.localeCompare(b.username))
  }, [profile.myGames, pid])

  useEffect(() => { setRivalId(prev => (opponents.some(o => o.id === prev) ? prev : (opponents[0]?.id ?? null))) }, [opponents])

  const h2h = useMemo(() => {
    if (!rivalId) return null
    const shared = profile.myGames.filter(g => g.players.some(p => p.user.id === rivalId))
    let meBetter = 0, oppBetter = 0, undecided = 0, myWins = 0, oppWins = 0, myKills = 0, oppKills = 0
    for (const g of shared) {
      const me = g.players.find(p => p.user.id === pid)
      const opp = g.players.find(p => p.user.id === rivalId)
      if (me.placement != null && opp.placement != null) {
        if (me.placement < opp.placement) meBetter++; else oppBetter++
      } else if (me.isWinner) meBetter++
      else if (opp.isWinner) oppBetter++
      else undecided++
      if (me.isWinner) myWins++
      if (opp.isWinner) oppWins++
      if (opp.eliminatedById === pid) myKills++
      if (me.eliminatedById === rivalId) oppKills++
    }
    return { shared, meBetter, oppBetter, undecided, myWins, oppWins, myKills, oppKills, rival: opponents.find(o => o.id === rivalId) }
  }, [rivalId, profile.myGames, pid, opponents])

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

  const { player, myGames, wins, total, winRate, streak, nemesis, favDeck, myDecks, trend, avgPlacement, firstOuts, placed, achievements, kills, deaths, archNemesis, favoritePrey, hasKillData } = profile

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

      {/* Eliminazioni (kill tracking) */}
      {hasKillData && (
        <div style={{ ...card, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {stat('⚔️ Kill', kills, 'giocatori eliminati')}
          {stat('💀 Morti', deaths, 'volte eliminato')}
          {stat('😈 Arcinemico', archNemesis ? archNemesis[0] : '—', archNemesis ? `ti ha eliminato ${archNemesis[1]}×` : 'nessuno')}
          {stat('🎯 Preda preferita', favoritePrey ? favoritePrey[0] : '—', favoritePrey ? `eliminato ${favoritePrey[1]}×` : 'nessuna')}
        </div>
      )}

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

      {/* Rivalità (scontri diretti) */}
      {opponents.length > 0 && h2h && (
        <>
          <div style={{ fontSize: 15, fontWeight: 700, color: t.text, margin: '20px 0 10px', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            Rivalità ⚔️
            <select
              value={rivalId || ''}
              onChange={e => setRivalId(Number.parseInt(e.target.value, 10))}
              style={{ padding: '5px 10px', borderRadius: 8, border: `1px solid ${t.border}`, background: t.inputBg, color: t.text, fontSize: 13, fontWeight: 600, cursor: 'pointer', outline: 'none' }}
            >
              {opponents.map(o => <option key={o.id} value={o.id}>vs {o.username}</option>)}
            </select>
          </div>

          {(() => {
            const decided = h2h.meBetter + h2h.oppBetter
            const mePct = decided ? Math.round(h2h.meBetter / decided * 100) : 50
            const row = (label, a, b) => (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderBottom: `0.5px solid ${t.border}` }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: t.text, minWidth: 30, textAlign: 'left' }}>{a}</span>
                <span style={{ fontSize: 12, color: t.textSub }}>{label}</span>
                <span style={{ fontSize: 16, fontWeight: 700, color: t.text, minWidth: 30, textAlign: 'right' }}>{b}</span>
              </div>
            )
            return (
              <div style={card}>
                {/* Intestazione nomi */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontWeight: 700, color: t.primary, fontSize: 14 }}>{player.username}</span>
                  <span style={{ fontSize: 11, color: t.textMuted }}>{h2h.shared.length} partite insieme</span>
                  <span style={{ fontWeight: 700, color: t.text, fontSize: 14 }}>{h2h.rival?.username}</span>
                </div>
                {/* Barra "chi finisce meglio" */}
                <div style={{ display: 'flex', height: 10, borderRadius: 5, overflow: 'hidden', marginBottom: 4 }}>
                  <div style={{ width: `${mePct}%`, background: t.primary }} />
                  <div style={{ width: `${100 - mePct}%`, background: t.bgMuted }} />
                </div>
                <div style={{ textAlign: 'center', fontSize: 11, color: t.textMuted, marginBottom: 12 }}>chi finisce più in alto</div>

                {row('arrivato più in alto', h2h.meBetter, h2h.oppBetter)}
                {row('vittorie del pod', h2h.myWins, h2h.oppWins)}
                {row('eliminazioni inflitte ⚔️', h2h.myKills, h2h.oppKills)}
                {h2h.undecided > 0 && (
                  <div style={{ fontSize: 11, color: t.textMuted, marginTop: 8 }}>
                    {h2h.undecided} {h2h.undecided === 1 ? 'partita senza' : 'partite senza'} ordine di uscita (vinte da altri) non assegnate.
                  </div>
                )}
              </div>
            )
          })()}
        </>
      )}

      {/* Achievement */}
      <div style={{ fontSize: 15, fontWeight: 700, color: t.text, margin: '20px 0 10px' }}>
        Achievement <span style={{ fontWeight: 500, color: t.textMuted, fontSize: 13 }}>· {achievements.filter(a => a.unlocked).length}/{achievements.length}</span>
      </div>
      <div style={{ ...card, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
        {achievements.map(a => (
          <div key={a.id} title={a.desc} style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 10,
            background: a.unlocked ? t.primaryBg : t.bgMuted,
            border: `1px solid ${a.unlocked ? t.primaryBorder : t.border}`,
            opacity: a.unlocked ? 1 : 0.55,
          }}>
            <span style={{ fontSize: 22, filter: a.unlocked ? 'none' : 'grayscale(1)' }}>{a.icon}</span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: a.unlocked ? t.text : t.textSub }}>{a.title}</div>
              <div style={{ fontSize: 10.5, color: t.textMuted, lineHeight: 1.25 }}>{a.desc}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Mazzi del giocatore */}
      <div style={{ fontSize: 15, fontWeight: 700, color: t.text, margin: '20px 0 10px' }}>Mazzi</div>
      {myDecks.length === 0 ? (
        <EmptyState icon="🎴" title="Nessun mazzo con partite" message="Questo giocatore non ha ancora mazzi che hanno giocato." />
      ) : (
        myDecks.map(d => (
          <div key={d.id} className="ct-lift" style={{ ...card, marginBottom: 10, display: 'flex', gap: 12, alignItems: 'center', cursor: 'pointer' }} onClick={() => navigate(`/mazzo/${d.id}`)}>
            <DeckThumb commander={d.commander} w={64} preview={false} />
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
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <DeckThumb commander={me?.deck.commander} w={32} />
                <div style={{ fontSize: 13, color: t.text }}>
                  {me?.deck.name}
                  {!won && winner && <span style={{ color: t.textSub }}> · ha vinto {winner.user.username} ({winner.deck.name})</span>}
                </div>
              </div>
              {g.notes && <div style={{ fontSize: 12, color: t.textMuted, marginTop: 4, fontStyle: 'italic' }}>{g.notes}</div>}
            </div>
          )
        })
      )}
    </div>
  )
}
