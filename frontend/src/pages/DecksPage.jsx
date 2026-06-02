import { useState, useEffect } from 'react'
import { api } from '../lib/api'
import { useTheme } from '../hooks/useTheme'
import DeckListPanel from '../components/DeckListPanel'

const COLOR_MAP   = { W: '#f5f0e0', U: '#b8d4e8', B: '#c8b8d8', R: '#e8c0b0', G: '#b8d8b8' }
const COLOR_LABEL = { W: 'Bianco', U: 'Blu', B: 'Nero', R: 'Rosso', G: 'Verde' }

function ColorPip({ c }) {
  return (
    <span title={COLOR_LABEL[c]} style={{
      display: 'inline-block', width: 18, height: 18, borderRadius: '50%',
      background: COLOR_MAP[c] || '#eee', border: '1px solid rgba(0,0,0,0.15)',
      fontSize: 10, lineHeight: '18px', textAlign: 'center', fontWeight: 600, color: '#444'
    }}>{c}</span>
  )
}

const commanderArtUrl = (name) =>
  `https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(name)}&format=image&version=art_crop`

export default function DecksPage() {
  const { t } = useTheme()
  const [decks, setDecks]         = useState([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState('')
  const [form, setForm]           = useState({ name: '', commander: '', colors: [] })
  const [saving, setSaving]       = useState(false)
  const [formError, setFormError] = useState('')

  const loadDecks = async () => {
    try {
      setDecks(await api.getMyDecks())
    } catch {
      setError('Errore nel caricamento mazzi')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadDecks() }, [])

  const toggleColor = (c) => {
    setForm(f => ({ ...f, colors: f.colors.includes(c) ? f.colors.filter(x => x !== c) : [...f.colors, c] }))
  }

  const submit = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) { setFormError('Il nome è obbligatorio'); return }
    setSaving(true); setFormError('')
    try {
      await api.createDeck({ name: form.name.trim(), commander: form.commander.trim() || null, colors: form.colors.join('') || null })
      setForm({ name: '', commander: '', colors: [] })
      await loadDecks()
    } catch (err) {
      setFormError(err.error || 'Errore nel salvataggio')
    } finally {
      setSaving(false)
    }
  }

  const deleteDeck = async (id) => {
    if (!confirm('Eliminare questo mazzo?')) return
    try {
      await api.deleteDeck(id)
      await loadDecks()
    } catch (err) {
      alert(err.error || 'Errore nella cancellazione')
    }
  }

  const formCard  = { background: t.bgSurface, border: `0.5px solid ${t.border}`, borderRadius: 12, padding: '1rem 1.25rem', marginBottom: 10 }
  const deckCard  = { background: t.bgSurface, border: `0.5px solid ${t.border}`, borderRadius: 12, marginBottom: 10, overflow: 'hidden' }
  const inputSt   = { padding: '9px 12px', borderRadius: 8, border: `0.5px solid ${t.border}`, fontSize: 14, width: '100%', boxSizing: 'border-box', outline: 'none', background: t.inputBg, color: t.text }
  const btnPrimary  = { padding: '9px 20px', background: t.primary, color: t.primaryFg, border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer' }
  const btnDanger   = { padding: '5px 12px', background: t.dangerBg, color: t.danger, border: `0.5px solid ${t.dangerBorder}`, borderRadius: 6, fontSize: 12, cursor: 'pointer' }

  return (
    <div>
      <div style={{ fontSize: 18, fontWeight: 600, marginBottom: '1.25rem', color: t.text }}>I miei mazzi</div>

      {/* Form aggiungi */}
      <div style={formCard}>
        <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 12, color: t.text }}>Aggiungi mazzo</div>
        <form onSubmit={submit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <input style={inputSt} placeholder="Nome mazzo *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            <input style={inputSt} placeholder="Commander (opzionale)" value={form.commander} onChange={e => setForm(f => ({ ...f, commander: e.target.value }))} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, color: t.textSub }}>Colori:</span>
            {['W', 'U', 'B', 'R', 'G'].map(c => (
              <button
                key={c} type="button" onClick={() => toggleColor(c)}
                style={{
                  width: 32, height: 32, borderRadius: '50%', cursor: 'pointer',
                  fontSize: 12, fontWeight: 600, color: '#444',
                  background: COLOR_MAP[c],
                  border: form.colors.includes(c) ? `2px solid ${t.primary}` : '1px solid #ccc',
                  outline: form.colors.includes(c) ? `2px solid ${t.primaryBorder}` : 'none'
                }}
              >{c}</button>
            ))}
          </div>
          {formError && <div style={{ color: t.danger, fontSize: 13, marginBottom: 8 }}>{formError}</div>}
          <button type="submit" style={btnPrimary} disabled={saving}>{saving ? 'Salvataggio...' : '+ Aggiungi mazzo'}</button>
        </form>
      </div>

      {loading && <div style={{ color: t.textSub, fontSize: 14, padding: '1rem' }}>Caricamento...</div>}
      {error   && <div style={{ color: t.danger,  fontSize: 14 }}>{error}</div>}
      {!loading && decks.length === 0 && (
        <div style={{ ...formCard, textAlign: 'center', color: t.textSub, fontSize: 14, padding: '2rem' }}>
          Nessun mazzo ancora. Aggiungine uno sopra!
        </div>
      )}

      {decks.map(deck => (
        <div key={deck.id} style={deckCard}>

          {/* Banner commander */}
          {deck.commander ? (
            <div style={{ position: 'relative', height: 96, background: '#1a1640', overflow: 'hidden' }}>
              <img
                src={commanderArtUrl(deck.commander)} alt=""
                onError={e => { e.currentTarget.style.display = 'none' }}
                style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top', display: 'block' }}
              />
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.08) 55%, transparent 100%)' }} />
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '8px 14px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16, color: '#fff', textShadow: '0 1px 4px rgba(0,0,0,0.7)' }}>{deck.name}</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 1 }}>{deck.commander}</div>
                </div>
                {deck.colors && <div style={{ display: 'flex', gap: 3 }}>{deck.colors.split('').map(c => <ColorPip key={c} c={c} />)}</div>}
              </div>
            </div>
          ) : (
            <div style={{ padding: '12px 14px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 600, fontSize: 15, color: t.text }}>{deck.name}</div>
              {deck.colors && <div style={{ display: 'flex', gap: 3 }}>{deck.colors.split('').map(c => <ColorPip key={c} c={c} />)}</div>}
            </div>
          )}

          {/* Azioni */}
          <div style={{ padding: '10px 14px', display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center' }}>
            <DeckListPanel
              decklist={deck.decklist}
              commander={deck.commander}
              onSave={async (newList, newCommander) => {
                await api.updateDeck(deck.id, { decklist: newList, commander: newCommander })
                await loadDecks()
              }}
            />
            <button style={btnDanger} onClick={() => deleteDeck(deck.id)}>Elimina</button>
          </div>

        </div>
      ))}
    </div>
  )
}
