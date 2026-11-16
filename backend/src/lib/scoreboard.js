// Segnapunti condiviso di un tavolo aperto — regole pure (testate in scoreboard.test.js).
//
// Stato salvato in OpenTable.scoreboard (JSON):
//   { players: { "<userId>": { life: 40, poison: 0, cmd: { "<fromUserId>": 0 } } }, updatedAt }
// I giocatori NON vengono copiati alla creazione: chi non ha ancora una voce parte dai valori iniziali,
// così il segnapunti segue i posti del tavolo anche se il creatore toglie qualcuno.

const START_LIFE = 40;
const CMD_LETHAL = 21;
const POISON_LETHAL = 10;
const MAX_ABS = 999; // tetto di sicurezza contro valori assurdi

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
  return { players, updatedAt: state?.updatedAt || null };
}

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
function applyAction(state, seatUserIds, action) {
  const seats = seatUserIds.map(Number);
  const a = action || {};
  const uid = Number(a.userId);
  const delta = Number(a.delta);
  if (!seats.includes(uid)) return { error: 'Giocatore non seduto a questo tavolo' };
  if (!Number.isInteger(delta) || delta === 0 || Math.abs(delta) > 100) return { error: 'Variazione non valida' };

  const players = {};
  const current = viewFor(state, seats).players;
  for (const s of seats) players[s] = { life: current[s].life, poison: current[s].poison, cmd: { ...current[s].cmd } };
  const p = players[uid];

  if (a.type === 'life') {
    p.life = clamp(p.life + delta, -MAX_ABS, MAX_ABS);
  } else if (a.type === 'poison') {
    p.poison = clamp(p.poison + delta, 0, MAX_ABS);
  } else if (a.type === 'cmd') {
    const from = Number(a.fromUserId);
    if (!seats.includes(from) || from === uid) return { error: 'Avversario non valido' };
    const before = p.cmd[from] || 0;
    const after = clamp(before + delta, 0, MAX_ABS);
    p.cmd[from] = after;
    // il danno da commander è anche perdita di vita (solo per la parte effettivamente applicata)
    p.life = clamp(p.life - (after - before), -MAX_ABS, MAX_ABS);
  } else {
    return { error: 'Azione non valida' };
  }
  return { state: { players, updatedAt: new Date().toISOString() } };
}

module.exports = { START_LIFE, CMD_LETHAL, POISON_LETHAL, emptyPlayer, viewFor, eliminationOf, applyAction };
