// Segnapunti condiviso di un tavolo aperto — regole pure (testate in scoreboard.test.js).
//
// Stato salvato in OpenTable.scoreboard (JSON):
//   { players: { "<userId>": { life: 40, poison: 0, cmd: { "<fromUserId>": 0 } } }, history: [...], updatedAt }
// history: ultime HISTORY_MAX azioni (la più recente in fondo), condivise da tutto il tavolo, per "Annulla":
//   { by, type, userId, fromUserId?, d: { life, poison, cmd }, at }  — d = variazioni EFFETTIVAMENTE applicate
// Tocchi ripetuti dello stesso giocatore sullo stesso contatore entro MERGE_MS diventano una voce sola
// (10 tocchi su -1 = un "−10" da annullare in un colpo).
// I giocatori NON vengono copiati alla creazione: chi non ha ancora una voce parte dai valori iniziali,
// così il segnapunti segue i posti del tavolo anche se il creatore toglie qualcuno.
// seatOrder (opzionale): ordine dei posti attorno al telefono, condiviso da tutto il tavolo e cambiato
// trascinando un pannello. NON entra nello storico di "Annulla" (non è un punteggio: si rimette a posto
// trascinando di nuovo). Chi si siede dopo finisce in fondo, chi si alza sparisce (vedi seatOrderOf).

const START_LIFE = 40;
const CMD_LETHAL = 21;
const POISON_LETHAL = 10;
const MAX_ABS = 999; // tetto di sicurezza contro valori assurdi
const HISTORY_MAX = 30;
const MERGE_MS = 4000;

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

function emptyPlayer() {
  return { life: START_LIFE, poison: 0, cmd: {} };
}

// Vista completa del segnapunti per i posti attuali (userId in ordine di seduta).
function viewFor(state, seatUserIds) {
  const src = (state && state.players) || {};
  const players = {};
  for (const uid of seatUserIds) {
    const p = src[uid] || src[String(uid)] || emptyPlayer();
    const cmd = {};
    for (const other of seatUserIds) {
      if (other === uid) continue;
      cmd[other] = Number(p.cmd?.[other] ?? p.cmd?.[String(other)] ?? 0) || 0;
    }
    const life = Number.isFinite(p.life) ? p.life : START_LIFE;
    const poison = Number.isFinite(p.poison) ? p.poison : 0;
    players[uid] = { life, poison, cmd, ...eliminationOf({ life, poison, cmd }) };
  }
  return { players, seatOrder: seatOrderOf(state, seatUserIds), history: historyOf(state), updatedAt: state?.updatedAt || null };
}

// Ordine dei posti valido per i seduti attuali: sempre una permutazione esatta dei loro id.
// Tiene l'ordine salvato per chi è ancora seduto e aggiunge in fondo chi è arrivato dopo (in ordine di seduta).
function seatOrderOf(state, seatUserIds) {
  const seats = seatUserIds.map(Number);
  const saved = Array.isArray(state?.seatOrder) ? state.seatOrder.map(Number) : [];
  const kept = [];
  for (const id of saved) if (seats.includes(id) && !kept.includes(id)) kept.push(id);
  return [...kept, ...seats.filter(id => !kept.includes(id))];
}

const isPermutation = (order, seats) => Array.isArray(order) && order.length === seats.length
  && order.every(id => Number.isInteger(id) && seats.includes(id)) && new Set(order).size === order.length;

// Nuovo ordine dei posti (qualsiasi membro). order: id dei seduti, ognuno una volta sola. → { state } | { error }
function setSeatOrder(state, seatUserIds, order, now = Date.now()) {
  const seats = seatUserIds.map(Number);
  const o = Array.isArray(order) ? order.map(v => (typeof v === 'number' || (typeof v === 'string' && v.trim() !== '') ? Number(v) : NaN)) : null;
  if (!isPermutation(o, seats)) return { error: 'Ordine dei posti non valido' };
  return { state: { ...(state || {}), players: state?.players || {}, history: historyOf(state), seatOrder: o, updatedAt: new Date(now).toISOString() } };
}

// Le azioni sui punteggi riscrivono lo stato: l'ordine dei posti (se scelto) va conservato.
const orderPart = (state, seats) => (Array.isArray(state?.seatOrder) ? { seatOrder: seatOrderOf(state, seats) } : {});

// Stato dopo "Ripristina punti vita": punteggi e storico azzerati, l'ordine dei posti resta (nessuno si è spostato).
const resetState = (state, seatUserIds) => {
  const keep = orderPart(state, seatUserIds.map(Number));
  return keep.seatOrder ? keep : null;
};

const historyOf = (state) => (Array.isArray(state?.history) ? state.history.slice(-HISTORY_MAX) : []);
const sameTarget = (a, b) => a.by === b.by && a.type === b.type && a.userId === b.userId && (a.fromUserId ?? null) === (b.fromUserId ?? null);
const isNoop = (d) => !d.life && !d.poison && !d.cmd;

function pushHistory(history, entry) {
  const out = history.slice();
  const last = out[out.length - 1];
  if (last && sameTarget(last, entry) && entry.at - last.at <= MERGE_MS) {
    const merged = { ...last, at: entry.at, d: { life: last.d.life + entry.d.life, poison: last.d.poison + entry.d.poison, cmd: last.d.cmd + entry.d.cmd } };
    out.pop();
    if (!isNoop(merged.d)) out.push(merged);
  } else if (!isNoop(entry.d)) {
    out.push(entry);
  }
  return out.slice(-HISTORY_MAX);
}

const copyPlayers = (state, seats) => {
  const current = viewFor(state, seats).players;
  const players = {};
  for (const s of seats) players[s] = { life: current[s].life, poison: current[s].poison, cmd: { ...current[s].cmd } };
  return players;
};

// Eliminato? e perché: vita <= 0, 10 veleni, 21 danni da UN singolo commander.
function eliminationOf(p) {
  if (p.life <= 0) return { eliminated: true, reason: 'life' };
  if (p.poison >= POISON_LETHAL) return { eliminated: true, reason: 'poison' };
  if (Object.values(p.cmd || {}).some(v => v >= CMD_LETHAL)) return { eliminated: true, reason: 'commander' };
  return { eliminated: false, reason: null };
}

// Applica un'azione. Restituisce { state } con lo stato nuovo, oppure { error }.
// Azioni:
//   { type: 'life',   userId, delta }
//   { type: 'poison', userId, delta }
//   { type: 'cmd',    userId, fromUserId, delta }  — il danno da commander toglie anche la stessa vita
// byUserId: chi ha toccato (per lo storico). now: ms, iniettabile nei test.
function applyAction(state, seatUserIds, action, byUserId = null, now = Date.now()) {
  const seats = seatUserIds.map(Number);
  const a = action || {};
  const uid = Number(a.userId);
  const delta = Number(a.delta);
  if (!seats.includes(uid)) return { error: 'Giocatore non seduto a questo tavolo' };
  if (!Number.isInteger(delta) || delta === 0 || Math.abs(delta) > 100) return { error: 'Variazione non valida' };

  const players = copyPlayers(state, seats);
  const p = players[uid];
  const before = { life: p.life, poison: p.poison };
  let cmdApplied = 0;
  let from = null;

  if (a.type === 'life') {
    p.life = clamp(p.life + delta, -MAX_ABS, MAX_ABS);
  } else if (a.type === 'poison') {
    p.poison = clamp(p.poison + delta, 0, MAX_ABS);
  } else if (a.type === 'cmd') {
    from = Number(a.fromUserId);
    if (!seats.includes(from) || from === uid) return { error: 'Avversario non valido' };
    const was = p.cmd[from] || 0;
    const after = clamp(was + delta, 0, MAX_ABS);
    p.cmd[from] = after;
    cmdApplied = after - was;
    // il danno da commander è anche perdita di vita (solo per la parte effettivamente applicata)
    p.life = clamp(p.life - cmdApplied, -MAX_ABS, MAX_ABS);
  } else {
    return { error: 'Azione non valida' };
  }
  const entry = {
    by: byUserId == null ? null : Number(byUserId), type: a.type, userId: uid, ...(from != null ? { fromUserId: from } : {}),
    d: { life: p.life - before.life, poison: p.poison - before.poison, cmd: cmdApplied }, at: now,
  };
  const history = pushHistory(historyOf(state), entry);
  return { state: { players, history, ...orderPart(state, seats), updatedAt: new Date(now).toISOString() } };
}

// Annulla l'ultima azione dello storico (di chiunque): restituisce { state, undone } oppure { error }.
// Le voci di giocatori che non sono più seduti vengono scartate.
function undoLast(state, seatUserIds, now = Date.now()) {
  const seats = seatUserIds.map(Number);
  const history = historyOf(state).slice();
  let entry;
  while ((entry = history.pop()) && !seats.includes(entry.userId)) { /* giocatore non più seduto: salta */ }
  if (!entry) return { error: 'Niente da annullare' };
  const players = copyPlayers(state, seats);
  const p = players[entry.userId];
  const d = entry.d || {};
  p.life = clamp(p.life - (d.life || 0), -MAX_ABS, MAX_ABS);
  p.poison = clamp(p.poison - (d.poison || 0), 0, MAX_ABS);
  if (entry.type === 'cmd' && seats.includes(entry.fromUserId)) {
    p.cmd[entry.fromUserId] = clamp((p.cmd[entry.fromUserId] || 0) - (d.cmd || 0), 0, MAX_ABS);
  }
  return { state: { players, history, ...orderPart(state, seats), updatedAt: new Date(now).toISOString() }, undone: entry };
}

module.exports = { START_LIFE, CMD_LETHAL, POISON_LETHAL, HISTORY_MAX, MERGE_MS, emptyPlayer, viewFor, eliminationOf, applyAction, undoLast, seatOrderOf, setSeatOrder, resetState };
