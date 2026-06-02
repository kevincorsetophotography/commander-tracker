import { useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api'
import DeckListPanel from '../components/DeckListPanel'
import { useTheme } from '../hooks/useTheme'
import { fetchCommanderColors } from '../lib/scryfall'
import { useFeedback } from '../hooks/useFeedback'
import CommanderInput from '../components/CommanderInput'

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
  notes: '',
  playedAt: ''
}

function SectionCard({ children, t }) {
  return (
    <div style={{
      background: t.bgSurface,
      backdropFilter: 'blur(14px) saturate(150%)',
      WebkitBackdropFilter: 'blur(14px) saturate(150%)',
      border: `1px solid ${t.border}`,
      borderRadius: 14,
      padding: '1rem 1.25rem',
      marginBottom: 12,
      boxShadow: t.shadow,
    }}>
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
    notes: game.notes || '',
    playedAt: game.playedAt ? new Date(game.playedAt).toISOString().slice(0, 10) : ''
  }
}

export default function AdminPage() {
  const { t } = useTheme()
  const { toast, confirm } = useFeedback()
  const [tab, setTab] = useState('utenti')
  const [detectingDeckColors, setDetectingDeckColors]       = useState(false)
  const [detectingEditColors, setDetectingEditColors]       = useState(false)
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
      toast('Utente creato', 'success')
    } catch (err) {
      setError(err.error || 'Errore nel salvataggio utente')
      toast(err.error || 'Errore nel salvataggio utente', 'error')
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
      toast('Utente aggiornato', 'success')
    } catch (err) {
      setError(err.error || 'Errore nell\'aggiornamento utente')
      toast(err.error || 'Errore nell\'aggiornamento utente', 'error')
    } finally {
      setSaving(false)
    }
  }

  const removeUser = async (userId) => {
    const ok = await confirm({ title: 'Eliminare utente?', message: 'L\'utente verrà eliminato definitivamente.', confirmLabel: 'Elimina', danger: true })
    if (!ok) return

    try {
      await api.deleteUser(userId)
      await loadData()
      toast('Utente eliminato', 'success')
    } catch (err) {
      toast(err.error || 'Errore nell\'eliminazione utente', 'error')
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
      toast('Mazzo creato', 'success')
    } catch (err) {
      setError(err.error || 'Errore nel salvataggio mazzo')
      toast(err.error || 'Errore nel salvataggio mazzo', 'error')
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
      toast('Mazzo aggiornato', 'success')
    } catch (err) {
      setError(err.error || 'Errore nell\'aggiornamento mazzo')
      toast(err.error || 'Errore nell\'aggiornamento mazzo', 'error')
    } finally {
      setSaving(false)
    }
  }

  const removeDeck = async (deckId) => {
    const ok = await confirm({ title: 'Eliminare mazzo?', message: 'Il mazzo verrà eliminato definitivamente.', confirmLabel: 'Elimina', danger: true })
    if (!ok) return

    try {
      await api.deleteDeck(deckId)
      await loadData()
      toast('Mazzo eliminato', 'success')
    } catch (err) {
      toast(err.error || 'Errore nell\'eliminazione mazzo', 'error')
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
        notes: gameForm.notes.trim() || undefined,
        playedAt: gameForm.playedAt || undefined
      }

      await api.updateGame(gameForm.id, payload)
      setGameForm(EMPTY_GAME_FORM)
      await loadData()
      toast('Partita aggiornata', 'success')
    } catch (err) {
      setError(err.error || 'Errore nell\'aggiornamento partita')
    } finally {
      setSaving(false)
    }
  }

  const removeGame = async (gameId) => {
    const ok = await confirm({ title: 'Eliminare partita?', message: 'La partita verrà eliminata definitivamente.', confirmLabel: 'Elimina', danger: true })
    if (!ok) return

    try {
      await api.deleteGame(gameId)
      if (gameForm.id === gameId) {
        setGameForm(EMPTY_GAME_FORM)
      }
      await loadData()
      toast('Partita eliminata', 'success')
    } catch (err) {
      toast(err.error || 'Errore nell\'eliminazione partita', 'error')
    }
  }

  const handleDeckCommanderBlur = async () => {
    const name = deckForm.commander.trim()
    if (!name) return
    setDetectingDeckColors(true)
    try {
      const colors = await fetchCommanderColors(name)
      if (colors !== null) setDeckForm(f => ({ ...f, colors: colors.join('') }))
    } finally {
      setDetectingDeckColors(false)
    }
  }

  const handleEditCommanderBlur = async () => {
    const name = editingDeckForm.commander.trim()
    if (!name) return
    setDetectingEditColors(true)
    try {
      const colors = await fetchCommanderColors(name)
      if (colors !== null) setEditingDeckForm(f => ({ ...f, colors: colors.join('') }))
    } finally {
      setDetectingEditColors(false)
    }
  }

  const inputStyle = {
    padding: '9px 12px',
    borderRadius: 8,
    border: `0.5px solid ${t.border}`,
    fontSize: 14,
    width: '100%',
    boxSizing: 'border-box',
    background: t.inputBg,
    color: t.text,
  }

  const buttonPrimary = {
    padding: '9px 16px',
    background: t.primary,
    color: t.primaryFg,
    border: 'none',
    borderRadius: 8,
    fontSize: 14,
    cursor: 'pointer'
  }

  const buttonSecondary = {
    padding: '8px 12px',
    background: t.bgSurface,
    color: t.textSub,
    border: `0.5px solid ${t.border}`,
    borderRadius: 8,
    fontSize: 13,
    cursor: 'pointer'
  }

  const buttonDanger = {
    padding: '8px 12px',
    background: t.dangerBg,
    color: t.danger,
    border: `0.5px solid ${t.dangerBorder}`,
    borderRadius: 8,
    fontSize: 13,
    cursor: 'pointer'
  }

  if (loading) {
    return <div style={{ color: t.textSub, fontSize: 14, padding: '2rem' }}>Caricamento area admin...</div>
  }

  return (
    <div style={{ color: t.text }}>
      <div style={{ fontSize: 18, fontWeight: 600, marginBottom: '1rem' }}>Amministrazione</div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        {['utenti', 'mazzi', 'partite'].map((item) => (
          <button
            key={item}
            onClick={() => setTab(item)}
            style={{
              ...buttonSecondary,
              background: tab === item ? t.primary : t.bgSurface,
              color: tab === item ? t.primaryFg : t.textSub,
              borderColor: tab === item ? t.primary : t.border
            }}
          >
            {item.charAt(0).toUpperCase() + item.slice(1)}
          </button>
        ))}
      </div>

      {error && <div style={{ color: t.danger, fontSize: 13, marginBottom: 12 }}>{error}</div>}

      {tab === 'utenti' && (
        <div>
          <SectionCard t={t}>
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
            <SectionCard key={user.id} t={t}>
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
                    <div style={{ fontWeight: 600, color: t.text }}>{user.username} <span style={{ color: t.textSub, fontWeight: 500 }}>· {user.role}</span></div>
                    <div style={{ fontSize: 12, color: t.textSub }}>
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
          <SectionCard t={t}>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>Crea mazzo</div>
            <form onSubmit={submitDeck} style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 2fr 1fr auto', gap: 8 }}>
              <select style={inputStyle} value={deckForm.userId} onChange={(event) => setDeckForm((current) => ({ ...current, userId: event.target.value }))}>
                <option value="">Owner</option>
                {users.map((user) => <option key={user.id} value={user.id}>{user.username}</option>)}
              </select>
              <input style={inputStyle} placeholder="Nome mazzo" value={deckForm.name} onChange={(event) => setDeckForm((current) => ({ ...current, name: event.target.value }))} />
              <CommanderInput
                style={inputStyle}
                placeholder="Commander"
                value={deckForm.commander}
                onChange={(name) => setDeckForm((current) => ({ ...current, commander: name }))}
                onBlur={handleDeckCommanderBlur}
              />
              <input
                style={{ ...inputStyle, color: detectingDeckColors ? t.primary : t.text }}
                placeholder={detectingDeckColors ? 'rilevamento...' : 'Colori es. WUG'}
                value={deckForm.colors}
                onChange={(event) => setDeckForm((current) => ({ ...current, colors: event.target.value }))}
                readOnly={detectingDeckColors}
              />
              <button type="submit" style={buttonPrimary} disabled={saving}>Crea</button>
            </form>
          </SectionCard>

          {decks.map((deck) => (
            <SectionCard key={deck.id} t={t}>
              {editingDeckId === deck.id ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 2fr 1fr auto auto', gap: 8 }}>
                  <select style={inputStyle} value={editingDeckForm.userId} onChange={(event) => setEditingDeckForm((current) => ({ ...current, userId: event.target.value }))}>
                    {users.map((user) => <option key={user.id} value={user.id}>{user.username}</option>)}
                  </select>
                  <input style={inputStyle} value={editingDeckForm.name} onChange={(event) => setEditingDeckForm((current) => ({ ...current, name: event.target.value }))} />
                  <CommanderInput
                    style={inputStyle}
                    value={editingDeckForm.commander}
                    onChange={(name) => setEditingDeckForm((current) => ({ ...current, commander: name }))}
                    onBlur={handleEditCommanderBlur}
                  />
                  <input
                    style={{ ...inputStyle, color: detectingEditColors ? t.primary : t.text }}
                    placeholder={detectingEditColors ? 'rilevamento...' : ''}
                    value={editingDeckForm.colors}
                    onChange={(event) => setEditingDeckForm((current) => ({ ...current, colors: event.target.value }))}
                    readOnly={detectingEditColors}
                  />
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
                    <div style={{ fontWeight: 600, color: t.text }}>{deck.name}</div>
                    <div style={{ fontSize: 12, color: t.textSub }}>
                      {deck.user.username} · {deck.commander || 'Nessun commander'} · {deck.colors || 'Senza colori'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                    <DeckListPanel
                      decklist={deck.decklist}
                      commander={deck.commander}
                      onSave={async (newList, newCommander, newColors) => {
                        await api.updateDeck(deck.id, {
                          decklist: newList,
                          commander: newCommander,
                          colors: newColors || undefined
                        })
                        await loadData()
                        toast('Lista salvata', 'success')
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
          <SectionCard t={t}>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Gestione partite</div>
            <div style={{ fontSize: 13, color: '#888' }}>Per creare nuove partite puoi continuare a usare la pagina "+ Partita". Qui puoi modificare o eliminare le partite esistenti.</div>
          </SectionCard>

          {gameForm.id && (
            <SectionCard t={t}>
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>Modifica partita #{gameForm.id}</div>
              <form onSubmit={submitGameEdit}>
                {gameForm.slots.map((slot, index) => (
                  <div key={index} style={{ display: 'grid', gridTemplateColumns: '40px 1fr 1fr auto', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                    <div style={{ textAlign: 'center', color: t.textSub }}>{index + 1}</div>
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

                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 12, color: t.textSub, marginBottom: 4 }}>Data partita</div>
                  <input
                    type="date"
                    style={{ ...inputStyle, width: 'auto', minWidth: 180 }}
                    value={gameForm.playedAt}
                    max={new Date().toISOString().slice(0, 10)}
                    onChange={(event) => setGameForm((current) => ({ ...current, playedAt: event.target.value }))}
                  />
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
                          background: active ? t.winBg : t.bgSurface,
                          color: active ? t.win : t.textSub,
                          borderColor: active ? t.win : t.border
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
              <SectionCard key={game.id} t={t}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontWeight: 600, color: t.text }}>Partita #{game.id}</div>
                    <div style={{ fontSize: 12, color: t.textSub }}>
                      Creata da {game.createdBy?.username || 'sconosciuto'} · {winner ? `${winner.user.username} vince con ${winner.deck.name}` : 'Nessun vincitore'}
                    </div>
                    <div style={{ fontSize: 12, color: t.textSub, marginTop: 4 }}>
                      {game.players.map((player) => `${player.user.username} · ${player.deck.name}`).join(' | ')}
                    </div>
                    {game.notes && <div style={{ fontSize: 12, color: t.textMuted, marginTop: 4 }}>{game.notes}</div>}
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
