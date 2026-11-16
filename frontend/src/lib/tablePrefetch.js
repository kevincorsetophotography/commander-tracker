// Apertura della pagina del tavolo senza attese in serie: il dettaglio parte insieme al
// codice della pagina (chunk lazy), invece che dopo. La pagina prende la richiesta già
// in volo se è recente, altrimenti ne fa una nuova.
import { api } from './api'

const MAX_AGE_MS = 8000
const inflight = new Map() // id -> { promise, at }

export const loadTablePage = () => import('../pages/TablePage')

export function prefetchTable(id) {
  loadTablePage().catch(() => {})
  const promise = api.getTable(id)
  promise.catch(() => {})
  inflight.set(id, { promise, at: Date.now() })
}

export function takePrefetchedTable(id) {
  const hit = inflight.get(id)
  inflight.delete(id)
  return hit && Date.now() - hit.at < MAX_AGE_MS ? hit.promise : null
}
