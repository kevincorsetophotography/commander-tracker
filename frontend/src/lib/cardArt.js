// Cache degli URL immagine dei commander.
//
// Problema: usare api.scryfall.com/cards/named?format=image per OGNI miniatura
// significa una chiamata all'API Scryfall (rate-limited) per ogni thumbnail —
// con 100+ miniature nello Storico, Scryfall risponde 429 e le immagini non
// caricano. Qui risolviamo ogni nome UNA volta in batch (/cards/collection),
// salviamo gli URL diretti del CDN (cards.scryfall.io, non rate-limited) in
// localStorage e li riusiamo. Al secondo caricamento: zero chiamate.
import { useState, useEffect } from 'react'

const BASE = 'https://api.scryfall.com'
const LS_KEY = 'ct_cardart_v1'

const key = (name) => (name || '').trim().toLowerCase()

// cache: key -> { art, normal } | { missing: true }
let cache = {}
try { cache = JSON.parse(localStorage.getItem(LS_KEY) || '{}') } catch { cache = {} }

let saveTimer = null
function persist() {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    try { localStorage.setItem(LS_KEY, JSON.stringify(cache)) } catch { /* quota/private */ }
  }, 400)
}

// stato per un nome: { status: 'loading' | 'ready' | 'missing', art?, normal? }
export function lookupArt(name) {
  const c = cache[key(name)]
  if (!c) return { status: 'loading' }
  if (c.missing) return { status: 'missing' }
  return { status: 'ready', art: c.art, normal: c.normal }
}

// ── batching + subscribe ──
const queue = new Set()
const subs = new Map() // key -> Set<cb>
let flushTimer = null

function subscribe(name, cb) {
  const k = key(name)
  if (!subs.has(k)) subs.set(k, new Set())
  subs.get(k).add(cb)
  return () => { const s = subs.get(k); if (s) { s.delete(cb); if (!s.size) subs.delete(k) } }
}
const notify = (k) => subs.get(k)?.forEach(cb => cb())

const imgUris = (card) => {
  const u = card.image_uris || card.card_faces?.[0]?.image_uris || {}
  return { art: u.art_crop || u.normal, normal: u.normal || u.large || u.art_crop }
}

async function flush() {
  flushTimer = null
  const names = [...queue].filter(k => !(k in cache))
  queue.clear()
  if (names.length === 0) return

  for (let i = 0; i < names.length; i += 75) {
    const chunk = names.slice(i, i + 75)
    try {
      const res = await fetch(`${BASE}/cards/collection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifiers: chunk.map(n => ({ name: n })) }),
      })
      if (!res.ok) continue // rate limit/errore: riproveremo alla prossima richiesta
      const data = await res.json()
      for (const card of data.data || []) {
        const k = key(card.name)
        cache[k] = imgUris(card)
        notify(k)
      }
      // i nomi non trovati: segnali come "missing" così non li si richiede all'infinito
      for (const k of chunk) {
        if (!(k in cache)) { cache[k] = { missing: true }; notify(k) }
      }
      persist()
    } catch { /* rete giù: non segnare, si riprova */ }
  }
}

export function requestArt(name) {
  const k = key(name)
  if (!k || k in cache) return
  queue.add(k)
  if (!flushTimer) flushTimer = setTimeout(flush, 60)
}

// Hook: ritorna { status, art, normal }, richiedendo la risoluzione se serve.
export function useCardArt(name) {
  const [state, setState] = useState(() => lookupArt(name))
  useEffect(() => {
    if (!name) { setState({ status: 'missing' }); return }
    const cur = lookupArt(name)
    setState(cur)
    if (cur.status === 'loading') {
      requestArt(name)
      const unsub = subscribe(name, () => setState(lookupArt(name)))
      return unsub
    }
  }, [name])
  return state
}
