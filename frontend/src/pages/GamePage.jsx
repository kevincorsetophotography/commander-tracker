import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { useTheme } from '../hooks/useTheme'
import { Skeleton } from '../components/Skeleton'
import EmptyState from '../components/EmptyState'
import DeckThumb from '../components/DeckThumb'
import GameSocial from '../components/GameSocial'
import PlayerAvatar from '../components/PlayerAvatar'
import { Icon, ManaPips, SectionLabel, bento } from '../components/ui'

// Dettaglio partita v2: vincitore in evidenza, piazzamenti, eliminazioni in ordine,
// note, reazioni e commenti. Stesse funzioni di prima.

const PODIUM = ['#F5C518', '#C9D1E0', '#D9915A']

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
    <button onClick={() => navigate(-1)} className="ct-press" style={{ minHeight: 40, padding: '0 14px 0 10px', borderRadius: 12, border: `1px solid ${t.border}`, background: t.bgSurfaceAlt, color: t.text, fontSize: 14, fontWeight: 700, cursor: 'pointer', marginBottom: 14, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <Icon name="back" size={17} /> Indietro
    </button>
  )

  if (loading) return (<div style={{ maxWidth: 640, margin: '0 auto' }}>{back}<Skeleton h={240} r={20} /></div>)
  if (error || !game) return (<div style={{ maxWidth: 640, margin: '0 auto' }}>{back}<EmptyState icon="🔍" title="Partita non trovata" message={error || 'Questa partita non esiste.'} /></div>)

  const card = bento(t, { padding: '1rem', marginBottom: 14 })

  const date = new Date(game.playedAt).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const winner = game.players.find(p => p.isWinner)
  const ranked = game.players.every(p => p.placement != null)
  const ordered = ranked
    ? [...game.players].sort((a, b) => a.placement - b.placement)
    : [...game.players].sort((a, b) => (b.isWinner ? 1 : 0) - (a.isWinner ? 1 : 0))
  const kills = game.players.filter(p => p.eliminatedById)
  // ordine delle eliminazioni: dal primo eliminato (piazzamento più alto) all'ultimo
  const killsOrdered = ranked ? [...kills].sort((a, b) => b.placement - a.placement) : kills

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      {back}

      {/* Testata */}
      <div className="ct-fade-up" style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 24, fontWeight: 800, color: t.text, textTransform: 'capitalize', lineHeight: 1.2 }}>{date}</div>
        <div style={{ fontSize: 14, color: t.textSub, marginTop: 4 }}>
          {game.players.length} giocatori{game.createdBy ? ` · registrata da ${game.createdBy.username}` : ''}
        </div>
      </div>

      {/* Vincitore */}
      {winner && (
        <div className="ct-fade-up ct-lift" onClick={() => navigate(`/mazzo/${winner.deck.id}`)} style={{
          ...card, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14,
          background: t.winBg, border: `1px solid ${t.primaryBorder}`, boxShadow: `${t.shadow}${t.glow !== 'none' ? ', ' + t.glow : ''}`,
        }}>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <PlayerAvatar username={winner.user.username} avatarCardName={winner.user.avatarCardName} avatarScryfallId={winner.user.avatarScryfallId} size={60} highlight />
            <span style={{ position: 'absolute', bottom: -4, right: -6, width: 28, height: 28, borderRadius: '50%', background: t.primary, color: t.primaryFg, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `2px solid ${t.bgPage}` }}>
              <Icon name="trophy" size={15} stroke={2.4} />
            </span>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: t.win }}>Vincitore</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: t.text, wordBreak: 'break-word' }}>{winner.user.username}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 3 }}>
              <span style={{ fontSize: 14, color: t.textSub, wordBreak: 'break-word' }}>{winner.deck.name}</span>
              <ManaPips colors={winner.deck.colors} size={18} />
            </div>
          </div>
          <DeckThumb commander={winner.deck.commander} w={64} radius={12} preview={false} />
        </div>
      )}

      {/* Classifica del tavolo */}
      <div className="ct-fade-up" style={{ ...card, animationDelay: '60ms' }}>
        <SectionLabel t={t} icon="groups">{ranked ? 'Piazzamenti' : 'Al tavolo'}</SectionLabel>
        {ordered.map(p => (
          <div key={p.id} onClick={() => navigate(`/mazzo/${p.deck.id}`)} className="ct-press" style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '10px', marginBottom: 8, borderRadius: 14, cursor: 'pointer',
            background: p.isWinner ? t.winBg : t.bgSurfaceAlt, border: `1px solid ${p.isWinner ? t.primaryBorder : t.border}`,
          }}>
            {ranked && (
              <span style={{ width: 30, flexShrink: 0, textAlign: 'center', fontSize: 16, fontWeight: 900, color: p.placement <= 3 ? PODIUM[p.placement - 1] : t.textSub }}>{p.placement}°</span>
            )}
            <PlayerAvatar username={p.user.username} avatarCardName={p.user.avatarCardName} avatarScryfallId={p.user.avatarScryfallId} size={40} highlight={p.isWinner} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: p.isWinner ? t.win : t.text, wordBreak: 'break-word' }}>{p.user.username}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
                <span style={{ fontSize: 13, color: t.textSub, wordBreak: 'break-word' }}>{p.deck.commander ? p.deck.commander.split('//')[0].trim() : p.deck.name}</span>
                <ManaPips colors={p.deck.colors} size={15} />
              </div>
            </div>
            <DeckThumb commander={p.deck.commander} w={44} radius={8} preview={false} />
          </div>
        ))}
      </div>

      {/* Eliminazioni */}
      {killsOrdered.length > 0 && (
        <div className="ct-fade-up" style={{ ...card, animationDelay: '120ms' }}>
          <SectionLabel t={t} icon="swords">Eliminazioni</SectionLabel>
          {killsOrdered.map((p, i) => {
            const killer = game.players.find(x => x.user.id === p.eliminatedById)
            return (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: i ? `1px solid ${t.border}` : 'none', flexWrap: 'wrap' }}>
                <span style={{ width: 22, fontSize: 13, fontWeight: 800, color: t.textMuted, textAlign: 'center' }}>{i + 1}</span>
                <PlayerAvatar username={killer?.user.username || '?'} avatarCardName={killer?.user.avatarCardName} avatarScryfallId={killer?.user.avatarScryfallId} size={30} />
                <span style={{ fontSize: 14, fontWeight: 700, color: t.text }}>{killer?.user.username || '?'}</span>
                <span style={{ color: t.danger, display: 'flex' }}><Icon name="swords" size={16} /></span>
                <PlayerAvatar username={p.user.username} avatarCardName={p.user.avatarCardName} avatarScryfallId={p.user.avatarScryfallId} size={30} />
                <span style={{ fontSize: 14, color: t.textSub, wordBreak: 'break-word' }}>{p.user.username}</span>
              </div>
            )
          })}
        </div>
      )}

      {/* Note */}
      {game.notes && (
        <div className="ct-fade-up" style={{ ...card, animationDelay: '160ms' }}>
          <SectionLabel t={t} icon="comment">Note</SectionLabel>
          <div style={{ fontSize: 15, color: t.text, whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.5 }}>{game.notes}</div>
        </div>
      )}

      {/* Reazioni + commenti (aperti) */}
      <div className="ct-fade-up" style={{ ...card, animationDelay: '200ms' }}>
        <GameSocial game={game} defaultOpen />
      </div>
    </div>
  )
}
