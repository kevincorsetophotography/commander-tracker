import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { useTheme } from '../hooks/useTheme'
import { useAuth } from '../hooks/useAuth'
import { useCardArt } from '../lib/cardCache'
import PlayerAvatar from '../components/PlayerAvatar'
import BracketBadge from '../components/BracketBadge'
import { Icon, ManaPips, SectionLabel, bento } from '../components/ui'
import OpenTables from '../components/OpenTables'

// Gioca v2 (restyle Stitch): CTA "Registra partita", il tuo tavolo stasera (se c'è),
// Giudice, i tuoi mazzi recenti, prossimo evento, ultima partita. Stesse funzioni di prima.

function relativeDate(date) {
  const diffDays = Math.floor((Date.now() - new Date(date)) / 86400000)
  if (diffDays === 0) return 'Oggi'
  if (diffDays === 1) return 'Ieri'
  if (diffDays < 7) return `${diffDays} gg fa`
  return new Date(date).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })
}

const sameLocalDay = (a, b) => {
  const x = new Date(a), y = new Date(b)
  return x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate()
}

function DeckCard({ deck, t, onClick }) {
  const { status, art } = useCardArt(deck.commander)
  return (
    <button onClick={onClick} className="ct-lift" style={{
      flex: '0 0 auto', width: 168, padding: 0, textAlign: 'left', cursor: 'pointer', overflow: 'hidden',
      ...bento(t, { borderRadius: 18 }),
    }}>
      <div style={{ position: 'relative', height: 92, background: '#0f1225' }}>
        {status === 'ready' && <img src={art} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 20%' }} />}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, transparent 40%, rgba(8,10,28,0.75))' }} />
        <span style={{ position: 'absolute', left: 8, bottom: 8 }}><ManaPips colors={deck.colors} size={18} /></span>
      </div>
      <div style={{ padding: '9px 10px 11px' }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: t.text, lineHeight: 1.25, wordBreak: 'break-word' }}>{deck.name}</div>
        {deck.commander && <div style={{ fontSize: 12, color: t.textSub, marginTop: 2, lineHeight: 1.3, wordBreak: 'break-word' }}>{deck.commander.split('//')[0].trim()}</div>}
        {deck.bracket && <div style={{ marginTop: 6 }}><BracketBadge bracket={deck.bracket} size="lg" /></div>}
      </div>
    </button>
  )
}

export default function GiocaPage() {
  const { t } = useTheme()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [games, setGames] = useState([])
  const [decks, setDecks] = useState([])
  const [events, setEvents] = useState([])
  const [tonight, setTonight] = useState(null) // { event, table } se stasera ho un tavolo

  useEffect(() => {
    Promise.allSettled([api.getGames(), api.getDecks(), api.getEvents()])
      .then(([g, d, e]) => {
        if (g.status === 'fulfilled') setGames(g.value)
        if (d.status === 'fulfilled') setDecks(d.value)
        if (e.status === 'fulfilled') setEvents(e.value)
      })
  }, [])

  // Ultimi mazzi usati da me (dall'ordine delle partite)
  const recentDecks = (() => {
    const seen = new Set()
    const result = []
    for (const g of games) {
      const me = g.players.find(p => p.user.id === user?.id)
      if (me && !seen.has(me.deck.id)) {
        seen.add(me.deck.id)
        result.push(me.deck)
        if (result.length >= 3) break
      }
    }
    // fallback: i miei mazzi se non ho giocato
    if (result.length === 0) {
      decks.filter(d => d.userId === user?.id).slice(0, 3).forEach(d => result.push(d))
    }
    return result
  })()

  const lastGame = games.find(g => g.players.some(p => p.user.id === user?.id))

  const nextEvent = (() => {
    const now = Date.now()
    return events
      .filter(e => new Date(e.startsAt).getTime() + 5 * 3600000 > now)
      .sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt))[0] || null
  })()

  // Evento di oggi con tavoli: cerco il mio tavolo dell'ultimo turno
  useEffect(() => {
    if (!nextEvent || !nextEvent.format || !sameLocalDay(nextEvent.startsAt, new Date())) return
    api.getEvent(nextEvent.id).then(ev => {
      const round = ev.rounds?.[ev.rounds.length - 1]
      const table = round?.tables.find(tb => tb.seats.some(s => s.user.id === user?.id))
      if (table) setTonight({ event: ev, table, round })
    }).catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nextEvent?.id])

  const eventCountdown = (startsAt) => {
    const diff = Math.ceil((new Date(startsAt) - Date.now()) / 86400000)
    if (diff <= 0) return 'Oggi'
    if (diff === 1) return 'Domani'
    return `Tra ${diff} giorni`
  }

  const rowBtn = (extra = {}) => ({
    width: '100%', textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12,
    ...bento(t, { padding: '0.95rem 1rem', ...extra }),
  })

  return (
    <div style={{ maxWidth: 560, margin: '0 auto' }}>
      <div style={{ fontSize: 26, fontWeight: 800, color: t.text, letterSpacing: '-0.02em', marginBottom: 14 }}>Gioca</div>

      {/* Hero CTA — Registra partita */}
      <button
        className="ct-fade-up ct-press"
        onClick={() => navigate('/nuova-partita')}
        style={{
          display: 'flex', alignItems: 'center', gap: 16, width: '100%', textAlign: 'left', marginBottom: 14,
          background: t.gradient, color: t.primaryFg, border: 'none', borderRadius: 24, padding: '1.4rem 1.3rem',
          cursor: 'pointer', boxShadow: t.glow === 'none' ? t.shadow : `${t.glow}, ${t.shadow}`,
        }}
      >
        <span style={{ width: 58, height: 58, borderRadius: 18, background: 'rgba(4,17,26,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon name="swords" size={30} stroke={2.2} />
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 22, fontWeight: 900, lineHeight: 1.15 }}>Registra partita</span>
          <span style={{ display: 'block', fontSize: 14, fontWeight: 600, opacity: 0.85, marginTop: 4 }}>Il risultato di una partita appena finita</span>
        </span>
        <Icon name="chevron" size={24} stroke={2.4} />
      </button>

      {/* Tavoli aperti dai giocatori (si agganciano da soli alla serata in corso) */}
      <OpenTables showEvent title="Tavoli aperti adesso" emptyHint="Nessun tavolo aperto in questo momento. Aprine uno con un tocco: gli altri vedranno i posti liberi e potranno sedersi." />

      {/* Stasera: il tuo tavolo (torneo) */}
      {tonight && (
        <div className="ct-fade-up" style={bento(t, { padding: '1rem', marginBottom: 14, border: `1px solid ${t.primaryBorder}`, animationDelay: '40ms' })}>
          <SectionLabel t={t} icon="groups" right={<span style={{ fontSize: 12, fontWeight: 700, color: t.primary }}>Turno {tonight.round.number}</span>}>
            Stasera · Tavolo {tonight.table.number}
          </SectionLabel>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
            {tonight.table.seats.map(s => (
              <span key={s.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 14, fontWeight: 600, color: t.text, background: t.bgSurfaceAlt, border: `1px solid ${t.border}`, borderRadius: 999, padding: '3px 11px 3px 3px' }}>
                <PlayerAvatar username={s.user.username} avatarCardName={s.user.avatarCardName} avatarScryfallId={s.user.avatarScryfallId} size={28} highlight={s.user.id === user?.id} />
                {s.user.username}
              </span>
            ))}
          </div>
          {tonight.table.done ? (
            <button onClick={() => navigate(`/evento/${tonight.event.id}`)} className="ct-press" style={{ width: '100%', minHeight: 46, borderRadius: 14, border: `1px solid ${t.border}`, background: t.bgSurfaceAlt, color: t.text, fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
              Tavolo concluso · vedi la serata
            </button>
          ) : (
            <button
              onClick={() => navigate('/nuova-partita', { state: { podContext: { eventId: tonight.event.id, tableId: tonight.table.id, date: tonight.event.startsAt, players: tonight.table.seats.map(s => ({ userId: s.user.id, username: s.user.username })) } } })}
              className="ct-press"
              style={{ width: '100%', minHeight: 48, borderRadius: 14, border: 'none', background: t.primary, color: t.primaryFg, fontSize: 15, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: t.glow }}
            >
              <Icon name="swords" size={18} stroke={2.2} /> Registra il risultato del tavolo
            </button>
          )}
        </div>
      )}

      {/* Giudice */}
      <button className="ct-fade-up ct-lift" onClick={() => navigate('/giudice')} style={{ ...rowBtn(), marginBottom: 22, animationDelay: '80ms' }}>
        <span style={{ width: 46, height: 46, borderRadius: 14, background: 'rgba(139,92,246,0.18)', color: t.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon name="book" size={23} />
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 16, fontWeight: 800, color: t.text }}>Chiedi al Giudice</span>
          <span style={{ display: 'block', fontSize: 13, color: t.textSub, marginTop: 2 }}>Ruling Commander · Regole complete + Scryfall</span>
        </span>
        <span style={{ color: t.textMuted, display: 'flex' }}><Icon name="chevron" size={20} /></span>
      </button>

      {/* Ultimi mazzi usati */}
      {recentDecks.length > 0 && (
        <div className="ct-fade-up" style={{ marginBottom: 22, animationDelay: '120ms' }}>
          <SectionLabel t={t} icon="cards" right={
            <button onClick={() => navigate('/mazzi')} style={{ background: 'none', border: 'none', color: t.primary, fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 2, padding: '6px 0' }}>
              I miei mazzi <Icon name="chevron" size={15} />
            </button>
          }>Ultimi mazzi usati</SectionLabel>
          <div className="ct-scroll-x" style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }}>
            {recentDecks.map(deck => (
              <DeckCard key={deck.id} deck={deck} t={t} onClick={() => navigate('/mazzo/' + deck.id)} />
            ))}
          </div>
        </div>
      )}

      {/* Prossimo evento */}
      {nextEvent && (
        <div className="ct-fade-up" style={{ marginBottom: 22, animationDelay: '160ms' }}>
          <SectionLabel t={t} icon="calendar">Prossimo evento</SectionLabel>
          <button onClick={() => navigate(`/evento/${nextEvent.id}`)} className="ct-lift" style={rowBtn({ background: t.primaryBg, border: `1px solid ${t.primaryBorder}` })}>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 16, fontWeight: 800, color: t.text, wordBreak: 'break-word' }}>{nextEvent.title}</span>
              <span style={{ display: 'block', fontSize: 13, color: t.textSub, marginTop: 3, textTransform: 'capitalize' }}>
                {new Date(nextEvent.startsAt).toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'long' })}
                {nextEvent.rsvps?.length > 0 ? ` · ${nextEvent.rsvps.length} iscritti` : ''}
              </span>
            </span>
            <span style={{ fontSize: 12, fontWeight: 800, color: t.primary, flexShrink: 0, background: t.bgSurface, border: `1px solid ${t.primaryBorder}`, borderRadius: 999, padding: '4px 10px', whiteSpace: 'nowrap' }}>
              {eventCountdown(nextEvent.startsAt)}
            </span>
          </button>
        </div>
      )}

      {/* Ultima partita */}
      {lastGame && (() => {
        const winner = lastGame.players.find(p => p.isWinner)
        const me = lastGame.players.find(p => p.user.id === user?.id)
        const iWon = !!me?.isWinner
        return (
          <div className="ct-fade-up" style={{ animationDelay: '200ms' }}>
            <SectionLabel t={t} icon="trophy">La tua ultima partita</SectionLabel>
            <button onClick={() => navigate('/partita/' + lastGame.id)} className="ct-lift" style={rowBtn(iWon ? { background: t.winBg, border: `1px solid ${t.primaryBorder}` } : {})}>
              <PlayerAvatar username={winner?.user?.username} avatarCardName={winner?.user?.avatarCardName} avatarScryfallId={winner?.user?.avatarScryfallId} size={44} highlight={iWon} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 15, fontWeight: 800, color: iWon ? t.win : t.text }}>
                  {iWon ? 'Hai vinto!' : `${me?.placement ? `${me.placement}° posto · ` : ''}Vittoria di ${winner?.user?.username}`}
                </span>
                <span style={{ display: 'block', fontSize: 13, color: t.textSub, marginTop: 2, wordBreak: 'break-word' }}>
                  {winner?.deck?.commander ? winner.deck.commander.split('//')[0].trim() : winner?.deck?.name || ''}
                </span>
                <span style={{ display: 'block', fontSize: 12, color: t.textMuted, marginTop: 2 }}>
                  {lastGame.players.length} giocatori · {relativeDate(lastGame.playedAt)}
                </span>
              </span>
              <span style={{ color: t.textMuted, display: 'flex' }}><Icon name="chevron" size={20} /></span>
            </button>
          </div>
        )
      })()}
    </div>
  )
}
