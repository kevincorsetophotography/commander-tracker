import { useState, useMemo, useRef, useEffect } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { AnimatePresence, m } from 'motion/react'
import { Search } from 'lucide-react'
import PlayerAvatar from './PlayerAvatar'
import { Icon } from './ui'
import { searchPlayers, splitHighlight } from '../lib/playerSearch'

// Selettore giocatori di "Registra partita": multi-selezione fino a `max`,
// riga "Selezionati", sezioni rapide "Stasera" e "Giocati di recente",
// ricerca istantanea con evidenziazione, navigazione da tastiera (frecce/Invio).
//
// players: [{ id, username, avatarCardName, avatarScryfallId, decks }]
// selected: [userId] nell'ordine dei posti
export default function PlayerPicker({
  open, onOpenChange, t, dark, isMobile,
  players, selected, onToggle, max = 5,
  tonightIds = [], recentIds = [], gamesById = {},
}) {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef(null)
  const listRef = useRef(null)

  useEffect(() => { if (open) { setQuery(''); setActive(0) } }, [open])

  const byId = useMemo(() => Object.fromEntries(players.map(p => [p.id, p])), [players])
  const results = useMemo(() => searchPlayers(players, query, gamesById), [players, query, gamesById])
  const full = selected.length >= max
  const searching = query.trim().length > 0

  useEffect(() => { setActive(0) }, [query])

  const toggle = (id) => {
    if (!selected.includes(id) && full) return
    onToggle(id)
  }

  const onKeyDown = (e) => {
    if (!results.length) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(a + 1, results.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(a - 1, 0)) }
    else if (e.key === 'Enter') {
      e.preventDefault()
      const p = results[active]
      if (p) { toggle(p.id); setQuery('') }
    }
  }

  // tieni visibile la riga attiva durante la navigazione da tastiera
  useEffect(() => {
    listRef.current?.querySelector(`[data-idx="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [active])

  const Tile = ({ p }) => {
    const on = selected.includes(p.id)
    const disabled = !on && full
    return (
      <button type="button" onClick={() => toggle(p.id)} disabled={disabled} aria-pressed={on} className="ct-press" style={{
        position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '10px 4px 8px',
        borderRadius: 16, cursor: disabled ? 'not-allowed' : 'pointer', minWidth: 0,
        background: on ? t.primaryBg : t.bgSurfaceAlt, border: `1px solid ${on ? t.primaryBorder : t.border}`,
        opacity: disabled ? 0.4 : 1, color: t.text,
      }}>
        <PlayerAvatar username={p.username} avatarCardName={p.avatarCardName} avatarScryfallId={p.avatarScryfallId} size={48} highlight={on} />
        {on && (
          <span style={{ position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: '50%', background: t.primary, color: t.primaryFg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="check" size={13} stroke={3} />
          </span>
        )}
        <span style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.2, textAlign: 'center', wordBreak: 'break-word', maxWidth: '100%' }}>{p.username}</span>
      </button>
    )
  }

  const Section = ({ icon, title, ids }) => {
    const list = ids.map(id => byId[id]).filter(Boolean)
    if (!list.length) return null
    return (
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: t.textSub, marginBottom: 8 }}>
          <span style={{ color: t.primary, display: 'flex' }}><Icon name={icon} size={15} /></span>{title}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(84px, 1fr))', gap: 8 }}>
          {list.map(p => <Tile key={p.id} p={p} />)}
        </div>
      </div>
    )
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(4,6,18,0.62)', backdropFilter: 'blur(3px)' }} />
        <Dialog.Content
          aria-describedby={undefined}
          onOpenAutoFocus={(e) => { e.preventDefault(); if (!isMobile) inputRef.current?.focus() }}
          className={isMobile ? 'ct-sheet-in' : 'ct-modal-in'}
          style={{
            position: 'fixed', zIndex: 61, boxSizing: 'border-box', outline: 'none',
            display: 'flex', flexDirection: 'column',
            background: dark ? '#0e122b' : '#FFFFFF', border: `1px solid ${t.border}`, boxShadow: '0 -12px 40px rgba(0,0,0,0.45)',
            ...(isMobile
              ? { left: 0, right: 0, bottom: 0, height: '92dvh', borderRadius: '24px 24px 0 0', borderBottom: 'none' }
              : { left: '50%', top: '50%', transform: 'translate(-50%, -50%)', width: 'calc(100vw - 32px)', maxWidth: 560, height: 'min(720px, 88vh)', borderRadius: 22 }),
          }}
        >
          {/* testata fissa: titolo, selezionati, ricerca */}
          <div style={{ padding: isMobile ? '4px 16px 10px' : '10px 20px 12px', borderBottom: `1px solid ${t.border}` }}>
            {isMobile && <div style={{ width: 40, height: 4, borderRadius: 4, background: t.borderStrong, margin: '8px auto 2px' }} />}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '8px 0 10px' }}>
              <Dialog.Title style={{ margin: 0, fontSize: 19, fontWeight: 800, color: t.text }}>
                Chi ha giocato <span style={{ fontSize: 14, fontWeight: 700, color: full ? t.primary : t.textSub }}>{selected.length}/{max}</span>
              </Dialog.Title>
              <Dialog.Close aria-label="Chiudi" style={{ width: 44, height: 44, border: 'none', borderRadius: 12, background: 'transparent', color: t.textSub, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="close" size={21} />
              </Dialog.Close>
            </div>

            {/* Selezionati */}
            <div className="ct-scroll-x" style={{ display: 'flex', gap: 8, overflowX: 'auto', minHeight: 44, alignItems: 'center', paddingBottom: 2 }}>
              {selected.length === 0 && <span style={{ fontSize: 13, color: t.textSub }}>Tocca i giocatori del tavolo (da 3 a {max}).</span>}
              <AnimatePresence initial={false}>
                {selected.map((id, i) => {
                  const p = byId[id]
                  if (!p) return null
                  return (
                    <m.span key={id}
                      initial={{ opacity: 0, scale: 0.6, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.6 }}
                      transition={{ type: 'spring', stiffness: 520, damping: 32 }}
                      style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 4px 3px 3px', borderRadius: 999, background: t.primaryBg, border: `1px solid ${t.primaryBorder}`, color: t.text }}>
                      <span style={{ position: 'relative' }}>
                        <PlayerAvatar username={p.username} avatarCardName={p.avatarCardName} avatarScryfallId={p.avatarScryfallId} size={30} />
                        <span style={{ position: 'absolute', top: -4, left: -4, minWidth: 16, height: 16, borderRadius: 8, background: t.primary, color: t.primaryFg, fontSize: 11, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</span>
                      </span>
                      <span style={{ fontSize: 14, fontWeight: 700 }}>{p.username}</span>
                      <button type="button" onClick={() => onToggle(id)} aria-label={`Togli ${p.username}`} style={{ width: 28, height: 28, borderRadius: '50%', border: 'none', background: 'transparent', color: t.textSub, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Icon name="close" size={15} stroke={2.4} />
                      </button>
                    </m.span>
                  )
                })}
              </AnimatePresence>
            </div>

            {/* Ricerca */}
            <label style={{ position: 'relative', display: 'block', marginTop: 10 }}>
              <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: t.textSub, display: 'flex' }}><Search size={19} /></span>
              <input
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Cerca giocatore…"
                aria-label="Cerca giocatore"
                role="combobox"
                aria-expanded="true"
                aria-controls="ct-player-list"
                aria-activedescendant={searching && results[active] ? `ct-player-${results[active].id}` : undefined}
                autoComplete="off"
                style={{ width: '100%', boxSizing: 'border-box', minHeight: 48, padding: '0 44px 0 44px', borderRadius: 14, border: `1px solid ${t.border}`, background: t.inputBg, color: t.text, fontSize: 16, outline: 'none', fontFamily: 'inherit' }}
              />
              {query && (
                <button type="button" onClick={() => { setQuery(''); inputRef.current?.focus() }} aria-label="Cancella ricerca" style={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)', width: 40, height: 40, border: 'none', background: 'transparent', color: t.textSub, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="close" size={17} />
                </button>
              )}
            </label>
          </div>

          {/* corpo scorrevole */}
          <div ref={listRef} style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '14px 16px' : '16px 20px', overscrollBehavior: 'contain' }}>
            {!searching && (
              <>
                <Section icon="calendar" title="Stasera" ids={tonightIds} />
                <Section icon="flame" title="Giocati di recente" ids={recentIds.filter(id => !tonightIds.includes(id))} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: t.textSub, margin: '4px 0 8px' }}>
                  <span style={{ color: t.primary, display: 'flex' }}><Icon name="groups" size={15} /></span>Tutti · {players.length}
                </div>
              </>
            )}

            {results.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '28px 10px', color: t.textSub }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: t.text }}>Nessun giocatore con «{query}»</div>
                <div style={{ fontSize: 13, marginTop: 4 }}>Controlla il nome. Compaiono solo i giocatori con almeno un mazzo.</div>
              </div>
            ) : (
              <div id="ct-player-list" role="listbox" aria-label="Giocatori" aria-multiselectable="true">
                {results.map((p, idx) => {
                  const on = selected.includes(p.id)
                  const disabled = !on && full
                  const [a, b, c] = splitHighlight(p.username, p.match)
                  const isActive = searching && idx === active
                  return (
                    <div key={p.id} id={`ct-player-${p.id}`} data-idx={idx} role="option" aria-selected={on} aria-disabled={disabled}
                      onClick={() => { if (!disabled) { toggle(p.id); if (searching) { setQuery(''); if (!isMobile) inputRef.current?.focus() } } }}
                      onMouseEnter={() => searching && setActive(idx)}
                      className="ct-press"
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12, padding: '8px 10px', minHeight: 56, borderRadius: 14, marginBottom: 4,
                        cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.45 : 1,
                        background: on ? t.primaryBg : isActive ? t.bgSurfaceAlt : 'transparent',
                        border: `1px solid ${on ? t.primaryBorder : isActive ? t.borderStrong : 'transparent'}`,
                      }}>
                      <PlayerAvatar username={p.username} avatarCardName={p.avatarCardName} avatarScryfallId={p.avatarScryfallId} size={40} highlight={on} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 16, fontWeight: 700, color: t.text, wordBreak: 'break-word' }}>
                          {a}<mark style={{ background: 'transparent', color: t.primary, fontWeight: 900, textDecoration: 'underline', textUnderlineOffset: 3 }}>{b}</mark>{c}
                        </div>
                        <div style={{ fontSize: 13, color: t.textSub }}>
                          {gamesById[p.id] || 0} partite · {p.decks.length} {p.decks.length === 1 ? 'mazzo' : 'mazzi'}
                        </div>
                      </div>
                      <span style={{
                        width: 28, height: 28, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: on ? t.primary : 'transparent', color: on ? t.primaryFg : t.textMuted,
                        border: on ? 'none' : `1.5px solid ${t.borderStrong}`,
                      }}>{on ? <Icon name="check" size={15} stroke={3} /> : <Icon name="plus" size={15} stroke={2.4} />}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* piè fisso */}
          <div style={{ padding: isMobile ? '10px 16px calc(14px + env(safe-area-inset-bottom))' : '12px 20px 18px', borderTop: `1px solid ${t.border}` }}>
            <Dialog.Close className="ct-press" style={{
              width: '100%', minHeight: 52, borderRadius: 16, border: 'none', cursor: 'pointer', fontSize: 16, fontWeight: 800,
              background: selected.length >= 3 ? t.primary : t.bgMuted, color: selected.length >= 3 ? t.primaryFg : t.textSub,
              boxShadow: selected.length >= 3 ? t.glow : 'none',
            }}>
              {selected.length >= 3 ? `Fatto · ${selected.length} giocatori` : `Scegline almeno 3 (${selected.length}/3)`}
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
