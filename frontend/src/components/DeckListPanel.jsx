import { useState } from 'react'
import { parseDecklist, validateAndFetchDecklist, fetchDecklistCards, fetchCommanderCard } from '../lib/scryfall'
import { useTheme } from '../hooks/useTheme'

export default function DeckListPanel({ decklist, commander, onSave }) {
  const { t } = useTheme()
  const [open, setOpen]                 = useState(false)
  const [mode, setMode]                 = useState('view')
  const [commanderInput, setCommanderInput] = useState('')
  const [editText, setEditText]         = useState('')
  const [saving, setSaving]             = useState(false)
  const [errors, setErrors]             = useState([])
  const [cards, setCards]               = useState([])
  const [loadingCards, setLoadingCards] = useState(false)
  const [selectedCard, setSelectedCard] = useState(null)

  const hasList = !!decklist

  const btnSecondary = { padding: '5px 12px', background: t.bgSurface, color: t.textSub, border: `0.5px solid ${t.border}`, borderRadius: 6, fontSize: 12, cursor: 'pointer' }
  const btnPrimary   = { padding: '9px 20px', background: t.primary, color: t.primaryFg, border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer' }
  const inputSt      = { width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8, border: `0.5px solid ${t.border}`, fontSize: 13, background: t.inputBg, color: t.text, outline: 'none' }

  const openPanel = async () => {
    setOpen(true)
    setSelectedCard(null)
    if (decklist) {
      setMode('view')
      setLoadingCards(true)
      try { setCards(await fetchDecklistCards(decklist)) }
      finally { setLoadingCards(false) }
    } else {
      enterEditMode()
    }
  }

  const enterEditMode = () => {
    setCommanderInput(commander || '')
    if (decklist) {
      // Estrai le 99 carte (tutto tranne la riga del commander)
      const lines = decklist.split('\n').map(l => l.trim()).filter(Boolean)
      let removed = false
      const others = lines.filter(line => {
        if (removed) return true
        const m = line.match(/^\d+x?\s+(.+)$/)
        if (m && commander && m[1].toLowerCase() === commander.toLowerCase()) {
          removed = true
          return false
        }
        return true
      })
      setEditText(others.join('\n'))
    } else {
      setEditText('')
    }
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

    if (!commanderInput.trim()) {
      setErrors(['Inserisci il nome del commander'])
      setSaving(false)
      return
    }

    try {
      // 1. Valida il commander su Scryfall → ottieni nome esatto
      const commanderCard = await fetchCommanderCard(commanderInput.trim())
      if (!commanderCard) {
        setErrors([`Commander non trovato su Scryfall: "${commanderInput.trim()}"`])
        return
      }

      // 2. Costruisci la lista completa: 1 commander + 99 carte
      const fullList = `1 ${commanderCard.name}\n${editText.trim()}`

      // 3. Valida le 100 carte (esistenza + conteggio)
      const result = await validateAndFetchDecklist(fullList)
      if (!result.valid) {
        setErrors(result.errors)
        return
      }

      // 4. Salva — passa anche il nome esatto del commander per aggiornare il banner
      await onSave(fullList, commanderCard.name)
      setCards(result.cards)
      setSelectedCard(null)
      setMode('view')
    } catch (e) {
      setErrors([e?.error || 'Errore nel salvataggio'])
    } finally {
      setSaving(false)
    }
  }

  const toggleCard = (card) => setSelectedCard(prev => prev?.name === card.name ? null : card)
  const totalCount = hasList ? parseDecklist(decklist).totalCount : 0

  return (
    <>
      <button
        style={{ ...btnSecondary, color: hasList ? t.primary : t.textSub, borderColor: hasList ? t.primaryBorder : t.border }}
        onClick={() => open ? setOpen(false) : openPanel()}
      >
        {open ? 'Chiudi' : hasList ? 'Lista ✓' : 'Lista'}
      </button>

      {open && (
        <div style={{ marginTop: 12 }}>

          {/* ── VIEWER ── */}
          {mode === 'view' && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ fontSize: 13, color: t.textSub }}>{totalCount} carte</div>
                <button style={btnSecondary} onClick={enterEditMode}>Modifica lista</button>
              </div>

              {loadingCards ? (
                <div style={{ fontSize: 13, color: t.textSub, padding: '0.5rem 0' }}>Caricamento carte...</div>
              ) : (
                <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                  <div style={{ flex: 1, maxHeight: 480, overflowY: 'auto', borderRadius: 8, border: `0.5px solid ${t.border}`, background: t.bgSurface }}>
                    {cards.map((card, i) => {
                      const active = selectedCard?.name === card.name
                      return (
                        <div
                          key={i}
                          onClick={() => toggleCard(card)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 10,
                            padding: '6px 12px', cursor: 'pointer',
                            background: active ? t.primaryBg : i % 2 === 0 ? t.bgSurface : t.bgMuted,
                            borderBottom: `0.5px solid ${t.border}`,
                            userSelect: 'none'
                          }}
                        >
                          <span style={{ fontSize: 11, fontWeight: 600, color: t.textMuted, minWidth: 26, textAlign: 'right' }}>{card.count}×</span>
                          <span style={{ fontSize: 14, color: active ? t.primary : t.text, fontWeight: active ? 500 : 400 }}>{card.name}</span>
                        </div>
                      )
                    })}
                  </div>
                  <div style={{ flexShrink: 0, width: 200 }}>
                    {selectedCard ? (
                      selectedCard.imageUri
                        ? <img src={selectedCard.imageUri} alt={selectedCard.name} style={{ width: 200, borderRadius: 12, display: 'block', boxShadow: '0 4px 20px rgba(0,0,0,0.25)' }} />
                        : <div style={{ width: 200, height: 279, background: t.bgMuted, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: t.textSub, textAlign: 'center', padding: 12 }}>{selectedCard.name}</div>
                    ) : (
                      <div style={{ width: 200, height: 279, border: `2px dashed ${t.border}`, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: t.textMuted, textAlign: 'center', padding: 12 }}>
                        Clicca su una carta per vedere l'immagine
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── EDITOR ── */}
          {mode === 'edit' && (
            <>
              {/* Campo commander */}
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 12, color: t.textSub, marginBottom: 4, fontWeight: 500 }}>Commander</div>
                <input
                  value={commanderInput}
                  onChange={e => setCommanderInput(e.target.value)}
                  placeholder="es. Atraxa, Praetors' Voice"
                  style={inputSt}
                />
              </div>

              {/* 99 carte rimanenti */}
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 12, color: t.textSub, marginBottom: 4 }}>
                  99 carte rimanenti · formato "1 Nome Carta"
                </div>
                <textarea
                  value={editText}
                  onChange={e => setEditText(e.target.value)}
                  placeholder={'1 Sol Ring\n1 Command Tower\n...'}
                  rows={12}
                  style={{ ...inputSt, fontFamily: 'monospace', resize: 'vertical' }}
                />
              </div>

              {errors.length > 0 && (
                <div style={{ marginBottom: 8, padding: '8px 12px', background: t.dangerBg, borderRadius: 8, border: `0.5px solid ${t.dangerBorder}` }}>
                  {errors.map((err, i) => <div key={i} style={{ color: t.danger, fontSize: 13 }}>{err}</div>)}
                </div>
              )}

              <div style={{ display: 'flex', gap: 8 }}>
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
