import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { toast as sonner } from 'sonner'
import { api } from '../lib/api'
import { useTheme } from '../hooks/useTheme'
import { useAuth } from '../hooks/useAuth'
import { useFeedback } from '../hooks/useFeedback'
import { useIsMobile } from '../hooks/useIsMobile'
import { applyLocal, REASON_LABEL } from '../lib/scoreboard'
import LifeCounter, { enterFullscreen } from '../components/LifeCounter'
import { Skeleton } from '../components/Skeleton'
import EmptyState from '../components/EmptyState'
import PlayerAvatar from '../components/PlayerAvatar'
import DeckThumb from '../components/DeckThumb'
import { Icon, ManaPips, SectionLabel, Sheet, bento } from '../components/ui'

// Pagina del tavolo (/tavoli/:id) — solo per chi è seduto (il server risponde 403 agli altri).
// Giocatori + mazzo scelto (ognuno il suo, chi ha aperto per tutti), segnapunti condiviso
// (polling ~3s mentre è aperto), "Registra risultati" verso il flusso di Registra partita.

const DETAIL_POLL_MS = 12000
const SCORE_POLL_MS = 3000
const pad = (n) => String(n).padStart(2, '0')
const hhmm = (d) => { const x = new Date(d); return `${pad(x.getHours())}:${pad(x.getMinutes())}` }

const openKey = (id) => `ct_score_open_${id}`
const readOpen = (id) => { try { return localStorage.getItem(openKey(id)) === '1' } catch { return false } }
const writeOpen = (id, v) => { try { v ? localStorage.setItem(openKey(id), '1') : localStorage.removeItem(openKey(id)) } catch { /* storage non disponibile */ } }

// ── Pagina ────────────────────────────────────────────────────────────────────
export default function TablePage() {
  const { id } = useParams()
  const tid = Number.parseInt(id, 10)
  const navigate = useNavigate()
  const { t, dark } = useTheme()
  const { user: me } = useAuth()
  const { confirm } = useFeedback()
  const isMobile = useIsMobile()

  const [table, setTable] = useState(null)
  const [error, setError] = useState('')
  const [score, setScore] = useState(null)
  const [scoreOpen, setScoreOpen] = useState(() => readOpen(tid))
  const [deckFor, setDeckFor] = useState(null)   // userId del posto di cui si sta scegliendo il mazzo
  const [busy, setBusy] = useState(false)

  const pending = useRef(0)              // azioni del segnapunti in volo
  const chain = useRef(Promise.resolve()) // le azioni partono in ordine
  const lastVersion = useRef(-1)

  const acceptScore = useCallback((sb) => {
    if (!sb || pending.current > 0) return
    if (typeof sb.version === 'number' && sb.version < lastVersion.current) return
    lastVersion.current = sb.version ?? lastVersion.current
    setScore({ players: sb.players, history: sb.history || [], version: sb.version })
  }, [])

  const loadDetail = useCallback(() => api.getTable(tid)
    .then(tb => { setTable(tb); setError(''); acceptScore(tb.scoreboard) })
    .catch(e => setError(e.error || 'Tavolo non trovato')), [tid, acceptScore])

  // dettaglio: subito e poi ogni ~12s (mazzi scelti dagli altri, risultato registrato)
  useEffect(() => {
    if (!Number.isInteger(tid)) { setError('Tavolo non trovato'); return }
    loadDetail()
    const iv = setInterval(() => { if (!document.hidden) loadDetail() }, DETAIL_POLL_MS)
    return () => clearInterval(iv)
  }, [tid, loadDetail])

  // segnapunti: polling ~3s solo mentre è aperto e la pagina è visibile
  const concluded = !!table?.gameId
  useEffect(() => {
    if (!scoreOpen || concluded || error) return
    const tick = () => {
      if (document.hidden) return
      api.getScoreboard(tid).then(sb => { if (sb.concluded) loadDetail(); else acceptScore(sb) }).catch(() => {})
    }
    tick()
    const iv = setInterval(tick, SCORE_POLL_MS)
    const onVis = () => { if (!document.hidden) tick() }
    document.addEventListener('visibilitychange', onVis)
    return () => { clearInterval(iv); document.removeEventListener('visibilitychange', onVis) }
  }, [scoreOpen, concluded, error, tid, acceptScore, loadDetail])

  // apertura dal pulsante (gesto dell'utente → si può chiedere lo schermo intero); chiusura dal menu centrale
  const openScore = () => { enterFullscreen(); writeOpen(tid, true); setScoreOpen(true) }
  const closeScore = () => { writeOpen(tid, false); setScoreOpen(false) }

  // tocco sul segnapunti: aggiornamento ottimistico, invio in coda, la risposta del server vince
  const act = (action) => {
    setScore(s => (s ? applyLocal(s, action) : s))
    pending.current += 1
    chain.current = chain.current
      .then(() => api.scoreAction(tid, action))
      .then(res => {
        pending.current -= 1
        lastVersion.current = Math.max(lastVersion.current, res.version)
        if (pending.current === 0) setScore({ players: res.players, history: res.history || [], version: res.version })
      })
      .catch(e => {
        pending.current -= 1
        sonner.error(e.error || 'Segnapunti non aggiornato')
        if (pending.current === 0) api.getScoreboard(tid).then(sb => { lastVersion.current = -1; acceptScore(sb) }).catch(() => {})
      })
  }

  // annulla l'ultima azione dello storico condiviso (qualsiasi membro); in coda dopo i tocchi in volo
  const undoScore = () => {
    pending.current += 1
    chain.current = chain.current
      .then(() => api.scoreAction(tid, { type: 'undo' }))
      .then(res => {
        pending.current -= 1
        lastVersion.current = Math.max(lastVersion.current, res.version)
        if (pending.current === 0) setScore({ players: res.players, history: res.history || [], version: res.version })
      })
      .catch(e => {
        pending.current -= 1
        sonner.error(e.error || 'Niente da annullare')
        if (pending.current === 0) api.getScoreboard(tid).then(sb => { lastVersion.current = -1; acceptScore(sb) }).catch(() => {})
      })
  }

  // ripristino (solo chi ha aperto il tavolo; la conferma è nel menu del segnapunti)
  const resetScore = async () => {
    try {
      await chain.current
      const sb = await api.resetScoreboard(tid)
      lastVersion.current = sb.version
      setScore({ players: sb.players, history: sb.history || [], version: sb.version })
      sonner.success('Punti vita ripristinati')
      return true
    } catch (e) { sonner.error(e.error || 'Impossibile ripristinare'); return false }
  }

  const pickDeck = async (userId, deckId) => {
    setDeckFor(null)
    try { const tb = await api.pickTableDeck(tid, userId, deckId); setTable(prev => ({ ...prev, ...tb })) }
    catch (e) { sonner.error(e.error || 'Mazzo non salvato') }
  }

  const deleteTable = async () => {
    const ok = await confirm({ title: 'Cancellare il tavolo?', message: 'Il tavolo, il segnapunti e i mazzi scelti vengono cancellati.', confirmLabel: 'Cancella', danger: true })
    if (!ok) return
    setBusy(true)
    try {
      await api.deleteTable(tid)
      writeOpen(tid, false)
      sonner.success('Tavolo cancellato')
      navigate(table?.eventId ? `/evento/${table.eventId}` : '/gioca', { replace: true })
    } catch (e) { sonner.error(e.error || 'Impossibile cancellare il tavolo'); setBusy(false) }
  }

  const registerResult = () => navigate('/nuova-partita', {
    state: { tableContext: {
      tableId: table.id, eventId: table.eventId, date: table.startsAt,
      players: table.seats.map(s => ({ userId: s.userId, username: s.user.username, deckId: s.deckId || null })),
    } },
  })

  const back = (
    <button onClick={() => navigate(-1)} className="ct-press" style={{ minHeight: 40, padding: '0 14px 0 10px', borderRadius: 12, border: `1px solid ${t.border}`, background: t.bgSurfaceAlt, color: t.text, fontSize: 14, fontWeight: 700, cursor: 'pointer', marginBottom: 14, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <Icon name="back" size={17} /> Indietro
    </button>
  )

  if (error) return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      {back}
      <EmptyState icon="🔒" title={error} message="La pagina del tavolo è riservata ai giocatori seduti." />
    </div>
  )
  if (!table) return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      {back}
      <Skeleton h={110} r={18} style={{ marginBottom: 12 }} />
      <Skeleton h={220} r={18} />
    </div>
  )

  const isOwner = table.createdById === me?.id
  const seats = table.seats
  const full = seats.length >= table.maxSeats
  const enough = seats.length >= 3
  const deckSeat = seats.find(s => s.userId === deckFor)
  const deckOptions = deckSeat ? table.decks.filter(d => d.userId === deckSeat.userId) : []
  const missingDecks = seats.filter(s => !s.deckId).length

  const btn = (primary, extra = {}) => ({
    minHeight: 48, padding: '0 16px', borderRadius: 14, cursor: 'pointer', fontSize: 15, fontWeight: 800,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    border: primary ? 'none' : `1px solid ${t.border}`, background: primary ? t.primary : t.bgSurfaceAlt,
    color: primary ? t.primaryFg : t.text, boxShadow: primary ? t.glow : 'none', ...extra,
  })

  // Tavolo concluso: lo stato di gioco non esiste più, resta la partita
  if (concluded) return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      {back}
      <div className="ct-fade-up" style={bento(t, { padding: '1.25rem', textAlign: 'center' })}>
        <div style={{ color: t.win, display: 'flex', justifyContent: 'center', marginBottom: 8 }}><Icon name="trophy" size={30} /></div>
        <div style={{ fontSize: 19, fontWeight: 800, color: t.text, marginBottom: 6 }}>Partita registrata</div>
        <div style={{ fontSize: 14, color: t.textSub, marginBottom: 14 }}>Il tavolo di {table.createdBy.username} è concluso: segnapunti e mazzi del tavolo sono stati chiusi.</div>
        <button onClick={() => navigate(`/partita/${table.gameId}`, { replace: true })} className="ct-press" style={btn(true)}>Vedi partita <Icon name="chevron" size={16} /></button>
      </div>
    </div>
  )

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      {back}

      {/* intestazione */}
      <div className="ct-fade-up" style={bento(t, { padding: '1rem', marginBottom: 14 })}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ minWidth: 0, flex: '1 1 180px' }}>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: t.text, wordBreak: 'break-word', lineHeight: 1.2 }}>Tavolo di {table.createdBy.username}</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 6, fontSize: 13, color: t.textSub }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Icon name="clock" size={14} /> dalle {hhmm(table.startsAt)}</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Icon name="groups" size={14} /> {seats.length}/{table.maxSeats}</span>
              {table.event && (
                <button onClick={() => navigate(`/evento/${table.event.id}`)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: t.primary, fontSize: 13, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <Icon name="calendar" size={14} /> {table.event.title}
                </button>
              )}
            </div>
          </div>
          <span style={{ flexShrink: 0, fontSize: 12, fontWeight: 800, padding: '4px 10px', borderRadius: 999, color: t.textSub, background: t.bgSurfaceAlt, border: `1px solid ${t.border}`, whiteSpace: 'nowrap' }}>
            {!table.isOpen ? 'Chiuso' : full ? 'Al completo' : 'Aperto'}
          </span>
        </div>
      </div>

      {/* giocatori e mazzi */}
      <div className="ct-fade-up" style={bento(t, { padding: '1rem', marginBottom: 14, animationDelay: '40ms' })}>
        <SectionLabel t={t} icon="cards" right={missingDecks > 0 && <span style={{ fontSize: 12, fontWeight: 700, color: t.textSub }}>{missingDecks} da scegliere</span>}>Giocatori e mazzi</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {seats.map(s => {
            const can = s.userId === me?.id || isOwner
            const body = (
              <>
                <PlayerAvatar username={s.user.username} avatarCardName={s.user.avatarCardName} avatarScryfallId={s.user.avatarScryfallId} size={38} highlight={s.userId === me?.id} />
                <span style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                  <span style={{ display: 'block', fontSize: 15, fontWeight: 800, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.user.username}{s.userId === table.createdById && <span style={{ fontSize: 12, fontWeight: 600, color: t.textSub }}> · ha aperto</span>}
                  </span>
                  {s.deck ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3, minWidth: 0 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: t.textSub, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.deck.name}</span>
                      <ManaPips colors={s.deck.colors} size={14} />
                    </span>
                  ) : (
                    <span style={{ display: 'block', fontSize: 13, fontWeight: 600, marginTop: 3, color: can ? t.primary : t.textMuted }}>{can ? 'Scegli il mazzo' : 'Mazzo non ancora scelto'}</span>
                  )}
                </span>
                {s.deck && <DeckThumb commander={s.deck.commander} w={44} radius={8} preview={false} />}
                {can && <Icon name="chevron" size={17} style={{ color: t.textMuted }} />}
              </>
            )
            const rowStyle = { display: 'flex', alignItems: 'center', gap: 10, minHeight: 60, padding: '8px 10px', borderRadius: 14, border: `1px solid ${s.userId === me?.id ? t.primaryBorder : t.border}`, background: s.userId === me?.id ? t.primaryBg : t.bgSurfaceAlt, width: '100%', boxSizing: 'border-box' }
            return can
              ? <button key={s.id} onClick={() => setDeckFor(s.userId)} className="ct-press" aria-label={`Scegli il mazzo di ${s.user.username}`} style={{ ...rowStyle, cursor: 'pointer', font: 'inherit' }}>{body}</button>
              : <div key={s.id} style={rowStyle}>{body}</div>
          })}
        </div>
        {isOwner && seats.length > 1 && <div style={{ fontSize: 12, color: t.textMuted, marginTop: 8 }}>Hai aperto tu il tavolo: puoi scegliere il mazzo per chiunque.</div>}
      </div>

      {/* segnapunti: riepilogo qui, il contatore vero è a schermo intero */}
      <div className="ct-fade-up" style={bento(t, { padding: '1rem', marginBottom: 14, animationDelay: '80ms' })}>
        <SectionLabel t={t} icon="flame">Segnapunti</SectionLabel>
        {score && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(70px, 1fr))', gap: 8, marginBottom: 12 }}>
            {seats.map(s => {
              const p = score.players[s.userId]
              if (!p) return null
              return (
                <div key={s.userId} style={{ minWidth: 0, padding: '8px 10px', borderRadius: 12, border: `1px solid ${p.eliminated ? t.dangerBorder : t.border}`, background: p.eliminated ? t.dangerBg : t.bgSurfaceAlt }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: t.textSub, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.user.username}</div>
                  <div style={{ fontSize: 24, fontWeight: 900, lineHeight: 1.1, fontVariantNumeric: 'tabular-nums', color: p.eliminated ? t.danger : t.text }}>{p.life}</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: p.eliminated ? t.danger : t.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.eliminated ? REASON_LABEL[p.reason] : [p.poison > 0 && `veleno ${p.poison}`, Math.max(0, ...Object.values(p.cmd || {})) > 0 && `cmd ${Math.max(...Object.values(p.cmd))}`].filter(Boolean).join(' · ') || 'vita'}
                  </div>
                </div>
              )
            })}
          </div>
        )}
        <button onClick={openScore} className="ct-press" style={btn(true, { width: '100%' })}>
          <Icon name="flame" size={17} /> Apri segnapunti
        </button>
        <div style={{ fontSize: 13, color: t.textSub, marginTop: 8, lineHeight: 1.45 }}>A schermo intero, con il telefono al centro del tavolo: tocca la metà sinistra o destra del tuo numero per −1/+1 (tieni premuto per ±10), scorri per veleno e danni da commander. Condiviso con tutto il tavolo.</div>
      </div>

      {/* azioni */}
      <div className="ct-fade-up" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20, animationDelay: '120ms' }}>
        <button disabled={!enough} onClick={registerResult} className="ct-press"
          style={btn(enough, { flex: '1 1 220px', opacity: enough ? 1 : 0.6, cursor: enough ? 'pointer' : 'not-allowed' })}>
          <Icon name="swords" size={18} stroke={2.2} /> {enough ? 'Registra risultati' : `Servono almeno 3 giocatori (${seats.length}/3)`}
        </button>
        {isOwner && (
          <button disabled={busy} onClick={deleteTable} className="ct-press" style={btn(false, { border: `1px solid ${t.dangerBorder}`, background: t.dangerBg, color: t.danger })}>
            <Icon name="trash" size={16} /> Cancella tavolo
          </button>
        )}
      </div>

      <Sheet open={!!deckSeat} onOpenChange={(o) => { if (!o) setDeckFor(null) }} title={deckSeat ? (deckSeat.userId === me?.id ? 'Il tuo mazzo' : `Mazzo di ${deckSeat.user.username}`) : ''} t={t} dark={dark} isMobile={isMobile}>
        {deckSeat && (deckOptions.length === 0 ? (
          <div style={{ fontSize: 14, color: t.textSub, padding: '4px 0 12px', lineHeight: 1.5 }}>
            {deckSeat.userId === me?.id ? 'Non hai ancora mazzi: creane uno dalla pagina Mazzi.' : `${deckSeat.user.username} non ha ancora mazzi registrati.`}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 8 }}>
            {deckOptions.map(d => {
              const active = d.id === deckSeat.deckId
              return (
                <button key={d.id} onClick={() => pickDeck(deckSeat.userId, d.id)} className="ct-press" style={{
                  display: 'flex', alignItems: 'center', gap: 10, minHeight: 56, padding: '6px 10px', borderRadius: 14, cursor: 'pointer', textAlign: 'left', font: 'inherit',
                  border: `1px solid ${active ? t.primaryBorder : t.border}`, background: active ? t.primaryBg : t.bgSurfaceAlt, color: t.text,
                }}>
                  <DeckThumb commander={d.commander} w={44} radius={8} preview={false} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 15, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</span>
                    {d.commander && <span style={{ display: 'block', fontSize: 12, color: t.textSub, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.commander}</span>}
                  </span>
                  <ManaPips colors={d.colors} size={14} />
                  {active && <span style={{ color: t.primary, display: 'flex' }}><Icon name="check" size={18} /></span>}
                </button>
              )
            })}
            {deckSeat.deckId && (
              <button onClick={() => pickDeck(deckSeat.userId, null)} className="ct-press" style={{ minHeight: 44, borderRadius: 12, border: `1px solid ${t.border}`, background: 'transparent', color: t.textSub, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Togli la scelta</button>
            )}
          </div>
        ))}
      </Sheet>

      {scoreOpen && score && (
        <LifeCounter tableId={tid} seats={seats} score={score} isOwner={isOwner} onAct={act} onUndo={undoScore} onReset={resetScore} onClose={closeScore} />
      )}
    </div>
  )
}
