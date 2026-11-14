import { useState, useEffect, useMemo } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { useTheme } from '../hooks/useTheme'
import { useAuth } from '../hooks/useAuth'
import { useFeedback } from '../hooks/useFeedback'
import { useIsMobile } from '../hooks/useIsMobile'
import EmptyState from '../components/EmptyState'
import PlayerAvatar from '../components/PlayerAvatar'
import { Icon, Sheet, Segmented, AvatarStack, bento } from '../components/ui'

// Eventi v2 (restyle Stitch): prossimo evento in evidenza, Prossimi/Passati,
// form admin in pannello (Radix). Stessa API di prima.

const MONTHS = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic']
const pad = (n) => String(n).padStart(2, '0')

const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }
const dayDiff = (a, b) => Math.round((startOfDay(a) - startOfDay(b)) / 86400000)

function countdown(startsAt) {
  const d = dayDiff(startsAt, new Date())
  if (d === 0) return 'Oggi'
  if (d === 1) return 'Domani'
  if (d === -1) return 'Ieri'
  if (d > 1 && d <= 21) return `Tra ${d} giorni`
  if (d < -1 && d >= -21) return `${-d} giorni fa`
  return null
}

function isPast(ev) {
  const now = Date.now()
  const eventDate = new Date(ev.startsAt)
  // Giorno dell'evento in Europe/Rome
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(eventDate)
  const y = +parts.find(p => p.type === 'year').value
  const mo = +parts.find(p => p.type === 'month').value
  const d = +parts.find(p => p.type === 'day').value
  // Probe: giorno+1 alle 05:00 UTC, poi aggiusta per l'offset di Roma
  const probe = new Date(Date.UTC(y, mo - 1, d + 1, 5, 0, 0))
  const romeHour = +new Intl.DateTimeFormat('en', {
    timeZone: 'Europe/Rome', hour: 'numeric', hour12: false,
  }).format(probe)
  const deadline = probe.getTime() - (romeHour - 5) * 3600000
  return deadline < now
}

const EMPTY = { title: '', date: '', time: '', location: '', description: '', format: '', bestOf: '1' }

const FORMAT_BADGE = {
  multiplayer: { label: 'Multiplayer', icon: 'groups', color: '#34F08F' },
  '1v1': { label: '1v1', icon: 'swords', color: '#8B5CF6' },
}

export function FormatChip({ ev }) {
  const f = ev?.format && FORMAT_BADGE[ev.format]
  if (!f) return null
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, color: f.color, background: f.color + '1f', border: `1px solid ${f.color}55`, padding: '3px 9px', borderRadius: 999, whiteSpace: 'nowrap' }}>
      <Icon name={f.icon} size={13} stroke={2.2} />{f.label}{ev.format === '1v1' && ev.bestOf ? ` · Bo${ev.bestOf}` : ''}
    </span>
  )
}

function DateBlock({ d, faded, big, t }) {
  return (
    <div style={{
      flexShrink: 0, width: big ? 72 : 58, textAlign: 'center', borderRadius: 16, padding: big ? '10px 0' : '8px 0',
      background: faded ? t.bgMuted : t.primaryBg, border: `1px solid ${faded ? t.border : t.primaryBorder}`,
    }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: faded ? t.textMuted : t.primary, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {d.toLocaleDateString('it-IT', { weekday: 'short' }).replace('.', '')}
      </div>
      <div style={{ fontSize: big ? 30 : 24, fontWeight: 900, color: faded ? t.textSub : t.text, lineHeight: 1.05 }}>{d.getDate()}</div>
      <div style={{ fontSize: 12, fontWeight: 700, color: t.textSub, textTransform: 'uppercase' }}>{MONTHS[d.getMonth()]}</div>
    </div>
  )
}

export default function EventsPage() {
  const { t, dark } = useTheme()
  const isMobile = useIsMobile()
  const { user } = useAuth()
  const { toast, confirm } = useFeedback()
  const navigate = useNavigate()
  const isAdmin = user?.role === 'ADMIN'

  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(EMPTY)
  const [editingId, setEditingId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [tab, setTab] = useState('prossimi')

  const [searchParams] = useSearchParams()
  const focusId = Number(searchParams.get('focus')) || null
  const [highlightId, setHighlightId] = useState(null)

  // Da notifica evento (?focus=ID): apre la scheda giusta, scrolla e evidenzia l'evento
  useEffect(() => {
    if (!focusId || loading || events.length === 0) return
    const ev = events.find(e => e.id === focusId)
    if (ev && isPast(ev) && tab !== 'passati') { setTab('passati'); return }
    const el = document.getElementById(`evento-${focusId}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      setHighlightId(focusId)
      const tm = setTimeout(() => setHighlightId(null), 2600)
      return () => clearTimeout(tm)
    }
  }, [focusId, loading, events, tab])

  const load = async () => {
    try { setEvents(await api.getEvents()) }
    catch { toast('Errore nel caricamento eventi', 'error') }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const { upcoming, past } = useMemo(() => {
    const up = [], pa = []
    for (const ev of events) (isPast(ev) ? pa : up).push(ev)
    up.sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt))
    pa.sort((a, b) => new Date(b.startsAt) - new Date(a.startsAt))
    return { upcoming: up, past: pa }
  }, [events])

  const resetForm = () => { setForm(EMPTY); setEditingId(null); setFormError(''); setShowForm(false) }

  const startCreate = () => { setForm(EMPTY); setEditingId(null); setFormError(''); setShowForm(true) }

  const startEdit = (ev) => {
    const d = new Date(ev.startsAt)
    setForm({
      title: ev.title,
      date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
      time: ev.allDay ? '' : `${pad(d.getHours())}:${pad(d.getMinutes())}`,
      location: ev.location || '',
      description: ev.description || '',
      format: ev.format || '',
      bestOf: String(ev.bestOf || 1),
    })
    setEditingId(ev.id)
    setFormError('')
    setShowForm(true)
  }

  const submit = async (e) => {
    e.preventDefault()
    if (!form.title.trim()) { setFormError('Il titolo è obbligatorio'); return }
    if (!form.date) { setFormError('La data è obbligatoria'); return }
    const allDay = !form.time
    const startsAt = new Date(`${form.date}T${form.time || '00:00'}`).toISOString()
    const payload = {
      title: form.title.trim(),
      startsAt,
      allDay,
      location: form.location.trim() || null,
      description: form.description.trim() || null,
      format: form.format || null,
      bestOf: form.format === '1v1' ? Number(form.bestOf) : null,
    }
    setSaving(true); setFormError('')
    try {
      if (editingId) { await api.updateEvent(editingId, payload); toast('Evento aggiornato', 'success') }
      else { await api.createEvent(payload); toast('Evento creato', 'success') }
      resetForm()
      await load()
    } catch (err) {
      setFormError(err.error || 'Errore nel salvataggio')
    } finally { setSaving(false) }
  }

  const removeEvent = async (ev) => {
    const ok = await confirm({ title: 'Eliminare l\'evento?', message: `"${ev.title}" verrà rimosso.`, confirmLabel: 'Elimina', danger: true })
    if (!ok) return
    try { await api.deleteEvent(ev.id); await load(); toast('Evento eliminato', 'success') }
    catch (err) { toast(err.error || 'Errore eliminazione', 'error') }
  }

  const toggleRsvp = async (ev) => {
    try {
      const { rsvps } = await api.toggleRsvp(ev.id)
      setEvents(prev => prev.map(e => e.id === ev.id ? { ...e, rsvps } : e))
    } catch (err) {
      toast(err.error || 'Errore adesione', 'error')
    }
  }

  // ── stili ──
  const inputSt = { padding: '12px 14px', borderRadius: 14, border: `1px solid ${t.border}`, fontSize: 15, width: '100%', boxSizing: 'border-box', outline: 'none', background: t.inputBg, color: t.text, fontFamily: 'inherit', minHeight: 48 }
  const labelSt = { fontSize: 13, fontWeight: 600, color: t.textSub, display: 'block', marginBottom: 6 }

  const RsvpButton = ({ ev, full }) => {
    const going = ev.rsvps?.some(r => r.userId === user?.id)
    return (
      <button onClick={(e) => { e.stopPropagation(); toggleRsvp(ev) }} className="ct-press" style={{
        minHeight: full ? 50 : 40, width: full ? '100%' : 'auto', padding: full ? '0 16px' : '0 14px', borderRadius: full ? 14 : 999,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, cursor: 'pointer',
        fontSize: full ? 16 : 14, fontWeight: 800, whiteSpace: 'nowrap',
        border: going ? `1px solid ${t.primaryBorder}` : 'none',
        background: going ? t.primaryBg : t.primary, color: going ? t.primary : t.primaryFg,
        boxShadow: going || !full ? 'none' : t.glow,
      }}>
        <Icon name="check" size={full ? 19 : 16} stroke={2.5} />
        {going ? (full ? 'Ci sei · tocca per annullare' : 'Ci sei') : 'Ci sono'}
      </button>
    )
  }

  const iconBtn = (danger) => ({
    width: 40, height: 40, borderRadius: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
    border: `1px solid ${danger ? t.dangerBorder : t.border}`, background: danger ? t.dangerBg : t.bgSurfaceAlt, color: danger ? t.danger : t.textSub,
  })

  const AdminActions = ({ ev }) => isAdmin ? (
    <span style={{ display: 'flex', gap: 6 }} onClick={e => e.stopPropagation()}>
      <button aria-label="Modifica evento" onClick={() => startEdit(ev)} className="ct-press" style={iconBtn(false)}><Icon name="edit" size={17} /></button>
      <button aria-label="Elimina evento" onClick={() => removeEvent(ev)} className="ct-press" style={iconBtn(true)}><Icon name="trash" size={17} /></button>
    </span>
  ) : null

  const rsvpUsers = (ev) => (ev.rsvps || []).map(r => ({ id: r.userId, ...(r.user || {}) }))

  const highlightStyle = (ev) => highlightId === ev.id ? { outline: `2px solid ${t.primary}`, boxShadow: `0 0 0 4px ${t.primaryBg}` } : {}

  // Evento in evidenza (il prossimo)
  const renderHero = (ev) => {
    const d = new Date(ev.startsAt)
    const cd = countdown(ev.startsAt)
    const time = ev.allDay ? null : d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
    const users = rsvpUsers(ev)
    return (
      <div key={ev.id} id={`evento-${ev.id}`} className="ct-fade-up" onClick={() => navigate(`/evento/${ev.id}`)} style={bento(t, {
        padding: '1.1rem', marginBottom: 14, cursor: 'pointer', border: `1px solid ${t.primaryBorder}`,
        boxShadow: `${t.shadow}${t.glow !== 'none' ? ', ' + t.glow : ''}`, transition: 'outline 0.3s, box-shadow 0.3s', ...highlightStyle(ev),
      })}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 12 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: t.primary }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: t.primary, boxShadow: `0 0 8px ${t.primary}` }} />Prossimo evento
          </span>
          {cd && <span style={{ padding: '4px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700, color: t.primary, background: t.primaryBg, border: `1px solid ${t.primaryBorder}` }}>{cd}</span>}
        </div>
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          <DateBlock d={d} big t={t} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 21, fontWeight: 800, color: t.text, lineHeight: 1.2, wordBreak: 'break-word' }}>{ev.title}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
              <FormatChip ev={ev} />
              {time && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 14, color: t.text, fontWeight: 600 }}><Icon name="clock" size={15} />{time}</span>}
            </div>
            {ev.location && <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, color: t.textSub, marginTop: 6 }}><Icon name="pin" size={15} /><span style={{ wordBreak: 'break-word' }}>{ev.location}</span></div>}
          </div>
        </div>
        {ev.description && <div style={{ fontSize: 14, color: t.textSub, marginTop: 12, whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.5 }}>{ev.description}</div>}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
          {users.length > 0 && <AvatarStack users={users} size={32} max={6} ring={t.bgPage} PlayerAvatar={PlayerAvatar} />}
          <span style={{ fontSize: 14, color: t.textSub }}>{users.length === 0 ? 'Ancora nessun iscritto' : `${users.length} ${users.length === 1 ? 'iscritto' : 'iscritti'}`}</span>
          <span style={{ marginLeft: 'auto' }}><AdminActions ev={ev} /></span>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
          <div style={{ flex: 1, minWidth: 0 }}><RsvpButton ev={ev} full /></div>
          <button onClick={(e) => { e.stopPropagation(); navigate(`/evento/${ev.id}`) }} className="ct-press" style={{ minHeight: 50, padding: '0 14px', borderRadius: 14, border: `1px solid ${t.border}`, background: t.bgSurfaceAlt, color: t.text, fontSize: 15, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
            Apri <Icon name="chevron" size={17} />
          </button>
        </div>
      </div>
    )
  }

  const renderEvent = (ev, faded = false, idx = 0) => {
    const d = new Date(ev.startsAt)
    const cd = countdown(ev.startsAt)
    const time = ev.allDay ? null : d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
    const users = rsvpUsers(ev)
    return (
      <div key={ev.id} id={`evento-${ev.id}`} className="ct-fade-up ct-lift" onClick={() => navigate(`/evento/${ev.id}`)} style={bento(t, {
        padding: '0.95rem', marginBottom: 12, cursor: 'pointer', opacity: faded ? 0.78 : 1,
        animationDelay: `${Math.min(idx, 6) * 50}ms`, transition: 'outline 0.3s, box-shadow 0.3s', ...highlightStyle(ev),
      })}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <DateBlock d={d} faded={faded} t={t} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: t.text, lineHeight: 1.3, wordBreak: 'break-word' }}>{ev.title}</div>
              <span style={{ color: t.textMuted, display: 'flex', flexShrink: 0 }}><Icon name="chevron" size={18} /></span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
              <FormatChip ev={ev} />
              {cd && !faded && <span style={{ fontSize: 12, fontWeight: 700, color: t.primary }}>{cd}</span>}
              {time && <span style={{ fontSize: 13, color: t.textSub }}>{time}</span>}
            </div>
            {ev.location && <div style={{ fontSize: 13, color: t.textSub, marginTop: 4, wordBreak: 'break-word' }}>{ev.location}</div>}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
              {users.length > 0 && <AvatarStack users={users} size={26} max={4} ring={t.bgPage} PlayerAvatar={PlayerAvatar} />}
              <span style={{ fontSize: 13, color: t.textSub }}>{users.length === 0 ? 'Nessun iscritto' : `${users.length} ${users.length === 1 ? 'iscritto' : 'iscritti'}`}</span>
              <span style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
                {!faded && <RsvpButton ev={ev} />}
                <AdminActions ev={ev} />
              </span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const list = tab === 'prossimi' ? upcoming : past

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 14 }}>
        <div style={{ fontSize: 26, fontWeight: 800, color: t.text, letterSpacing: '-0.02em' }}>Eventi</div>
        {isAdmin && !isMobile && (
          <button onClick={startCreate} className="ct-press" style={{ minHeight: 44, padding: '0 18px', borderRadius: 14, border: 'none', background: t.primary, color: t.primaryFg, fontSize: 15, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, boxShadow: t.glow }}>
            <Icon name="plus" size={18} stroke={2.5} /> Nuovo evento
          </button>
        )}
      </div>

      {/* Form admin (crea / modifica) in pannello */}
      {isAdmin && (
        <Sheet open={showForm} onOpenChange={(o) => { if (!o) resetForm() }} title={editingId ? 'Modifica evento' : 'Nuovo evento'} t={t} dark={dark} isMobile={isMobile}>
          <form onSubmit={submit}>
            <label style={labelSt}>Titolo *</label>
            <input style={{ ...inputSt, marginBottom: 12 }} placeholder="es. Serata Commander" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} maxLength={120} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
              <div style={{ minWidth: 0 }}>
                <label style={labelSt}>Data *</label>
                <input type="date" style={inputSt} value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
              </div>
              <div style={{ minWidth: 0 }}>
                <label style={labelSt}>Ora (facoltativa)</label>
                <input type="time" style={inputSt} value={form.time} onChange={e => setForm(f => ({ ...f, time: e.target.value }))} />
              </div>
            </div>
            <label style={labelSt}>Luogo</label>
            <input style={{ ...inputSt, marginBottom: 12 }} placeholder="es. Circolo Villastellone" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} maxLength={160} />
            <label style={labelSt}>Formato</label>
            <div style={{ marginBottom: 12 }}>
              <Segmented t={t} value={form.format} onChange={v => setForm(f => ({ ...f, format: v }))} options={[
                { value: '', label: 'Solo evento' }, { value: 'multiplayer', label: 'Multiplayer' }, { value: '1v1', label: '1v1' },
              ]} />
            </div>
            {form.format === '1v1' && (
              <div style={{ marginBottom: 12 }}>
                <label style={labelSt}>Match</label>
                <Segmented t={t} value={form.bestOf} onChange={v => setForm(f => ({ ...f, bestOf: v }))} options={[
                  { value: '1', label: 'Best of 1' }, { value: '3', label: 'Best of 3' },
                ]} />
              </div>
            )}
            <label style={labelSt}>Descrizione</label>
            <textarea style={{ ...inputSt, marginBottom: 14, minHeight: 90, resize: 'vertical' }} placeholder="Facoltativa" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} maxLength={2000} />
            {formError && <div role="alert" style={{ color: t.danger, fontSize: 14, fontWeight: 600, marginBottom: 10 }}>{formError}</div>}
            <button type="submit" disabled={saving} className="ct-press" style={{ width: '100%', minHeight: 52, borderRadius: 16, border: 'none', background: t.primary, color: t.primaryFg, fontSize: 16, fontWeight: 800, cursor: saving ? 'wait' : 'pointer', boxShadow: t.glow }}>
              {saving ? 'Salvataggio…' : editingId ? 'Salva modifiche' : 'Crea evento'}
            </button>
          </form>
        </Sheet>
      )}

      {loading ? (
        <div style={{ fontSize: 14, color: t.textSub }}>Caricamento…</div>
      ) : events.length === 0 ? (
        <EmptyState icon="📅" title="Nessun evento" message={isAdmin ? 'Crea il primo evento con "Nuovo evento".' : 'Gli admin non hanno ancora pubblicato eventi.'} />
      ) : (
        <>
          <div style={{ marginBottom: 14 }}>
            <Segmented t={t} value={tab} onChange={setTab} options={[
              { value: 'prossimi', label: 'Prossimi', count: upcoming.length },
              { value: 'passati', label: 'Passati', count: past.length },
            ]} />
          </div>
          <div key={tab} className="ct-fade-up">
            {list.length === 0 && (
              <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: t.textMuted, fontSize: 15 }}>
                {tab === 'prossimi' ? 'Nessun evento in programma.' : 'Nessun evento passato.'}
              </div>
            )}
            {tab === 'prossimi'
              ? list.map((ev, i) => i === 0 ? renderHero(ev) : renderEvent(ev, false, i))
              : list.map((ev, i) => renderEvent(ev, true, i))}
          </div>
        </>
      )}

      {/* FAB admin su mobile, sopra la barra */}
      {isAdmin && isMobile && (
        <button onClick={startCreate} aria-label="Nuovo evento" className="ct-press" style={{
          position: 'fixed', right: 18, bottom: 'calc(92px + env(safe-area-inset-bottom))', zIndex: 25,
          height: 52, padding: '0 18px', borderRadius: 999, border: 'none', background: t.accent, color: '#fff',
          fontSize: 15, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
          boxShadow: '0 10px 30px rgba(139,92,246,0.45)',
        }}>
          <Icon name="plus" size={19} stroke={2.6} /> Evento
        </button>
      )}
    </div>
  )
}
