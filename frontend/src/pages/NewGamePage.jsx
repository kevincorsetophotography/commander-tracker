import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { api } from '../lib/api'
import { useTheme } from '../hooks/useTheme'
import { useFeedback } from '../hooks/useFeedback'
import { fireConfetti } from '../lib/confetti'
import { toast as sonner } from 'sonner'
import { pointsFor } from '../lib/seasons'
import PlayerAvatar from '../components/PlayerAvatar'
import DeckThumb from '../components/DeckThumb'
import BracketBadge from '../components/BracketBadge'
import { Icon, ManaPips, bento } from '../components/ui'

// Registra partita v2 (restyle Stitch): logger a tocchi, a schermo intero.
// Stessa API di prima: giocatori+mazzi, vincitore, piazzamenti (da ordine di uscita),
// eliminatedById, data, note. Nessun campo nuovo.

const EMPTY_SLOT = { userId: '', deckId: '' }

// Data locale YYYY-MM-DD (niente shift di fuso come con toISOString)
const toLocalDate = (d) => {
  const x = new Date(d)
  const p = (n) => String(n).padStart(2, '0')
  return `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())}`
}

const prettyDate = (ymd) => {
  const [y, m, d] = ymd.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const today = toLocalDate(new Date())
  const label = date.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' })
  return ymd === today ? `Oggi, ${label}` : label
}

function StepTitle({ n, title, sub, t, right }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
      <div style={{ display: 'flex', gap: 10, minWidth: 0 }}>
        <span style={{
          width: 28, height: 28, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, fontWeight: 900, color: t.primary, border: `1.5px solid ${t.primaryBorder}`, background: t.primaryBg,
        }}>{n}</span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: t.text, lineHeight: 1.3 }}>{title}</div>
          {sub && <div style={{ fontSize: 13, color: t.textSub, marginTop: 2, lineHeight: 1.4 }}>{sub}</div>}
        </div>
      </div>
      {right}
    </div>
  )
}

const chip = (t, active, extra = {}) => ({
  display: 'inline-flex', alignItems: 'center', gap: 8, minHeight: 44, padding: '6px 12px 6px 6px', borderRadius: 999,
  cursor: 'pointer', fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap',
  border: `1px solid ${active ? t.primaryBorder : t.border}`,
  background: active ? t.primaryBg : t.bgSurfaceAlt, color: active ? t.primary : t.text,
  ...extra,
})

export default function NewGamePage() {
  const navigate = useNavigate()
  const { t } = useTheme()
  const { toast } = useFeedback()
  // Contesto pod torneo: giocatori bloccati + collegamento al tavolo dopo il salvataggio
  const podCtx = useLocation().state?.podContext || null
  const [allDecks, setAllDecks] = useState([])   // tutti i mazzi di tutti i giocatori
  const [slots, setSlots] = useState(() => podCtx
    ? podCtx.players.map(p => ({ userId: String(p.userId), deckId: '' }))
    : [{ ...EMPTY_SLOT }, { ...EMPTY_SLOT }, { ...EMPTY_SLOT }])
  const [winnerId, setWinnerId] = useState(null)   // { userId, deckId }
  const [notes, setNotes] = useState('')
  // Per i pod torneo la data è quella dell'EVENTO (non oggi), così la partita
  // finisce nella stagione/storico giusti.
  const [playedAt, setPlayedAt] = useState(() => toLocalDate(podCtx?.date || new Date()))
  const [elimOrder, setElimOrder] = useState([])  // chiavi "userId-deckId" in ordine di uscita (primo eliminato per primo)
  const [elimBy, setElimBy] = useState({})        // { "userId-deckId" → userId del killer }
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(null)    // indice dello slot in modifica (scelta giocatore/mazzo)

  useEffect(() => {
    api.getDecks().then(setAllDecks).catch(() => setError('Errore caricamento mazzi'))
  }, [])

  // Raggruppa mazzi per utente
  const byUser = useMemo(() => allDecks.reduce((acc, d) => {
    if (!acc[d.userId]) acc[d.userId] = { username: d.user.username, avatarCardName: d.user.avatarCardName || null, avatarScryfallId: d.user.avatarScryfallId || null, decks: [] }
    acc[d.userId].decks.push(d)
    return acc
  }, {}), [allDecks])

  const users = Object.entries(byUser)
    .map(([id, v]) => ({ id: parseInt(id), ...v }))
    .sort((a, b) => a.username.localeCompare(b.username))

  const updateSlot = (i, patch) => {
    setSlots(prev => {
      const next = [...prev]
      next[i] = { ...next[i], ...patch }
      return next
    })
    setWinnerId(null)
  }

  const pickUser = (i, userId) => {
    const decks = byUser[userId]?.decks || []
    // Un solo mazzo → scelto in automatico
    updateSlot(i, { userId: String(userId), deckId: decks.length === 1 ? String(decks[0].id) : '' })
    if (decks.length === 1) setEditing(null)
  }

  const pickDeck = (i, deckId) => {
    updateSlot(i, { deckId: String(deckId) })
    setEditing(null)
  }

  const addSlot = () => {
    if (slots.length >= 5) return
    setSlots(prev => [...prev, { ...EMPTY_SLOT }])
    setEditing(slots.length)
  }

  const removeSlot = (i) => {
    if (slots.length <= 3) return
    setSlots(prev => prev.filter((_, idx) => idx !== i))
    setWinnerId(null)
    setEditing(null)
  }

  const filledSlots = slots.filter(s => s.userId && s.deckId)

  // Reset ordine di uscita ed eliminazioni se cambia il vincitore o il tavolo
  useEffect(() => { setElimOrder([]); setElimBy({}) }, [winnerId, slots.length])

  const slotKey = (s) => `${parseInt(s.userId)}-${parseInt(s.deckId)}`

  const isWinner = (s) =>
    winnerId && winnerId.userId === parseInt(s.userId) && winnerId.deckId === parseInt(s.deckId)

  // Perdenti = giocatori completi non vincitori
  const losers = filledSlots.filter(s => !isWinner(s))

  const toggleElim = (key) => {
    setElimOrder(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key])
  }

  // placement: vincitore = 1; primo eliminato = N; ultimo eliminato (runner-up) = 2
  const computePlacements = () => {
    if (!winnerId || elimOrder.length !== losers.length || losers.length === 0) return null
    const n = filledSlots.length
    const map = {}
    map[`${winnerId.userId}-${winnerId.deckId}`] = 1
    elimOrder.forEach((key, i) => { map[key] = n - i })
    return map
  }

  const deckOf = (deckId) => allDecks.find(d => d.id === parseInt(deckId))
  const userOf = (userId) => byUser[userId]

  // Anteprima punti stagione: stessa funzione usata dalla classifica (lib/seasons).
  const pointsPreview = useMemo(() => {
    if (!winnerId || filledSlots.length < 3) return null
    const placements = computePlacements()
    const players = filledSlots.map(s => ({
      key: slotKey(s), userId: s.userId,
      isWinner: isWinner(s),
      placement: placements ? placements[slotKey(s)] : null,
    }))
    const game = { players }
    return players
      .map(p => ({ ...p, pts: pointsFor(p, game) }))
      .sort((a, b) => (a.placement ?? (a.isWinner ? 1 : 99)) - (b.placement ?? (b.isWinner ? 1 : 99)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [winnerId, elimOrder, slots])

  const submit = async () => {
    if (filledSlots.length < 3) { setError('Servono almeno 3 giocatori completi'); return }
    if (!winnerId) { setError('Seleziona il vincitore'); return }

    // Controlla duplicati giocatore
    const uids = filledSlots.map(s => s.userId)
    if (new Set(uids).size !== uids.length) { setError('Lo stesso giocatore non può essere al tavolo due volte'); return }

    setSaving(true)
    setError('')
    try {
      const placements = computePlacements()
      const game = await api.createGame({
        players: filledSlots.map(s => ({
          userId: parseInt(s.userId),
          deckId: parseInt(s.deckId),
          ...(placements ? { placement: placements[slotKey(s)] } : {}),
          ...(elimBy[slotKey(s)] ? { eliminatedById: parseInt(elimBy[slotKey(s)]) } : {})
        })),
        winnerId: winnerId.userId,
        winnerDeckId: winnerId.deckId,
        notes: notes.trim() || undefined,
        playedAt: playedAt || undefined
      })
      // Pod torneo: collega la partita al tavolo e torna all'evento
      if (podCtx) {
        await api.submitTableResult(podCtx.eventId, podCtx.tableId, { gameId: game.id })
        fireConfetti()
        toast('Risultato del pod registrato', 'success')
        setTimeout(() => navigate(`/evento/${podCtx.eventId}`), 700)
        return
      }
      fireConfetti()
      const winnerName = userOf(winnerId.userId)?.username
      sonner.success('Partita registrata', {
        description: winnerName ? `Vittoria di ${winnerName} · punti stagione aggiornati` : undefined,
        duration: 6000,
        action: {
          label: 'Annulla',
          onClick: async () => {
            try {
              await api.deleteGame(game.id)
              sonner('Partita annullata')
              navigate('/', { replace: true })
              window.location.reload()
            } catch (e) {
              sonner.error(e.error || 'Impossibile annullare la partita')
            }
          },
        },
      })
      setTimeout(() => navigate('/'), 700)
    } catch (err) {
      setError(err.error || 'Errore nel salvataggio')
    } finally {
      setSaving(false)
    }
  }

  const card = bento(t, { padding: '1.1rem 1rem', marginBottom: 14 })
  const usedIds = new Set(slots.map(s => s.userId).filter(Boolean))
  const canSave = filledSlots.length >= 3 && !!winnerId && !saving

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      {/* Testata: chiudi · titolo · data */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <button onClick={() => navigate(-1)} aria-label="Chiudi" className="ct-press" style={{
          width: 44, height: 44, borderRadius: 14, border: `1px solid ${t.border}`, background: t.bgSurfaceAlt, color: t.text,
          display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0,
        }}><Icon name="close" size={20} /></button>
        <div style={{ flex: 1, minWidth: 0, fontSize: 22, fontWeight: 800, color: t.text }}>
          {podCtx ? 'Risultato del pod' : 'Registra partita'}
        </div>
        <label style={{ position: 'relative', ...chip(t, false, { padding: '6px 12px', color: t.text }) }}>
          <Icon name="calendar" size={17} />
          <span style={{ textTransform: 'capitalize' }}>{prettyDate(playedAt)}</span>
          <input
            type="date"
            value={playedAt}
            max={podCtx ? undefined : toLocalDate(new Date())}
            onChange={e => e.target.value && setPlayedAt(e.target.value)}
            aria-label="Data partita"
            style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%' }}
          />
        </label>
      </div>

      {podCtx && (
        <div style={{ ...card, display: 'flex', gap: 10, alignItems: 'center', border: `1px solid ${t.primaryBorder}`, background: t.primaryBg }}>
          <span style={{ width: 9, height: 9, borderRadius: '50%', background: t.primary, boxShadow: `0 0 8px ${t.primary}`, flexShrink: 0 }} />
          <div style={{ fontSize: 14, color: t.text, lineHeight: 1.45 }}>
            Partita del tavolo dell'evento: giocatori bloccati, data dell'evento. Scegli i mazzi, il vincitore e (se vuoi) l'ordine di uscita.
          </div>
        </div>
      )}

      {allDecks.length === 0 && !error && (
        <div style={{ ...card, color: t.textSub, fontSize: 14 }}>
          Caricamento mazzi… Se non compare nulla, aggiungete prima i mazzi dalla pagina <strong>Mazzi</strong>.
        </div>
      )}

      {/* 1 — Chi ha giocato */}
      <div className="ct-fade-up" style={card}>
        <StepTitle n={1} t={t} title="Chi ha giocato" sub="Da 3 a 5 giocatori al tavolo"
          right={<span style={{ fontSize: 13, fontWeight: 700, color: filledSlots.length >= 3 ? t.primary : t.textSub, padding: '4px 10px', borderRadius: 999, border: `1px solid ${filledSlots.length >= 3 ? t.primaryBorder : t.border}`, whiteSpace: 'nowrap' }}>{filledSlots.length}/{slots.length}</span>} />

        {slots.map((slot, i) => {
          const u = slot.userId ? userOf(slot.userId) : null
          const deck = slot.deckId ? deckOf(slot.deckId) : null
          const open = editing === i || !slot.userId || !slot.deckId
          const userChoices = podCtx
            ? podCtx.players.map(p => ({ id: p.userId, username: p.username, ...(byUser[p.userId] || {}) }))
            : users.filter(x => !usedIds.has(String(x.id)) || String(x.id) === slot.userId)
          return (
            <div key={i} style={{
              borderRadius: 16, padding: 12, marginBottom: 10,
              border: `1px solid ${deck ? t.primaryBorder : t.border}`, background: t.bgSurfaceAlt,
            }}>
              {/* riga riassunto */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                {u
                  ? <PlayerAvatar username={u.username} avatarCardName={u.avatarCardName} avatarScryfallId={u.avatarScryfallId} size={42} />
                  : <span style={{ width: 42, height: 42, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1.5px dashed ${t.borderStrong}`, color: t.textSub, fontWeight: 800 }}>{i + 1}</span>}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: u ? t.text : t.textSub, wordBreak: 'break-word' }}>{u ? u.username : `Giocatore ${i + 1}`}</div>
                  {deck ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 3 }}>
                      <span style={{ fontSize: 14, color: t.textSub, wordBreak: 'break-word' }}>{deck.name}</span>
                      <ManaPips colors={deck.colors} size={17} />
                    </div>
                  ) : (
                    <div style={{ fontSize: 13, color: t.textMuted, marginTop: 2 }}>{u ? 'Scegli il mazzo' : 'Tocca un giocatore qui sotto'}</div>
                  )}
                </div>
                {deck && !open && (
                  <button onClick={() => setEditing(i)} className="ct-press" style={{ minHeight: 40, padding: '0 12px', borderRadius: 12, border: `1px solid ${t.border}`, background: 'transparent', color: t.primary, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Cambia</button>
                )}
                {i >= 3 && !podCtx && (
                  <button onClick={() => removeSlot(i)} aria-label="Rimuovi giocatore" className="ct-press" style={{ width: 40, height: 40, borderRadius: 12, border: `1px solid ${t.border}`, background: 'transparent', color: t.textSub, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="close" size={18} /></button>
                )}
              </div>

              {/* scelta giocatore */}
              {open && !podCtx && (
                <div className="ct-scroll-x ct-section-open" style={{ display: 'flex', gap: 8, overflowX: 'auto', marginTop: 12, paddingBottom: 2 }}>
                  {userChoices.map(x => (
                    <button key={x.id} onClick={() => pickUser(i, x.id)} className="ct-press" style={chip(t, String(x.id) === slot.userId)}>
                      <PlayerAvatar username={x.username} avatarCardName={x.avatarCardName} avatarScryfallId={x.avatarScryfallId} size={32} />
                      {x.username}
                    </button>
                  ))}
                </div>
              )}

              {/* scelta mazzo */}
              {open && slot.userId && (
                <div className="ct-section-open" style={{ display: 'grid', gap: 8, marginTop: 12 }}>
                  {(byUser[slot.userId]?.decks || []).map(d => {
                    const active = String(d.id) === slot.deckId
                    return (
                      <button key={d.id} onClick={() => pickDeck(i, d.id)} className="ct-press" style={{
                        display: 'flex', alignItems: 'center', gap: 10, padding: 8, minHeight: 56, borderRadius: 14, cursor: 'pointer', textAlign: 'left',
                        border: `1px solid ${active ? t.primaryBorder : t.border}`, background: active ? t.primaryBg : t.bgSurface, color: t.text,
                      }}>
                        <DeckThumb commander={d.commander} w={56} radius={10} preview={false} />
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ display: 'block', fontSize: 15, fontWeight: 700, wordBreak: 'break-word' }}>{d.name}</span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                            <ManaPips colors={d.colors} size={16} />
                            <BracketBadge bracket={d.bracket} size="lg" />
                          </span>
                        </span>
                        {active && <span style={{ color: t.primary, display: 'flex' }}><Icon name="check" size={20} stroke={2.6} /></span>}
                      </button>
                    )
                  })}
                  {(byUser[slot.userId]?.decks || []).length === 0 && (
                    <div style={{ fontSize: 13, color: t.textMuted }}>Questo giocatore non ha mazzi registrati.</div>
                  )}
                </div>
              )}
            </div>
          )
        })}

        {slots.length < 5 && !podCtx && (
          <button onClick={addSlot} className="ct-press" style={{
            width: '100%', minHeight: 48, borderRadius: 14, cursor: 'pointer', fontSize: 15, fontWeight: 700,
            border: `1.5px dashed ${t.borderStrong}`, background: 'transparent', color: t.textSub,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
            <Icon name="plus" size={18} /> Aggiungi {slots.length + 1}° giocatore
          </button>
        )}
      </div>

      {/* 2 — Chi ha vinto */}
      {filledSlots.length >= 2 && (
        <div className="ct-fade-up" style={card}>
          <StepTitle n={2} t={t} title="Chi ha vinto" sub="Tocca il vincitore del tavolo" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
            {filledSlots.map((s, i) => {
              const active = isWinner(s)
              const u = userOf(s.userId); const d = deckOf(s.deckId)
              return (
                <button key={i} onClick={() => setWinnerId({ userId: parseInt(s.userId), deckId: parseInt(s.deckId) })} className="ct-press" style={{
                  position: 'relative', textAlign: 'left', padding: 12, borderRadius: 16, cursor: 'pointer', minHeight: 96,
                  border: `1.5px solid ${active ? t.primary : t.border}`, background: active ? t.winBg : t.bgSurfaceAlt,
                  boxShadow: active ? t.glow : 'none', color: t.text, transition: 'all 0.18s ease',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                    <PlayerAvatar username={u?.username} avatarCardName={u?.avatarCardName} avatarScryfallId={u?.avatarScryfallId} size={34} highlight={active} />
                    <span style={{
                      width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: active ? t.primary : 'transparent', color: active ? t.primaryFg : t.textMuted,
                      border: active ? 'none' : `1.5px solid ${t.borderStrong}`,
                    }}><Icon name="trophy" size={15} stroke={2.2} /></span>
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 800, marginTop: 8, wordBreak: 'break-word' }}>{u?.username}</div>
                  <div style={{ fontSize: 13, color: t.textSub, marginTop: 2, wordBreak: 'break-word' }}>{d?.name}</div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* 3 — Ordine di eliminazione + chi ha eliminato chi (opzionali) */}
      {winnerId && losers.length >= 1 && (
        <div className="ct-fade-up" style={card}>
          <StepTitle n={3} t={t} title="Ordine di eliminazione"
            sub={losers.length >= 2 ? 'Tocca i giocatori dal primo eliminato all’ultimo. Facoltativo: completa i piazzamenti.' : 'Facoltativo: chi ha eliminato chi.'}
            right={elimOrder.length > 0 && (
              <button onClick={() => { setElimOrder([]) }} style={{ fontSize: 13, fontWeight: 700, color: t.primary, background: 'none', border: 'none', cursor: 'pointer', padding: '6px 0', whiteSpace: 'nowrap' }}>Azzera</button>
            )} />

          {losers.map((s, i) => {
            const key = slotKey(s)
            const pos = elimOrder.indexOf(key)
            const picked = pos !== -1
            const u = userOf(s.userId); const d = deckOf(s.deckId)
            const place = picked ? filledSlots.length - pos : null
            return (
              <div key={i} style={{
                borderRadius: 16, padding: 12, marginBottom: 10,
                border: `1px solid ${picked ? 'rgba(255,107,107,0.35)' : t.border}`, background: t.bgSurfaceAlt,
              }}>
                <button onClick={() => losers.length >= 2 && toggleElim(key)} className="ct-press" style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 10, background: 'transparent', border: 'none', padding: 0,
                  cursor: losers.length >= 2 ? 'pointer' : 'default', textAlign: 'left', color: t.text,
                }}>
                  <span style={{
                    minWidth: 44, height: 30, padding: '0 8px', borderRadius: 999, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 13, fontWeight: 800,
                    background: picked ? t.dangerBg : 'transparent', color: picked ? t.danger : t.textMuted,
                    border: `1px solid ${picked ? t.dangerBorder : t.borderStrong}`,
                  }}>{picked ? `${pos + 1}° out` : '—'}</span>
                  <PlayerAvatar username={u?.username} avatarCardName={u?.avatarCardName} avatarScryfallId={u?.avatarScryfallId} size={34} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 15, fontWeight: 700, wordBreak: 'break-word' }}>{u?.username}</span>
                    <span style={{ display: 'block', fontSize: 13, color: t.textSub, wordBreak: 'break-word' }}>{d?.name}</span>
                  </span>
                  {place && <span style={{ fontSize: 13, fontWeight: 700, color: t.textSub, flexShrink: 0 }}>{place}° posto</span>}
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 13, color: t.textSub, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <Icon name="swords" size={15} /> Eliminato da
                  </span>
                  {filledSlots.filter(o => slotKey(o) !== key).map((o, oi) => {
                    const killer = userOf(o.userId)
                    const sel = String(elimBy[key] || '') === String(parseInt(o.userId))
                    return (
                      <button key={oi} onClick={() => setElimBy(prev => ({ ...prev, [key]: sel ? '' : String(parseInt(o.userId)) }))}
                        className="ct-press" style={chip(t, sel, { minHeight: 40, fontSize: 13, padding: '4px 10px 4px 4px' })}>
                        <PlayerAvatar username={killer?.username} avatarCardName={killer?.avatarCardName} avatarScryfallId={killer?.avatarScryfallId} size={26} />
                        {killer?.username}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
          {losers.length >= 2 && (
            <div style={{ fontSize: 13, fontWeight: 600, color: elimOrder.length === losers.length ? t.win : t.textMuted }}>
              {elimOrder.length === losers.length ? 'Piazzamenti completi' : `${elimOrder.length}/${losers.length} in ordine`}
            </div>
          )}
        </div>
      )}

      {/* Anteprima punti stagione */}
      {pointsPreview && (
        <div className="ct-fade-up" style={card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: t.text }}>Punti stagione</div>
            <span style={{ fontSize: 12, color: t.textSub, textAlign: 'right' }}>1°=3 · 2°=2 · 3°=1 · +1 a partita</span>
          </div>
          {pointsPreview.map((p, i) => {
            const u = userOf(p.userId)
            return (
              <div key={p.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: i ? `1px solid ${t.border}` : 'none' }}>
                <span style={{ width: 30, fontSize: 14, fontWeight: 800, color: p.isWinner ? t.primary : t.textSub }}>
                  {p.placement ? `${p.placement}°` : p.isWinner ? '1°' : '–'}
                </span>
                <span style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 600, color: t.text, wordBreak: 'break-word' }}>{u?.username}</span>
                <span style={{ fontSize: 18, fontWeight: 900, color: p.isWinner ? t.primary : t.text, fontVariantNumeric: 'tabular-nums' }}>+{p.pts}</span>
              </div>
            )
          })}
          {!computePlacements() && losers.length >= 2 && (
            <div style={{ fontSize: 13, color: t.textMuted, marginTop: 6, lineHeight: 1.4 }}>
              Senza ordine di eliminazione completo contano solo vittoria (+3) e presenza (+1).
            </div>
          )}
        </div>
      )}

      {/* Note */}
      <div style={card}>
        <div style={{ fontSize: 16, fontWeight: 800, color: t.text, marginBottom: 8 }}>Note <span style={{ fontSize: 13, fontWeight: 500, color: t.textSub }}>(facoltative)</span></div>
        <textarea
          rows={3}
          maxLength={2000}
          style={{ padding: '12px 14px', borderRadius: 14, border: `1px solid ${t.border}`, fontSize: 15, width: '100%', boxSizing: 'border-box', outline: 'none', background: t.inputBg, color: t.text, resize: 'vertical', fontFamily: 'inherit' }}
          placeholder="es. combo al turno 9, partita lunga..."
          value={notes}
          onChange={e => setNotes(e.target.value)}
        />
      </div>

      {error && <div role="alert" style={{ color: t.danger, fontSize: 14, fontWeight: 600, marginBottom: 12 }}>{error}</div>}

      {/* Salva: fisso in basso */}
      <div style={{ position: 'sticky', bottom: 'calc(12px + env(safe-area-inset-bottom))', zIndex: 5, paddingTop: 4 }}>
        <button
          onClick={submit}
          disabled={saving}
          className="ct-press"
          style={{
            width: '100%', minHeight: 56, borderRadius: 18, border: 'none', fontSize: 17, fontWeight: 800,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            background: canSave ? t.primary : t.bgMuted, color: canSave ? t.primaryFg : t.textSub,
            boxShadow: canSave ? `${t.glow}, 0 10px 30px rgba(0,0,0,0.35)` : '0 10px 30px rgba(0,0,0,0.25)',
            cursor: saving ? 'wait' : 'pointer', transition: 'all 0.2s ease',
          }}
        >
          <Icon name="check" size={21} stroke={2.6} />
          {saving ? 'Salvataggio…' : !filledSlots.length || filledSlots.length < 3 ? 'Completa almeno 3 giocatori' : !winnerId ? 'Scegli il vincitore' : 'Salva partita'}
        </button>
      </div>
    </div>
  )
}
