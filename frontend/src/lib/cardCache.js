// Cache dei dati carta di Scryfall (immagini + type_line), per non interrogare
// l'API a ogni miniatura e a ogni apertura della lista di un mazzo.
//
// - Le miniature commander (DeckThumb) usano gli URL del CDN cachati.
// - La "lista carte per tipo" (profilo mazzo) e la lista nel pannello usano gli
//   stessi dati cachati (immagine + tipo).
// Tutto è risolto in batch (/cards/collection, 75 per richiesta) e salvato in
// localStorage: dal secondo caricamento, zero chiamate all'API Scryfall.
import { useState, useEffect } from 'react'
import { parseDecklist } from './scryfall'

const BASE = 'https://api.scryfall.com'
const LS_KEY = 'ct_cardcache_v1'

const key = (name) => (name || '').trim().toLowerCase()

// cache: key -> { name, art, normal, typeLine } | { missing: true }
let cache = {}
try { cache = JSON.parse(localStorage.getItem(LS_KEY) || '{}') } catch { cache = {} }

let saveTimer = null
function persist() {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    try { localStorage.setItem(LS_KEY, JSON.stringify(cache)) } catch { /* quota/private */ }
  }, 400)
}

const imgUris = (card) => {
  const u = card.image_uris || card.card_faces?.[0]?.image_uris || {}
  return {
    name: card.name,
    art: u.art_crop || u.normal,
    normal: u.normal || u.large || u.art_crop,
    typeLine: card.type_line || card.card_faces?.[0]?.type_line || '',
  }
}

// Nomi che il batch non trova (DFC con la sola faccia frontale, nomi "universes beyond",
// piccoli refusi): una ricerca fuzzy in JSON per ciascuno, una alla volta (Scryfall chiede
// 50-100 ms fra le richieste), e l'URL CDN finisce in cache come gli altri. Prima si usava
// l'endpoint `format=image` a ogni miniatura: un redirect dall'API, lento e soggetto a 429.

// Nomi non risolti in questa sessione per errori temporanei (429, rete): si mostra il
// fallback invece dello skeleton infinito; al prossimo avvio si riprova.
const gaveUp = new Set()
const giveUp = (k) => { gaveUp.add(k); notify(k) }

const sleep = (ms) => new Promise(r => setTimeout(r, ms))
async function fuzzyResolve(keys) {
  for (const k of keys) {
    try {
      const res = await fetch(`${BASE}/cards/named?fuzzy=${encodeURIComponent(k)}`)
      if (res.ok) cache[k] = imgUris(await res.json())
      else if (res.status === 404) cache[k] = { missing: true, fz: true }
      else { giveUp(k); continue } // 429/5xx: si riprova al prossimo avvio
      notify(k)
    } catch { giveUp(k) }
    await sleep(110)
  }
  persist()
}

// Da (ri)scaricare: mai visto, oppure segnato "mancante" dal solo batch (senza ricerca fuzzy)
const needsFetch = (k) => !(k in cache) || (cache[k].missing && !cache[k].fz)

// Scarica e mette in cache i dati per i nomi (chiavi) indicati. Awaitable.
// fuzzy: per le miniature, i nomi non trovati dal batch passano dalla ricerca fuzzy.
async function fetchAndCache(keys, { fuzzy = false } = {}) {
  const notFound = []
  for (let i = 0; i < keys.length; i += 75) {
    const chunk = keys.slice(i, i + 75)
    try {
      const res = await fetch(`${BASE}/cards/collection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifiers: chunk.map(n => ({ name: n })) }),
      })
      if (!res.ok) { if (fuzzy) chunk.forEach(giveUp); continue } // rate limit/errore: si riproverà
      const data = await res.json()
      for (const card of data.data || []) {
        const k = key(card.name)
        cache[k] = imgUris(card)
        notify(k)
      }
      for (const k of chunk) {
        if (!(k in cache) || (cache[k].missing && !cache[k].fz)) {
          if (fuzzy) notFound.push(k)
          else { cache[k] = { missing: true }; notify(k) }
        }
      }
      persist()
    } catch { if (fuzzy) chunk.forEach(giveUp) } // rete giù: non segnare, si riprova
  }
  if (notFound.length) await fuzzyResolve(notFound)
}

// ── stato per le miniature (DeckThumb) ──
export function lookupArt(name) {
  const k = key(name)
  const c = cache[k]
  if (!c || needsFetch(k)) return gaveUp.has(k) ? { status: 'missing' } : { status: 'loading' }
  if (c.missing) return { status: 'missing' }
  return { status: 'ready', art: c.art, normal: c.normal }
}

// batching per le miniature: tante DeckThumb montano insieme → una richiesta sola
const queue = new Set()
const subs = new Map()
let flushTimer = null

function subscribe(name, cb) {
  const k = key(name)
  if (!subs.has(k)) subs.set(k, new Set())
  subs.get(k).add(cb)
  return () => { const s = subs.get(k); if (s) { s.delete(cb); if (!s.size) subs.delete(k) } }
}
const notify = (k) => subs.get(k)?.forEach(cb => cb())

function requestArt(name) {
  const k = key(name)
  if (!k || !needsFetch(k) || gaveUp.has(k)) return
  queue.add(k)
  if (!flushTimer) flushTimer = setTimeout(async () => {
    flushTimer = null
    const keys = [...queue].filter(needsFetch)
    queue.clear()
    if (keys.length) await fetchAndCache(keys, { fuzzy: true })
  }, 60)
}

const NO_NAME = { status: 'missing' }

export function useCardArt(name) {
  const [state, setState] = useState(() => ({ name, art: name ? lookupArt(name) : NO_NAME }))
  useEffect(() => {
    if (!name) { setState({ name, art: NO_NAME }); return }
    const cur = lookupArt(name)
    setState({ name, art: cur })
    if (cur.status === 'loading') {
      requestArt(name)
      const unsub = subscribe(name, () => setState({ name, art: lookupArt(name) }))
      return unsub
    }
  }, [name])
  // Nome appena cambiato (es. arriva il commander di default): lo stato è ancora del nome
  // precedente fino all'effetto, quindi si legge subito la cache per il nome nuovo.
  // Prima, per un render, restava "missing" e partiva la richiesta format=image di ripiego.
  if (state.name !== name) return name ? lookupArt(name) : NO_NAME
  return state.art
}

// ── lista carte per tipo (profilo mazzo / pannello) ──
// Stessa forma di scryfall.fetchTypedDecklist: [{ name, count, imageUri, typeLine }]
export async function resolveDecklistCards(text) {
  const { entries } = parseDecklist(text)
  const countByKey = {}
  for (const { count, name } of entries) {
    const k = key(name)
    countByKey[k] = (countByKey[k] || 0) + count
  }
  const keys = Object.keys(countByKey)
  const uncached = keys.filter(k => !(k in cache))
  if (uncached.length) await fetchAndCache(uncached)

  const out = []
  for (const k of keys) {
    const c = cache[k]
    if (!c || c.missing) continue
    out.push({ name: c.name || k, count: countByKey[k], imageUri: c.normal, typeLine: c.typeLine || '' })
  }
  return out
}
