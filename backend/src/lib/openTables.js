// Regole pure dei tavoli aperti (testate in openTables.test.js).

const MAX_SEATS = 5;

// Finestra in cui un tavolo "appartiene" a un evento:
// - evento con orario: da 1 ora prima dell'inizio fino alle 4:00 del giorno dopo;
// - evento "tutto il giorno": dalle 00:00 del giorno fino alle 4:00 del giorno dopo.
// Le ore sono quelle locali del server (Europe/Rome in produzione e in dev).
function eventWindow(event) {
  const start = new Date(event.startsAt);
  const dayStart = new Date(start); dayStart.setHours(0, 0, 0, 0);
  const from = event.allDay ? dayStart : new Date(start.getTime() - 3600 * 1000);
  const to = new Date(dayStart); to.setDate(to.getDate() + 1); to.setHours(4, 0, 0, 0);
  return { from, to };
}

// I tornei 1v1 (svizzera) non prevedono tavoli aperti.
const allowsOpenTables = (event) => event?.format !== '1v1';

// L'evento a cui agganciare un tavolo che inizia a `when` (il più vicino come inizio), o null.
// Gli eventi 1v1 non vengono mai considerati.
function findEventForTime(events, when) {
  const t = new Date(when).getTime();
  const hits = events.filter(allowsOpenTables).filter(ev => {
    const { from, to } = eventWindow(ev);
    return t >= from.getTime() && t < to.getTime();
  });
  hits.sort((a, b) => Math.abs(new Date(a.startsAt) - t) - Math.abs(new Date(b.startsAt) - t));
  return hits[0] || null;
}

// Perché un utente NON può sedersi (stringa d'errore) oppure null se può.
function joinError(table, userId) {
  if (table.gameId) return 'Il tavolo ha già un risultato registrato';
  if (table.seats.some(s => s.userId === userId)) return 'Sei già seduto a questo tavolo';
  if (!table.isOpen) return 'Il tavolo è chiuso';
  if (table.seats.length >= (table.maxSeats || MAX_SEATS)) return 'Il tavolo è pieno';
  return null;
}

// Creatore del tavolo o admin.
function canEditTable(user, table) {
  if (!user || !table) return false;
  return user.role === 'ADMIN' || table.createdById === user.id;
}

// La partita registrata deve avere esattamente i giocatori seduti al tavolo.
function resultMatchesSeats(gamePlayerIds, seatUserIds) {
  const a = [...new Set(gamePlayerIds)].sort((x, y) => x - y);
  const b = [...new Set(seatUserIds)].sort((x, y) => x - y);
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

// Tavolo "chiuso": non accetta più giocatori (chiuso dal creatore o pieno). Senza risultato.
function isTableClosed(table) {
  if (!table || table.gameId) return false;
  return !table.isOpen || table.seats.length >= (table.maxSeats || MAX_SEATS);
}

// Il mazzo di un posto lo sceglie il giocatore stesso oppure chi ha aperto il tavolo.
// Chi lo chiede deve essere seduto (la pagina del tavolo è solo per i membri).
function canPickDeck(user, table, targetUserId) {
  if (!user || !table) return false;
  if (!table.seats.some(s => s.userId === user.id)) return false;
  if (!table.seats.some(s => s.userId === targetUserId)) return false;
  return user.id === targetUserId || table.createdById === user.id;
}

module.exports = { MAX_SEATS, isTableClosed, canPickDeck, allowsOpenTables, eventWindow, findEventForTime, joinError, canEditTable, resultMatchesSeats };
