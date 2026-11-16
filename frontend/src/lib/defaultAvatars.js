// Avatar di default (commander più giocato / creato per ultimo) per chi non ha
// scelto un'immagine profilo. Una sola richiesta condivisa da tutti i PlayerAvatar,
// rinfrescata dopo le scritture che possono cambiarla (mazzi, partite, profilo).
import { useEffect, useState } from 'react'
import { api } from './api'

const TTL = 5 * 60 * 1000
let map = null          // { [username]: commander }
let fetchedAt = 0
let inflight = null
const subs = new Set()

function load() {
  if (inflight) return inflight
  inflight = api.defaultAvatars()
    .then(m => { map = m || {}; fetchedAt = Date.now(); subs.forEach(cb => cb()) })
    .catch(() => { if (!map) map = {} })   // best-effort: in errore restano le iniziali
    .finally(() => { inflight = null })
  return inflight
}

const stale = () => !map || Date.now() - fetchedAt > TTL

if (typeof window !== 'undefined') {
  window.addEventListener('ct:avatars-stale', () => { fetchedAt = 0; if (subs.size) load() })
}

// username → nome commander di default, o null. Passare null per disattivare
// (es. l'utente ha già un avatar scelto): niente richiesta.
export function useDefaultAvatar(username) {
  const [, force] = useState(0)
  useEffect(() => {
    if (!username || !localStorage.getItem('ct_token')) return
    const cb = () => force(n => n + 1)
    subs.add(cb)
    if (stale()) load()
    return () => { subs.delete(cb) }
  }, [username])
  return (username && map?.[username]) || null
}
