import { useState, useEffect, useMemo } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { api } from '../lib/api'
import { useTheme } from '../hooks/useTheme'
import { useIsMobile } from '../hooks/useIsMobile'
import { useFeedback } from '../hooks/useFeedback'
import { fetchCommanderColors } from '../lib/scryfall'
import { useCardArt } from '../lib/cardCache'
import { filterSortDecks, DECK_SORTS } from '../lib/deckList'
import { BRACKETS, BRACKET_OPTIONS } from '../lib/brackets'
import { ARCHETYPE_OPTIONS } from '../lib/archetypes'
import DeckListPanel from './DeckListPanel'
import CommanderInput from './CommanderInput'
import BracketBadge from './BracketBadge'
import ArchetypeBadge from './ArchetypeBadge'
import { SkeletonList } from './Skeleton'
import EmptyState from './EmptyState'
import { Icon, ManaPips, Sheet } from './ui'

// I miei mazzi v3: griglia di carte compatte (art del commander, colori, livello, win rate).
// Tocco su una carta → pannello "Gestisci" con archetipo, livello, lista carte, apri, elimina.
// Usato da /mazzi (completo, con ricerca e ordinamento) e dal proprio profilo (limit = anteprima dei più giocati).

const MANA_BG = { W: '#F8F6D8', U: '#3B82F6', B: '#2B2533', R: '#EF4444', G: '#16A34A' }
const MANA_FG = { W: '#2a2618', U: '#fff', B: '#E8E2F0', R: '#fff', G: '#fff' }
const COLOR_LABEL = { W: 'Bianco', U: 'Blu', B: 'Nero', R: 'Rosso', G: 'Verde' }
const EMPTY_FORM = { name: '', commander: '', colors: [], bracket: '', archetype: '' }
const SORT_KEY = 'ct_deck_sort'

const readSort = () => { try { return localStorage.getItem(SORT_KEY) || 'recent' } catch { return 'recent' } }
const initials = (s) => (s || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase()

function DeckArt({ deck, height, radius = 0 }) {
  const { status, art } = useCardArt(deck.commander)
  return (
    <div style={{ position: 'relative', height, overflow: 'hidden', borderRadius: radius, background: 'linear-gradient(135deg, #2a2366 0%, #141834 100%)' }}>
      {deck.commander && status === 'ready'
        ? <img src={art} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 20%', display: 'block' }} />
        : <div aria-hidden="true" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 34, fontWeight: 900, color: 'rgba(255,255,255,0.18)', letterSpacing: '0.04em' }}>{initials(deck.name)}</div>}
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(8,10,28,0.92) 0%, rgba(8,10,28,0.25) 55%, transparent 100%)' }} />
    </div>
  )
}

function DeckTile({ deck, stat, onOpen, t, index }) {
  const played = stat.games > 0
  return (
    <button type="button" onClick={onOpen} aria-label={`Gestisci ${deck.name}`} className="ct-lift ct-press ct-fade-up" style={{
      all: 'unset', boxSizing: 'border-box', cursor: 'pointer', display: 'flex', flexDirection: 'column', minWidth: 0,
      borderRadius: 18, overflow: 'hidden', border: `1px solid ${t.border}`, background: t.bgSurface, boxShadow: t.shadow,
      animationDelay: `${Math.min(index, 8) * 40}ms`,
    }}>
      <div style={{ position: 'relative' }}>
        <DeckArt deck={deck} height={118} />
        <div style={{ position: 'absolute', top: 8, right: 8 }}><ManaPips colors={deck.colors} size={16} /></div>
        <div style={{ position: 'absolute', left: 10, right: 10, bottom: 8 }}>
          <div style={{ fontWeight: 800, fontSize: 15, color: '#fff', textShadow: '0 1px 4px rgba(0,0,0,0.7)', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{deck.name}</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{deck.commander || 'Nessun commander'}</div>
        </div>
      </div>
      <div style={{ padding: '8px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, minHeight: 36 }}>
        <span style={{ minWidth: 0, overflow: 'hidden' }}>
          {deck.bracket ? <BracketBadge bracket={deck.bracket} /> : <span style={{ fontSize: 12, color: t.textMuted }}>Livello —</span>}
        </span>
        <span title={played ? `${stat.wins}V su ${stat.games} partite` : 'Mai giocato'} style={{ fontSize: 13, fontWeight: 800, color: !played ? t.textMuted : stat.winRate >= 50 ? t.win : t.textSub, flexShrink: 0 }}>
          {played ? `${stat.winRate}%` : '—'}
        </span>
      </div>
    </button>
  )
}

export default function MyDecks({ limit, onChanged }) {
  const { t, dark } = useTheme()
  const isMobile = useIsMobile()
  const navigate = useNavigate()
  const { toast, confirm } = useFeedback()
  const [decks, setDecks]       = useState([])
  const [stats, setStats]       = useState({})
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')
  const [q, setQ]               = useState('')
  const [sort, setSort]         = useState(readSort)
  const [openId, setOpenId]     = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm]         = useState(EMPTY_FORM)
  const [saving, setSaving]     = useState(false)
  const [formError, setFormError] = useState('')
  const [detectingColors, setDetectingColors] = useState(false)

  const preview = !!limit

  const loadDecks = async () => {
    try { setDecks(await api.getMyDecks()); setError('') }
    catch { setError('Errore nel caricamento mazzi') }
    finally { setLoading(false) }
  }
  const loadStats = async () => {
    try {
      const rows = await api.statsDecks()
      setStats(Object.fromEntries(rows.map(r => [r.id, { games: r.games, wins: r.wins, winRate: r.winRate }])))
    } catch { /* il win rate è un di più: senza statistiche le carte mostrano "—" */ }
  }
  useEffect(() => { loadDecks(); loadStats() }, [])

  const changed = async () => { await loadDecks(); onChanged?.() }

  const chooseSort = (id) => {
    setSort(id)
    try { localStorage.setItem(SORT_KEY, id) } catch { /* solo comodità */ }
  }

  const visible = useMemo(() => {
    const list = filterSortDecks(decks, stats, { q: preview ? '' : q, sort: preview ? 'games' : sort })
    return preview ? list.slice(0, limit) : list
  }, [decks, stats, q, sort, preview, limit])

  const openDeck = decks.find(d => d.id === openId) || null
  const openStat = openDeck ? (stats[openDeck.id] || { games: 0, wins: 0, winRate: 0 }) : null

  // ── Nuovo mazzo ──
  const toggleColor = (c) =>
    setForm(f => ({ ...f, colors: f.colors.includes(c) ? f.colors.filter(x => x !== c) : [...f.colors, c] }))

  const handleCommanderBlur = async () => {
    const name = form.commander.trim()
    if (!name) return
    setDetectingColors(true)
    try {
      const colors = await fetchCommanderColors(name)
      if (colors !== null) setForm(f => ({ ...f, colors }))
    } finally { setDetectingColors(false) }
  }

  const submit = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) { setFormError('Il nome è obbligatorio'); return }
    setSaving(true); setFormError('')
    try {
      await api.createDeck({ name: form.name.trim(), commander: form.commander.trim() || null, colors: form.colors.join('') || null, bracket: form.bracket || null, archetype: form.archetype || null })
      setForm(EMPTY_FORM)
      setShowForm(false)
      await changed()
      toast('Mazzo aggiunto', 'success')
    } catch (err) {
      setFormError(err.error || 'Errore nel salvataggio')
    } finally { setSaving(false) }
  }

  // ── Gestione mazzo ──
  const updateField = async (id, field, value, okMsg) => {
    try {
      await api.updateDeck(id, { [field]: value || null })
      await changed()
      toast(okMsg, 'success')
    } catch (err) {
      toast(err.error || 'Errore aggiornamento', 'error')
    }
  }

  const deleteDeck = async (deck) => {
    const ok = await confirm({
      title: 'Eliminare il mazzo?',
      message: `"${deck.name}" verrà eliminato definitivamente.`,
      confirmLabel: 'Elimina',
      danger: true,
    })
    if (!ok) return
    try {
      await api.deleteDeck(deck.id)
      setOpenId(null)
      await changed()
      toast('Mazzo eliminato', 'success')
    } catch (err) {
      toast(err.error || 'Errore nella cancellazione', 'error')
    }
  }

  const openForm = () => { setFormError(''); setShowForm(true) }

  const inputSt = { padding: '12px 14px', borderRadius: 14, border: `1px solid ${t.border}`, fontSize: 16, width: '100%', boxSizing: 'border-box', outline: 'none', background: t.inputBg, color: t.text, minHeight: 48, fontFamily: 'inherit' }
  const labelSt = { fontSize: 13, fontWeight: 600, color: t.textSub, display: 'block', marginBottom: 6 }
  const chipSt = (on) => ({
    minHeight: 36, padding: '0 12px', borderRadius: 999, fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit',
    border: `1px solid ${on ? t.primary : t.border}`, background: on ? t.primaryBg : 'transparent', color: on ? t.primary : t.textSub,
  })

  const showTools = !preview && decks.length > 4

  return (
    <div>
      {/* Intestazione */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, minWidth: 0 }}>
          <span style={{ fontSize: preview ? 17 : 26, fontWeight: 800, color: t.text, letterSpacing: preview ? 0 : '-0.02em' }}>I miei mazzi</span>
          {decks.length > 0 && <span style={{ fontSize: 13, color: t.textMuted, fontWeight: 600 }}>{decks.length}</span>}
        </div>
        <button onClick={openForm} className="ct-press" style={{
          minHeight: preview ? 40 : 44, padding: '0 14px', borderRadius: 14, border: 'none', background: t.primary, color: t.primaryFg,
          fontSize: 14, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, boxShadow: t.glow, whiteSpace: 'nowrap', fontFamily: 'inherit',
        }}>
          <Icon name="plus" size={17} stroke={2.5} /> Nuovo
        </button>
      </div>

      {/* Ricerca + ordinamento (solo pagina completa, con abbastanza mazzi) */}
      {showTools && (
        <div style={{ marginBottom: 14 }}>
          <input
            type="search" value={q} onChange={e => setQ(e.target.value)}
            placeholder="Cerca per nome, commander o archetipo"
            aria-label="Cerca tra i tuoi mazzi"
            style={{ ...inputSt, minHeight: 44, padding: '10px 14px', marginBottom: 10 }}
          />
          <div role="group" aria-label="Ordina i mazzi" style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
            {DECK_SORTS.map(s => (
              <button key={s.id} type="button" aria-pressed={sort === s.id} onClick={() => chooseSort(s.id)} className="ct-press" style={chipSt(sort === s.id)}>{s.label}</button>
            ))}
          </div>
        </div>
      )}

      {loading && <SkeletonList rows={2} />}
      {error && <div style={{ color: t.danger, fontSize: 14 }}>{error}</div>}
      {!loading && !error && decks.length === 0 && (
        <EmptyState icon="🎴" title="Nessun mazzo" message='Aggiungi il tuo primo mazzo con "Nuovo": bastano nome e commander.' />
      )}
      {!loading && decks.length > 0 && visible.length === 0 && (
        <div style={{ fontSize: 14, color: t.textSub, padding: '12px 0' }}>Nessun mazzo corrisponde a "{q}".</div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${isMobile ? 140 : 180}px, 1fr))`, gap: isMobile ? 10 : 14 }}>
        {visible.map((deck, i) => (
          <DeckTile key={deck.id} deck={deck} index={i} t={t} stat={stats[deck.id] || { games: 0, wins: 0, winRate: 0 }} onOpen={() => setOpenId(deck.id)} />
        ))}
      </div>

      {preview && decks.length > limit && (
        <Link to="/mazzi" className="ct-press" style={{ marginTop: 12, minHeight: 44, borderRadius: 14, border: `1px solid ${t.border}`, background: t.bgSurfaceAlt, color: t.primary, fontSize: 14, fontWeight: 800, textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
          Vedi tutti i {decks.length} mazzi <Icon name="chevron" size={16} />
        </Link>
      )}

      {/* Pannello gestione mazzo */}
      <Sheet open={!!openDeck} onOpenChange={(o) => { if (!o) setOpenId(null) }} title={openDeck?.name || 'Mazzo'} t={t} dark={dark} isMobile={isMobile} maxWidth={560}>
        {openDeck && (
          <div>
            <div style={{ position: 'relative', marginBottom: 14 }}>
              <DeckArt deck={openDeck} height={130} radius={16} />
              <div style={{ position: 'absolute', left: 14, right: 14, bottom: 10, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.9)', fontWeight: 600, wordBreak: 'break-word' }}>{openDeck.commander || 'Nessun commander'}</div>
                  <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 2 }}>
                    {openStat.games > 0 ? `${openStat.winRate}% win rate · ${openStat.wins}V su ${openStat.games} partite` : 'Mai giocato'}
                  </div>
                </div>
                <ManaPips colors={openDeck.colors} size={20} />
              </div>
            </div>

            {(openDeck.bracket || openDeck.archetype) && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                {openDeck.bracket && <BracketBadge bracket={openDeck.bracket} size="lg" />}
                {openDeck.archetype && <ArchetypeBadge archetype={openDeck.archetype} />}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
              <div style={{ minWidth: 0 }}>
                <label style={labelSt} htmlFor="deck-archetype">Archetipo</label>
                <select id="deck-archetype" value={openDeck.archetype || ''} onChange={e => updateField(openDeck.id, 'archetype', e.target.value, 'Archetipo aggiornato')} style={{ ...inputSt, cursor: 'pointer', minWidth: 0 }}>
                  <option value="">—</option>
                  {ARCHETYPE_OPTIONS.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <div style={{ minWidth: 0 }}>
                <label style={labelSt} htmlFor="deck-bracket">Livello</label>
                <select id="deck-bracket" value={openDeck.bracket || ''} onChange={e => updateField(openDeck.id, 'bracket', e.target.value, 'Livello aggiornato')} style={{ ...inputSt, cursor: 'pointer', minWidth: 0 }}>
                  <option value="">—</option>
                  {BRACKET_OPTIONS.map(b => <option key={b} value={b}>B{b} · {BRACKETS[b].label}</option>)}
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <button onClick={() => navigate(`/mazzo/${openDeck.id}`)} className="ct-press" style={{ minHeight: 44, padding: '0 16px', borderRadius: 12, border: 'none', background: t.primary, color: t.primaryFg, fontSize: 15, fontWeight: 800, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: 'inherit' }}>
                Apri profilo <Icon name="chevron" size={16} />
              </button>
              <DeckListPanel
                key={openDeck.id}
                decklist={openDeck.decklist}
                commander={openDeck.commander}
                name={openDeck.name}
                onSave={async (newList, newCommander, newColors, newName) => {
                  await api.updateDeck(openDeck.id, { name: newName, decklist: newList, commander: newCommander, colors: newColors || undefined })
                  await changed()
                  toast('Mazzo aggiornato', 'success')
                }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16, paddingTop: 14, borderTop: `1px solid ${t.border}` }}>
              <button onClick={() => deleteDeck(openDeck)} aria-label={`Elimina ${openDeck.name}`} className="ct-press" style={{ minHeight: 44, padding: '0 12px', borderRadius: 12, border: `1px solid ${t.dangerBorder}`, background: t.dangerBg, color: t.danger, fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'inherit' }}>
                <Icon name="trash" size={17} /> Elimina
              </button>
            </div>
          </div>
        )}
      </Sheet>

      {/* Pannello nuovo mazzo */}
      <Sheet open={showForm} onOpenChange={setShowForm} title="Nuovo mazzo" t={t} dark={dark} isMobile={isMobile}>
        <form onSubmit={submit}>
          <label style={labelSt}>Nome mazzo *</label>
          <input style={{ ...inputSt, marginBottom: 12 }} placeholder="Nome mazzo *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          <label style={labelSt}>Commander</label>
          <div style={{ marginBottom: 12 }}>
            <CommanderInput
              style={inputSt}
              placeholder="Commander (opzionale)"
              value={form.commander}
              onChange={(name) => setForm(f => ({ ...f, commander: name }))}
              onBlur={handleCommanderBlur}
            />
          </div>
          <label style={labelSt}>
            Colori {detectingColors && <span style={{ marginLeft: 6, fontSize: 12, color: t.primary }}>rilevamento dal commander…</span>}
          </label>
          <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
            {['W', 'U', 'B', 'R', 'G'].map(c => {
              const on = form.colors.includes(c)
              return (
                <button key={c} type="button" onClick={() => toggleColor(c)} aria-pressed={on} title={COLOR_LABEL[c]} className="ct-press" style={{
                  width: 46, height: 46, borderRadius: '50%', cursor: 'pointer', fontSize: 16, fontWeight: 900,
                  background: MANA_BG[c], color: MANA_FG[c], opacity: on ? 1 : 0.35,
                  border: on ? `3px solid ${t.primary}` : `1px solid ${t.border}`,
                  boxShadow: on ? t.glow : 'none', transition: 'all 0.15s ease',
                }}>{c}</button>
              )
            })}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
            <div style={{ minWidth: 0 }}>
              <label style={labelSt}>Livello</label>
              <select style={{ ...inputSt, cursor: 'pointer' }} value={form.bracket} onChange={e => setForm(f => ({ ...f, bracket: e.target.value }))}>
                <option value="">—</option>
                {BRACKET_OPTIONS.map(b => <option key={b} value={b}>B{b} · {BRACKETS[b].label}</option>)}
              </select>
            </div>
            <div style={{ minWidth: 0 }}>
              <label style={labelSt}>Archetipo</label>
              <select style={{ ...inputSt, cursor: 'pointer' }} value={form.archetype} onChange={e => setForm(f => ({ ...f, archetype: e.target.value }))}>
                <option value="">—</option>
                {ARCHETYPE_OPTIONS.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
          </div>
          <div style={{ fontSize: 13, color: t.textSub, marginBottom: 12 }}>La lista carte (anche da Archidekt/Moxfield) si aggiunge dopo: tocca il mazzo e poi "Lista".</div>
          {formError && <div role="alert" style={{ color: t.danger, fontSize: 14, fontWeight: 600, marginBottom: 10 }}>{formError}</div>}
          <button type="submit" disabled={saving} className="ct-press" style={{ width: '100%', minHeight: 52, borderRadius: 16, border: 'none', background: t.primary, color: t.primaryFg, fontSize: 16, fontWeight: 800, cursor: saving ? 'wait' : 'pointer', boxShadow: t.glow, fontFamily: 'inherit' }}>
            {saving ? 'Salvataggio…' : 'Aggiungi mazzo'}
          </button>
        </form>
      </Sheet>

    </div>
  )
}
