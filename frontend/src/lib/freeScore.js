// Segnapunti libero (/segnapunti) — NON legato a un tavolo: tutto locale sul telefono, niente server.
// Regole pure (testate in freeScore.test.js). Stesso formato di stato del segnapunti del tavolo
// (backend/src/lib/scoreboard.js), così LifeCounter lo mostra senza differenze:
//   score = { players: { [id]: { life, poison, cmd: { [fromId]: n }, eliminated, reason } }, seatOrder: [id], history: [...] }
// I posti: { userId, user: { username }, deck: { commander } | null, guest? }
//   utenti registrati → userId = id vero; ospiti → id negativi (-1, -2, …), mai in conflitto.
// Persistenza: sessionStorage solo per sopravvivere a un ricaricamento; "Chiudi" la distrugge (clearFree).

import { eliminationOf } from './scoreboard'

export const START_LIFE = 40
export const MIN_PLAYERS = 2
export const MAX_PLAYERS = 6
export const HISTORY_MAX = 30
export const MERGE_MS = 4000
const MAX_ABS = 999
const STORAGE_KEY = 'ct_free_score'

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n))

function withElim(p) {
  return { life: p.life, poison: p.poison, cmd: p.cmd, ...eliminationOf(p) }
}

// ── setup ────────────────────────────────────────────────────────────────────────
// entries: [{ kind: 'user', userId, username, deck? } | { kind: 'guest', name, commander? }]
export function validateSetup(entries) {
  const list = Array.isArray(entries) ? entries : []
  if (list.length < MIN_PLAYERS) return `Servono almeno ${MIN_PLAYERS} giocatori`
  if (list.length > MAX_PLAYERS) return `Massimo ${MAX_PLAYERS} giocatori`
  const names = []
  for (const e of list) {
    const name = (e.kind === 'guest' ? e.name : e.username || '').trim()
    if (!name) return 'Dai un nome a ogni ospite'
    if (names.includes(name.toLowerCase())) return `Il nome «${name}» compare due volte`
    names.push(name.toLowerCase())
  }
  const ids = list.filter(e => e.kind === 'user').map(e => e.userId)
  if (new Set(ids).size !== ids.length) return 'Lo stesso giocatore non può sedersi due volte'
  return null
}

// Posti per il segnapunti (nell'ordine del setup)
export function buildSeats(entries) {
  let guest = 0
  return entries.map(e => {
    if (e.kind === 'guest') {
      guest += 1
      const commander = (e.commander || '').trim()
      return { userId: -guest, guest: true, user: { username: e.name.trim().slice(0, 32) }, deck: commander ? { commander } : null }
    }
    const d = e.deck || null
    return { userId: Number(e.userId), user: { username: e.username }, deckId: d?.id ?? null, deck: d ? { id: d.id, name: d.name, commander: d.commander || null } : null }
  })
}

// "Registra risultati" ha senso solo se tutti sono utenti registrati (e Registra partita vuole almeno 3 giocatori)
export const canRegister = (seats) => Array.isArray(seats) && seats.length >= 3 && seats.every(s => !s.guest && s.userId > 0)

// ── punteggi ─────────────────────────────────────────────────────────────────────
export function initialScore(seatIds) {
  const players = {}
  for (const id of seatIds) {
    const cmd = {}
    for (const o of seatIds) if (o !== id) cmd[o] = 0
    players[id] = withElim({ life: START_LIFE, poison: 0, cmd })
  }
  return { players, seatOrder: seatIds.slice(), history: [] }
}

const sameTarget = (a, b) => a.type === b.type && a.userId === b.userId && (a.fromUserId ?? null) === (b.fromUserId ?? null)
const isNoop = (d) => !d.life && !d.poison && !d.cmd

function pushHistory(history, entry) {
  const out = history.slice()
  const last = out[out.length - 1]
  if (last && sameTarget(last, entry) && entry.at - last.at <= MERGE_MS) {
    const merged = { ...last, at: entry.at, d: { life: last.d.life + entry.d.life, poison: last.d.poison + entry.d.poison, cmd: last.d.cmd + entry.d.cmd } }
    out.pop()
    if (!isNoop(merged.d)) out.push(merged)
  } else if (!isNoop(entry.d)) {
    out.push(entry)
  }
  return out.slice(-HISTORY_MAX)
}

// Applica un'azione del LifeCounter ({ type: life|poison|cmd, userId, fromUserId?, delta }); azione non valida = stato invariato
export function applyFree(score, action, now = Date.now()) {
  const a = action || {}
  const src = score?.players?.[a.userId]
  const delta = Number(a.delta)
  if (!src || !Number.isInteger(delta) || delta === 0) return score
  const p = { life: src.life, poison: src.poison, cmd: { ...src.cmd } }
  const before = { life: p.life, poison: p.poison }
  let cmdApplied = 0
  if (a.type === 'life') p.life = clamp(p.life + delta, -MAX_ABS, MAX_ABS)
  else if (a.type === 'poison') p.poison = clamp(p.poison + delta, 0, MAX_ABS)
  else if (a.type === 'cmd') {
    if (!(a.fromUserId in p.cmd)) return score
    const was = p.cmd[a.fromUserId] || 0
    const after = clamp(was + delta, 0, MAX_ABS)
    p.cmd[a.fromUserId] = after
    cmdApplied = after - was
    p.life = clamp(p.life - cmdApplied, -MAX_ABS, MAX_ABS) // il danno da commander è anche perdita di vita
  } else return score
  const entry = { by: null, type: a.type, userId: a.userId, ...(a.type === 'cmd' ? { fromUserId: a.fromUserId } : {}),
    d: { life: p.life - before.life, poison: p.poison - before.poison, cmd: cmdApplied }, at: now }
  return { ...score, players: { ...score.players, [a.userId]: withElim(p) }, history: pushHistory(score.history || [], entry) }
}

export function undoFree(score) {
  const history = (score?.history || []).slice()
  const e = history.pop()
  if (!e || !score.players[e.userId]) return score
  const src = score.players[e.userId]
  const p = { life: src.life, poison: src.poison, cmd: { ...src.cmd } }
  p.life = clamp(p.life - (e.d.life || 0), -MAX_ABS, MAX_ABS)
  p.poison = clamp(p.poison - (e.d.poison || 0), 0, MAX_ABS)
  if (e.type === 'cmd' && e.fromUserId in p.cmd) p.cmd[e.fromUserId] = clamp((p.cmd[e.fromUserId] || 0) - (e.d.cmd || 0), 0, MAX_ABS)
  return { ...score, players: { ...score.players, [e.userId]: withElim(p) }, history }
}

// Ripristino: tutti a 40, storico azzerato, i posti restano dove sono
export function resetFree(score) {
  const ids = Object.keys(score?.players || {}).map(Number)
  return { ...initialScore(ids), seatOrder: (score?.seatOrder || ids).slice() }
}

// ── sessionStorage ───────────────────────────────────────────────────────────────
function storage() { try { return window.sessionStorage } catch { return null } }

export function loadFree(store = storage()) {
  try {
    const raw = store?.getItem(STORAGE_KEY)
    if (!raw) return null
    const v = JSON.parse(raw)
    const ok = v && Array.isArray(v.seats) && v.seats.length >= MIN_PLAYERS && v.seats.length <= MAX_PLAYERS
      && v.score && v.seats.every(s => Number.isInteger(s.userId) && s.user?.username && v.score.players?.[s.userId])
    return ok ? { seats: v.seats, score: { ...v.score, history: Array.isArray(v.score.history) ? v.score.history : [] } } : null
  } catch { return null }
}

export function saveFree(state, store = storage()) {
  try { store?.setItem(STORAGE_KEY, JSON.stringify({ seats: state.seats, score: state.score })) } catch { /* storage pieno o non disponibile */ }
}

export function clearFree(store = storage()) {
  try { store?.removeItem(STORAGE_KEY) } catch { /* niente */ }
}
