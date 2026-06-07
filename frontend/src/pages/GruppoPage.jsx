import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { useTheme } from '../hooks/useTheme'
import { useAuth } from '../hooks/useAuth'
import { useCountUp } from '../hooks/useCountUp'
import { SkeletonList, Skeleton } from '../components/Skeleton'
import EmptyState from '../components/EmptyState'
import DeckThumb from '../components/DeckThumb'
import GameSocial from '../components/GameSocial'
import { listSeasons, computeStandings } from '../lib/seasons'

// ─── piccoli helper ────────────────────────────────────────

function WinBar({ pct, t }) {
  return (
    <div style={{ height: 6, borderRadius: 3, background: t.bgMuted, overflow: 'hidden', marginTop: 6 }}>
      <div style={{ height: '100%', width: `${pct}%`, background: t.primary, borderRadius: 3, transition: 'width 0.4s' }} />
    </div>
  )
}

function Avatar({ name, t, size = 32 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', background: t.primaryBg, color: t.primary,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.38, fontWeight: 600, flexShrink: 0,
    }}>
      {name?.substring(0, 2).toUpperCase()}
    </div>
  )
}

function MetricCard({ label, value, t }) {
  const shown = useCountUp(value)
  return (
    <div style={{
      background: t.bgSurface,
      backdropFilter: 'blur(14px) saturate(150%)',
      WebkitBackdropFilter: 'blur(14px) saturate(150%)',
      borderRadius: 16, padding: '1rem 1.15rem',
      border: `1px solid ${t.border}`, boxShadow: t.shadow,
      position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', top: 0, left: 0, width: 3, height: '100%', background: t.gradient }} />
      <div style={{ fontSize: 11, color: t.textSub, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: t.text, lineHeight: 1 }}>{shown}</div>
    </div>
  )
}

function SectionHeader({ icon, title, collapsible, open, onToggle, t }) {
  return (
    <div
      onClick={collapsible ? onToggle : undefined}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 12, marginTop: 28,
        cursor: collapsible ? 'pointer' : 'default',
        userSelect: 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 18 }}>{icon}</span>
        <span style={{ fontSize: 16, fontWeight: 800, color: t.text }}>{title}</span>
      </div>
      {collapsible && (
        <span style={{ fontSize: 12, color: t.textMuted, transition: 'transform 0.2s', display: 'inline-block', transform: open ? 'rotate(180deg)' : 'none' }}>▼</span>
      )}
    </div>
  )
}

// ─── main ──────────────────────────────────────────────────

export default function GruppoPage() {
  const { t } = useTheme()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [games, setGames]           = useState([])
  const [playerStats, setPlayerStats] = useState([])
  const [deckStats, setDeckStats]   = useState([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState('')

  // Sezioni collassabili
  const [showPrimati, setShowPrimati] = useState(true)
  const [showMeta, setShowMeta]       = useState(false)

  // Stagione
  const [seasonKey, setSeasonKey] = useState(null)

  // Storico filtri
  const [historicPeriod, setHistoricPeriod] = useState('all')
  const [historicFrom,   setHistoricFrom]   = useState('')
  const [historicTo,     setHistoricTo]     = useState('')

  useEffect(() => {
    Promise.all([api.getGames(), api.statsPlayers(), api.statsDecks()])
      .then(([g, p, d]) => { setGames(g); setPlayerStats(p); setDeckStats(d) })
      .catch(() => setError('Errore nel caricamento'))
      .finally(() => setLoading(false))
  }, [])

  // ── Stagione ──
  const seasons = useMemo(() => listSeasons(games), [games])
  useEffect(() => { if (seasons.length > 0 && !seasonKey) setSeasonKey(seasons[0].key) }, [seasons])
  const season = useMemo(() => (seasonKey ? computeStandings(games, seasonKey) : null), [games, seasonKey])

  // ── Storico filtrato ──
  const visibleGames = useMemo(() => {
    const hasCustom = historicFrom || historicTo
    let from = null, to = null
    if (hasCustom) {
      if (historicFrom) from = new Date(historicFrom + 'T00:00:00')
      if (historicTo)   to   = new Date(historicTo + 'T23:59:59')
    } else if (historicPeriod !== 'all') {
      from = new Date()
      from.setDate(from.getDate() - { '7d': 7, '30d': 30, '90d': 90, '180d': 180 }[historicPeriod])
      from.setHours(0, 0, 0, 0)
    }
    if (!from && !to) return games
    return games.filter(g => {
      const d = new Date(g.playedAt)
      if (from && d < from) return false
      if (to   && d > to)   return false
      return true
    })
  }, [games, historicPeriod, historicFrom, historicTo])

  // ── Primati ──
  const records = useMemo(() => {
    if (games.length === 0) return null
    const byPlayer = {}
    for (const g of [...games].sort((a, b) => new Date(a.playedAt) - new Date(b.playedAt))) {
      for (const p of g.players) {
        if (!byPlayer[p.user.id]) byPlayer[p.user.id] = { username: p.user.username, cur: 0, best: 0 }
        const rec = byPlayer[p.user.id]
        if (p.isWinner) { rec.cur++; rec.best = Math.max(rec.best, rec.cur) }
        else rec.cur = 0
      }
    }
    const longestStreak = Object.values(byPlayer).sort((a, b) => b.best - a.best)[0]
    const now = new Date()
    const monthWins = {}
    for (const g of games) {
      const d = new Date(g.playedAt)
      if (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) {
        const w = g.players.find(p => p.isWinner)
        if (w) monthWins[w.user.username] = (monthWins[w.user.username] || 0) + 1
      }
    }
    const kingOfMonth = Object.entries(monthWins).sort((a, b) => b[1] - a[1])[0] || null
    const biggestTable = games.reduce((max, g) => g.players.length > max.players.length ? g : max, games[0])
    const mostWins  = [...playerStats].sort((a, b) => b.wins - a.wins)[0]
    const mostGames = [...playerStats].sort((a, b) => b.games - a.games)[0]
    const bestRate  = [...playerStats].filter(p => p.games >= 5).sort((a, b) => b.winRate - a.winRate)[0]
    const topDeck   = [...deckStats].filter(d => d.games >= 3).sort((a, b) => b.winRate - a.winRate || b.wins - a.wins)[0]
    const placeStats = {}
    for (const g of games) {
      if (!g.players.every(p => p.placement != null)) continue
      for (const p of g.players) {
        if (!placeStats[p.user.id]) placeStats[p.user.id] = { username: p.user.username, sum: 0, n: 0, firstOuts: 0 }
        const ps = placeStats[p.user.id]
        ps.sum += p.placement; ps.n++
        if (p.placement === g.players.length) ps.firstOuts++
      }
    }
    const placeArr = Object.values(placeStats)
    const survivalKing = placeArr.filter(p => p.n >= 3).map(p => ({ ...p, avg: p.sum / p.n })).sort((a, b) => a.avg - b.avg)[0]
    const unluckiest   = placeArr.filter(p => p.firstOuts > 0).sort((a, b) => b.firstOuts - a.firstOuts)[0]
    const killTally = {}, deathTally = {}
    for (const g of games) {
      for (const p of g.players) {
        if (!p.eliminatedById) continue
        deathTally[p.user.username] = (deathTally[p.user.username] || 0) + 1
        const killer = g.players.find(x => x.user.id === p.eliminatedById)
        if (killer) killTally[killer.user.username] = (killTally[killer.user.username] || 0) + 1
      }
    }
    const mostRuthless  = Object.entries(killTally).sort((a, b) => b[1] - a[1])[0] || null
    const biggestTarget = Object.entries(deathTally).sort((a, b) => b[1] - a[1])[0] || null
    return { longestStreak, kingOfMonth, biggestTable, mostWins, mostGames, bestRate, topDeck, survivalKing, unluckiest, mostRuthless, biggestTarget }
  }, [games, playerStats, deckStats])

  // ── Meta colori ──
  const colorMeta = useMemo(() => {
    const order = ['W', 'U', 'B', 'R', 'G']
    const tally = Object.fromEntries(order.map(c => [c, { games: 0, wins: 0 }]))
    for (const g of games) {
      for (const p of g.players) {
        const cols = (p.deck.colors || '').split('')
        for (const c of order) {
          if (cols.includes(c)) { tally[c].games++; if (p.isWinner) tally[c].wins++ }
        }
      }
    }
    return order.map(c => ({ color: c, games: tally[c].games, winRate: tally[c].games ? Math.round(tally[c].wins / tally[c].games * 100) : 0 }))
  }, [games])

  // ── Attività mensile ──
  const activity = useMemo(() => {
    const months = []
    const now = new Date()
    for (let i = 7; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      months.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleDateString('it-IT', { month: 'short' }), count: 0 })
    }
    const idx = Object.fromEntries(months.map((m, i) => [m.key, i]))
    for (const g of games) {
      const d = new Date(g.playedAt)
      const k = `${d.getFullYear()}-${d.getMonth()}`
      if (k in idx) months[idx[k]].count++
    }
    return months
  }, [games])

  const card = {
    background: t.bgSurface,
    backdropFilter: 'blur(14px) saturate(150%)',
    WebkitBackdropFilter: 'blur(14px) saturate(150%)',
    border: `1px solid ${t.border}`,
    borderRadius: 14, padding: '1rem 1.25rem',
    marginBottom: 10, boxShadow: t.shadow,
  }

  if (loading) return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: '1.5rem' }}>
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} h={78} r={16} />)}
      </div>
      <SkeletonList rows={5} />
    </div>
  )
  if (error) return <EmptyState icon="⚠️" title="Errore" message={error} />

  const totalGames = games.length
  const topPlayer  = playerStats[0]
  const bestDeck   = deckStats.filter(d => d.games >= 3).sort((a, b) => b.winRate - a.winRate)[0]

  return (
    <div>
      {/* Metriche globali */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: '1.5rem' }}>
        <MetricCard label="Partite totali"   value={totalGames}                  t={t} />
        <MetricCard label="Giocatori"        value={playerStats.length}           t={t} />
        <MetricCard label="Mazzi registrati" value={deckStats.length}             t={t} />
        <MetricCard label="Top player"       value={topPlayer?.username || '—'}   t={t} />
      </div>

      {/* ── STAGIONE ── */}
      <SectionHeader icon="🏆" title="Stagione" t={t} />
      {seasons.length === 0 || !season ? (
        <EmptyState icon="🏆" title="Nessuna stagione ancora" message="Registrate qualche partita per far partire la classifica stagionale." />
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
            <select
              value={seasonKey || ''}
              onChange={e => setSeasonKey(e.target.value)}
              style={{ padding: '6px 10px', borderRadius: 8, border: `1px solid ${t.border}`, background: t.inputBg, color: t.text, fontSize: 14, fontWeight: 600, cursor: 'pointer', outline: 'none' }}
            >
              {seasons.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
            <span style={{ fontSize: 12, color: t.textMuted }}>{season.total} partite · qualificato da {season.threshold} partite</span>
          </div>

          {season.champion && (
            <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 14, borderColor: t.primaryBorder }}>
              <div style={{ fontSize: 34 }}>🏆</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: t.textSub, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>In testa alla stagione</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: t.text }}>{season.champion.username}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 26, fontWeight: 900, color: t.primary, lineHeight: 1 }}>{season.champion.points}</div>
                <div style={{ fontSize: 11, color: t.textMuted }}>punti</div>
              </div>
            </div>
          )}

          <div style={{ fontSize: 11.5, color: t.textMuted, margin: '4px 4px 10px' }}>
            Punteggio: 1° = 3 · 2° = 2 · 3° = 1 · +1 presenza a ogni partita
          </div>

          {season.standings.map((s, i) => (
            <div key={s.id} className="ct-lift" onClick={() => navigate(`/giocatore/${s.id}`)} style={{ ...card, cursor: 'pointer', opacity: s.qualified ? 1 : 0.62 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: i === 0 && s.qualified ? t.primary : t.textMuted, minWidth: 22 }}>{i + 1}°</span>
                  <Avatar name={s.username} t={t} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, color: t.text, display: 'flex', alignItems: 'center', gap: 6 }}>
                      {s.username}
                      {!s.qualified && <span style={{ fontSize: 10, color: t.textMuted, fontWeight: 600, border: `1px solid ${t.border}`, borderRadius: 6, padding: '1px 5px' }}>non qualif.</span>}
                    </div>
                    <div style={{ fontSize: 12, color: t.textSub }}>{s.games} partite · {s.wins} vittorie</div>
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: t.text }}>{s.points}</div>
                  <div style={{ fontSize: 11, color: t.textMuted }}>punti</div>
                </div>
              </div>
            </div>
          ))}
        </>
      )}

      {/* ── PRIMATI ── */}
      <SectionHeader icon="🥇" title="Primati" collapsible open={showPrimati} onToggle={() => setShowPrimati(v => !v)} t={t} />
      {showPrimati && (
        !records ? (
          <EmptyState icon="🏆" title="Nessun primato ancora" message="Servono partite registrate per calcolare record e statistiche del gruppo." />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
            {[
              { icon: '👑', label: 'Re del mese',         value: records.kingOfMonth?.[0] || '—',                    sub: records.kingOfMonth ? `${records.kingOfMonth[1]} vittorie questo mese` : 'nessuna partita questo mese' },
              { icon: '🔥', label: 'Streak record',        value: records.longestStreak ? `${records.longestStreak.best} di fila` : '—', sub: records.longestStreak?.username || '' },
              { icon: '🏅', label: 'Più vittorie',         value: records.mostWins?.username || '—',                  sub: records.mostWins ? `${records.mostWins.wins} vittorie` : '' },
              { icon: '📈', label: 'Miglior win rate',     value: records.bestRate ? `${records.bestRate.winRate}%` : '—', sub: records.bestRate ? `${records.bestRate.username} · min 5 partite` : 'min 5 partite' },
              { icon: '🎴', label: 'Mazzo più forte',      value: records.topDeck?.name || '—',                       sub: records.topDeck ? `${records.topDeck.owner} · ${records.topDeck.winRate}%` : 'min 3 partite' },
              { icon: '🎲', label: 'Più presenze',         value: records.mostGames?.username || '—',                 sub: records.mostGames ? `${records.mostGames.games} partite` : '' },
              { icon: '🪑', label: 'Tavolo più affollato', value: `${records.biggestTable.players.length} giocatori`, sub: new Date(records.biggestTable.playedAt).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' }) },
              { icon: '🛡️', label: 'Re della sopravvivenza', value: records.survivalKing?.username || '—',            sub: records.survivalKing ? `piazz. medio ${records.survivalKing.avg.toFixed(1)}° · min 3 partite` : 'serve l\'ordine di uscita' },
              { icon: '🪦', label: 'Sfortunato',           value: records.unluckiest?.username || '—',                sub: records.unluckiest ? `${records.unluckiest.firstOuts}× primo eliminato` : 'serve l\'ordine di uscita' },
              { icon: '⚔️', label: 'Più spietato',         value: records.mostRuthless?.[0] || '—',                  sub: records.mostRuthless ? `${records.mostRuthless[1]} eliminazioni` : 'serve il kill tracking' },
              { icon: '🎯', label: 'Bersaglio',            value: records.biggestTarget?.[0] || '—',                 sub: records.biggestTarget ? `eliminato ${records.biggestTarget[1]}× in totale` : 'serve il kill tracking' },
            ].map((r, i) => (
              <div key={i} style={{ ...card, marginBottom: 0, position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, width: 3, height: '100%', background: t.gradient }} />
                <div style={{ fontSize: 11, color: t.textSub, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, marginBottom: 6 }}>{r.icon} {r.label}</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: t.text, lineHeight: 1.15 }}>{r.value}</div>
                {r.sub && <div style={{ fontSize: 11.5, color: t.textMuted, marginTop: 4 }}>{r.sub}</div>}
              </div>
            ))}
          </div>
        )
      )}

      {/* ── META COLORI ── */}
      <SectionHeader icon="🎨" title="Meta colori" collapsible open={showMeta} onToggle={() => setShowMeta(v => !v)} t={t} />
      {showMeta && (
        <div style={card}>
          {colorMeta.every(c => c.games === 0) ? (
            <div style={{ fontSize: 13, color: t.textMuted }}>Nessun dato</div>
          ) : colorMeta.map(c => {
            const COLOR_BG  = { W: '#f5f0e0', U: '#b8d4e8', B: '#c8b8d8', R: '#e8c0b0', G: '#b8d8b8' }
            const COLOR_LBL = { W: 'Bianco', U: 'Blu', B: 'Nero', R: 'Rosso', G: 'Verde' }
            return (
              <div key={c.color} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 9 }}>
                <span style={{ width: 22, height: 22, borderRadius: '50%', background: COLOR_BG[c.color], border: '1px solid rgba(0,0,0,0.15)', flexShrink: 0, fontSize: 10, fontWeight: 700, color: '#444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{c.color}</span>
                <span style={{ fontSize: 12, color: t.textSub, width: 52, flexShrink: 0 }}>{COLOR_LBL[c.color]}</span>
                <div style={{ flex: 1, height: 8, borderRadius: 4, background: t.bgMuted, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${c.winRate}%`, background: t.primary, borderRadius: 4, transition: 'width 0.4s' }} />
                </div>
                <span style={{ fontSize: 13, fontWeight: 600, color: t.text, width: 38, textAlign: 'right', flexShrink: 0 }}>{c.winRate}%</span>
                <span style={{ fontSize: 11, color: t.textMuted, width: 60, textAlign: 'right', flexShrink: 0 }}>{c.games} pres.</span>
              </div>
            )
          })}

          {/* Attività mensile */}
          <div style={{ marginTop: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 16 }}>Attivita · partite per mese</div>
            {(() => {
              const max = Math.max(1, ...activity.map(m => m.count))
              return (
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8, height: 130 }}>
                  {activity.map((m, i) => (
                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: m.count ? t.text : t.textMuted }}>{m.count || ''}</div>
                      <div style={{ width: '100%', maxWidth: 38, height: `${(m.count / max) * 90}px`, minHeight: m.count ? 4 : 2, background: m.count ? t.gradient : t.bgMuted, borderRadius: 6, transition: 'height 0.4s' }} />
                      <div style={{ fontSize: 10.5, color: t.textSub, textTransform: 'capitalize' }}>{m.label}</div>
                    </div>
                  ))}
                </div>
              )
            })()}
          </div>
        </div>
      )}

      {/* ── STORICO ── */}
      <SectionHeader icon="📜" title="Storico partite" t={t} />

      {/* Filtri data */}
      <div style={{ background: t.bgSurface, border: `0.5px solid ${t.border}`, borderRadius: 12, padding: '0.85rem 1rem', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: t.textSub }}>Periodo:</span>
          {[
            { key: 'all', label: 'Tutto' }, { key: '7d', label: '7 giorni' },
            { key: '30d', label: 'Mese' }, { key: '90d', label: '3 mesi' },
            { key: '180d', label: '6 mesi' },
          ].map(({ key, label }) => {
            const active = !historicFrom && !historicTo && historicPeriod === key
            return (
              <button key={key} onClick={() => { setHistoricPeriod(key); setHistoricFrom(''); setHistoricTo('') }} style={{ padding: '4px 12px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 500, transition: 'all 0.12s', background: active ? t.primary : t.bgMuted, color: active ? t.primaryFg : t.textSub }}>
                {label}
              </button>
            )
          })}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: t.textSub }}>Da:</span>
          <input type='date' value={historicFrom} onChange={e => { setHistoricFrom(e.target.value); setHistoricPeriod('') }} style={{ padding: '4px 8px', borderRadius: 6, border: `0.5px solid ${t.border}`, background: t.inputBg, color: t.text, fontSize: 13, outline: 'none', cursor: 'pointer' }} />
          <span style={{ fontSize: 12, color: t.textSub }}>A:</span>
          <input type='date' value={historicTo}   onChange={e => { setHistoricTo(e.target.value); setHistoricPeriod('') }} style={{ padding: '4px 8px', borderRadius: 6, border: `0.5px solid ${t.border}`, background: t.inputBg, color: t.text, fontSize: 13, outline: 'none', cursor: 'pointer' }} />
          {(historicFrom || historicTo) && (
            <button onClick={() => { setHistoricFrom(''); setHistoricTo(''); setHistoricPeriod('all') }} style={{ fontSize: 11, color: t.primary, background: 'none', border: 'none', cursor: 'pointer' }}>✕ reset</button>
          )}
        </div>
      </div>

      {(historicPeriod !== 'all' || historicFrom || historicTo) && (
        <div style={{ fontSize: 12, color: t.textSub, marginBottom: 8, paddingLeft: 4 }}>
          {visibleGames.length} partita{visibleGames.length !== 1 ? 'e' : ''} nel periodo selezionato
        </div>
      )}

      {visibleGames.length === 0 && (
        games.length === 0
          ? <EmptyState icon="🃏" title="Storico vuoto" message="Nessuna partita registrata. Vai su Gioca per aggiungerne una." />
          : <div style={{ ...card, color: t.textSub, fontSize: 14, textAlign: 'center', padding: '2rem' }}>Nessuna partita nel periodo selezionato</div>
      )}

      {visibleGames.map(g => {
        const winner = g.players.find(p => p.isWinner)
        const date   = new Date(g.playedAt).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })
        return (
          <div key={g.id} style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <div onClick={() => navigate(`/partita/${g.id}`)} style={{ fontSize: 12, color: t.textMuted, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <span style={{ textDecoration: 'underline', textDecorationStyle: 'dotted', textUnderlineOffset: 2 }}>{date}</span>
                <span>· {g.players.length} giocatori</span>
                <span style={{ color: t.primary, fontWeight: 700 }}>›</span>
              </div>
              {winner && (
                <span style={{ fontSize: 12, background: t.winBg, color: t.win, padding: '3px 10px', borderRadius: 20, fontWeight: 500 }}>
                  {winner.user.username} · {winner.deck.name}
                </span>
              )}
            </div>
            {(() => {
              const ranked  = g.players.every(p => p.placement != null)
              const ordered = ranked ? [...g.players].sort((a, b) => a.placement - b.placement) : g.players
              return (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {ordered.map(p => (
                    <span key={p.id} onClick={() => navigate(`/mazzo/${p.deck.id}`)} style={{ fontSize: 12, padding: '3px 10px 3px 4px', borderRadius: 20, background: p.isWinner ? t.winBg : t.bgMuted, color: p.isWinner ? t.win : t.textSub, display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                      <DeckThumb commander={p.deck.commander} w={20} round preview={false} />
                      {ranked && <span style={{ fontWeight: 800, opacity: 0.8 }}>{p.placement}°</span>}
                      {p.user.username} · {p.deck.name}
                    </span>
                  ))}
                </div>
              )
            })()}
            {(() => {
              const kills = g.players.filter(p => p.eliminatedById)
              if (kills.length === 0) return null
              return (
                <div style={{ fontSize: 11.5, color: t.textMuted, marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: '2px 10px' }}>
                  {kills.map(p => {
                    const killer = g.players.find(x => x.user.id === p.eliminatedById)
                    return <span key={p.id}>⚔️ {killer?.user.username || '?'} → {p.user.username}</span>
                  })}
                </div>
              )
            })()}
            {g.notes && <div style={{ fontSize: 12, color: t.textMuted, marginTop: 8, fontStyle: 'italic' }}>{g.notes}</div>}
            <GameSocial game={g} />
          </div>
        )
      })}
    </div>
  )
}
