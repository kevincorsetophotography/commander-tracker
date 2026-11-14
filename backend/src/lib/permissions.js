// Permessi sugli eventi.
// - ADMIN: tutto.
// - Organizzatore (isOrganizer, resta PLAYER): crea eventi e gestisce SOLO quelli che ha creato.
// - Player: nessuna gestione.

const isAdmin = (user) => user?.role === 'ADMIN';

function canCreateEvent(user) {
  return isAdmin(user) || !!user?.isOrganizer;
}

function canManageEvent(user, event) {
  if (!user || !event) return false;
  if (isAdmin(user)) return true;
  return !!user.isOrganizer && event.createdByUserId === user.id;
}

module.exports = { isAdmin, canCreateEvent, canManageEvent };
