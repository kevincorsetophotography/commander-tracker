import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { useTheme } from '../hooks/useTheme'
import { useAuth } from '../hooks/useAuth'
import { useFeedback } from '../hooks/useFeedback'
import { Skeleton } from '../components/Skeleton'
import EmptyState from '../components/EmptyState'
import PlayerAvatar from '../components/PlayerAvatar'
import { Icon, Segmented, AvatarStack, ManaPips, SectionLabel, bento } from '../components/ui'
import { FormatChip } from './EventsPage'

// Dettaglio evento v2 (restyle Stitch): vista "stasera" con iscritti, il tuo tavolo
// in evidenza, turni a segmenti, partite della serata. Stessa API di prima.

const sameLocalDay = (a, b) => {
  const x = new Date(a), y = new Date(b)
  return x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate()
}

export default function EventDetailPage() {
  const { id } = useParams()
  const eid = Number.parseInt(id, 10)
  const navigate = useNavigate()
  const { t } = useTheme()
  const { user } = useAuth()
  const { toast, confirm } = useFeedback()
  const isAdmin = user?.role === 'ADMIN'

  const [event, setEvent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [scores, setScores] = useState({}) // tableId -> { a, b }
  const [view, setView] = useState(null)   // id turno selezionato | 'classifica'
  const [games, setGames] = useState([])   // partite registrate nel giorno dell'evento

  const load = () => {
    setLoading(true); setError('')
    api.getEvent(eid).then(setEvent).catch(e => setError(e.error || 'Evento non trovato')).finally(() => setLoading(false))
  }
  useEffect(load, [eid])
  useEffect(() => { api.getGames().then(setGames).catch(() => {}) }, [eid])

  const nightGames = useMemo(
    () => event ? games.filter(g => sameLocalDay(g.playedAt, event.startsAt)) : [],
    [games, event],
  )

  const back = (
    <button onClick={() => navigate('/eventi')} className="ct-press" style={{ minHeight: 40, padding: '0 14px 0 10px', borderRadius: 12, border: `1px solid ${t.border}`, background: t.bgSurfaceAlt, color: t.text, fontSize: 14, fontWeight: 700, cursor: 'pointer', marginBottom: 14, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <Icon name="back" size={17} /> Eventi
    </button>
  )

  if (loading) return (<div style={{ maxWidth: 640, margin: '0 auto' }}>{back}<Skeleton h={220} r={20} /></div>)
  if (error || !event) return (<div style={{ maxWidth: 640, margin: '0 auto' }}>{back}<EmptyState icon="🔍" title="Evento non trovato" message={error} /></div>)

  const going = event.rsvps?.some(r => r.userId === user?.id)
  const registrants = event.rsvps || []
  const rounds = event.rounds || []
  const is1v1 = event.format === '1v1'
  const activeView = view ?? (rounds.length ? rounds[rounds.length - 1].id : null)
  const avatarOf = (uid) => registrants.find(r => r.userId === uid)?.user || {}

  const toggleRsvp = async () => {
    try { const { rsvps } = await api.toggleRsvp(eid); setEvent(ev => ({ ...ev, rsvps })) }
    catch (e) { toast(e.error || 'Errore adesione', 'error') }
  }
  const generateRound = async () => {
    setBusy(true)
    try { const ev = await api.generateRound(eid); setEvent(ev); setView(null); toast('Turno generato', 'success') }
    catch (e) { toast(e.error || 'Errore', 'error') }
    finally { setBusy(false) }
  }
  const deleteRound = async (rid) => {
    const ok = await confirm({ title: 'Eliminare il turno?', message: 'Tavoli e abbinamenti verranno rifatti.', confirmLabel: 'Elimina', danger: true })
    if (!ok) return
    try { await api.deleteRound(eid, rid); setView(null); load() } catch (e) { toast(e.error || 'Errore', 'error') }
  }
  const submitResult = async (tbl) => {
    const sc = scores[tbl.id] || { a: 0, b: 0 }
    try {
      setEvent(await api.submitTableResult(eid, tbl.id, { scoreA: sc.a, scoreB: sc.b }))
      toast('Risultato salvato', 'success')
    } catch (e) { toast(e.error || 'Errore', 'error') }
  }
  const setScore = (tableId, side, val) => setScores(s => ({ ...s, [tableId]: { ...(s[tableId] || { a: 0, b: 0 }), [side]: val } }))

  const start = new Date(event.startsAt)
  const dateLine = start.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const time = event.allDay ? null : start.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
  const diffDays = Math.round((new Date(start).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 86400000)
  const countdown = diffDays < 0 ? null : diffDays === 0 ? 'Stasera' : diffDays === 1 ? 'Domani' : `Tra ${diffDays} giorni`

  const card = bento(t, { padding: '1rem', marginBottom: 14 })
  const primaryBtn = { minHeight: 46, padding: '0 16px', borderRadius: 14, border: 'none', background: t.primary, color: t.primaryFg, fontSize: 15, fontWeight: 800, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, boxShadow: t.glow }
  const ghostBtn = { minHeight: 40, padding: '0 12px', borderRadius: 12, border: `1px solid ${t.border}`, background: t.bgSurfaceAlt, color: t.textSub, fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }
  const step = { width: 40, height: 40, borderRadius: 12, border: `1px solid ${t.border}`, background: t.bgSurface, color: t.text, cursor: 'pointer', fontSize: 20, fontWeight: 700, lineHeight: 1 }

  // Un tavolo (pod o pairing)
  const renderTable = (tbl) => {
    const mine = tbl.seats.some(s => s.user.id === user?.id)
    const isBye = tbl.seats.length === 1 && is1v1
    const isMatch = is1v1 && tbl.seats.length === 2
    return (
      <div key={tbl.id} className="ct-fade-up" style={{
        borderRadius: 18, padding: 14, marginBottom: 12,
        border: `1px solid ${mine ? t.primaryBorder : t.border}`,
        background: mine ? t.primaryBg : t.bgSurfaceAlt,
        boxShadow: mine && t.glow !== 'none' ? t.glow : 'none',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 16, fontWeight: 800, color: t.text }}>{isBye ? 'Bye' : isMatch ? `Match ${tbl.number}` : `Tavolo ${tbl.number}`}</span>
          {mine && <span style={{ fontSize: 12, fontWeight: 800, color: t.primaryFg, background: t.primary, padding: '3px 9px', borderRadius: 999 }}>Il tuo {isMatch ? 'match' : 'tavolo'}</span>}
          <span style={{
            marginLeft: 'auto', fontSize: 12, fontWeight: 700, padding: '3px 9px', borderRadius: 999,
            color: tbl.done ? t.win : t.textSub, background: tbl.done ? t.winBg : 'transparent', border: `1px solid ${tbl.done ? t.primaryBorder : t.border}`,
          }}>{tbl.done ? 'Concluso' : isBye ? 'Passa il turno' : 'In attesa del risultato'}</span>
        </div>

        {isBye ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 15, color: t.text }}>
            <PlayerAvatar username={tbl.seats[0].user.username} avatarCardName={tbl.seats[0].user.avatarCardName} avatarScryfallId={tbl.seats[0].user.avatarScryfallId} size={36} highlight={tbl.seats[0].user.id === user?.id} />
            <span style={{ fontWeight: 700, wordBreak: 'break-word' }}>{tbl.seats[0].user.username}</span>
          </div>
        ) : isMatch ? (() => {
          const sa = tbl.seats.find(s => s.seat === 0) || tbl.seats[0]
          const sb = tbl.seats.find(s => s.seat === 1) || tbl.seats[1]
          const canEnter = (isAdmin || mine) && !tbl.done
          const sc = scores[tbl.id] || { a: tbl.scoreA ?? 0, b: tbl.scoreB ?? 0 }
          const winA = tbl.done && tbl.winnerUserId === sa.user.id
          const winB = tbl.done && tbl.winnerUserId === sb.user.id
          const side = (s, win, key) => (
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, textAlign: 'center' }}>
              <div style={{ position: 'relative' }}>
                <PlayerAvatar username={s.user.username} avatarCardName={s.user.avatarCardName} avatarScryfallId={s.user.avatarScryfallId} size={52} highlight={win || s.user.id === user?.id} />
                {win && <span style={{ position: 'absolute', bottom: -4, right: -6, width: 24, height: 24, borderRadius: '50%', background: t.primary, color: t.primaryFg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="trophy" size={13} stroke={2.4} /></span>}
              </div>
              <span style={{ fontSize: 15, fontWeight: win ? 800 : 700, color: win ? t.win : t.text, wordBreak: 'break-word' }}>{s.user.username}</span>
              {canEnter && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <button aria-label={`Meno a ${s.user.username}`} style={step} onClick={() => setScore(tbl.id, key, Math.max(0, sc[key] - 1))}>−</button>
                  <button aria-label={`Più a ${s.user.username}`} style={step} onClick={() => setScore(tbl.id, key, Math.min(event.bestOf || 1, sc[key] + 1))}>+</button>
                </span>
              )}
            </div>
          )
          return (
            <div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                {side(sa, winA, 'a')}
                <div style={{ flexShrink: 0, paddingTop: 12, textAlign: 'center' }}>
                  <div style={{ fontSize: 26, fontWeight: 900, color: t.text, fontVariantNumeric: 'tabular-nums' }}>{tbl.done ? `${tbl.scoreA}–${tbl.scoreB}` : canEnter ? `${sc.a}–${sc.b}` : 'vs'}</div>
                  {event.bestOf > 1 && <div style={{ fontSize: 12, color: t.textMuted }}>Best of {event.bestOf}</div>}
                </div>
                {side(sb, winB, 'b')}
              </div>
              {tbl.done && tbl.isDraw && <div style={{ fontSize: 13, color: t.textSub, marginTop: 8, textAlign: 'center' }}>Pareggio</div>}
              {canEnter && (
                <button onClick={() => submitResult(tbl)} className="ct-press" style={{ ...primaryBtn, width: '100%', marginTop: 12 }}>
                  <Icon name="check" size={18} stroke={2.5} /> Salva risultato
                </button>
              )}
            </div>
          )
        })() : (
          <div>
            <div style={{ display: 'grid', gap: 8 }}>
              {tbl.seats.map(s => (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 8px', borderRadius: 12, background: s.user.id === user?.id ? 'transparent' : 'transparent' }}>
                  <PlayerAvatar username={s.user.username} avatarCardName={s.user.avatarCardName} avatarScryfallId={s.user.avatarScryfallId} size={36} highlight={s.user.id === user?.id} />
                  <span style={{ fontSize: 15, fontWeight: 700, color: t.text, wordBreak: 'break-word' }}>{s.user.username}</span>
                  {s.user.id === user?.id && <span style={{ fontSize: 12, fontWeight: 800, color: t.primary }}>Tu</span>}
                </div>
              ))}
            </div>
            <div style={{ marginTop: 12 }}>
              {tbl.done && tbl.game ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '10px 12px', borderRadius: 14, background: t.winBg, border: `1px solid ${t.primaryBorder}` }}>
                  <span style={{ color: t.win, display: 'flex' }}><Icon name="trophy" size={18} /></span>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 700, color: t.text, wordBreak: 'break-word' }}>
                    Vince {tbl.game.players[0]?.user.username}
                    {tbl.game.players[0]?.deck?.name && <span style={{ fontWeight: 500, color: t.textSub }}> · {tbl.game.players[0].deck.name}</span>}
                  </span>
                  <button onClick={() => navigate(`/partita/${tbl.game.id}`)} className="ct-press" style={ghostBtn}>Vedi partita <Icon name="chevron" size={15} /></button>
                </div>
              ) : (isAdmin || mine) ? (
                <button
                  onClick={() => navigate('/nuova-partita', { state: { podContext: { eventId: eid, tableId: tbl.id, date: event.startsAt, players: tbl.seats.map(s => ({ userId: s.user.id, username: s.user.username })) } } })}
                  className="ct-press" style={{ ...primaryBtn, width: '100%' }}
                ><Icon name="swords" size={18} stroke={2.2} /> Registra partita del tavolo</button>
              ) : (
                <span style={{ fontSize: 13, color: t.textMuted }}>Il risultato lo registra un giocatore del tavolo.</span>
              )}
            </div>
          </div>
        )}
      </div>
    )
  }

  const currentRound = rounds.find(r => r.id === activeView)
  // "Il tuo tavolo" per primo
  const orderedTables = currentRound
    ? [...currentRound.tables].sort((a, b) => (b.seats.some(s => s.user.id === user?.id) - a.seats.some(s => s.user.id === user?.id)) || a.number - b.number)
    : []

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      {back}

      {/* Hero evento */}
      <div className="ct-fade-up" style={bento(t, { padding: '1.15rem', marginBottom: 14, border: `1px solid ${countdown ? t.primaryBorder : t.border}`, boxShadow: `${t.shadow}${countdown && t.glow !== 'none' ? ', ' + t.glow : ''}` })}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
          {event.format ? <FormatChip ev={event} /> : <span style={{ fontSize: 12, fontWeight: 700, color: t.textSub, background: t.bgMuted, padding: '3px 9px', borderRadius: 999, border: `1px solid ${t.border}` }}>Serata libera</span>}
          {countdown && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 800, color: t.primary, background: t.primaryBg, border: `1px solid ${t.primaryBorder}`, padding: '3px 10px', borderRadius: 999 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: t.primary, boxShadow: `0 0 6px ${t.primary}` }} />{countdown}
            </span>
          )}
          {event.finished && <span style={{ fontSize: 12, fontWeight: 800, color: t.win }}>Torneo concluso</span>}
        </div>
        <div style={{ fontSize: 24, fontWeight: 800, color: t.text, lineHeight: 1.2, wordBreak: 'break-word' }}>{event.title}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 15, color: t.text, fontWeight: 600, marginTop: 8, textTransform: 'capitalize' }}>
          <Icon name="calendar" size={16} /> {dateLine}{time ? ` · ${time}` : ''}
        </div>
        {event.location && <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, color: t.textSub, marginTop: 4 }}><Icon name="pin" size={16} /><span style={{ wordBreak: 'break-word' }}>{event.location}</span></div>}
        {event.description && <div style={{ fontSize: 14, color: t.textSub, marginTop: 10, whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.5 }}>{event.description}</div>}

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
          {registrants.length > 0 && <AvatarStack users={registrants.map(r => ({ id: r.userId, ...r.user }))} size={32} max={6} ring={t.bgPage} PlayerAvatar={PlayerAvatar} />}
          <span style={{ fontSize: 14, color: t.textSub }}>{registrants.length === 0 ? 'Ancora nessun iscritto' : `${registrants.length} ${registrants.length === 1 ? 'iscritto' : 'iscritti'}`}</span>
        </div>
        <button onClick={toggleRsvp} className="ct-press" style={{
          width: '100%', marginTop: 14, minHeight: 50, borderRadius: 14, cursor: 'pointer', fontSize: 16, fontWeight: 800,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          border: going ? `1px solid ${t.primaryBorder}` : 'none', background: going ? t.primaryBg : t.primary,
          color: going ? t.primary : t.primaryFg, boxShadow: going ? 'none' : t.glow,
        }}>
          <Icon name="check" size={19} stroke={2.5} /> {going ? 'Ci sei · tocca per annullare' : 'Ci sono'}
        </button>
      </div>

      {/* Iscritti */}
      {registrants.length > 0 && (
        <div className="ct-fade-up" style={{ ...card, animationDelay: '60ms' }}>
          <SectionLabel t={t} icon="groups">Iscritti · {registrants.length}</SectionLabel>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {registrants.map(r => (
              <span key={r.userId} onClick={() => navigate(`/giocatore/${r.userId}`)} className="ct-press" style={{
                display: 'inline-flex', alignItems: 'center', gap: 8, minHeight: 40, fontSize: 14, fontWeight: 600, cursor: 'pointer',
                color: t.text, background: r.userId === user?.id ? t.primaryBg : t.bgSurfaceAlt,
                border: `1px solid ${r.userId === user?.id ? t.primaryBorder : t.border}`, borderRadius: 999, padding: '4px 12px 4px 4px',
              }}>
                <PlayerAvatar username={r.user.username} avatarCardName={r.user.avatarCardName} avatarScryfallId={r.user.avatarScryfallId} size={30} highlight={r.userId === user?.id} />{r.user.username}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Torneo */}
      {event.format && (
        <>
          {event.finished && event.winner && (
            <div className="ct-fade-up" style={{ ...card, display: 'flex', alignItems: 'center', gap: 12, border: '1px solid rgba(245,197,24,0.5)', background: 'rgba(245,197,24,0.10)' }}>
              <span style={{ width: 44, height: 44, borderRadius: 14, background: 'rgba(245,197,24,0.18)', color: '#F5C518', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon name="crown" size={24} /></span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#F5C518' }}>Vincitore</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: t.text, wordBreak: 'break-word' }}>{event.winner.username} · {event.winner.points} punti</div>
              </div>
            </div>
          )}

          <div className="ct-fade-up" style={{ ...card, animationDelay: '120ms' }}>
            <SectionLabel t={t} icon={is1v1 ? 'swords' : 'shuffle'} right={
              isAdmin && rounds.length > 0 && activeView !== 'classifica' && currentRound?.id === rounds[rounds.length - 1].id && (
                <button className="ct-press" style={ghostBtn} onClick={() => deleteRound(currentRound.id)}>Rifai turno</button>
              )
            }>{is1v1 ? 'Torneo 1v1 · svizzera' : 'Tavoli della serata'}</SectionLabel>

            {(rounds.length > 1 || (is1v1 && rounds.length > 0 && event.standings?.length > 0)) && (
              <div className="ct-scroll-x" style={{ overflowX: 'auto', marginBottom: 14 }}>
                <Segmented t={t} value={activeView} onChange={setView} options={[
                  ...rounds.map(r => ({ value: r.id, label: `Turno ${r.number}` })),
                  ...(is1v1 && event.standings?.length > 0 ? [{ value: 'classifica', label: 'Classifica' }] : []),
                ]} />
              </div>
            )}

            {rounds.length === 0 ? (
              <div style={{ fontSize: 14, color: t.textSub, lineHeight: 1.5 }}>
                {event.format === 'multiplayer'
                  ? 'Quando tutti sono iscritti, l’admin genera i tavoli (pod da 3 a 5, preferendo 4).'
                  : 'Quando tutti sono iscritti, l’admin genera gli abbinamenti del primo turno.'}
              </div>
            ) : activeView === 'classifica' ? (
              <div key="classifica" className="ct-fade-up">
                {event.standings.map((s, i) => {
                  const me = s.userId === user?.id
                  const av = avatarOf(s.userId)
                  return (
                    <div key={s.userId} style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '10px', marginBottom: 6, borderRadius: 14,
                      background: me ? t.primaryBg : t.bgSurfaceAlt, border: `1px solid ${me ? t.primaryBorder : t.border}`,
                    }}>
                      <span style={{ width: 26, fontSize: 15, fontWeight: 900, color: i === 0 ? '#F5C518' : t.textSub, textAlign: 'center' }}>{i + 1}</span>
                      <PlayerAvatar username={s.username} avatarCardName={av.avatarCardName ?? null} avatarScryfallId={av.avatarScryfallId ?? null} size={34} highlight={me} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 15, fontWeight: 700, color: t.text, wordBreak: 'break-word' }}>{s.username}</div>
                        <div style={{ fontSize: 13, color: t.textSub }}>{s.wins}V · {s.draws}N · {s.losses}P{s.byes ? ` · ${s.byes} bye` : ''}</div>
                      </div>
                      <span style={{ fontSize: 20, fontWeight: 900, color: t.text, fontVariantNumeric: 'tabular-nums' }}>{s.points}<span style={{ fontSize: 13, fontWeight: 600, color: t.textSub, marginLeft: 3 }}>pt</span></span>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div key={activeView}>{orderedTables.map(renderTable)}</div>
            )}

            {isAdmin && (rounds.length === 0 || event.canNextRound) && (
              <button className="ct-press" style={{ ...primaryBtn, width: '100%', marginTop: 4 }} onClick={generateRound} disabled={busy}>
                <Icon name="shuffle" size={18} />
                {rounds.length === 0 ? (event.format === 'multiplayer' ? 'Genera tavoli' : 'Genera abbinamenti') : `Genera turno ${rounds.length + 1}`}
              </button>
            )}
          </div>
        </>
      )}

      {/* Partite registrate nel giorno dell'evento */}
      {nightGames.length > 0 && (
        <div className="ct-fade-up" style={{ ...card, animationDelay: '180ms' }}>
          <SectionLabel t={t} icon="trophy">Partite della serata · {nightGames.length}</SectionLabel>
          {nightGames.map(g => {
            const w = g.players.find(p => p.isWinner)
            const others = g.players.filter(p => !p.isWinner).sort((a, b) => (a.placement ?? 99) - (b.placement ?? 99))
            return (
              <div key={g.id} onClick={() => navigate(`/partita/${g.id}`)} className="ct-press" style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px', marginBottom: 8, borderRadius: 14, cursor: 'pointer', background: t.bgSurfaceAlt, border: `1px solid ${t.border}` }}>
                <PlayerAvatar username={w?.user.username} avatarCardName={w?.user.avatarCardName} avatarScryfallId={w?.user.avatarScryfallId} size={40} highlight={w?.user.id === user?.id} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: t.text, wordBreak: 'break-word' }}>{w?.user.username} <span style={{ fontWeight: 500, color: t.textSub }}>ha vinto</span></div>
                  {w?.deck && <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 2 }}><span style={{ fontSize: 13, color: t.textSub }}>{w.deck.name}</span><ManaPips colors={w.deck.colors} size={15} /></div>}
                  <div style={{ fontSize: 13, color: t.textMuted, marginTop: 3 }}>con {others.map(p => p.user.username).join(', ')}</div>
                </div>
                <span style={{ color: t.textMuted, display: 'flex' }}><Icon name="chevron" size={18} /></span>
              </div>
            )
          })}
        </div>
      )}

      {!event.format && nightGames.length === 0 && (
        <div style={{ ...card, color: t.textSub, fontSize: 14 }}>Serata libera: le partite registrate in questa data compariranno qui.</div>
      )}
    </div>
  )
}
