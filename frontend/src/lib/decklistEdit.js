// Modifica della lista di un mazzo: il commander sta nel suo campo, la sezione mazzo ha le altre 99 carte.
// Puro, con test (decklistEdit.test.js).

export const MAIN_TOTAL = 99

const LINE = /^(\d+)x?\s+(.+)$/

const isCommanderLine = (line, commander) => {
  const m = line.match(LINE)
  if (!m || !commander) return false
  const entered = m[2].trim().toLowerCase()
  const stored = commander.trim().toLowerCase()
  // Anche le carte bifronte scritte solo con la faccia frontale (o viceversa)
  return entered === stored || entered.startsWith(stored + ' //') || stored.startsWith(entered + ' //')
}

// Toglie la PRIMA riga del commander (se c'è) dalla lista: serve sia ad aprire la modifica
// (la lista salvata contiene "1 Commander") sia a chi incolla 100 carte compreso il commander.
export function stripCommander(text, commander) {
  const lines = String(text || '').split('\n').map(l => l.trim()).filter(Boolean)
  let removed = false
  const rest = lines.filter(line => {
    if (removed || !isCommanderLine(line, commander)) return true
    removed = true
    return false
  })
  return rest.join('\n')
}

// Somma delle quantità delle righe "N Nome" / "Nx Nome".
export function countCards(text) {
  let total = 0
  for (const raw of String(text || '').split('\n')) {
    const m = raw.trim().match(LINE)
    if (m) total += Number.parseInt(m[1], 10)
  }
  return total
}

// Prepara il salvataggio.
// - sezione mazzo vuota → si salva solo il commander (decklist vuota), nessun controllo sulle carte
// - altrimenti servono esattamente 99 carte (oltre al commander) → lista completa "1 Commander" + 99
export function buildDecklist(commander, mainText) {
  const main = stripCommander(mainText, commander)
  const count = countCards(main)
  if (!main.trim()) return { ok: true, decklist: '', count: 0 }
  if (count !== MAIN_TOTAL) {
    return {
      ok: false, count, decklist: null,
      error: `La sezione mazzo ha ${count} carte: ne servono ${MAIN_TOTAL} (il commander va nel suo campo). Lasciala vuota per salvare solo il commander.`,
    }
  }
  return { ok: true, count, decklist: `1 ${commander}\n${main}` }
}
