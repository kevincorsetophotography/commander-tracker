import { useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api'
import DeckListPanel from '../components/DeckListPanel'

const EMPTY_DECK_FORM = { userId: '', name: '', commander: '', colors: '' }
const EMPTY_USER_FORM = { username: '', password: '', role: 'PLAYER' }
const EMPTY_GAME_FORM = {
  id: null,
  slots: [
    { userId: '', deckId: '' },
    { userId: '', deckId: '' },
    { userId: '', deckId: '' }
  ],
  winnerId: '',
  winnerDeckId: '',
  notes: ''
}

function SectionCard({ children }) {
  return (
    <div style={{ background: '#fff', border: '0.5px solid #e0ddd5', borderRadius: 12, padding: '1rem 1.25rem', marginBottom: 12 }}>
      {children}
    </div>
  )
}

function formatGameForEdit(game) {
  return {
    id: game.id,
    slots: game.players.map((player) => ({
      userId: String(player.user.id),
      deckId: String(player.deck.id)
    })),
    winnerId: String(game.players.find((player) => player.isWinner)?.user.id || ''),
    winnerDeckId: String(game.players.find((player) => player.isWinner)?.deck.id || ''),
    notes: game.notes || ''
  }
}

export default function AdminPage() {
  const [tab, setTab] = useState('utenti')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [users, setUsers] = useState([])
  const [decks, setDecks] = useState([])
  const [games, setGames] = useState([])

  const [userForm, setUserForm] = useState(EMPTY_USER_FORM)
  const [editingUserId, setEditingUserId] = useState(null)
  const [editingUserForm, setEditingUserForm] = useState(EMPTY_USER_FORM)

  const [deckForm, setDeckForm] = useState(EMPTY_DECK_FORM)
  const [editingDeckId, setEditingDeckId] = useState(null)
  const [editingDeckForm, setEditingDeckForm] = useState(EMPTY_DECK_FORM)

  const [gameForm, setGameForm] = useState(EMPTY_GAME_FORM)
  const [saving, setSaving] = useState(false)

  const loadData = async () => {
    setLoading(true)
    setError('')

    try {
      const [usersData, decksData, gamesData] = await Promise.all([
        api.adminUsers(),
        api.getDecks(),
        api.getGames()
      ])

      setUsers(usersData)
      setDecks(decksData)
      setGames(gamesData)
    } catch (err) {
      setError(err.error || 'Errore nel caricamento area admin')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const usersById = useMemo(() => {
    return new Map(users.map((user) => [user.id, user]))
  }, [users])

  const decksByUser = useMemo(() => {
    return decks.reduce((acc, deck) => {
      const key = String(deck.userId)
      if (!acc[key]) acc[key] = []
      acc[key].push(deck)
      return acc
    }, {})
  }, [decks])

  const gameCandidates = gameForm.slots.filter((slot) => slot.userId && slot.deckId)

  const startUserEdit = (user) => {
    setEditingUserId(user.id)
    setEditingUserForm({ username: user.username, password: '', role: user.role })
  }

  const startDeckEdit = (deck) => {
    setEditingDeckId(deck.id)
    setEditingDeckForm({
      userId: String(deck.userId),
      name: deck.name,
      commander: deck.commander || '',
      colors: deck.colors || ''
    })
  }

  const startGameEdit = (game) => {
    setGameForm(formatGameForEdit(game))
    setTab('partite')
  }

  const updateGameSlot = (index, field, value) => {
    setGameForm((current) => {
      const nextSlots = [...current.slots]
      nextSlots[index] = { ...nextSlots[index], [field]: value }

      if (field === 'userId') {
        nextSlots[index].deckId = ''
      }

      return {
        ...current,
        slots: nextSlots,
        winnerId: '',
        winnerDeckId: ''
      }
    })
  }

  const addGameSlot = () => {
    setGameForm((current) => {
      if (current.slots.length >= 5) return current
      return {
        ...current,
        slots: [...current.slots, { userId: '', deckId: '' }]
      }
    })
  }

  const removeGameSlot = (index) => {
    setGameForm((current) => {
      if (current.slots.length <= 3) return current
      return {
        ...current,
        slots: current.slots.filter((_, currentIndex) => currentIndex !== index),
        winnerId: '',
        winnerDeckId: ''
      }
    })
  }

  const submitUser = async (event) => {
    event.preventDefault()
    setSaving(true)

    try {
      await api.createUser(userForm)
      setUserForm(EMPTY_USER_FORM)
      await loadData()
    } catch (err) {
      setError(err.error || 'Errore nel salvataggio utente')
    } finally {
      setSaving(false)
    }
  }

  const saveUserEdit = async (userId) => {
    setSaving(true)

    try {
      await api.updateUser(userId, editingUserForm)
      setEditingUserId(null)
      setEditingUserForm(EMPTY_USER_FORM)
      await loadData()
    } catch (err) {
      setError(err.error || 'Errore nell\'aggiornamento utente')
    } finally {
      setSaving(false)
    }
  }

  const removeUser = async (userId) => {
    if (!confirm('Eliminare questo utente?')) return

    try {
      await api.deleteUser(userId)
      await loadData()
    } catch (err) {
      setError(err.error || 'Errore nell\'eliminazione utente')
    }
  }

  const submitDeck = async (event) => {
    event.preventDefault()
    setSaving(true)

    try {
      await api.createDeck({
        ...deckForm,
        userId: Number.parseInt(deckForm.userId, 10),
        commander: deckForm.commander.trim() || null,
        colors: deckForm.colors.trim().toUpperCase() || null
      })
      setDeckForm(EMPTY_DECK_FORM)
      await loadData()
    } catch (err) {
      setError(err.error || 'Errore nel salvataggio mazzo')
    } finally {
      setSaving(false)
    }
  }

  const saveDeckEdit = async (deckId) => {
    setSaving(true)

    try {
      await api.updateDeck(deckId, {
        ...editingDeckForm,
        userId: Number.parseInt(editingDeckForm.userId, 10),
        commander: editingDeckForm.commander.trim() || null,
        colors: editingDeckForm.colors.trim().toUpperCase() || null
      })
      setEditingDeckId(null)
      setEditingDeckForm(EMPTY_DECK_FORM)
      await loadData()
    } catch (err) {
      setError(err.error || 'Errore nell\'aggiornamento mazzo')
    } finally {
      setSaving(false)
    }
  }

  const removeDeck = async (deckId) => {
    if (!confirm('Eliminare questo mazzo?')) return

    try {
      await api.deleteDeck(deckId)
      await loadData()
    } catch (err) {
      setError(err.error || 'Errore nell\'eliminazione mazzo')
    }
  }

  const submitGameEdit = async (event) => {
    event.preventDefault()
    setSaving(true)

    try {
      const payload = {
        players: gameForm.slots
          .filter((slot) => slot.userId && slot.deckId)
          .map((slot) => ({
            userId: Number.parseInt(slot.userId, 10),
            deckId: Number.parseInt(slot.deckId, 10)
          })),
        winnerId: Number.parseInt(gameForm.winnerId, 10),
        winnerDeckId: Number.parseInt(gameForm.winnerDeckId, 10),
        notes: gameForm.notes.trim() || undefined
      }

      await api.updateGame(gameForm.id, payload)
      setGameForm(EMPTY_GAME_FORM)
      await loadData()
    } catch (err) {
      setError(err.error || 'Errore nell\'aggiornamento partita')
    } finally {
      setSaving(false)
    }
  }

  const removeGame = async (gameId) => {
    if (!confirm('Eliminare questa partita?')) return

    try {
      await api.deleteGame(gameId)
      if (gameForm.id === gameId) {
        setGameForm(EMPTY_GAME_FORM)
      }
      await loadData()
    } catch (err) {
      setError(err.error || 'Errore nell\'eliminazione partita')
    }
  }

  const inputStyle = {
    padding: '9px 12px',
    borderRadius: 8,
    border: '0.5px solid #ccc',
    fontSize: 14,
    width: '100%',
    boxSizing: 'border-box',
    background: '#fff'
  }

  const buttonPrimary = {
    padding: '9px 16px',
    background: '#534AB7',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontSize: 14,
    cursor: 'pointer'
  }

  const buttonSecondary = {
    padding: '8px 12px',
    background: '#fff',
    color: '#555',
    border: '0.5px solid #ccc',
    borderRadius: 8,
    fontSize: 13,
    cursor: 'pointer'
  }

  const buttonDanger = {
    padding: '8px 12px',
    background: '#fcebeb',
    color: '#a32d2d',
    border: '0.5px solid #f7c1c1',
    borderRadius: 8,
    fontSize: 13,
    cursor: 'pointer'
  }

  if (loading) {
    return <div style={{ color: '#888', fontSize: 14, padding: '2rem' }}>Caricamento area admin...</div>
  }

  return (
    <div>
      <div style={{ fontSize: 18, fontWeight: 600, marginBottom: '1rem' }}>Amministrazione</div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        {['utenti', 'mazzi', 'partite'].map((item) => (
          <button
            key={item}
            onClick={() => setTab(item)}
            style={{
              ...buttonSecondary,
              background: tab === item ? '#534AB7' : '#fff',
              color: tab === item ? '#fff' : '#555',
              borderColor: tab === item ? '#534AB7' : '#ccc'
            }}
          >
            {item.charAt(0).toUpperCase() + item.slice(1)}
          </button>
        ))}
      </div>

      {error && <div style={{ color: '#a32d2d', fontSize: 13, marginBottom: 12 }}>{error}</div>}

      {tab === 'utenti' && (
        <div>
          <SectionCard>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>Crea utente</div>
            <form onSubmit={submitUser} style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr auto', gap: 8 }}>
              <input style={inputStyle} placeholder="Username" value={userForm.username} onChange={(event) => setUserForm((current) => ({ ...current, username: event.target.value }))} />
              <input style={inputStyle} type="password" placeholder="Password" value={userForm.password} onChange={(event) => setUserForm((current) => ({ ...current, password: event.target.value }))} />
              <select style={inputStyle} value={userForm.role} onChange={(event) => setUserForm((current) => ({ ...current, role: event.target.value }))}>
                <option value="PLAYER">PLAYER</option>
                <option value="ADMIN">ADMIN</option>
              </select>
              <button type="submit" style={buttonPrimary} disabled={saving}>Crea</button>
            </form>
          </SectionCard>

          {users.map((user) => (
            <SectionCard key={user.id}>
              {editingUserId === user.id ? (
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr auto auto', gap: 8 }}>
                  <input style={inputStyle} value={editingUserForm.username} onChange={(event) => setEditingUserForm((current) => ({ ...current, username: event.target.value }))} />
                  <input style={inputStyle} type="password" placeholder="Nuova password opzionale" value={editingUserForm.password} onChange={(event) => setEditingUserForm((current) => ({ ...current, password: event.target.value }))} />
                  <select style={inputStyle} value={editingUserForm.role} onChange={(event) => setEditingUserForm((current) => ({ ...current, role: event.target.value }))}>
                    <option value="PLAYER">PLAYER</option>
                    <option value="ADMIN">ADMIN</option>
                  </select>
                  <button style={buttonPrimary} onClick={() => saveUserEdit(user.id)}>Salva</button>
                  <button style={buttonSecondary} onClick={() => setEditingUserId(null)}>Annulla</button>
                </div>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{user.username} <span style={{ color: '#888', fontWeight: 500 }}>· {user.role}</span></div>
                    <div style={{ fontSize: 12, color: '#888' }}>
                      Mazzi: {user._count.decks} · Presenze: {user._count.gamePlayers} · Partite create: {user._count.createdGames}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button style={buttonSecondary} onClick={() => startUserEdit(user)}>Modifica</button>
                    <button style={buttonDanger} onClick={() => removeUser(user.id)}>Elimina</button>
                  </div>
                </div>
              )}
            </SectionCard>
          ))}
        </div>
      )}

      {tab === 'mazzi' && (
        <div>
          <SectionCard>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>Crea mazzo</div>
            <form onSubmit={submitDeck} style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 2fr 1fr auto', gap: 8 }}>
              <select style={inputStyle} value={deckForm.userId} onChange={(event) => setDeckForm((current) => ({ ...current, userId: event.target.value }))}>
                <option value="">Owner</option>
                {users.map((user) => <option key={user.id} value={user.id}>{user.username}</option>)}
              </select>
              <input style={inputStyle} placeholder="Nome mazzo" value={deckForm.name} onChange={(event) => setDeckForm((current) => ({ ...current, name: event.target.value }))} />
              <input style={inputStyle} placeholder="Commander" value={deckForm.commander} onChange={(event) => setDeckForm((current) => ({ ...current, commander: event.target.value }))} />
              <input style={inputStyle} placeholder="Colori es. WUG" value={deckForm.colors} onChange={(event) => setDeckForm((current) => ({ ...current, colors: event.target.value }))} />
              <button type="submit" style={buttonPrimary} disabled={saving}>Crea</button>
            </form>
          </SectionCard>

          {decks.map((deck) => (
            <SectionCard key={deck.id}>
              {editingDeckId === deck.id ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 2fr 1fr auto auto', gap: 8 }}>
                  <select style={inputStyle} value={editingDeckForm.userId} onChange={(event) => setEditingDeckForm((current) => ({ ...current, userId: event.target.value }))}>
                    {users.map((user) => <option key={user.id} value={user.id}>{user.username}</option>)}
                  </select>
                  <input style={inputStyle} value={editingDeckForm.name} onChange={(event) => setEditingDeckForm((current) => ({ ...current, name: event.target.value }))} />
                  <input style={inputStyle} value={editingDeckForm.commander} onChange={(event) => setEditingDeckForm((current) => ({ ...current, commander: event.target.value }))} />
                  <input style={inputStyle} value={editingDeckForm.colors} onChange={(event) => setEditingDeckForm((current) => ({ ...current, colors: event.target.value }))} />
                  <button style={buttonPrimary} onClick={() => saveDeckEdit(deck.id)}>Salva</button>
                  <button style={buttonSecondary} onClick={() => setEditingDeckId(null)}>Annulla</button>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  {deck.commander && (
                    <img
                      src={`https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(deck.commander)}&format=image&version=art_crop`}
                      alt=""
                      onError={e => { e.currentTarget.style.display = 'none' }}
                      style={{ width: 72, height: 52, objectFit: 'cover', objectPosition: 'center top', borderRadius: 6, flexShrink: 0 }}
                    />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600 }}>{deck.name}</div>
                    <div style={{ fontSize: 12, color: '#888' }}>
                      {deck.user.username} · {deck.commander || 'Nessun commander'} · {deck.colors || 'Senza colori'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                    <DeckListPanel
                      decklist={deck.decklist}
                      onSave={async (newList) => {
                        await api.updateDeck(deck.id, { decklist: newList })
                        await loadData()
                      }}
                    />
                    <button style={buttonSecondary} onClick={() => startDeckEdit(deck)}>Modifica</button>
                    <button style={buttonDanger} onClick={() => removeDeck(deck.id)}>Elimina</button>
                  </div>
                </div>
              )}
            </SectionCard>
          ))}
        </div>
      )}

      {tab === 'partite' && (
        <div>
          <SectionCard>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Gestione partite</div>
            <div style={{ fontSize: 13, color: '#888' }}>Per creare nuove partite puoi continuare a usare la pagina "+ Partita". Qui puoi modificare o eliminare le partite esistenti.</div>
          </SectionCard>

          {gameForm.id && (
            <SectionCard>
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>Modifica partita #{gameForm.id}</div>
              <form onSubmit={submitGameEdit}>
                {gameForm.slots.map((slot, index) => (
                  <div key={index} style={{ display: 'grid', gridTemplateColumns: '40px 1fr 1fr auto', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                    <div style={{ textAlign: 'center', color: '#666' }}>{index + 1}</div>
                    <select style={inputStyle} value={slot.userId} onChange={(event) => updateGameSlot(index, 'userId', event.target.value)}>
                      <option value="">Giocatore</option>
                      {users.map((user) => <option key={user.id} value={user.id}>{user.username}</option>)}
                    </select>
                    <select style={inputStyle} value={slot.deckId} onChange={(event) => updateGameSlot(index, 'deckId', event.target.value)} disabled={!slot.userId}>
                      <option value="">Mazzo</option>
                      {(decksByUser[slot.userId] || []).map((deck) => <option key={deck.id} value={deck.id}>{deck.name}</option>)}
                    </select>
                    {index >= 3 ? <button type="button" style={buttonSecondary} onClick={() => removeGameSlot(index)}>Rimuovi</button> : <div />}
                  </div>
                ))}

                <div style={{ marginBottom: 12 }}>
                  <button type="button" style={buttonSecondary} onClick={addGameSlot}>Aggiungi giocatore</button>
                </div>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                  {gameCandidates.map((slot, index) => {
                    const active = gameForm.winnerId === slot.userId && gameForm.winnerDeckId === slot.deckId
                    const user = usersById.get(Number.parseInt(slot.userId, 10))
                    const deck = decks.find((candidate) => candidate.id === Number.parseInt(slot.deckId, 10))

                    return (
                      <button
                        key={`${slot.userId}-${slot.deckId}-${index}`}
                        type="button"
                        onClick={() => setGameForm((current) => ({ ...current, winnerId: slot.userId, winnerDeckId: slot.deckId }))}
                        style={{
                          ...buttonSecondary,
                          background: active ? '#EAF3DE' : '#fff',
                          color: active ? '#3B6D11' : '#555',
                          borderColor: active ? '#C0DD97' : '#ccc'
                        }}
                      >
                        {user?.username} · {deck?.name}
                      </button>
                    )
                  })}
                </div>

                <input
                  style={{ ...inputStyle, marginBottom: 12 }}
                  placeholder="Note"
                  value={gameForm.notes}
                  onChange={(event) => setGameForm((current) => ({ ...current, notes: event.target.value }))}
                />

                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="submit" style={buttonPrimary} disabled={saving}>Salva partita</button>
                  <button type="button" style={buttonSecondary} onClick={() => setGameForm(EMPTY_GAME_FORM)}>Chiudi modifica</button>
                </div>
              </form>
            </SectionCard>
          )}

          {games.map((game) => {
            const winner = game.players.find((player) => player.isWinner)
            return (
              <SectionCard key={game.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>Partita #{game.id}</div>
                    <div style={{ fontSize: 12, color: '#888' }}>
                      Creata da {game.createdBy?.username || 'sconosciuto'} · {winner ? `${winner.user.username} vince con ${winner.deck.name}` : 'Nessun vincitore'}
                    </div>
                    <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
                      {game.players.map((player) => `${player.user.username} · ${player.deck.name}`).join(' | ')}
                    </div>
                    {game.notes && <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>{game.notes}</div>}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button style={buttonSecondary} onClick={() => startGameEdit(game)}>Modifica</button>
                    <button style={buttonDanger} onClick={() => removeGame(game.id)}>Elimina</button>
                  </div>
                </div>
              </SectionCard>
            )
          })}
        </div>
      )}
    </div>
  )
}
