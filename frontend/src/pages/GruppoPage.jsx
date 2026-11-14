import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../lib/api'
import { useTheme } from '../hooks/useTheme'
import { useAuth } from '../hooks/useAuth'
import { SkeletonList, Skeleton } from '../components/Skeleton'
import EmptyState from '../components/EmptyState'
import DeckThumb from '../components/DeckThumb'
import BracketBadge from '../components/BracketBadge'
import GameSocial from '../components/GameSocial'
import { listSeasons, computeStandings, seasonOf } from '../lib/seasons'
import PlayerAvatar from '../components/PlayerAvatar'
import SeasonRecap from '../components/SeasonRecap'
import NumberFlow from '@number-flow/react'
import { Icon, ManaPips, Segmented, bento } from '../components/ui'

// ─── piccoli helper ────────────────────────────────────────

function WinBar({ pct, t }) {
  return (
    <div style={{ height: 6, borderRadius: 3, background: t.bgMuted, overflow: 'hidden', marginTop: 6 }}>
      <div className="ct-bar-fill" style={{ height: '100%', width: `${pct}%`, background: t.primary, borderRadius: 3 }} />
    </div>
  )
}


function MetricCard({ label, value, icon, t }) {
  const isNum = typeof value === 'number'
  return (
    <div style={bento(t, { padding: '0.9rem 1rem', minWidth: 0 })}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginBottom: 8 }}>
        <div style={{ fontSize: 12, color: t.textSub, textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 800 }}>{label}</div>
        {icon && <span style={{ color: t.primary, display: 'flex' }}><Icon name={icon} size={18} /></span>}
      </div>
      <div style={{ fontSize: isNum ? 30 : 22, fontWeight: 900, color: t.text, lineHeight: 1.1, wordBreak: 'break-word', fontVariantNumeric: 'tabular-nums' }}>
        {isNum ? <NumberFlow value={value} /> : value}
      </div>
    </div>
  )
}

function SectionHeader({ icon, title, collapsible, open, onToggle, t, right }) {
  return (
    <button
      onClick={collapsible ? onToggle : undefined}
      aria-expanded={collapsible ? open : undefined}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
        margin: '26px 0 12px', padding: '4px 0', minHeight: 44, background: 'none', border: 'none',
        cursor: collapsible ? 'pointer' : 'default', color: t.text, textAlign: 'left',
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        <span style={{ color: t.primary, display: 'flex' }}><Icon name={icon} size={20} /></span>
        <span style={{ fontSize: 18, fontWeight: 800 }}>{title}</span>
      </span>
      {right}
      {collapsible && (
        <span style={{ color: t.textSub, display: 'flex', transition: 'transform 0.2s', transform: open ? 'rotate(90deg)' : 'none' }}><Icon name="chevron" size={20} /></span>
      )}
    </button>
  )
}

const PODIUM_COLORS = ['#F5C518', '#C9D1E0', '#D9915A']
const COLOR_LBL = { W: 'Bianco', U: 'Blu', B: 'Nero', R: 'Rosso', G: 'Verde' }
const MANA_BAR = { W: '#F8F6D8', U: '#3B82F6', B: '#6B5B7B', R: '#EF4444', G: '#16A34A' }

// ─── main ──────────────────────────────────────────────────

const TABS = [
  { key: 'stagione',  label: 'Stagione' },
  { key: 'giocatori', label: 'Giocatori' },
  { key: 'mazzi',     label: 'Mazzi' },
  { key: 'storico',   label: 'Storico' },
]

export default function GruppoPage() {
  const { t } = useTheme()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const qTab = searchParams.get('tab')
  const tab = TABS.some(x => x.key === qTab) ? qTab : 'stagione'
  const setTab = (next) => setSearchParams(next === 'stagione' ? {} : { tab: next }, { replace: true })

  const [games, setGames]             = useState([])
  const [playerStats, setPlayerStats] = useState([])
  const [deckStats, setDeckStats]     = useState([])
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState('')

  // Sezioni collassabili (stagione tab)
  const [showPrimati, setShowPrimati] = useState(true)
  const [showMeta, setShowMeta]       = useState(false)
  const [showRecap, setShowRecap]     = useState(false)

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

  return (
    <>
    <div>
      <div style={{ fontSize: 26, fontWeight: 800, color: t.text, letterSpacing: '-0.02em', marginBottom: 14 }}>Gruppo</div>

      {/* Metriche globali */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 16 }}>
        <MetricCard label="Partite"    value={totalGames}          icon="swords" t={t} />
        <MetricCard label="Giocatori"  value={playerStats.length}  icon="groups" t={t} />
        <MetricCard label="Mazzi"      value={deckStats.length}    icon="cards"  t={t} />
        <MetricCard label="Top player" value={topPlayer?.username || '—'} icon="crown" t={t} />
      </div>

      {/* Tab */}
      <div style={{ marginBottom: 18 }}>
        <Segmented t={t} value={tab} onChange={setTab} options={TABS.map(x => ({ value: x.key, label: x.label }))} />
      </div>

      <div key={tab} className="ct-fade-up">
      {/* ══════════ TAB: STAGIONE ══════════ */}
      {tab === 'stagione' && (
        <div>
          {seasons.length === 0 || !season ? (
            <EmptyState icon="🏆" title="Nessuna stagione ancora" message="Registrate qualche partita per far partire la classifica stagionale." />
          ) : (
            <>
              {(() => {
                const currentSeasonKey = seasonOf(new Date()).key
                const isCompleted = seasonKey !== currentSeasonKey
                return (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
                    <label style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 8, minHeight: 44, padding: '0 14px', borderRadius: 14, border: `1px solid ${t.border}`, background: t.bgSurfaceAlt, color: t.text, fontSize: 15, fontWeight: 700 }}>
                      <span style={{ color: t.primary, display: 'flex' }}><Icon name="trophy" size={17} /></span>
                      {seasons.find(x => x.key === seasonKey)?.label}
                      {!isCompleted && <span style={{ fontSize: 12, fontWeight: 700, color: t.primary }}>· in corso</span>}
                      <span style={{ color: t.textSub, display: 'flex', transform: 'rotate(90deg)' }}><Icon name="chevron" size={16} /></span>
                      <select
                        aria-label="Stagione"
                        value={seasonKey || ''}
                        onChange={e => { setSeasonKey(e.target.value); setShowRecap(false) }}
                        style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%' }}
                      >
                        {seasons.map(x => <option key={x.key} value={x.key}>{x.label}</option>)}
                      </select>
                    </label>
                    {isCompleted && (
                      <button onClick={() => setShowRecap(true)} className="ct-press" style={{
                        minHeight: 44, padding: '0 14px', borderRadius: 14, border: `1px solid ${t.primaryBorder}`,
                        background: t.primaryBg, color: t.primary, fontSize: 14, fontWeight: 800, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 6,
                      }}>
                        <Icon name="medal" size={17} /> Infografica
                      </button>
                    )}
                  </div>
                )
              })()}

              {/* Podio (primi 3 qualificati) */}
              {(() => {
                const top = season.standings.filter(x => x.qualified).slice(0, 3)
                if (top.length < 2) return null
                const order = top.length === 3 ? [top[1], top[0], top[2]] : [top[1], top[0]]
                const avatar = (id) => playerStats.find(p => p.id === id) || {}
                return (
                  <div className="ct-fade-up" style={bento(t, { padding: '1rem 0.75rem', marginBottom: 14 })}>
                    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${order.length}, 1fr)`, gap: 8, alignItems: 'end' }}>
                      {order.map(x => {
                        const rank = top.indexOf(x)
                        const first = rank === 0
                        const av = avatar(x.id)
                        return (
                          <div key={x.id} onClick={() => navigate(`/giocatore/${x.id}`)} className="ct-press" style={{
                            cursor: 'pointer', textAlign: 'center', minWidth: 0, borderRadius: 18,
                            padding: first ? '14px 6px 14px' : '10px 6px 12px',
                            background: first ? t.primaryBg : t.bgSurfaceAlt,
                            border: `1px solid ${first ? t.primaryBorder : t.border}`,
                            boxShadow: first && t.glow !== 'none' ? t.glow : 'none',
                          }}>
                            {first && <div style={{ color: PODIUM_COLORS[0], display: 'flex', justifyContent: 'center', marginBottom: 4 }}><Icon name="crown" size={20} /></div>}
                            <div style={{ position: 'relative', display: 'inline-block' }}>
                              <PlayerAvatar username={x.username} avatarCardName={av.avatarCardName} avatarScryfallId={av.avatarScryfallId} size={first ? 64 : 50} highlight={x.id === user?.id} />
                              <span style={{
                                position: 'absolute', bottom: -6, left: '50%', transform: 'translateX(-50%)', minWidth: 24, height: 24, borderRadius: 999,
                                background: PODIUM_COLORS[rank], color: '#1a1a2e', fontSize: 13, fontWeight: 900,
                                display: 'flex', alignItems: 'center', justifyContent: 'center', border: `2px solid ${t.bgPage}`,
                              }}>{rank + 1}</span>
                            </div>
                            <div style={{ fontSize: first ? 16 : 14, fontWeight: 800, color: t.text, marginTop: 10, wordBreak: 'break-word', lineHeight: 1.2 }}>{x.username}</div>
                            <div style={{ fontSize: first ? 24 : 19, fontWeight: 900, color: first ? t.primary : t.text, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
                              <NumberFlow value={x.points} /><span style={{ fontSize: 12, fontWeight: 700, color: t.textSub, marginLeft: 3 }}>pt</span>
                            </div>
                            <div style={{ fontSize: 12, color: t.textSub, lineHeight: 1.35 }}>{x.games} partite<br />{x.wins} vittorie</div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })()}

              <div style={{ fontSize: 13, color: t.textSub, margin: '2px 2px 10px', lineHeight: 1.45 }}>
                Punti: 1° = 3 · 2° = 2 · 3° = 1 · +1 per ogni partita giocata. Qualificato chi gioca almeno {season.threshold} delle {season.total} partite (30%).
              </div>

              {season.standings.map((s, i) => {
                const me = s.id === user?.id
                const av = playerStats.find(p => p.id === s.id) || {}
                const rankColor = i < 3 && s.qualified ? PODIUM_COLORS[i] : t.textSub
                return (
                  <div key={s.id} className="ct-lift ct-fade-up" onClick={() => navigate(`/giocatore/${s.id}`)} style={bento(t, {
                    cursor: 'pointer', padding: '0.75rem 0.85rem', marginBottom: 8, animationDelay: `${Math.min(i, 7) * 40}ms`,
                    display: 'flex', alignItems: 'center', gap: 10,
                    background: me ? t.primaryBg : t.bgSurface, border: `1px solid ${me ? t.primaryBorder : t.border}`,
                  })}>
                    <span style={{ width: 26, flexShrink: 0, textAlign: 'center', fontSize: 16, fontWeight: 900, color: rankColor, fontVariantNumeric: 'tabular-nums' }}>{i + 1}</span>
                    <PlayerAvatar username={s.username} avatarCardName={av.avatarCardName} avatarScryfallId={av.avatarScryfallId} size={40} highlight={me} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 15, fontWeight: 800, color: t.text, wordBreak: 'break-word' }}>{s.username}</span>
                        {me && <span style={{ fontSize: 12, fontWeight: 800, color: t.primaryFg, background: t.primary, padding: '1px 6px', borderRadius: 6 }}>Tu</span>}
                      </div>
                      <div style={{ fontSize: 13, color: t.textSub, marginTop: 2 }}>
                        {s.games} partite · {s.wins} vittorie · {s.games ? Math.round(s.wins / s.games * 100) : 0}%
                      </div>
                      <span style={{
                        display: 'inline-block', marginTop: 5, fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
                        color: s.qualified ? t.win : t.textSub, background: s.qualified ? t.winBg : 'transparent',
                        border: `1px solid ${s.qualified ? t.primaryBorder : t.border}`,
                      }}>{s.qualified ? 'Qualificato' : `Non qualificato · ${s.games}/${season.threshold}`}</span>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 24, fontWeight: 900, color: i === 0 && s.qualified ? t.primary : t.text, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                        <NumberFlow value={s.points} />
                      </div>
                      <div style={{ fontSize: 12, color: t.textSub }}>punti</div>
                    </div>
                  </div>
                )
              })}
            </>
          )}

          {/* ── PRIMATI ── */}
          <SectionHeader icon="medal" title="Primati" collapsible open={showPrimati} onToggle={() => setShowPrimati(v => !v)} t={t} />
          {showPrimati && (
            !records ? (
              <EmptyState icon="🏆" title="Nessun primato ancora" message="Servono partite registrate per calcolare record e statistiche del gruppo." />
            ) : (
              <div className="ct-section-open" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
                {[
                  { icon: 'crown',  label: 'Re del mese',      value: records.kingOfMonth?.[0] || '—',                        sub: records.kingOfMonth ? `${records.kingOfMonth[1]} vittorie` : 'nessuna partita' },
                  { icon: 'flame',  label: 'Serie record',     value: records.longestStreak?.username || '—',                 sub: records.longestStreak ? `${records.longestStreak.best} vittorie di fila` : '' },
                  { icon: 'trophy', label: 'Più vittorie',     value: records.mostWins?.username || '—',                      sub: records.mostWins ? `${records.mostWins.wins} vinte` : '' },
                  { icon: 'chart',  label: 'Miglior win rate', value: records.bestRate?.username || '—',                      sub: records.bestRate ? `${records.bestRate.winRate}% · min 5 partite` : 'min 5 partite' },
                  { icon: 'cards',  label: 'Mazzo più forte',  value: records.topDeck?.name || '—',                           sub: records.topDeck ? `${records.topDeck.winRate}% · min 3 partite` : 'min 3 partite' },
                  { icon: 'calendar', label: 'Più presenze',   value: records.mostGames?.username || '—',                     sub: records.mostGames ? `${records.mostGames.games} partite` : '' },
                  { icon: 'groups', label: 'Tavolo record',    value: `${records.biggestTable.players.length} giocatori`,     sub: new Date(records.biggestTable.playedAt).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' }) },
                  { icon: 'shield', label: 'Re sopravvivenza', value: records.survivalKing?.username || '—',                  sub: records.survivalKing ? `piazzamento medio ${records.survivalKing.avg.toFixed(1)}°` : 'serve ordine di uscita' },
                  { icon: 'skull',  label: 'Sfortunato',       value: records.unluckiest?.username || '—',                    sub: records.unluckiest ? `${records.unluckiest.firstOuts}× primo eliminato` : 'serve ordine di uscita' },
                  { icon: 'swords', label: 'Più spietato',     value: records.mostRuthless?.[0] || '—',                      sub: records.mostRuthless ? `${records.mostRuthless[1]} eliminazioni` : 'serve "eliminato da"' },
                  { icon: 'pin',    label: 'Bersaglio',        value: records.biggestTarget?.[0] || '—',                     sub: records.biggestTarget ? `eliminato ${records.biggestTarget[1]} volte` : 'serve "eliminato da"' },
                ].map((r, i) => (
                  <div key={i} style={bento(t, { padding: '0.8rem 0.9rem', borderRadius: 16, minWidth: 0 })}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: t.textSub, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 800, marginBottom: 6 }}>
                      <span style={{ color: t.accent, display: 'flex' }}><Icon name={r.icon} size={15} /></span>{r.label}
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: t.text, lineHeight: 1.25, wordBreak: 'break-word' }}>{r.value}</div>
                    {r.sub && <div style={{ fontSize: 12, color: t.textSub, marginTop: 3, lineHeight: 1.35 }}>{r.sub}</div>}
                  </div>
                ))}
              </div>
            )
          )}

          {/* ── META COLORI ── */}
          <SectionHeader icon="chart" title="Meta colori" collapsible open={showMeta} onToggle={() => setShowMeta(v => !v)} t={t} />
          {showMeta && (
            <div className="ct-section-open" style={bento(t, { padding: '1rem' })}>
              {colorMeta.every(c => c.games === 0) ? (
                <div style={{ fontSize: 13, color: t.textMuted }}>Nessun dato</div>
              ) : (
                <>
                  {(() => {
                    const tot = colorMeta.reduce((a, c) => a + c.games, 0) || 1
                    return (
                      <div style={{ display: 'flex', height: 12, borderRadius: 999, overflow: 'hidden', marginBottom: 14 }}>
                        {colorMeta.map(c => <div key={c.color} className="ct-bar-fill" style={{ width: `${c.games / tot * 100}%`, background: MANA_BAR[c.color] }} />)}
                      </div>
                    )
                  })()}
                  {colorMeta.map(c => (
                    <div key={c.color} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                      <ManaPips colors={c.color} size={24} />
                      <span style={{ fontSize: 14, fontWeight: 600, color: t.text, width: 58, flexShrink: 0 }}>{COLOR_LBL[c.color]}</span>
                      <div style={{ flex: 1, height: 8, borderRadius: 4, background: t.bgMuted, overflow: 'hidden' }}>
                        <div className="ct-bar-fill" style={{ height: '100%', width: `${c.winRate}%`, background: t.primary, borderRadius: 4 }} />
                      </div>
                      <span style={{ fontSize: 14, fontWeight: 800, color: t.text, width: 42, textAlign: 'right', flexShrink: 0 }}>{c.winRate}%</span>
                      <span style={{ fontSize: 12, color: t.textSub, width: 58, textAlign: 'right', flexShrink: 0 }}>{c.games} pres.</span>
                    </div>
                  ))}
                  <div style={{ fontSize: 12, color: t.textSub, marginTop: 2 }}>Barra: quota di presenze per colore · percentuale: win rate dei mazzi con quel colore</div>
                </>
              )}

              <div style={{ marginTop: 24 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: t.text, marginBottom: 16 }}>Attività · partite per mese</div>
                {(() => {
                  const max = Math.max(1, ...activity.map(m => m.count))
                  return (
                    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8, height: 130 }}>
                      {activity.map((m, i) => (
                        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: m.count ? t.text : t.textMuted }}>{m.count || ''}</div>
                          <div style={{ width: '100%', maxWidth: 38, height: `${(m.count / max) * 90}px`, minHeight: m.count ? 4 : 2, background: m.count ? t.gradient : t.bgMuted, borderRadius: 6, transition: 'height 0.4s' }} />
                          <div style={{ fontSize: 12, color: t.textSub, textTransform: 'capitalize' }}>{m.label}</div>
                        </div>
                      ))}
                    </div>
                  )
                })()}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════ TAB: GIOCATORI ══════════ */}
      {tab === 'giocatori' && (
        <div>
          {playerStats.length === 0 ? (
            <EmptyState icon="👥" title="Nessun giocatore" message="Nessuna partita registrata ancora." />
          ) : (
            playerStats.map((p, i) => (
              <div key={p.id} className="ct-lift ct-fade-up" onClick={() => navigate(`/giocatore/${p.id}`)} style={{ ...card, cursor: 'pointer', animationDelay: `${Math.min(i, 7) * 45}ms` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: i === 0 ? t.primary : t.textMuted, minWidth: 22, textAlign: 'right' }}>{i + 1}°</span>
                  <PlayerAvatar username={p.username} avatarCardName={p.avatarCardName} avatarScryfallId={p.avatarScryfallId} size={36} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, color: t.text, fontSize: 15 }}>{p.username}</div>
                    <div style={{ fontSize: 12, color: t.textSub }}>{p.games} partite · {p.wins} vittorie</div>
                    <WinBar pct={p.winRate} t={t} />
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 22, fontWeight: 900, color: p.winRate >= 30 ? t.win : t.text, lineHeight: 1 }}>{p.winRate}%</div>
                    <div style={{ fontSize: 10, color: t.textMuted }}>win rate</div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ══════════ TAB: MAZZI ══════════ */}
      {tab === 'mazzi' && (
        <div>
          {deckStats.length === 0 ? (
            <EmptyState icon="🃏" title="Nessun mazzo" message="Nessun mazzo registrato ancora." />
          ) : (
            [...deckStats].sort((a, b) => b.winRate - a.winRate || b.wins - a.wins).map((d, i) => (
              <div key={d.id} className="ct-lift ct-fade-up" onClick={() => navigate(`/mazzo/${d.id}`)} style={{ ...card, cursor: 'pointer', animationDelay: `${Math.min(i, 7) * 45}ms` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <DeckThumb commander={d.commander} w={38} round preview={false} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, color: t.text, fontSize: 14 }}>{d.name}</span>
                      {d.bracket && <BracketBadge bracket={d.bracket} />}
                    </div>
                    <div style={{ fontSize: 12, color: t.textSub, marginTop: 1 }}>{d.owner} · {d.games} partite · {d.wins} vittorie</div>
                    <WinBar pct={d.winRate} t={t} />
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 20, fontWeight: 900, color: d.winRate >= 30 ? t.win : t.text, lineHeight: 1 }}>{d.winRate}%</div>
                    <div style={{ fontSize: 10, color: t.textMuted }}>win rate</div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ══════════ TAB: STORICO ══════════ */}
      {tab === 'storico' && (
        <div>
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
      )}
      </div>
    </div>
    {showRecap && season && (
      <SeasonRecap
        season={season}
        seasonKey={seasonKey}
        seasons={seasons}
        games={games}
        playerStats={playerStats}
        onClose={() => setShowRecap(false)}
      />
    )}
    </>
  )
}
