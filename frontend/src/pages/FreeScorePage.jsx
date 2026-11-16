import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { useTheme } from '../hooks/useTheme'
import { useAuth } from '../hooks/useAuth'
import { useIsMobile } from '../hooks/useIsMobile'
import { validateSetup, buildSeats, canRegister, initialScore, applyFree, undoFree, resetFree, loadFree, saveFree, clearFree, MAX_PLAYERS } from '../lib/freeScore'
import LifeCounter, { enterFullscreen } from '../components/LifeCounter'
import PlayerPicker from '../components/PlayerPicker'
import PlayerAvatar from '../components/PlayerAvatar'
import DeckThumb from '../components/DeckThumb'
import CommanderInput from '../components/CommanderInput'
import { Icon, ManaPips, SectionLabel, Sheet, bento } from '../components/ui'

// Segnapunti libero (/segnapunti, dal menu dell'avatar): NON legato a un tavolo, tutto sul telefono.
// Setup (2-6 giocatori: utenti registrati col loro mazzo oppure ospiti con solo nome e commander
// facoltativo) → stesso LifeCounter del tavolo in modalità `local`. Lo stato vive in sessionStorage
// solo per sopravvivere a un ricaricamento; "Chiudi segnapunti" lo distrugge.

export default function FreeScorePage() {
  const navigate = useNavigate()
  const { t, dark } = useTheme()
  const { user: me } = useAuth()
  const isMobile = useIsMobile()

  const [game, setGame] = useState(() => loadFree())   // { seats, score } mentre si gioca
  const [entries, setEntries] = useState(() => (me ? [{ kind: 'user', userId: me.id, username: me.username, deck: null }] : []))
  const [decks, setDecks] = useState([])
  const [players, setPlayers] = useState([])
  const [pickerOpen, setPickerOpen] = useState(false)
  const [deckFor, setDeckFor] = useState(null)         // indice della voce di cui si sceglie il mazzo
  const [error, setError] = useState('')

  useEffect(() => {
    if (game) return
    api.getDecks().then(setDecks).catch(() => {})
    api.statsPlayers().then(setPlayers).catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ogni cambio di punteggio finisce in sessionStorage (ricaricamento accidentale)
  useEffect(() => { if (game) saveFree(game) }, [game])

  // utenti registrati: chi ha mazzi ∪ chi compare nelle statistiche (anche senza mazzi)
  const decksByUser = useMemo(() => decks.reduce((acc, d) => { (acc[d.userId] ||= []).push(d); return acc }, {}), [decks])
  const users = useMemo(() => {
    const m = new Map()
    for (const p of players) m.set(p.id, { id: p.id, username: p.username, avatarCardName: p.avatarCardName || null, avatarScryfallId: p.avatarScryfallId || null })
    for (const d of decks) if (!m.has(d.userId)) m.set(d.userId, { id: d.userId, username: d.user.username, avatarCardName: d.user.avatarCardName || null, avatarScryfallId: d.user.avatarScryfallId || null })
    if (me && !m.has(me.id)) m.set(me.id, { id: me.id, username: me.username, avatarCardName: me.avatarCardName || null, avatarScryfallId: me.avatarScryfallId || null })
    return [...m.values()].map(u => ({ ...u, decks: decksByUser[u.id] || [] })).sort((a, b) => a.username.localeCompare(b.username))
  }, [players, decks, me, decksByUser])
  const gamesById = useMemo(() => Object.fromEntries(players.map(p => [p.id, p.games || 0])), [players])
  const userById = useMemo(() => Object.fromEntries(users.map(u => [u.id, u])), [users])

  // l'utente corrente col suo unico mazzo, appena i mazzi arrivano
  useEffect(() => {
    setEntries(prev => prev.map(e => (e.kind === 'user' && !e.deck && !e.deckTouched && decksByUser[e.userId]?.length === 1 ? { ...e, deck: decksByUser[e.userId][0] } : e)))
  }, [decksByUser])

  const guests = entries.filter(e => e.kind === 'guest').length
  const full = entries.length >= MAX_PLAYERS
  const selectedIds = entries.filter(e => e.kind === 'user').map(e => e.userId)

  const toggleUser = (id) => {
    setError('')
    setEntries(prev => {
      if (prev.some(e => e.kind === 'user' && e.userId === id)) return prev.filter(e => !(e.kind === 'user' && e.userId === id))
      if (prev.length >= MAX_PLAYERS) return prev
      const own = decksByUser[id] || []
      return [...prev, { kind: 'user', userId: id, username: userById[id]?.username || '?', deck: own.length === 1 ? own[0] : null }]
    })
  }
  const addGuest = () => { setError(''); setEntries(prev => (prev.length >= MAX_PLAYERS ? prev : [...prev, { kind: 'guest', key: Date.now(), name: '', commander: '' }])) }
  const updateAt = (i, patch) => setEntries(prev => prev.map((e, j) => (j === i ? { ...e, ...patch } : e)))
  const removeAt = (i) => setEntries(prev => prev.filter((_, j) => j !== i))

  const setupError = validateSetup(entries)
  const start = () => {
    if (setupError) { setError(setupError); return }
    enterFullscreen() // dentro il gesto dell'utente
    const seats = buildSeats(entries)
    setGame({ seats, score: initialScore(seats.map(s => s.userId)) })
  }

  const leave = () => {
    if ((window.history.state?.idx ?? 0) > 0) navigate(-1)
    else navigate('/gioca', { replace: true })
  }
  const closeGame = () => { clearFree(); leave() }

  if (game) {
    const { seats, score } = game
    const register = canRegister(seats) ? () => {
      const order = score.seatOrder?.length === seats.length ? score.seatOrder : seats.map(s => s.userId)
      const byId = Object.fromEntries(seats.map(s => [s.userId, s]))
      navigate('/nuova-partita', { state: { prefill: { fromFreeScore: true, players: order.map(id => ({ userId: id, deckId: byId[id]?.deckId || null })) } } })
    } : null
    return (
      <LifeCounter
        local seats={seats} score={score} isOwner
        onAct={(a) => setGame(g => ({ ...g, score: applyFree(g.score, a) }))}
        onUndo={() => setGame(g => ({ ...g, score: undoFree(g.score) }))}
        onReset={() => { setGame(g => ({ ...g, score: resetFree(g.score) })); return true }}
        onReorder={(order) => setGame(g => ({ ...g, score: { ...g.score, seatOrder: order } }))}
        onClose={closeGame}
        onRegister={register}
      />
    )
  }

  const deckEntry = deckFor != null ? entries[deckFor] : null
  const deckOptions = deckEntry ? decksByUser[deckEntry.userId] || [] : []
  const input = { width: '100%', boxSizing: 'border-box', minHeight: 44, padding: '10px 12px', borderRadius: 12, border: `1px solid ${t.border}`, fontSize: 15, background: t.inputBg, color: t.text, outline: 'none' }
  const ghost = { flex: '1 1 150px', minHeight: 48, padding: '0 14px', borderRadius: 14, border: `1px solid ${t.border}`, background: t.bgSurfaceAlt, color: t.text, fontSize: 15, fontWeight: 800, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }
  const removeBtn = (i, name) => (
    <button onClick={() => removeAt(i)} aria-label={`Togli ${name || 'ospite'}`} className="ct-press" style={{ flexShrink: 0, width: 40, height: 40, borderRadius: 12, border: 'none', background: 'transparent', color: t.textMuted, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Icon name="close" size={18} />
    </button>
  )

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', paddingBottom: 16 }}>
      <button onClick={leave} className="ct-press" style={{ minHeight: 40, padding: '0 14px 0 10px', borderRadius: 12, border: `1px solid ${t.border}`, background: t.bgSurfaceAlt, color: t.text, fontSize: 14, fontWeight: 700, cursor: 'pointer', marginBottom: 14, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <Icon name="back" size={17} /> Indietro
      </button>

      <div className="ct-fade-up" style={bento(t, { padding: '1rem', marginBottom: 14 })}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: t.text }}>Segnapunti</h1>
        <div style={{ fontSize: 14, color: t.textSub, marginTop: 6, lineHeight: 1.45 }}>
          Per una partita qualsiasi, anche fuori dai tavoli. Resta solo su questo telefono: chiudendolo i punti vengono cancellati.
        </div>
      </div>

      <div className="ct-fade-up" style={bento(t, { padding: '1rem', marginBottom: 14, animationDelay: '40ms' })}>
        <SectionLabel t={t} icon="groups" right={<span style={{ fontSize: 12, fontWeight: 700, color: t.textSub }}>{entries.length}/{MAX_PLAYERS}</span>}>Giocatori e mazzi</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {entries.map((e, i) => {
            const rowStyle = { display: 'flex', alignItems: 'center', gap: 10, minHeight: 60, padding: '8px 6px 8px 10px', borderRadius: 14, border: `1px solid ${e.userId === me?.id ? t.primaryBorder : t.border}`, background: e.userId === me?.id ? t.primaryBg : t.bgSurfaceAlt, boxSizing: 'border-box' }
            if (e.kind === 'guest') return (
              <div key={`g${e.key}`} style={{ ...rowStyle, alignItems: 'flex-start' }}>
                <div style={{ paddingTop: 3 }}><PlayerAvatar username={e.name || '?'} size={38} /></div>
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.06em', color: t.textMuted }}>OSPITE</span>
                  <input value={e.name} maxLength={32} placeholder="Nome" aria-label="Nome dell'ospite" onChange={ev => updateAt(i, { name: ev.target.value })} style={input} />
                  <CommanderInput value={e.commander} onChange={(v) => updateAt(i, { commander: v })} placeholder="Commander (facoltativo)" style={input} />
                </div>
                {removeBtn(i, e.name)}
              </div>
            )
            const u = userById[e.userId]
            const own = decksByUser[e.userId] || []
            return (
              <div key={`u${e.userId}`} style={rowStyle}>
                <button onClick={() => setDeckFor(i)} className="ct-press" aria-label={`Scegli il mazzo di ${e.username}`} style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 10, padding: 0, border: 'none', background: 'transparent', cursor: 'pointer', font: 'inherit', textAlign: 'left', color: t.text }}>
                  <PlayerAvatar username={e.username} avatarCardName={u?.avatarCardName} avatarScryfallId={u?.avatarScryfallId} size={38} highlight={e.userId === me?.id} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 15, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.username}</span>
                    {e.deck ? (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3, minWidth: 0 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: t.textSub, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.deck.name}</span>
                        <ManaPips colors={e.deck.colors} size={14} />
                      </span>
                    ) : (
                      <span style={{ display: 'block', fontSize: 13, fontWeight: 600, marginTop: 3, color: own.length ? t.primary : t.textMuted }}>{own.length ? 'Scegli il mazzo' : 'Nessun mazzo · colore pieno'}</span>
                    )}
                  </span>
                  {e.deck && <DeckThumb commander={e.deck.commander} w={44} radius={8} preview={false} />}
                </button>
                {removeBtn(i, e.username)}
              </div>
            )
          })}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
          <button onClick={() => setPickerOpen(true)} disabled={full} className="ct-press" style={{ ...ghost, opacity: full ? 0.5 : 1 }}><Icon name="groups" size={17} /> Giocatori</button>
          <button onClick={addGuest} disabled={full} className="ct-press" style={{ ...ghost, opacity: full ? 0.5 : 1 }}><Icon name="plus" size={17} /> Ospite</button>
        </div>
      </div>

      {error && <div role="alert" style={{ color: t.danger, fontSize: 14, fontWeight: 600, marginBottom: 12 }}>{error}</div>}

      <div style={{ position: 'sticky', bottom: 'calc(12px + env(safe-area-inset-bottom))', zIndex: 5 }}>
        <button onClick={start} className="ct-press" style={{
          width: '100%', minHeight: 56, borderRadius: 18, border: 'none', fontSize: 17, fontWeight: 800, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          background: setupError ? t.bgMuted : t.primary, color: setupError ? t.textSub : t.primaryFg,
          boxShadow: setupError ? '0 10px 30px rgba(0,0,0,0.25)' : `${t.glow}, 0 10px 30px rgba(0,0,0,0.35)`,
        }}>
          <Icon name="flame" size={20} /> {setupError || 'Inizia'}
        </button>
      </div>

      <PlayerPicker
        open={pickerOpen} onOpenChange={setPickerOpen} t={t} dark={dark} isMobile={isMobile}
        players={users} selected={selectedIds} onToggle={toggleUser} max={MAX_PLAYERS - guests} min={2}
        recentIds={me?.id ? [me.id] : []} gamesById={gamesById}
      />

      <Sheet open={!!deckEntry} onOpenChange={(o) => { if (!o) setDeckFor(null) }} title={deckEntry ? (deckEntry.userId === me?.id ? 'Il tuo mazzo' : `Mazzo di ${deckEntry.username}`) : ''} t={t} dark={dark} isMobile={isMobile}>
        {deckEntry && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 8 }}>
            {deckOptions.length === 0 && (
              <div style={{ fontSize: 14, color: t.textSub, padding: '4px 0 6px', lineHeight: 1.5 }}>Nessun mazzo registrato: nel segnapunti avrà un colore pieno.</div>
            )}
            {deckOptions.map(d => {
              const active = d.id === deckEntry.deck?.id
              return (
                <button key={d.id} onClick={() => { updateAt(deckFor, { deck: d, deckTouched: true }); setDeckFor(null) }} className="ct-press" style={{
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
            {deckEntry.deck && (
              <button onClick={() => { updateAt(deckFor, { deck: null, deckTouched: true }); setDeckFor(null) }} className="ct-press" style={{ minHeight: 44, borderRadius: 12, border: `1px solid ${t.border}`, background: 'transparent', color: t.textSub, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Nessun mazzo (colore pieno)</button>
            )}
          </div>
        )}
      </Sheet>
    </div>
  )
}
