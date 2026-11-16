// Segnapunti del tavolo — aggiornamento ottimistico lato client.
// Specchio di backend/src/lib/scoreboard.js (la fonte di verità resta il server:
// la risposta del server sostituisce sempre questo stato locale).

export const CMD_LETHAL = 21
export const POISON_LETHAL = 10

export function eliminationOf(p) {
  if (p.life <= 0) return { eliminated: true, reason: 'life' }
  if (p.poison >= POISON_LETHAL) return { eliminated: true, reason: 'poison' }
  if (Object.values(p.cmd || {}).some(v => v >= CMD_LETHAL)) return { eliminated: true, reason: 'commander' }
  return { eliminated: false, reason: null }
}

export const REASON_LABEL = { life: 'vita a 0', poison: '10 veleni', commander: '21 da un commander' }

// view: { players: { [userId]: { life, poison, cmd: { [fromId]: n } } } } — restituisce una copia aggiornata
export function applyLocal(view, action) {
  const src = view?.players?.[action.userId]
  if (!src) return view
  const p = { life: src.life, poison: src.poison, cmd: { ...src.cmd } }
  const d = action.delta
  if (action.type === 'life') p.life += d
  else if (action.type === 'poison') p.poison = Math.max(0, p.poison + d)
  else if (action.type === 'cmd') {
    const before = p.cmd[action.fromUserId] || 0
    const after = Math.max(0, before + d)
    p.cmd[action.fromUserId] = after
    p.life -= after - before
  }
  return { ...view, players: { ...view.players, [action.userId]: { ...p, ...eliminationOf(p) } } }
}
