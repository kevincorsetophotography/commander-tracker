import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'

const EMPTY_SLOT = { userId: '', deckId: '' }

export default function NewGamePage() {
  const navigate = useNavigate()
  const [allDecks, setAllDecks] = useState([])   // tutti i mazzi di tutti i giocatori
  const [slots, setSlots] = useState([{ ...EMPTY_SLOT }, { ...EMPTY_SLOT }, { ...EMPTY_SLOT }])
  const [winnerId, setWinnerId] = useState(null)   // { userId, deckId }
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api.getDecks().then(setAllDecks).catch(() => setError('Errore caricamento mazzi'))
  }, [])

  // Raggruppa mazzi per utente
  const byUser = allDecks.reduce((acc, d) => {
    if (!acc[d.userId]) acc[d.userId] = { username: d.user.username, decks: [] }
    acc[d.userId].decks.push(d)
    return acc
  }, {})

  const users = Object.entries(byUser).map(([id, v]) => ({ id: parseInt(id), ...v }))

  const updateSlot = (i, field, value) => {
    setSlots(prev => {
      const next = [...prev]
      next[i] = { ...next[i], [field]: value }
      // Reset mazzo se cambia giocatore
      if (field === 'userId') next[i].deckId = ''
      return next
    })
    setWinnerId(null)
  }

  const addSlot = () => {
    if (slots.length >= 5) return
    setSlots(prev => [...prev, { ...EMPTY_SLOT }])
  }

  const removeSlot = (i) => {
    if (slots.length <= 3) return
    setSlots(prev => prev.filter((_, idx) => idx !== i))
    setWinnerId(null)
  }

  const filledSlots = slots.filter(s => s.userId && s.deckId)

  const isWinner = (s) =>
    winnerId && winnerId.userId === parseInt(s.userId) && winnerId.deckId === parseInt(s.deckId)

  const getDeckName = (deckId) => allDecks.find(d => d.id === parseInt(deckId))?.name || ''
  const getUserName = (userId) => users.find(u => u.id === parseInt(userId))?.username || ''

  const submit = async () => {
    if (filledSlots.length < 3) { setError('Servono almeno 3 giocatori completi'); return }
    if (!winnerId) { setError('Seleziona il vincitore'); return }

    // Controlla duplicati giocatore
    const uids = filledSlots.map(s => s.userId)
    if (new Set(uids).size !== uids.length) { setError('Lo stesso giocatore non può essere al tavolo due volte'); return }

    setSaving(true)
    setError('')
    try {
      await api.createGame({
        players: filledSlots.map(s => ({ userId: parseInt(s.userId), deckId: parseInt(s.deckId) })),
        winnerId: winnerId.userId,
        winnerDeckId: winnerId.deckId,
        notes: notes.trim() || undefined
      })
      navigate('/')
    } catch (err) {
      setError(err.error || 'Errore nel salvataggio')
    } finally {
      setSaving(false)
    }
  }

  const card = { background: '#fff', border: '0.5px solid #e0ddd5', borderRadius: 12, padding: '1rem 1.25rem', marginBottom: 12 }
  const sel = { padding: '9px 12px', borderRadius: 8, border: '0.5px solid #ccc', fontSize: 14, background: '#fff', outline: 'none', cursor: 'pointer' }

  return (
    <div>
      <div style={{ fontSize: 18, fontWeight: 500, marginBottom: '1.25rem' }}>Nuova partita</div>

      {allDecks.length === 0 && !error && (
        <div style={{ ...card, color: '#888', fontSize: 14 }}>
          Nessun mazzo trovato. Prima aggiungete i mazzi dalla pagina <strong>Mazzi</strong>.
        </div>
      )}

      {/* Slot giocatori */}
      <div style={card}>
        <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 12 }}>Giocatori al tavolo</div>
        {slots.map((slot, i) => {
          const userDecks = slot.userId ? (byUser[slot.userId]?.decks || []) : []
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#EEEDFE', color: '#534AB7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 500, flexShrink: 0 }}>
                {i + 1}
              </div>
              <select style={{ ...sel, flex: 1, minWidth: 120 }} value={slot.userId} onChange={e => updateSlot(i, 'userId', e.target.value)}>
                <option value="">Giocatore...</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.username}</option>)}
              </select>
              <select style={{ ...sel, flex: 1, minWidth: 120 }} value={slot.deckId} onChange={e => updateSlot(i, 'deckId', e.target.value)} disabled={!slot.userId}>
                <option value="">Mazzo...</option>
                {userDecks.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              {i >= 3 && (
                <button onClick={() => removeSlot(i)} style={{ padding: '6px 10px', border: '0.5px solid #ccc', borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: 13, color: '#888' }}>×</button>
              )}
            </div>
          )
        })}
        {slots.length < 5 && (
          <button onClick={addSlot} style={{ marginTop: 4, padding: '7px 14px', border: '0.5px solid #ccc', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 13, color: '#666' }}>
            + Aggiungi giocatore
          </button>
        )}
      </div>

      {/* Selezione vincitore */}
      {filledSlots.length >= 2 && (
        <div style={card}>
          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 12 }}>Chi ha vinto?</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {filledSlots.map((s, i) => {
              const active = isWinner(s)
              return (
                <button
                  key={i}
                  onClick={() => setWinnerId({ userId: parseInt(s.userId), deckId: parseInt(s.deckId) })}
                  style={{
                    padding: '8px 16px', borderRadius: 20, cursor: 'pointer', fontSize: 13, fontWeight: 500,
                    background: active ? '#EAF3DE' : '#fff',
                    color: active ? '#3B6D11' : '#555',
                    border: active ? '0.5px solid #C0DD97' : '0.5px solid #ccc',
                    transition: 'all 0.15s'
                  }}
                >
                  {getUserName(s.userId)} · {getDeckName(s.deckId)}
                  {active && ' ✓'}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Note */}
      <div style={card}>
        <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 8 }}>Note (opzionale)</div>
        <input
          style={{ padding: '9px 12px', borderRadius: 8, border: '0.5px solid #ccc', fontSize: 14, width: '100%', boxSizing: 'border-box', outline: 'none' }}
          placeholder="es. combo al turno 9, partita lunga..."
          value={notes}
          onChange={e => setNotes(e.target.value)}
        />
      </div>

      {error && <div style={{ color: '#a32d2d', fontSize: 13, marginBottom: 12 }}>{error}</div>}

      <button
        onClick={submit}
        disabled={saving}
        style={{ padding: '11px 28px', background: '#534AB7', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}
      >
        {saving ? 'Salvataggio...' : 'Salva partita'}
      </button>
    </div>
  )
}
