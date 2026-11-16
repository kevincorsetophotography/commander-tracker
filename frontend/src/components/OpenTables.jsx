import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast as sonner } from 'sonner'
import { api } from '../lib/api'
import { useTheme } from '../hooks/useTheme'
import { useAuth } from '../hooks/useAuth'
import { useFeedback } from '../hooks/useFeedback'
import PlayerAvatar from './PlayerAvatar'
import { Icon, SectionLabel, bento } from './ui'

// Tavoli aperti dai giocatori: lista + "Apri un tavolo" (un tocco).
// eventId: mostra/crea i tavoli di quell'evento; senza eventId mostra quelli attivi (Gioca).

const pad = (n) => String(n).padStart(2, '0')
const hhmm = (d) => { const x = new Date(d); return `${pad(x.getHours())}:${pad(x.getMinutes())}` }

function TableCard({ table, me, t, onChange, showEvent }) {
  const navigate = useNavigate()
  const { confirm } = useFeedback()
  const [busy, setBusy] = useState(false)
  const seated = table.seats.some(s => s.userId === me.id)
  const isCreator = table.createdById === me.id
  const canEdit = isCreator || me.role === 'ADMIN'
  const done = !!table.gameId
  const free = table.maxSeats - table.seats.length
  const winner = table.game?.players?.[0]
  // Tavolo chiuso (dal creatore o pieno): chi è seduto apre la pagina del tavolo (mazzi, segnapunti)
  const closed = !done && (!table.isOpen || free <= 0)
  const openPage = seated && closed ? () => navigate(`/tavoli/${table.id}`) : null

  const run = async (fn, okMsg) => {
    setBusy(true)
    try { const res = await fn(); onChange(table.id, res); if (okMsg) sonner.success(okMsg) }
    catch (e) { sonner.error(e.error || 'Operazione non riuscita') }
    finally { setBusy(false) }
  }

  const status = done
    ? { label: 'Concluso', color: t.win, bg: t.winBg, border: t.primaryBorder }
    : table.isOpen
      ? { label: free > 0 ? `Aperto · ${free} ${free === 1 ? 'posto libero' : 'posti liberi'}` : 'Al completo', color: t.primary, bg: t.primaryBg, border: t.primaryBorder }
      : { label: 'Chiuso', color: t.textSub, bg: t.bgSurfaceAlt, border: t.border }

  const registerResult = () => navigate('/nuova-partita', {
    state: { tableContext: {
      tableId: table.id, eventId: table.eventId, date: table.startsAt,
      players: table.seats.map(s => ({ userId: s.userId, username: s.user.username, deckId: s.deckId || null })),
    } },
  })

  const btn = (primary, extra = {}) => ({
    minHeight: 44, padding: '0 14px', borderRadius: 14, cursor: busy ? 'wait' : 'pointer', fontSize: 15, fontWeight: 800,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
    border: primary ? 'none' : `1px solid ${t.border}`, background: primary ? t.primary : t.bgSurfaceAlt,
    color: primary ? t.primaryFg : t.text, boxShadow: primary ? t.glow : 'none', ...extra,
  })

  return (
    <div className="ct-fade-up" style={{
      borderRadius: 18, padding: 14, marginBottom: 12,
      border: `1px solid ${seated && !done ? t.primaryBorder : t.border}`,
      background: seated && !done ? t.primaryBg : t.bgSurfaceAlt,
      boxShadow: seated && !done && t.glow !== 'none' ? t.glow : 'none',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0, flex: '1 1 150px' }}>
          {openPage ? (
            <button onClick={openPage} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', font: 'inherit', fontSize: 17, fontWeight: 800, color: t.text, wordBreak: 'break-word', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              Tavolo di {table.createdBy.username} <Icon name="chevron" size={17} style={{ color: t.primary }} />
            </button>
          ) : (
            <div style={{ fontSize: 17, fontWeight: 800, color: t.text, wordBreak: 'break-word' }}>Tavolo di {table.createdBy.username}</div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 4, fontSize: 13, color: t.textSub }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}><Icon name="clock" size={14} /> dalle {hhmm(table.startsAt)}</span>
            {showEvent && table.event && (
              <button onClick={() => navigate(`/evento/${table.event.id}`)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: t.primary, fontSize: 13, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Icon name="calendar" size={14} /> {table.event.title}
              </button>
            )}
          </div>
        </div>
        <span style={{ flexShrink: 0, fontSize: 12, fontWeight: 800, padding: '4px 10px', borderRadius: 999, color: status.color, background: status.bg, border: `1px solid ${status.border}`, whiteSpace: 'nowrap' }}>{status.label}</span>
      </div>

      {/* posti */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(118px, 1fr))', gap: 8, marginBottom: 12 }}>
        {table.seats.map(s => (
          <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, padding: '6px 8px', borderRadius: 12, background: t.bgSurface, border: `1px solid ${t.border}` }}>
            <PlayerAvatar username={s.user.username} avatarCardName={s.user.avatarCardName} avatarScryfallId={s.user.avatarScryfallId} size={30} highlight={s.userId === me.id} />
            <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 700, color: t.text, wordBreak: 'break-word', lineHeight: 1.2 }}>
              {s.user.username}
              {s.userId === table.createdById && <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: t.textSub }}>ha aperto</span>}
            </span>
            {canEdit && !done && s.userId !== table.createdById && (
              <button aria-label={`Togli ${s.user.username}`} disabled={busy} onClick={() => run(() => api.removeTableSeat(table.id, s.userId))}
                style={{ width: 32, height: 32, borderRadius: 10, border: 'none', background: 'transparent', color: t.textSub, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon name="close" size={15} />
              </button>
            )}
          </div>
        ))}
        {!done && table.isOpen && Array.from({ length: free }).map((_, i) => (
          <div key={`free-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 12, border: `1.5px dashed ${t.borderStrong}`, color: t.textMuted, fontSize: 13, fontWeight: 600, minHeight: 44, boxSizing: 'border-box' }}>
            <span style={{ width: 30, height: 30, borderRadius: '50%', border: `1.5px dashed ${t.borderStrong}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="plus" size={14} /></span>
            Libero
          </div>
        ))}
      </div>

      {/* azioni */}
      {done ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '10px 12px', borderRadius: 14, background: t.winBg, border: `1px solid ${t.primaryBorder}` }}>
          <span style={{ color: t.win, display: 'flex' }}><Icon name="trophy" size={18} /></span>
          <span style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 700, color: t.text, wordBreak: 'break-word' }}>
            Vince {winner?.user?.username}{winner?.deck?.name && <span style={{ fontWeight: 500, color: t.textSub }}> · {winner.deck.name}</span>}
          </span>
          <button onClick={() => navigate(`/partita/${table.gameId}`)} className="ct-press" style={btn(false, { minHeight: 40, fontSize: 14 })}>Vedi partita <Icon name="chevron" size={15} /></button>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {!seated && table.isOpen && free > 0 && (
            <button disabled={busy} onClick={() => run(() => api.joinTable(table.id), 'Ti sei seduto al tavolo')} className="ct-press" style={btn(true, { flex: 1 })}>
              <Icon name="plus" size={17} stroke={2.6} /> Siediti
            </button>
          )}
          {openPage && (
            <button onClick={openPage} className="ct-press" style={btn(true, { flex: '1 1 100%' })}>
              <Icon name="cards" size={17} stroke={2.2} /> Apri il tavolo · mazzi e segnapunti
            </button>
          )}
          {seated && (
            <button disabled={busy || table.seats.length < 3} onClick={registerResult} className="ct-press"
              title={table.seats.length < 3 ? 'Servono almeno 3 giocatori' : undefined}
              style={btn(table.seats.length >= 3 && !openPage, { flex: 1, opacity: table.seats.length < 3 ? 0.6 : 1 })}>
              <Icon name="swords" size={17} stroke={2.2} /> {table.seats.length < 3 ? `Servono almeno 3 giocatori (${table.seats.length}/3)` : 'Registra risultato'}
            </button>
          )}
          {seated && (
            <button disabled={busy} onClick={() => run(() => api.leaveTable(table.id), 'Ti sei alzato dal tavolo')} className="ct-press" style={btn(false)}>Alzati</button>
          )}
          {!seated && (!table.isOpen || free === 0) && (
            <span style={{ fontSize: 13, color: t.textSub, alignSelf: 'center' }}>{table.isOpen ? 'Tavolo al completo' : 'Tavolo chiuso da chi l’ha aperto'}</span>
          )}
        </div>
      )}

      {/* impostazioni del creatore */}
      {canEdit && !done && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 12, paddingTop: 12, borderTop: `1px solid ${t.border}` }}>
          <button role="switch" aria-checked={table.isOpen} disabled={busy}
            onClick={() => run(() => api.updateTable(table.id, { isOpen: !table.isOpen }), table.isOpen ? 'Tavolo chiuso: nessun altro può entrare' : 'Tavolo aperto: altri possono sedersi')}
            className="ct-press" style={{ ...btn(false, { minHeight: 40, fontSize: 14 }), gap: 8 }}>
            <span style={{ width: 34, height: 20, borderRadius: 999, background: table.isOpen ? t.primary : t.bgMuted, position: 'relative', transition: 'background 0.2s' }}>
              <span style={{ position: 'absolute', top: 2, left: table.isOpen ? 16 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
            </span>
            {table.isOpen ? 'Aperto' : 'Chiuso'}
          </button>
          <label style={{ ...btn(false, { minHeight: 40, fontSize: 14, position: 'relative' }) }}>
            <Icon name="clock" size={15} /> {hhmm(table.startsAt)}
            <input type="time" aria-label="Orario del tavolo" value={hhmm(table.startsAt)}
              onChange={e => {
                const [h, m] = e.target.value.split(':').map(Number)
                if (Number.isNaN(h)) return
                const d = new Date(table.startsAt); d.setHours(h, m, 0, 0)
                run(() => api.updateTable(table.id, { startsAt: d.toISOString() }))
              }}
              style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%' }} />
          </label>
          <button aria-label="Cancella il tavolo" disabled={busy} onClick={async () => {
            const ok = await confirm({ title: 'Cancellare il tavolo?', message: 'I giocatori seduti verranno tolti.', confirmLabel: 'Cancella', danger: true })
            if (ok) run(async () => { await api.deleteTable(table.id); return { deleted: true } }, 'Tavolo cancellato')
          }} className="ct-press" style={{ marginLeft: 'auto', width: 40, height: 40, borderRadius: 12, border: `1px solid ${t.dangerBorder}`, background: t.dangerBg, color: t.danger, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="trash" size={16} />
          </button>
        </div>
      )}
    </div>
  )
}

export default function OpenTables({ eventId = null, title = 'Tavoli aperti', showEvent = false, emptyHint, style }) {
  const { t } = useTheme()
  const { user } = useAuth()
  const [tables, setTables] = useState(null)
  const [creating, setCreating] = useState(false)

  const load = useCallback(() => {
    api.getTables(eventId).then(setTables).catch(() => setTables([]))
  }, [eventId])
  useEffect(() => { load() }, [load])

  const onChange = (id, res) => {
    if (res?.deleted) setTables(prev => prev.filter(tb => tb.id !== id))
    else if (res?.id) setTables(prev => prev.map(tb => tb.id === id ? res : tb))
  }

  const create = async () => {
    setCreating(true)
    try {
      const tb = await api.createTable(eventId ? { eventId } : {})
      setTables(prev => [...(prev || []), tb])
      sonner.success('Tavolo aperto!', { description: 'Gli altri possono sedersi. Puoi chiuderlo quando siete al completo.' })
    } catch (e) { sonner.error(e.error || 'Impossibile aprire il tavolo') }
    finally { setCreating(false) }
  }

  if (!user) return null
  const list = tables || []
  const active = list.filter(tb => !tb.gameId)
  const mineActive = active.some(tb => tb.seats.some(s => s.userId === user.id))

  return (
    <div style={{ ...bento(t, { padding: '1rem', marginBottom: 14 }), ...style }}>
      <SectionLabel t={t} icon="groups" right={active.length > 0 && <span style={{ fontSize: 12, fontWeight: 700, color: t.primary }}>{active.length} {active.length === 1 ? 'attivo' : 'attivi'}</span>}>{title}</SectionLabel>

      {tables === null && <div style={{ fontSize: 14, color: t.textSub, marginBottom: 10 }}>Caricamento…</div>}
      {tables && list.length === 0 && (
        <div style={{ fontSize: 14, color: t.textSub, marginBottom: 12, lineHeight: 1.5 }}>{emptyHint || 'Nessun tavolo aperto. Aprine uno: gli altri potranno sedersi.'}</div>
      )}
      {[...active, ...list.filter(tb => tb.gameId)].map(tb => (
        <TableCard key={tb.id} table={tb} me={user} t={t} onChange={onChange} showEvent={showEvent} />
      ))}

      {!mineActive ? (
        <button onClick={create} disabled={creating} className="ct-press" style={{
          width: '100%', minHeight: 50, borderRadius: 16, cursor: creating ? 'wait' : 'pointer', fontSize: 16, fontWeight: 800,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          border: `1.5px dashed ${t.primaryBorder}`, background: 'transparent', color: t.primary,
        }}>
          <Icon name="plus" size={19} stroke={2.6} /> {creating ? 'Apro il tavolo…' : 'Apri un tavolo'}
        </button>
      ) : (
        <div style={{ fontSize: 13, color: t.textSub, textAlign: 'center' }}>Sei già seduto a un tavolo attivo.</div>
      )}
    </div>
  )
}
