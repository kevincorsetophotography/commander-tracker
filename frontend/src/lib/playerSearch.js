// Ricerca giocatori per il selettore di "Registra partita":
// filtro istantaneo, case/accent-insensitive, con posizioni per evidenziare le lettere.

export const normalize = (s) =>
  (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

// Restituisce { score, start, end } se `query` compare in `name`, altrimenti null.
// score: 0 = inizia con la query, 1 = inizio di una parola, 2 = contenuta altrove.
export function matchName(name, query) {
  const q = normalize(query).trim()
  if (!q) return { score: 0, start: 0, end: 0 }
  const n = normalize(name)
  const idx = n.indexOf(q)
  if (idx === -1) return null
  // preferisci un'occorrenza a inizio parola, se c'è
  let best = idx
  const re = /[\s._-]/
  for (let i = idx; i !== -1; i = n.indexOf(q, i + 1)) {
    if (i === 0 || re.test(n[i - 1])) { best = i; break }
  }
  const score = best === 0 ? 0 : re.test(n[best - 1]) ? 1 : 2
  return { score, start: best, end: best + q.length }
}

// Filtra e ordina: prima per qualità della corrispondenza, poi per partite giocate, poi per nome.
export function searchPlayers(players, query, gamesById = {}) {
  return players
    .map(p => ({ p, m: matchName(p.username, query) }))
    .filter(x => x.m)
    .sort((a, b) =>
      (a.m.score - b.m.score) ||
      ((gamesById[b.p.id] || 0) - (gamesById[a.p.id] || 0)) ||
      a.p.username.localeCompare(b.p.username, 'it'))
    .map(x => ({ ...x.p, match: x.m }))
}

// Spezza il nome nei pezzi [prima, corrispondenza, dopo] per l'evidenziazione.
// Gli indici della corrispondenza sono sul nome normalizzato: li riporta sui caratteri
// originali (una lettera accentata come "ò" resta un solo carattere).
export function splitHighlight(name, match) {
  if (!match || match.end <= match.start) return [name, '', '']
  const chars = [...name]
  const map = []
  chars.forEach((c, i) => { for (let k = 0; k < normalize(c).length; k++) map.push(i) })
  const s = map[match.start] ?? 0
  const e = (map[match.end - 1] ?? chars.length - 1) + 1
  return [chars.slice(0, s).join(''), chars.slice(s, e).join(''), chars.slice(e).join('')]
}
