import { useState, useEffect } from 'react'
import { api } from '../lib/api'

function WinBar({ pct }) {
  return (
    <div style={{ height: 6, borderRadius: 3, background: '#f0ede8', overflow: 'hidden', marginTop: 6 }}>
      <div style={{ height: '100%', width: `${pct}%`, background: '#534AB7', borderRadius: 3, transition: 'width 0.4s' }} />
    </div>
  )
}

function Avatar({ name, size = 32 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', background: '#EEEDFE', color: '#534AB7',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.38, fontWeight: 500, flexShrink: 0
    }}>
      {name?.substring(0, 2).toUpperCase()}
    </div>
  )
}

function MetricCard({ label, value }) {
  return (
    <div style={{ background: '#f5f4f0', borderRadius: 10, padding: '0.9rem 1rem' }}>
      <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 500 }}>{value}</div>
    </div>
  )
}

export default function DashboardPage() {
  const [tab, setTab] = useState('giocatori') // giocatori | mazzi | matchup | storico
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
      setPlayerStats(p)
      setDeckStats(d)
      setMatchups(m)
      setGames(g)
    }).catch(() => setError('Errore nel caricamento statistiche')).finally(() => setLoading(false))
  }, [])

  const totalGames = games.length
  const topPlayer = playerStats[0]
  const topDeck = deckStats[0]

  const tabStyle = (t) => ({
    padding: '7px 16px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500,
    background: tab === t ? '#534AB7' : '#f0ede8',
    color: tab === t ? '#fff' : '#666',
    transition: 'all 0.15s'
  })

  const card = { background: '#fff', border: '0.5px solid #e0ddd5', borderRadius: 12, padding: '1rem 1.25rem', marginBottom: 10 }

  if (loading) return <div style={{ color: '#888', fontSize: 14, padding: '2rem' }}>Caricamento...</div>
  if (error) return <div style={{ color: '#a32d2d', fontSize: 14 }}>{error}</div>

  return (
    <div>
      {/* Metriche globali */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: '1.5rem' }}>
        <MetricCard label="Partite totali" value={totalGames} />
        <MetricCard label="Giocatori" value={playerStats.length} />
        <MetricCard label="Mazzi registrati" value={deckStats.length} />
        <MetricCard label="Top player" value={topPlayer?.username || '—'} />
      </div>

      {/* Tab selector */}
      <div style={{ display: 'flex', gap: 6, marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        {['giocatori', 'mazzi', 'matchup', 'storico'].map(t => (
          <button key={t} style={tabStyle(t)} onClick={() => setTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* GIOCATORI */}
      {tab === 'giocatori' && (
        <div>
          {playerStats.length === 0 && <div style={{ ...card, color: '#888', fontSize: 14, textAlign: 'center', padding: '2rem' }}>Nessuna partita ancora</div>}
          {playerStats.map((p, i) => (
            <div key={p.id} style={card}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 12, color: '#aaa', minWidth: 20 }}>#{i + 1}</span>
                  <Avatar name={p.username} />
                  <div>
                    <div style={{ fontWeight: 500 }}>{p.username}</div>
                    <div style={{ fontSize: 12, color: '#888' }}>{p.wins}V / {p.games - p.wins}P · {p.games} partite</div>
                  </div>
                </div>
                <div style={{ fontSize: 22, fontWeight: 500, color: '#534AB7' }}>{p.winRate}%</div>
              </div>
              <WinBar pct={p.winRate} />
            </div>
          ))}
        </div>
      )}

      {/* MAZZI */}
      {tab === 'mazzi' && (
        <div>
          {deckStats.length === 0 && <div style={{ ...card, color: '#888', fontSize: 14, textAlign: 'center', padding: '2rem' }}>Nessun mazzo ha ancora giocato</div>}
          {deckStats.map((d, i) => (
            <div key={d.id} style={card}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 12, color: '#aaa', minWidth: 20 }}>#{i + 1}</span>
                  <div>
                    <div style={{ fontWeight: 500 }}>{d.name}</div>
                    <div style={{ fontSize: 12, color: '#888' }}>
                      {d.owner}{d.commander ? ` · ${d.commander}` : ''} · {d.wins}V / {d.games - d.wins}P
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 20, fontWeight: 500, color: d.winRate >= 50 ? '#3B6D11' : d.winRate > 0 ? '#534AB7' : '#aaa' }}>
                    {d.games > 0 ? `${d.winRate}%` : 'n/a'}
                  </div>
                  <div style={{ fontSize: 11, color: '#aaa' }}>{d.games} partite</div>
                </div>
              </div>
              {d.games > 0 && <WinBar pct={d.winRate} />}
            </div>
          ))}
        </div>
      )}

      {/* MATCHUP */}
      {tab === 'matchup' && (
        <div>
          {matchups.length === 0 && (
            <div style={{ ...card, color: '#888', fontSize: 14, textAlign: 'center', padding: '2rem' }}>
              Servono più partite per i dati di matchup
            </div>
          )}
          {matchups
            .filter(m => m.deckA.id < m.deckB.id) // mostra ogni coppia una volta sola
            .sort((a, b) => b.games - a.games)
            .map((m, i) => {
              const wrA = m.winRate
              const wrB = 100 - wrA
              // trova il dato inverso per deckB
              return (
                <div key={i} style={card}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 100 }}>
                      <div style={{ fontWeight: 500, fontSize: 14 }}>{m.deckA.name}</div>
                      <div style={{ fontSize: 11, color: '#888' }}>{m.deckA.owner}</div>
                    </div>
                    <div style={{ textAlign: 'center', padding: '0 8px' }}>
                      <div style={{ fontSize: 12, color: '#aaa' }}>{m.games} partite</div>
                      <div style={{ fontSize: 11, color: '#bbb' }}>vs</div>
                    </div>
                    <div style={{ flex: 1, minWidth: 100, textAlign: 'right' }}>
                      <div style={{ fontWeight: 500, fontSize: 14 }}>{m.deckB.name}</div>
                      <div style={{ fontSize: 11, color: '#888' }}>{m.deckB.owner}</div>
                    </div>
                  </div>
                  {/* Barra duale */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: '#534AB7', minWidth: 36 }}>{wrA}%</span>
                    <div style={{ flex: 1, height: 8, borderRadius: 4, background: '#f0ede8', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${wrA}%`, background: '#534AB7', borderRadius: 4, transition: 'width 0.4s' }} />
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 500, color: '#888', minWidth: 36, textAlign: 'right' }}>{wrB}%</span>
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
            <div style={{ ...card, color: '#888', fontSize: 14, textAlign: 'center', padding: '2rem' }}>
              Nessuna partita ancora. Vai su "+ Partita" per registrarne una!
            </div>
          )}
          {games.map(g => {
            const winner = g.players.find(p => p.isWinner)
            const date = new Date(g.playedAt).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })
            return (
              <div key={g.id} style={card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div style={{ fontSize: 12, color: '#aaa' }}>{date} · {g.players.length} giocatori</div>
                  {winner && (
                    <span style={{ fontSize: 12, background: '#EAF3DE', color: '#3B6D11', padding: '3px 10px', borderRadius: 20, fontWeight: 500 }}>
                      {winner.user.username} · {winner.deck.name}
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {g.players.map(p => (
                    <span key={p.id} style={{
                      fontSize: 12, padding: '3px 10px', borderRadius: 20,
                      background: p.isWinner ? '#EAF3DE' : '#f5f4f0',
                      color: p.isWinner ? '#3B6D11' : '#666'
                    }}>
                      {p.user.username} · {p.deck.name}
                    </span>
                  ))}
                </div>
                {g.notes && <div style={{ fontSize: 12, color: '#aaa', marginTop: 8, fontStyle: 'italic' }}>{g.notes}</div>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
