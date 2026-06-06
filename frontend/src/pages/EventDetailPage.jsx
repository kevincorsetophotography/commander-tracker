import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { useTheme } from '../hooks/useTheme'
import { useAuth } from '../hooks/useAuth'
import { useFeedback } from '../hooks/useFeedback'
import { Skeleton } from '../components/Skeleton'
import EmptyState from '../components/EmptyState'

const FORMAT_BADGE = {
  multiplayer: { label: '🎴 Multiplayer', color: '#5FB87A' },
  '1v1': { label: '⚔️ 1v1', color: '#E8654F' },
}

function Avatar({ name, t, size = 26, highlight }) {
  return (
    <span style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: highlight ? t.primary : t.bgMuted, color: highlight ? t.primaryFg : t.textSub,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.42, fontWeight: 700, textTransform: 'uppercase',
    }}>{(name || '?').slice(0, 2)}</span>
  )
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

  const load = () => {
    setLoading(true); setError('')
    api.getEvent(eid).then(setEvent).catch(e => setError(e.error || 'Evento non trovato')).finally(() => setLoading(false))
  }
  useEffect(load, [eid])

  const back = (
    <button onClick={() => navigate('/eventi')} style={{ padding: '6px 14px', borderRadius: 10, border: `1px solid ${t.border}`, background: t.bgMuted, color: t.textSub, fontSize: 13, fontWeight: 600, cursor: 'pointer', marginBottom: 16 }}>← Eventi</button>
  )

  if (loading) return (<div>{back}<Skeleton h={160} r={16} /></div>)
  if (error || !event) return (<div>{back}<EmptyState icon="🔍" title="Evento non trovato" message={error} /></div>)

  const going = event.rsvps?.some(r => r.userId === user?.id)
  const registrants = event.rsvps || []
  const round = event.rounds?.[event.rounds.length - 1] || null
  const badge = FORMAT_BADGE[event.format]

  const card = { background: t.bgSurface, border: `1px solid ${t.border}`, borderRadius: 16, padding: '1.1rem 1.25rem', marginBottom: 14, boxShadow: t.shadow }
  const btnPrimary = { padding: '9px 18px', background: t.primary, color: t.primaryFg, border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }
  const btnGhost = { padding: '7px 14px', background: 'transparent', color: t.textSub, border: `1px solid ${t.border}`, borderRadius: 8, fontSize: 13, cursor: 'pointer' }

  const toggleRsvp = async () => {
    try { const { rsvps } = await api.toggleRsvp(eid); setEvent(ev => ({ ...ev, rsvps })) }
    catch (e) { toast(e.error || 'Errore adesione', 'error') }
  }
  const generateRound = async () => {
    setBusy(true)
    try { setEvent(await api.generateRound(eid)); toast('Turno generato', 'success') }
    catch (e) { toast(e.error || 'Errore', 'error') }
    finally { setBusy(false) }
  }
  const deleteRound = async (rid) => {
    const ok = await confirm({ title: 'Eliminare il turno?', message: 'Tavoli e abbinamenti verranno rifatti.', confirmLabel: 'Elimina', danger: true })
    if (!ok) return
    try { await api.deleteRound(eid, rid); load() } catch (e) { toast(e.error || 'Errore', 'error') }
  }

  const dateLine = new Date(event.startsAt).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const time = event.allDay ? null : new Date(event.startsAt).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })

  // Un tavolo (pod o pairing)
  const renderTable = (tbl) => {
    const mine = tbl.seats.some(s => s.user.id === user?.id)
    const isBye = tbl.seats.length === 1 && event.format === '1v1'
    const is1v1 = event.format === '1v1' && tbl.seats.length === 2
    return (
      <div key={tbl.id} style={{
        border: `1px solid ${mine ? t.primary : t.border}`, borderRadius: 12, padding: '10px 12px',
        background: mine ? (t.primaryBg || t.bgMuted) : t.bgMuted,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: t.text }}>{isBye ? 'Bye' : (is1v1 ? `Match ${tbl.number}` : `Tavolo ${tbl.number}`)}</span>
          {mine && <span style={{ fontSize: 10.5, fontWeight: 700, color: t.primary, background: t.primaryBg, border: `1px solid ${t.primaryBorder}`, padding: '1px 7px', borderRadius: 20 }}>Il tuo {is1v1 ? 'match' : 'tavolo'}</span>}
          {tbl.done && <span style={{ fontSize: 11, color: t.win, marginLeft: 'auto' }}>✓ concluso</span>}
        </div>

        {isBye ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: t.textSub }}>
            <Avatar name={tbl.seats[0].user.username} t={t} highlight={tbl.seats[0].user.id === user?.id} />
            {tbl.seats[0].user.username} · passa il turno
          </div>
        ) : is1v1 ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: t.text }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
              <Avatar name={tbl.seats[0].user.username} t={t} highlight={tbl.seats[0].user.id === user?.id} />{tbl.seats[0].user.username}
            </span>
            <span style={{ color: t.textMuted, fontWeight: 700 }}>vs</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
              <Avatar name={tbl.seats[1].user.username} t={t} highlight={tbl.seats[1].user.id === user?.id} />{tbl.seats[1].user.username}
            </span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {tbl.seats.map(s => (
              <span key={s.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: s.user.id === user?.id ? t.text : t.textSub, background: t.bgSurface, border: `0.5px solid ${t.border}`, borderRadius: 20, padding: '3px 10px 3px 3px' }}>
                <Avatar name={s.user.username} t={t} size={22} highlight={s.user.id === user?.id} />{s.user.username}
              </span>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      {back}

      {/* Intestazione evento */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
          <span style={{ fontSize: 19, fontWeight: 800, color: t.text }}>{event.title}</span>
          {badge && (
            <span style={{ fontSize: 12, fontWeight: 700, color: badge.color, background: badge.color + '22', border: `1px solid ${badge.color}55`, padding: '2px 10px', borderRadius: 20 }}>
              {badge.label}{event.format === '1v1' && event.bestOf ? ` · Bo${event.bestOf}` : ''}
            </span>
          )}
        </div>
        <div style={{ fontSize: 13, color: t.textSub, textTransform: 'capitalize' }}>
          {dateLine}{time ? ` · ${time}` : ''}{event.location ? <span style={{ textTransform: 'none' }}> · 📍 {event.location}</span> : ''}
        </div>
        {event.description && <div style={{ fontSize: 13, color: t.textMuted, marginTop: 8, whiteSpace: 'pre-wrap' }}>{event.description}</div>}

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
          <button onClick={toggleRsvp} style={{ padding: '6px 16px', borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: `1px solid ${going ? t.primary : t.border}`, background: going ? t.primary : 'transparent', color: going ? t.primaryFg : t.textSub }}>
            {going ? '✓ Ci sono' : 'Ci sono'}
          </button>
          <span style={{ fontSize: 12, color: t.textMuted }}>{registrants.length} iscritt{registrants.length === 1 ? 'o' : 'i'}</span>
        </div>
      </div>

      {/* Iscritti */}
      <div style={card}>
        <div style={{ fontSize: 13, fontWeight: 700, color: t.textSub, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 10 }}>Iscritti</div>
        {registrants.length === 0 ? (
          <div style={{ fontSize: 13, color: t.textMuted }}>Nessun iscritto. Premi “Ci sono”.</div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {registrants.map(r => (
              <span key={r.userId} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: r.userId === user?.id ? t.text : t.textSub, background: t.bgMuted, borderRadius: 20, padding: '3px 10px 3px 3px' }}>
                <Avatar name={r.user.username} t={t} size={22} highlight={r.userId === user?.id} />{r.user.username}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Torneo */}
      {event.format ? (
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: t.textSub, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {round ? `Turno ${round.number}` : 'Tornei: ancora nessun turno'}
            </div>
            {isAdmin && !round && (
              <button style={{ ...btnPrimary, marginLeft: 'auto' }} onClick={generateRound} disabled={busy}>
                {event.format === 'multiplayer' ? 'Genera tavoli' : 'Genera abbinamenti'}
              </button>
            )}
            {isAdmin && round && (
              <button style={{ ...btnGhost, marginLeft: 'auto' }} onClick={() => deleteRound(round.id)}>Rifai turno</button>
            )}
          </div>

          {!round ? (
            <div style={{ fontSize: 13, color: t.textMuted }}>
              {event.format === 'multiplayer'
                ? 'Quando tutti sono iscritti, l’admin genera i tavoli (pod da 3 a 5, preferendo 4).'
                : 'Quando tutti sono iscritti, l’admin genera gli abbinamenti del primo turno.'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {round.tables.map(renderTable)}
            </div>
          )}
        </div>
      ) : (
        <div style={{ ...card, color: t.textMuted, fontSize: 13 }}>Evento semplice (senza torneo). Il formato si imposta alla creazione.</div>
      )}
    </div>
  )
}
