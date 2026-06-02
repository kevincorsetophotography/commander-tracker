import { useState, useEffect } from 'react'
import { api } from '../lib/api'
import { useTheme } from '../hooks/useTheme'

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
      fontSize: size * 0.38, fontWeight: 600, flexShrink: 0
    }}>
      {name?.substring(0, 2).toUpperCase()}
    </div>
  )
}

function MetricCard({ label, value, t }) {
  return (
    <div style={{ background: t.bgMuted, borderRadius: 10, padding: '0.9rem 1rem', border: `0.5px solid ${t.border}` }}>
      <div style={{ fontSize: 12, color: t.textSub, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 600, color: t.text }}>{value}</div>
    </div>
  )
}

export default function DashboardPage() {
  const { t } = useTheme()
  const [tab, setTab] = useState('giocatori')
  const [playerStats, setPlayerStats] = useState([])
  const [deckStats, setDeckStats] = useState([])
  const [matchups, setMatchups] = useState([])
  const [games, setGames] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([
      api.statsPlayers(),
      api.statsDecks(),
      api.statsMatchups(),
      api.getGames()
    ]).then(([p, d, m, g]) => {
      setPlayerStats(p); setDeckStats(d); setMatchups(m); setGames(g)
    }).catch(() => setError('Errore nel caricamento statistiche')).finally(() => setLoading(false))
  }, [])

  const card = { background: t.bgSurface, border: `0.5px solid ${t.border}`, borderRadius: 12, padding: '1rem 1.25rem', marginBottom: 10 }

  const tabBtn = (tab2) => ({
    padding: '7px 16px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500,
    background: tab === tab2 ? t.primary : t.bgMuted,
    color: tab === tab2 ? t.primaryFg : t.textSub,
    transition: 'all 0.15s'
  })

  if (loading) return <div style={{ color: t.textSub, fontSize: 14, padding: '2rem' }}>Caricamento...</div>
  if (error)   return <div style={{ color: t.danger,  fontSize: 14 }}>{error}</div>

  const totalGames = games.length
  const topPlayer  = playerStats[0]
  const topDeck    = deckStats[0]

  return (
    <div>
      {/* Metriche globali */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: '1.5rem' }}>
        <MetricCard label="Partite totali"    value={totalGames}                    t={t} />
        <MetricCard label="Giocatori"         value={playerStats.length}            t={t} />
        <MetricCard label="Mazzi registrati"  value={deckStats.length}              t={t} />
        <MetricCard label="Top player"        value={topPlayer?.username || '—'}    t={t} />
      </div>

      {/* Tab selector */}
      <div style={{ display: 'flex', gap: 6, marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        {['giocatori', 'mazzi', 'matchup', 'storico'].map(t2 => (
          <button key={t2} style={tabBtn(t2)} onClick={() => setTab(t2)}>
            {t2.charAt(0).toUpperCase() + t2.slice(1)}
          </button>
        ))}
      </div>

      {/* GIOCATORI */}
      {tab === 'giocatori' && (
        <div>
          {playerStats.length === 0 && <div style={{ ...card, color: t.textSub, fontSize: 14, textAlign: 'center', padding: '2rem' }}>Nessuna partita ancora</div>}
          {playerStats.map((p, i) => (
            <div key={p.id} style={card}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 12, color: t.textMuted, minWidth: 20 }}>#{i + 1}</span>
                  <Avatar name={p.username} t={t} />
                  <div>
                    <div style={{ fontWeight: 500, color: t.text }}>{p.username}</div>
                    <div style={{ fontSize: 12, color: t.textSub }}>{p.wins}V / {p.games - p.wins}P · {p.games} partite</div>
                  </div>
                </div>
                <div style={{ fontSize: 22, fontWeight: 600, color: t.primary }}>{p.winRate}%</div>
              </div>
              <WinBar pct={p.winRate} t={t} />
            </div>
          ))}
        </div>
      )}

      {/* MAZZI */}
      {tab === 'mazzi' && (
        <div>
          {deckStats.length === 0 && <div style={{ ...card, color: t.textSub, fontSize: 14, textAlign: 'center', padding: '2rem' }}>Nessun mazzo ha ancora giocato</div>}
          {deckStats.map((d, i) => (
            <div key={d.id} style={card}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 12, color: t.textMuted, minWidth: 20 }}>#{i + 1}</span>
                  <div>
                    <div style={{ fontWeight: 500, color: t.text }}>{d.name}</div>
                    <div style={{ fontSize: 12, color: t.textSub }}>
                      {d.owner}{d.commander ? ` · ${d.commander}` : ''} · {d.wins}V / {d.games - d.wins}P
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 20, fontWeight: 600, color: d.winRate >= 50 ? t.win : d.winRate > 0 ? t.primary : t.textMuted }}>
                    {d.games > 0 ? `${d.winRate}%` : 'n/a'}
                  </div>
                  <div style={{ fontSize: 11, color: t.textMuted }}>{d.games} partite</div>
                </div>
              </div>
              {d.games > 0 && <WinBar pct={d.winRate} t={t} />}
            </div>
          ))}
        </div>
      )}

      {/* MATCHUP */}
      {tab === 'matchup' && (
        <div>
          {matchups.length === 0 && (
            <div style={{ ...card, color: t.textSub, fontSize: 14, textAlign: 'center', padding: '2rem' }}>
              Servono più partite per i dati di matchup
            </div>
          )}
          {matchups
            .filter(m => m.deckA.id < m.deckB.id)
            .sort((a, b) => b.games - a.games)
            .map((m, i) => {
              const wrA = m.winRate
              const wrB = 100 - wrA
              return (
                <div key={i} style={card}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 100 }}>
                      <div style={{ fontWeight: 500, fontSize: 14, color: t.text }}>{m.deckA.name}</div>
                      <div style={{ fontSize: 11, color: t.textSub }}>{m.deckA.owner}</div>
                    </div>
                    <div style={{ textAlign: 'center', padding: '0 8px' }}>
                      <div style={{ fontSize: 12, color: t.textSub }}>{m.games} partite</div>
                      <div style={{ fontSize: 11, color: t.textMuted }}>vs</div>
                    </div>
                    <div style={{ flex: 1, minWidth: 100, textAlign: 'right' }}>
                      <div style={{ fontWeight: 500, fontSize: 14, color: t.text }}>{m.deckB.name}</div>
                      <div style={{ fontSize: 11, color: t.textSub }}>{m.deckB.owner}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: t.primary, minWidth: 36 }}>{wrA}%</span>
                    <div style={{ flex: 1, height: 8, borderRadius: 4, background: t.bgMuted, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${wrA}%`, background: t.primary, borderRadius: 4, transition: 'width 0.4s' }} />
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 500, color: t.textSub, minWidth: 36, textAlign: 'right' }}>{wrB}%</span>
                  </div>
                </div>
              )
            })}
        </div>
      )}

      {/* STORICO */}
      {tab === 'storico' && (
        <div>
          {games.length === 0 && (
            <div style={{ ...card, color: t.textSub, fontSize: 14, textAlign: 'center', padding: '2rem' }}>
              Nessuna partita ancora. Vai su "+ Partita" per registrarne una!
            </div>
          )}
          {games.map(g => {
            const winner = g.players.find(p => p.isWinner)
            const date = new Date(g.playedAt).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })
            return (
              <div key={g.id} style={card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div style={{ fontSize: 12, color: t.textMuted }}>{date} · {g.players.length} giocatori</div>
                  {winner && (
                    <span style={{ fontSize: 12, background: t.winBg, color: t.win, padding: '3px 10px', borderRadius: 20, fontWeight: 500 }}>
                      {winner.user.username} · {winner.deck.name}
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {g.players.map(p => (
                    <span key={p.id} style={{
                      fontSize: 12, padding: '3px 10px', borderRadius: 20,
                      background: p.isWinner ? t.winBg : t.bgMuted,
                      color: p.isWinner ? t.win : t.textSub
                    }}>
                      {p.user.username} · {p.deck.name}
                    </span>
                  ))}
                </div>
                {g.notes && <div style={{ fontSize: 12, color: t.textMuted, marginTop: 8, fontStyle: 'italic' }}>{g.notes}</div>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
