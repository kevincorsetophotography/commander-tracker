const SCRYFALL = 'https://api.scryfall.com';
const EXPECTED_TOTAL = 100;

// Parsa una decklist testuale: ogni riga "Nx Nome" o "N Nome".
function parseDecklist(text) {
  const entries = [];
  let total = 0;
  for (const raw of String(text || '').split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const m = line.match(/^(\d+)x?\s+(.+)$/);
    if (!m) continue;
    const count = parseInt(m[1], 10);
    total += count;
    entries.push({ count, name: m[2].trim() });
  }
  return { entries, total };
}

// Verifica esistenza carte via batch /cards/collection (max 75 per richiesta).
async function findMissingCards(names) {
  const missing = [];
  for (let i = 0; i < names.length; i += 75) {
    const chunk = names.slice(i, i + 75);
    const res = await fetch(`${SCRYFALL}/cards/collection`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifiers: chunk.map((name) => ({ name })) })
    });
    if (!res.ok) {
      const err = new Error('Scryfall non raggiungibile');
      err.code = 'SCRYFALL_UNREACHABLE';
      throw err;
    }
    const data = await res.json();
    if (Array.isArray(data.not_found)) {
      missing.push(...data.not_found.map((c) => c.name).filter(Boolean));
    }
  }

  // Fuzzy fallback: handles DFC front-face-only names and alternate/universe-beyond names
  const reallyMissing = [];
  for (const name of missing) {
    try {
      const res = await fetch(`${SCRYFALL}/cards/named?fuzzy=${encodeURIComponent(name)}`);
      if (!res.ok) reallyMissing.push(name);
    } catch {
      reallyMissing.push(name);
    }
  }

  return reallyMissing;
}

/**
 * Valida una decklist Commander.
 * @returns {Promise<{ valid: boolean, errors: string[] }>}
 */
async function validateDecklist(text) {
  const errors = [];
  const { entries, total } = parseDecklist(text);

  if (entries.length === 0) {
    return { valid: false, errors: ['La lista è vuota o in un formato non valido'] };
  }

  if (total !== EXPECTED_TOTAL) {
    errors.push(`Il mazzo ha ${total} carte: servono il commander + ${EXPECTED_TOTAL - 1} carte (${EXPECTED_TOTAL} in totale)`);
    return { valid: false, errors };
  }

  // Conteggio ok → verifica esistenza. Se Scryfall è giù, non blocchiamo (best-effort).
  try {
    const uniqueNames = [...new Set(entries.map((e) => e.name))];
    const missing = await findMissingCards(uniqueNames);
    if (missing.length > 0) {
      errors.push(`Carte non trovate su Scryfall: ${missing.join(', ')}`);
    }
  } catch (err) {
    if (err.code !== 'SCRYFALL_UNREACHABLE') throw err;
    // Scryfall non raggiungibile: accettiamo basandoci sul solo conteggio.
  }

  return { valid: errors.length === 0, errors };
}

// Nuovo commander su un mazzo che ha già la lista: la riga del vecchio commander
// (di solito la prima) diventa "1 <nuovo>", così lista, sezione Commander e immagini restano
// coerenti. Senza la riga del vecchio commander la lista resta com'è. Puro.
function replaceCommanderLine(decklist, oldCommander, newCommander) {
  const text = String(decklist || '');
  const oldName = String(oldCommander || '').trim().toLowerCase();
  const newName = String(newCommander || '').trim();
  if (!text.trim() || !oldName || !newName || oldName === newName.toLowerCase()) return text;
  const lines = text.split('\n');
  const i = lines.findIndex((raw) => {
    const m = raw.trim().match(/^(\d+)x?\s+(.+)$/);
    if (!m) return false;
    const n = m[2].trim().toLowerCase();
    return n === oldName || n.startsWith(oldName + ' //') || oldName.startsWith(n + ' //');
  });
  if (i === -1) return text;
  lines[i] = `1 ${newName}`;
  return lines.join('\n');
}

module.exports = { parseDecklist, validateDecklist, replaceCommanderLine, EXPECTED_TOTAL };
