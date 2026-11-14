import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { categorizeCard } from '../lib/scryfall'
import { resolveDecklistCards, useCardArt } from '../lib/cardCache'
import { useTheme } from '../hooks/useTheme'
import { useIsMobile } from '../hooks/useIsMobile'
import { Skeleton, SkeletonList } from '../components/Skeleton'
import EmptyState from '../components/EmptyState'
import DeckThumb from '../components/DeckThumb'
import BracketBadge from '../components/BracketBadge'
import ArchetypeBadge from '../components/ArchetypeBadge'
import { Icon, ManaPips, Segmented, SectionLabel, bento } from '../components/ui'

const CATEGORY_ORDER = ['Commander', 'Creature', 'Planeswalker', 'Istantanei', 'Stregonerie', 'Artefatti', 'Incantesimi', 'Terre', 'Altro']

function WinBar({ pct, t }) {
  return (
    <div style={{ height: 6, borderRadius: 3, background: t.bgMuted, overflow: 'hidden', marginTop: 6 }}>
      <div className="ct-bar-fill" style={{ height: '100%', width: `${pct}%`, background: t.primary, borderRadius: 3 }} />
    </div>
  )
}

export default function DeckProfilePage() {
  const { id } = useParams()
  const did = Number.parseInt(id, 10)
  const navigate = useNavigate()
  const { t } = useTheme()
  const isMobile = useIsMobile()

  const [games, setGames] = useState([])
  const [deckStats, setDeckStats] = useState([])
  const [matchups, setMatchups] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [deckDetail, setDeckDetail]     = useState(null)
  const [typedCards, setTypedCards]     = useState([])
  const [loadingList, setLoadingList]   = useState(false)
  const [selectedCard, setSelectedCard] = useState(null)
  const [tab, setTab]                   = useState('perf')
  const [showTrend, setShowTrend]       = useState(false)

  useEffect(() => {
    Promise.all([api.getGames(), api.statsDecks(), api.statsMatchups()])
      .then(([g, d, m]) => { setGames(g); setDeckStats(d); setMatchups(m) })
      .catch(() => setError('Errore nel caricamento del mazzo'))
      .finally(() => setLoading(false))
  }, [])

  // Carica la decklist del mazzo e i tipi delle carte
  useEffect(() => {
    let alive = true
    setDeckDetail(null); setTypedCards([]); setSelectedCard(null)
    api.getDeck(did).then(async (deck) => {
      if (!alive) return
      setDeckDetail(deck)
      if (deck?.decklist) {
        setLoadingList(true)
        try {
          const cards = await resolveDecklistCards(deck.decklist)
          if (alive) setTypedCards(cards)
        } finally {
          if (alive) setLoadingList(false)
        }
      }
    }).catch(() => {})
    return () => { alive = false }
  }, [did])

  // Raggruppa le carte per categoria (commander a parte)
  const grouped = useMemo(() => {
    const commanderName = deckDetail?.commander
    const groups = {}
    for (const card of typedCards) {
      const cat = commanderName && card.name === commanderName ? 'Commander' : categorizeCard(card.typeLine)
      if (!groups[cat]) groups[cat] = []
      groups[cat].push(card)
    }
    for (const k of Object.keys(groups)) groups[k].sort((a, b) => a.name.localeCompare(b.name))
    return groups
  }, [typedCards, deckDetail])

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

  const totalEur = useMemo(() => {
    let sum = 0
    for (const c of typedCards) {
      const price = parseFloat(c.prices?.eur)
      if (!isNaN(price)) sum += price * c.count
    }
    return sum > 0 ? sum.toFixed(2) : null
  }, [typedCards])

  const bannerArt = useCardArt(deckStats.find(d => d.id === did)?.commander)

  const card = bento(t, { padding: '1rem 1.05rem', marginBottom: 12 })
  const back = (
    <button onClick={() => navigate(-1)} className="ct-press" style={{ minHeight: 40, padding: '0 14px 0 10px', borderRadius: 12, border: `1px solid ${t.border}`, background: t.bgSurfaceAlt, color: t.text, fontSize: 14, fontWeight: 700, cursor: 'pointer', marginBottom: 14, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <Icon name="back" size={17} /> Indietro
    </button>
  )

  if (loading) return (<div>{back}<Skeleton h={140} r={16} style={{ marginBottom: 12 }} /><SkeletonList rows={4} /></div>)
  if (error) return (<div>{back}<EmptyState icon="⚠️" title="Errore" message={error} /></div>)
  if (!data.deck) return (<div>{back}<EmptyState icon="🔍" title="Mazzo non trovato" message="Questo mazzo non esiste o non ha ancora dati." /></div>)

  const { deck, myGames, trend, matchups: mine, best, worst } = data

  const stat = (label, value, sub) => (
    <div style={bento(t, { padding: '0.85rem 0.95rem', minWidth: 0 })}>
      <div style={{ fontSize: 12, color: t.textSub, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 900, color: t.text, lineHeight: 1.05, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: t.textSub, marginTop: 4, lineHeight: 1.35, wordBreak: 'break-word' }}>{sub}</div>}
    </div>
  )

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      {back}

      {/* Banner commander */}
      <div className="ct-fade-up" style={{ ...card, padding: 0, overflow: 'hidden', marginBottom: 14 }}>
        <div style={{ position: 'relative', height: 200, background: '#1a1640' }}>
          {deck.commander && bannerArt.status === 'ready' && (
            <img src={bannerArt.art} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 22%' }} />
          )}
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(8,10,28,0.95) 0%, rgba(8,10,28,0.25) 60%, transparent 100%)' }} />
          <div style={{ position: 'absolute', top: 12, right: 12 }}><ManaPips colors={deck.colors} size={24} /></div>
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 10 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 900, fontSize: 24, color: '#fff', textShadow: '0 1px 6px rgba(0,0,0,0.8)', lineHeight: 1.15, wordBreak: 'break-word' }}>{deck.name}</div>
              <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.85)', marginTop: 3, wordBreak: 'break-word' }}>{deck.commander || 'Nessun commander'} · di {deck.owner}</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                <BracketBadge bracket={deck.bracket} size="lg" />
                {deck.archetype && <ArchetypeBadge archetype={deck.archetype} />}
              </div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontSize: 34, fontWeight: 900, color: deck.winRate >= 50 ? '#34F08F' : '#fff', textShadow: '0 1px 6px rgba(0,0,0,0.8)', lineHeight: 1 }}>
                {deck.games > 0 ? `${deck.winRate}%` : 'n/a'}
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', fontWeight: 600 }}>win rate</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tab switcher */}
      <div style={{ marginBottom: 14 }}>
        <Segmented t={t} value={tab} onChange={setTab} options={[{ value: 'perf', label: 'Performance' }, { value: 'lista', label: 'Lista carte' }]} />
      </div>

      {/* ── TAB: PERFORMANCE ── */}
      {tab === 'perf' && (
        <div key="perf" className="ct-fade-up">
          {/* Statistiche chiave */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 12 }}>
            {stat('Partite', deck.games)}
            {stat('Vittorie', deck.wins, `${deck.games - deck.wins} sconfitte`)}
            {stat('Miglior matchup', best ? `${best.winRate}%` : '—', best ? `vs ${best.deckB.name}` : 'nessun dato')}
            {stat('Peggior matchup', worst ? `${worst.winRate}%` : '—', worst ? `vs ${worst.deckB.name}` : 'nessun dato')}
          </div>

          {/* Stima prezzo */}
          {totalEur && (
            <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ width: 44, height: 44, borderRadius: 14, background: t.primaryBg, color: t.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 20, fontWeight: 900 }}>€</span>
              <div>
                <div style={{ fontSize: 12, color: t.textSub, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800, marginBottom: 2 }}>Valore stimato</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: t.text }}>~€ {totalEur}</div>
                <div style={{ fontSize: 12, color: t.textSub }}>prezzi Scryfall · carta singola</div>
              </div>
            </div>
          )}

          {/* Matchup */}
          {mine.length > 0 && (
            <>
              <div style={{ marginTop: 20 }}><SectionLabel t={t} icon="swords">Matchup</SectionLabel></div>
              {mine.map((m, i) => (
                <div key={i} className="ct-fade-up" style={{ ...card, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 12, animationDelay: `${Math.min(i, 6) * 40}ms` }}>
                  <DeckThumb commander={commanderById[m.deckB.id]} w={48} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, color: t.text, wordBreak: 'break-word' }}>{m.deckB.name}</div>
                    <div style={{ fontSize: 13, color: t.textSub }}>di {m.deckB.owner} · {m.games} {m.games === 1 ? 'partita' : 'partite'}</div>
                    <WinBar pct={m.winRate} t={t} />
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: m.winRate >= 50 ? t.win : m.winRate > 0 ? t.primary : t.textMuted }}>{m.winRate}%</div>
                </div>
              ))}
            </>
          )}

          {/* Trend (collassabile) */}
          {trend.length >= 2 && (
            <div style={card}>
              <div onClick={() => setShowTrend(v => !v)} role="button" aria-expanded={showTrend} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', userSelect: 'none', minHeight: 40 }}>
                <span style={{ fontSize: 15, fontWeight: 800, color: t.text, display: 'inline-flex', alignItems: 'center', gap: 8 }}><span style={{ color: t.primary, display: 'flex' }}><Icon name="chart" size={18} /></span>Andamento win rate</span>
                <span style={{ fontSize: 13, color: t.textSub, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  {trend.length} partite
                  <span style={{ display: 'flex', transition: 'transform 0.15s', transform: showTrend ? 'rotate(90deg)' : 'none' }}><Icon name="chevron" size={17} /></span>
                </span>
              </div>
              {showTrend && (<div className="ct-section-open">{(() => {
                const W = 600, H = 120, pad = 6, n = trend.length
                const x = (i) => pad + (i / (n - 1)) * (W - pad * 2)
                const y = (v) => pad + (1 - v / 100) * (H - pad * 2)
                const line = trend.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ')
                const area = `${line} L ${x(n - 1).toFixed(1)} ${H - pad} L ${x(0).toFixed(1)} ${H - pad} Z`
                return (
                  <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block', marginTop: 16 }} preserveAspectRatio="none">
                    <line x1={pad} y1={y(50)} x2={W - pad} y2={y(50)} stroke={t.border} strokeWidth="1" strokeDasharray="4 4" />
                    <defs><linearGradient id="ct-dtrend" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={t.primary} stopOpacity="0.30" /><stop offset="100%" stopColor={t.primary} stopOpacity="0" /></linearGradient></defs>
                    <path d={area} fill="url(#ct-dtrend)" />
                    <path d={line} fill="none" stroke={t.primary} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
                    <circle cx={x(n - 1)} cy={y(trend[n - 1])} r="4" fill={t.primary} />
                  </svg>
                )
              })()}</div>)}
            </div>
          )}

          {/* Storico */}
          <div style={{ marginTop: 20 }}><SectionLabel t={t} icon="trophy">Storico partite</SectionLabel></div>
          {myGames.length === 0 ? (
            <EmptyState icon="🃏" title="Nessuna partita" message="Questo mazzo non ha ancora giocato." />
          ) : myGames.map(g => {
            const me  = g.players.find(p => p.deck.id === did)
            const won = me?.isWinner
            const winner = g.players.find(p => p.isWinner)
            const date = new Date(g.playedAt).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })
            return (
              <div key={g.id} onClick={() => navigate(`/partita/${g.id}`)} className="ct-lift" style={{ ...card, marginBottom: 10, cursor: 'pointer', ...(won ? { background: t.winBg, border: `1px solid ${t.primaryBorder}` } : {}) }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                  <div style={{ fontSize: 13, color: t.textSub }}>{date} · {g.players.length} giocatori · {me?.user.username}</div>
                  <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 12px', borderRadius: 20, background: won ? t.winBg : t.bgMuted, color: won ? t.win : t.textSub }}>
                    {won ? 'Vittoria' : 'Sconfitta'}{me?.placement ? ` · ${me.placement}°` : ''}
                  </span>
                </div>
                {!won && winner && <div style={{ fontSize: 14, color: t.text }}>Ha vinto {winner.user.username} ({winner.deck.name})</div>}
                {g.notes && <div style={{ fontSize: 13, color: t.textSub, marginTop: 4, fontStyle: 'italic', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{g.notes}</div>}
              </div>
            )
          })}
        </div>
      )}

      {/* ── TAB: LISTA CARTE ── */}
      {tab === 'lista' && (
        <div key="lista" className="ct-fade-up" style={card}>
          {!deckDetail?.decklist ? (
            <EmptyState icon="🃏" title="Nessuna decklist" message="Aggiungi una decklist dal profilo del mazzo per vederla qui." />
          ) : loadingList ? (
            <div style={{ fontSize: 13, color: t.textSub }}>Caricamento lista...</div>
          ) : (
            <>
              <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                {/* Elenco raggruppato */}
                <div style={{ flex: 1, minWidth: isMobile ? '100%' : 240 }}>
                  {CATEGORY_ORDER.filter(cat => grouped[cat]?.length).map(cat => {
                    const cards = grouped[cat]
                    const tot = cards.reduce((s, c) => s + c.count, 0)
                    return (
                      <div key={cat} style={{ marginBottom: 14 }}>
                        <div style={{ fontSize: 13, fontWeight: 800, color: t.primary, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                          {cat} <span style={{ color: t.textMuted, fontWeight: 600 }}>({tot})</span>
                        </div>
                        {cards.map((c, i) => {
                          const active = selectedCard?.name === c.name
                          return (
                            <div key={i} onMouseEnter={() => c.imageUri && setSelectedCard(c)} onClick={() => setSelectedCard(active ? null : c)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', minHeight: 40, borderRadius: 10, cursor: 'pointer', background: active ? t.primaryBg : 'transparent', color: active ? t.primary : t.text, fontSize: 15 }}>
                              <span style={{ color: t.textSub, minWidth: 26, textAlign: 'right', fontSize: 13, fontWeight: 700 }}>{c.count}×</span>
                              <span>{c.name}</span>
                            </div>
                          )
                        })}
                      </div>
                    )
                  })}
                </div>
                {/* Anteprima — sticky desktop */}
                {!isMobile && (
                  <div style={{ position: 'sticky', top: 80, width: 240, flexShrink: 0 }}>
                    {selectedCard?.imageUri ? (
                      <img src={selectedCard.imageUri} alt={selectedCard.name} style={{ width: 240, borderRadius: 14, display: 'block', boxShadow: '0 8px 30px rgba(0,0,0,0.4)' }} />
                    ) : (
                      <div style={{ width: 240, height: 335, borderRadius: 14, border: `2px dashed ${t.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', color: t.textMuted, fontSize: 12, padding: 12 }}>
                        Passa su una carta per vederne l'immagine
                      </div>
                    )}
                  </div>
                )}
              </div>
              {totalEur && (
                <div style={{ marginTop: 16, paddingTop: 12, borderTop: `0.5px solid ${t.border}`, fontSize: 13, color: t.textSub }}>
                  Valore stimato: <strong style={{ color: t.text }}>~€ {totalEur}</strong> <span style={{ fontSize: 12 }}>(Scryfall)</span>
                </div>
              )}
            </>
          )}
          {/* Anteprima mobile — fullscreen al tap */}
          {isMobile && selectedCard?.imageUri && (
            <div onClick={() => setSelectedCard(null)} style={{ position: 'fixed', inset: 0, zIndex: 70, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
              <img src={selectedCard.imageUri} alt={selectedCard.name} style={{ width: '100%', maxWidth: 320, borderRadius: 16, boxShadow: '0 12px 40px rgba(0,0,0,0.6)' }} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
