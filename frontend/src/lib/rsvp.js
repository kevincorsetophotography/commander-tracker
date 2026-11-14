// POST /events/:id/rsvp restituisce gli iscritti con il solo username (senza avatar),
// mentre GET /events li include. Sostituire lo stato con la risposta faceva sparire
// le immagini dei presenti dopo "Ci sei?"/annulla.
// Qui si tiene la lista della risposta (fonte di verità su CHI è iscritto) e si
// ricompletano gli avatar: prima dalla lista precedente, poi (per l'utente corrente)
// dal suo profilo.
export function mergeRsvps(prev = [], next = [], me = null) {
  const known = new Map(prev.map(r => [r.userId, r.user || {}]))
  return next.map(r => {
    const fromPrev = known.get(r.userId) || {}
    const fromMe = me && r.userId === me.id ? me : {}
    const pick = (field) => r.user?.[field] ?? fromPrev[field] ?? fromMe[field] ?? null
    return {
      ...r,
      user: {
        ...fromPrev,
        ...(r.user || {}),
        username: r.user?.username ?? fromPrev.username ?? fromMe.username,
        avatarCardName: pick('avatarCardName'),
        avatarScryfallId: pick('avatarScryfallId'),
      },
    }
  })
}
