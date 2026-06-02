import { useState } from 'react'
import { parseDecklist, validateAndFetchDecklist, fetchDecklistCards } from '../lib/scryfall'

const btnSecondary = { padding: '5px 12px', background: '#fff', color: '#555', border: '0.5px solid #ccc', borderRadius: 6, fontSize: 12, cursor: 'pointer' }
const btnPrimary = { padding: '9px 20px', background: '#534AB7', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer' }

export default function DeckListPanel({ decklist, onSave }) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState('view')
  const [editText, setEditText] = useState('')
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState([])
  const [cards, setCards] = useState([])
  const [loadingCards, setLoadingCards] = useState(false)
  const [selectedCard, setSelectedCard] = useState(null)

  const hasList = !!decklist

  const openPanel = async () => {
    setOpen(true)
    setSelectedCard(null)
    if (decklist) {
      setMode('view')
      setLoadingCards(true)
      try {
        const data = await fetchDecklistCards(decklist)
        setCards(data)
      } finally {
        setLoadingCards(false)
      }
    } else {
      setMode('edit')
      setEditText('')
    }
  }

  const startEdit = () => {
    setEditText(decklist || '')
    setErrors([])
    setSelectedCard(null)
    setMode('edit')
  }

  const cancel = () => {
    setErrors([])
    if (decklist) setMode('view')
    else setOpen(false)
  }

  const save = async () => {
    setSaving(true)
    setErrors([])
    try {
      const result = await validateAndFetchDecklist(editText)
      if (!result.valid) {
        setErrors(result.errors)
        return
      }
      await onSave(editText)
      setCards(result.cards)
      setSelectedCard(null)
      setMode('view')
    } catch (e) {
      setErrors([e?.error || 'Errore nel salvataggio'])
    } finally {
      setSaving(false)
    }
  }

  const toggleCard = (card) => {
    setSelectedCard(prev => prev?.name === card.name ? null : card)
  }

  const totalCount = hasList ? parseDecklist(decklist).totalCount : 0

  return (
    <>
      <button
        style={{ ...btnSecondary, color: hasList ? '#534AB7' : '#888', borderColor: hasList ? '#AFA9EC' : '#ccc' }}
        onClick={() => open ? setOpen(false) : openPanel()}
      >
        {open ? 'Chiudi' : hasList ? 'Lista ✓' : 'Lista'}
      </button>

      {open && (
        <div style={{ marginTop: 12 }}>
          {mode === 'view' && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ fontSize: 13, color: '#888' }}>{totalCount} carte</div>
                <button style={btnSecondary} onClick={startEdit}>Modifica lista</button>
              </div>

              {loadingCards ? (
                <div style={{ fontSize: 13, color: '#888', padding: '0.5rem 0' }}>Caricamento carte...</div>
              ) : (
                <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                  {/* Lista testuale */}
                  <div style={{ flex: 1, maxHeight: 480, overflowY: 'auto', borderRadius: 8, border: '0.5px solid #e0ddd5' }}>
                    {cards.map((card, i) => {
                      const active = selectedCard?.name === card.name
                      return (
                        <div
                          key={i}
                          onClick={() => toggleCard(card)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 10,
                            padding: '6px 12px', cursor: 'pointer',
                            background: active ? '#F0EFFA' : i % 2 === 0 ? '#fafaf8' : '#fff',
                            borderBottom: '0.5px solid #f0ede5',
                            userSelect: 'none'
                          }}
                        >
                          <span style={{
                            fontSize: 11, fontWeight: 600, color: '#888',
                            minWidth: 26, textAlign: 'right'
                          }}>{card.count}×</span>
                          <span style={{
                            fontSize: 14,
                            color: active ? '#534AB7' : '#222',
                            fontWeight: active ? 500 : 400
                          }}>{card.name}</span>
                        </div>
                      )
                    })}
                  </div>

                  {/* Immagine carta selezionata */}
                  <div style={{ flexShrink: 0, width: 200 }}>
                    {selectedCard ? (
                      selectedCard.imageUri ? (
                        <img
                          src={selectedCard.imageUri}
                          alt={selectedCard.name}
                          style={{ width: 200, borderRadius: 12, display: 'block', boxShadow: '0 4px 20px rgba(0,0,0,0.18)' }}
                        />
                      ) : (
                        <div style={{
                          width: 200, height: 279, background: '#eee', borderRadius: 12,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 12, color: '#888', textAlign: 'center', padding: 12
                        }}>{selectedCard.name}</div>
                      )
                    ) : (
                      <div style={{
                        width: 200, height: 279, border: '2px dashed #e0ddd5', borderRadius: 12,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 12, color: '#ccc', textAlign: 'center', padding: 12
                      }}>Clicca su una carta per vedere l'immagine</div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {mode === 'edit' && (
            <>
              <div style={{ fontSize: 12, color: '#888', marginBottom: 6 }}>
                Una carta per riga · formato "1 Sol Ring" · esattamente 100 carte
              </div>
              <textarea
                value={editText}
                onChange={e => setEditText(e.target.value)}
                placeholder={'1 Sol Ring\n1 Command Tower\n...'}
                rows={14}
                style={{
                  width: '100%', boxSizing: 'border-box', padding: '8px 10px',
                  borderRadius: 8, border: '0.5px solid #ccc', fontSize: 13,
                  fontFamily: 'monospace', resize: 'vertical', outline: 'none'
                }}
              />
              {errors.length > 0 && (
                <div style={{ marginTop: 8, padding: '8px 12px', background: '#fcebeb', borderRadius: 8 }}>
                  {errors.map((err, i) => (
                    <div key={i} style={{ color: '#a32d2d', fontSize: 13 }}>{err}</div>
                  ))}
                </div>
              )}
              <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                <button style={btnPrimary} onClick={save} disabled={saving}>
                  {saving ? 'Validazione in corso...' : 'Salva lista'}
                </button>
                <button style={btnSecondary} onClick={cancel}>Annulla</button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  )
}
