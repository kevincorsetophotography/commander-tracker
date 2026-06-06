import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { useTheme } from '../hooks/useTheme'
import { Skeleton } from '../components/Skeleton'
import EmptyState from '../components/EmptyState'
import DeckThumb from '../components/DeckThumb'
import GameSocial from '../components/GameSocial'

export default function GamePage() {
  const { id } = useParams()
  const gid = Number.parseInt(id, 10)
  const navigate = useNavigate()
  const { t } = useTheme()

  const [game, setGame] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    setLoading(true); setError('')
    api.getGame(gid)
      .then(g => { if (alive) setGame(g) })
      .catch(err => { if (alive) setError(err.error || 'Partita non trovata') })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [gid])

  const back = (
    <button onClick={() => navigate(-1)} style={{ padding: '6px 14px', borderRadius: 10, border: `1px solid ${t.border}`, background: t.bgMuted, color: t.textSub, fontSize: 13, fontWeight: 600, cursor: 'pointer', marginBottom: 16 }}>← Indietro</button>
  )

  if (loading) return (<div>{back}<Skeleton h={200} r={16} /></div>)
  if (error || !game) return (<div>{back}<EmptyState icon="🔍" title="Partita non trovata" message={error || 'Questa partita non esiste.'} /></div>)

  const card = {
    background: t.bgSurface, border: `1px solid ${t.border}`, borderRadius: 16,
    padding: '1.15rem 1.35rem', marginBottom: 14, boxShadow: t.shadow,
  }

  const date = new Date(game.playedAt).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const winner = game.players.find(p => p.isWinner)
  const ranked = game.players.every(p => p.placement != null)
  const ordered = ranked ? [...game.players].sort((a, b) => a.placement - b.placement) : game.players
  const kills = game.players.filter(p => p.eliminatedById)

  const medal = (placement) => placement === 1 ? '🥇' : placement === 2 ? '🥈' : placement === 3 ? '🥉' : `${placement}°`

  return (
    <div>
      {back}

      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: t.text, textTransform: 'capitalize' }}>{date}</div>
            <div style={{ fontSize: 12, color: t.textMuted, marginTop: 2 }}>{game.players.length} giocatori{game.createdBy ? ` · registrata da ${game.createdBy.username}` : ''}</div>
          </div>
          {winner && (
            <span style={{ fontSize: 13, background: t.winBg, color: t.win, padding: '5px 12px', borderRadius: 20, fontWeight: 600 }}>
              🏆 {winner.user.username} · {winner.deck.name}
            </span>
          )}
        </div>

        {/* Giocatori al tavolo (in ordine di piazzamento se disponibile) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {ordered.map(p => (
            <div
              key={p.id}
              onClick={() => navigate(`/mazzo/${p.deck.id}`)}
              title="Apri il profilo del mazzo"
              style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '8px 10px', borderRadius: 12, cursor: 'pointer',
                background: p.isWinner ? t.winBg : t.bgMuted,
                border: `1px solid ${p.isWinner ? (t.winBorder || t.border) : t.border}`,
              }}
            >
              {ranked && <span style={{ fontSize: 15, fontWeight: 800, minWidth: 26, textAlign: 'center', color: p.isWinner ? t.win : t.textSub }}>{medal(p.placement)}</span>}
              <DeckThumb commander={p.deck.commander} w={48} preview={false} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: p.isWinner ? t.win : t.text }}>{p.user.username}</div>
                <div style={{ fontSize: 12, color: t.textSub, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {p.deck.name}{p.deck.commander ? ` · ${p.deck.commander}` : ''}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Eliminazioni */}
        {kills.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 11, color: t.textSub, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, marginBottom: 6 }}>Eliminazioni</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', fontSize: 13, color: t.textMuted }}>
              {kills.map(p => {
                const killer = game.players.find(x => x.user.id === p.eliminatedById)
                return <span key={p.id}>⚔️ {killer?.user.username || '?'} → {p.user.username}</span>
              })}
            </div>
          </div>
        )}

        {/* Note */}
        {game.notes && (
          <div style={{ marginTop: 12, fontSize: 13, color: t.textMuted, fontStyle: 'italic', whiteSpace: 'pre-wrap' }}>{game.notes}</div>
        )}

        {/* Reazioni + commenti (aperti) */}
        <GameSocial game={game} defaultOpen />
      </div>
    </div>
  )
}
