// Prossima serata Commanderone: ogni venerdì alle 21:30, ora di Roma (gestisce l'ora legale).
// Durante la serata (venerdì 21:30 → sabato 04:00) "Stasera si gioca".
const TZ = 'Europe/Rome'
const START_H = 21, START_M = 30, END_H = 4 // la serata finisce alle 4:00 del sabato

// Scarto in minuti di Roma rispetto a UTC in un dato istante (+60 inverno, +120 estate)
export function romeOffset(date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric',
  }).formatToParts(date)
  const v = Object.fromEntries(parts.map(p => [p.type, +p.value]))
  const asUtc = Date.UTC(v.year, v.month - 1, v.day, v.hour, v.minute, v.second)
  return Math.round((asUtc - Math.floor(date.getTime() / 1000) * 1000) / 60000)
}

// Istante UTC che corrisponde a una data/ora "da orologio" di Roma
function romeWallToUtc(y, mo, d, h, mi) {
  const guess = Date.UTC(y, mo, d, h, mi)
  let t = guess - romeOffset(new Date(guess)) * 60000
  t = guess - romeOffset(new Date(t)) * 60000 // seconda passata per i giorni del cambio d'ora
  return new Date(t)
}

// Data di calendario e giorno della settimana a Roma
function romeDay(date) {
  const off = romeOffset(date)
  const w = new Date(date.getTime() + off * 60000)
  return { y: w.getUTCFullYear(), mo: w.getUTCMonth(), d: w.getUTCDate(), dow: w.getUTCDay() }
}

export function nightStatus(now = new Date()) {
  const { y, mo, d, dow } = romeDay(now)
  // venerdì di questa settimana (o quello appena passato, se è sabato notte)
  const back = (dow - 5 + 7) % 7
  const lastFri = romeWallToUtc(y, mo, d - back, START_H, START_M)
  const lastEnd = romeWallToUtc(y, mo, d - back + 1, END_H, 0)
  if (now >= lastFri && now < lastEnd) return { live: true, start: lastFri, ms: 0 }
  const ahead = now < lastFri ? 0 : 7
  const start = romeWallToUtc(y, mo, d - back + ahead, START_H, START_M)
  return { live: false, start, ms: start.getTime() - now.getTime() }
}

export function splitMs(ms) {
  const s = Math.max(0, Math.floor(ms / 1000))
  return { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 }
}
