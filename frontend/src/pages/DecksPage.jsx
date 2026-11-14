import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { useTheme } from '../hooks/useTheme'
import { useIsMobile } from '../hooks/useIsMobile'
import { fetchCommanderColors } from '../lib/scryfall'
import { useFeedback } from '../hooks/useFeedback'
import { useCardArt } from '../lib/cardCache'
import DeckListPanel from '../components/DeckListPanel'
import CommanderInput from '../components/CommanderInput'
import { SkeletonList } from '../components/Skeleton'
import EmptyState from '../components/EmptyState'
import BracketBadge from '../components/BracketBadge'
import { BRACKETS, BRACKET_OPTIONS } from '../lib/brackets'
import ArchetypeBadge from '../components/ArchetypeBadge'
import { ARCHETYPE_OPTIONS } from '../lib/archetypes'
import { Icon, ManaPips, Sheet, bento } from '../components/ui'

// I miei mazzi v2: card con art del commander, form "Nuovo mazzo" in pannello,
// modifica rapida archetipo/livello, decklist, elimina. Stesse funzioni di prima.

const MANA_BG = { W: '#F8F6D8', U: '#3B82F6', B: '#2B2533', R: '#EF4444', G: '#16A34A' }
const MANA_FG = { W: '#2a2618', U: '#fff', B: '#E8E2F0', R: '#fff', G: '#fff' }
const COLOR_LABEL = { W: 'Bianco', U: 'Blu', B: 'Nero', R: 'Rosso', G: 'Verde' }

function DeckBanner({ deck, onOpen }) {
  const { status, art } = useCardArt(deck.commander)
  return (
    <div onClick={onOpen} title="Apri il profilo del mazzo" style={{ position: 'relative', height: 120, background: '#1a1640', overflow: 'hidden', cursor: 'pointer' }}>
      {status === 'ready' && <img src={art} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 20%', display: 'block' }} />}
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(8,10,28,0.9) 0%, rgba(8,10,28,0.15) 60%, transparent 100%)' }} />
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '10px 14px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 18, color: '#fff', textShadow: '0 1px 4px rgba(0,0,0,0.7)', wordBreak: 'break-word', lineHeight: 1.2 }}>{deck.name}</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 2, wordBreak: 'break-word' }}>{deck.commander}</div>
        </div>
        <ManaPips colors={deck.colors} size={20} />
      </div>
    </div>
  )
}

export default function DecksPage() {
  const { t, dark } = useTheme()
  const isMobile = useIsMobile()
  const navigate = useNavigate()
  const { toast, confirm } = useFeedback()
  const [decks, setDecks]                     = useState([])
  const [loading, setLoading]                 = useState(true)
  const [error, setError]                     = useState('')
  const [form, setForm]                       = useState({ name: '', commander: '', colors: [], bracket: '', archetype: '' })
  const [saving, setSaving]                   = useState(false)
  const [formError, setFormError]             = useState('')
  const [detectingColors, setDetectingColors] = useState(false)
  const [showForm, setShowForm]               = useState(false)

  const loadDecks = async () => {
    try { setDecks(await api.getMyDecks()) }
    catch { setError('Errore nel caricamento mazzi') }
    finally { setLoading(false) }
  }

  useEffect(() => { loadDecks() }, [])

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
      setForm({ name: '', commander: '', colors: [], bracket: '', archetype: '' })
      setShowForm(false)
      await loadDecks()
      toast('Mazzo aggiunto', 'success')
    } catch (err) {
      setFormError(err.error || 'Errore nel salvataggio')
    } finally { setSaving(false) }
  }

  const updateBracket = async (id, bracket) => {
    try {
      await api.updateDeck(id, { bracket: bracket || null })
      await loadDecks()
      toast('Livello aggiornato', 'success')
    } catch (err) {
      toast(err.error || 'Errore aggiornamento livello', 'error')
    }
  }

  const updateArchetype = async (id, archetype) => {
    try {
      await api.updateDeck(id, { archetype: archetype || null })
      await loadDecks()
      toast('Archetipo aggiornato', 'success')
    } catch (err) {
      toast(err.error || 'Errore aggiornamento archetipo', 'error')
    }
  }

  const deleteDeck = async (id, name) => {
    const ok = await confirm({
      title: 'Eliminare il mazzo?',
      message: `"${name}" verrà eliminato definitivamente.`,
      confirmLabel: 'Elimina',
      danger: true,
    })
    if (!ok) return
    try {
      await api.deleteDeck(id)
      await loadDecks()
      toast('Mazzo eliminato', 'success')
    } catch (err) {
      toast(err.error || 'Errore nella cancellazione', 'error')
    }
  }

  const inputSt  = { padding: '12px 14px', borderRadius: 14, border: `1px solid ${t.border}`, fontSize: 16, width: '100%', boxSizing: 'border-box', outline: 'none', background: t.inputBg, color: t.text, minHeight: 48, fontFamily: 'inherit' }
  const selSt    = { padding: '0 10px', minHeight: 40, borderRadius: 12, border: `1px solid ${t.border}`, background: t.inputBg, color: t.text, fontSize: 14, cursor: 'pointer', outline: 'none', fontFamily: 'inherit' }
  const labelSt  = { fontSize: 13, fontWeight: 600, color: t.textSub, display: 'block', marginBottom: 6 }

  return (
    <div style={{ maxWidth: 680, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 14 }}>
        <div style={{ fontSize: 26, fontWeight: 800, color: t.text, letterSpacing: '-0.02em' }}>I miei mazzi</div>
        <button onClick={() => { setFormError(''); setShowForm(true) }} className="ct-press" style={{ minHeight: 44, padding: '0 16px', borderRadius: 14, border: 'none', background: t.primary, color: t.primaryFg, fontSize: 15, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, boxShadow: t.glow, whiteSpace: 'nowrap' }}>
          <Icon name="plus" size={18} stroke={2.5} /> Nuovo mazzo
        </button>
      </div>

      {/* Form nuovo mazzo in pannello */}
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
          <div style={{ fontSize: 13, color: t.textSub, marginBottom: 12 }}>La lista carte (anche da Archidekt/Moxfield) si aggiunge dopo, con "Lista" sulla card del mazzo.</div>
          {formError && <div role="alert" style={{ color: t.danger, fontSize: 14, fontWeight: 600, marginBottom: 10 }}>{formError}</div>}
          <button type="submit" disabled={saving} className="ct-press" style={{ width: '100%', minHeight: 52, borderRadius: 16, border: 'none', background: t.primary, color: t.primaryFg, fontSize: 16, fontWeight: 800, cursor: saving ? 'wait' : 'pointer', boxShadow: t.glow }}>
            {saving ? 'Salvataggio…' : 'Aggiungi mazzo'}
          </button>
        </form>
      </Sheet>

      {loading && <SkeletonList rows={3} />}
      {error   && <div style={{ color: t.danger, fontSize: 14 }}>{error}</div>}
      {!loading && decks.length === 0 && (
        <EmptyState icon="🎴" title="Nessun mazzo" message='Aggiungi il tuo primo mazzo con "Nuovo mazzo": bastano nome e commander.' />
      )}

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 14 }}>
        {decks.map((deck, i) => (
          <div key={deck.id} className="ct-fade-up" style={bento(t, { overflow: 'hidden', animationDelay: `${Math.min(i, 6) * 50}ms` })}>
            {deck.commander ? (
              <DeckBanner deck={deck} onOpen={() => navigate(`/mazzo/${deck.id}`)} />
            ) : (
              <div onClick={() => navigate(`/mazzo/${deck.id}`)} title="Apri il profilo del mazzo" style={{ padding: '14px 14px 4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                <div style={{ fontWeight: 800, fontSize: 18, color: t.text, wordBreak: 'break-word' }}>{deck.name}</div>
                <ManaPips colors={deck.colors} size={20} />
              </div>
            )}

            <div style={{ padding: '12px 14px 14px' }}>
              {(deck.archetype || deck.bracket) && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                  {deck.bracket && <BracketBadge bracket={deck.bracket} size="lg" />}
                  {deck.archetype && <ArchetypeBadge archetype={deck.archetype} />}
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                <select value={deck.archetype || ''} onChange={e => updateArchetype(deck.id, e.target.value)} title="Archetipo" aria-label="Archetipo" style={{ ...selSt, minWidth: 0 }}>
                  <option value="">— archetipo</option>
                  {ARCHETYPE_OPTIONS.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
                <select value={deck.bracket || ''} onChange={e => updateBracket(deck.id, e.target.value)} title="Livello" aria-label="Livello" style={{ ...selSt, minWidth: 0 }}>
                  <option value="">— livello</option>
                  {BRACKET_OPTIONS.map(b => <option key={b} value={b}>B{b} · {BRACKETS[b].label}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <button onClick={() => navigate(`/mazzo/${deck.id}`)} className="ct-press" style={{ minHeight: 40, padding: '0 12px', borderRadius: 12, border: `1px solid ${t.border}`, background: t.bgSurfaceAlt, color: t.text, fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  Apri <Icon name="chevron" size={15} />
                </button>
                <DeckListPanel
                  decklist={deck.decklist}
                  commander={deck.commander}
                  name={deck.name}
                  onSave={async (newList, newCommander, newColors, newName) => {
                    await api.updateDeck(deck.id, {
                      name: newName,
                      decklist: newList,
                      commander: newCommander,
                      colors: newColors || undefined,
                    })
                    await loadDecks()
                    toast('Mazzo aggiornato', 'success')
                  }}
                />
                <button onClick={() => deleteDeck(deck.id, deck.name)} aria-label={`Elimina ${deck.name}`} className="ct-press" style={{ marginLeft: 'auto', width: 40, height: 40, borderRadius: 12, border: `1px solid ${t.dangerBorder}`, background: t.dangerBg, color: t.danger, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="trash" size={17} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* FAB su mobile */}
      {isMobile && decks.length > 2 && (
        <button onClick={() => { setFormError(''); setShowForm(true) }} aria-label="Nuovo mazzo" className="ct-press" style={{
          position: 'fixed', right: 18, bottom: 'calc(92px + env(safe-area-inset-bottom))', zIndex: 25,
          height: 52, padding: '0 18px', borderRadius: 999, border: 'none', background: t.accent, color: '#fff',
          fontSize: 15, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
          boxShadow: '0 10px 30px rgba(139,92,246,0.45)',
        }}>
          <Icon name="plus" size={19} stroke={2.6} /> Mazzo
        </button>
      )}
    </div>
  )
}
