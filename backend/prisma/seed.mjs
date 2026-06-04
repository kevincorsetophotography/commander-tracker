// Seed di dati di TEST per l'ambiente di sviluppo locale.
// NON viene mai eseguito in produzione.
import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

const PLAYERS = [
  { username: 'Ramuh',   commander: 'The Ur-Dragon',            colors: 'WUBRG', bracket: 3 },
  { username: 'Shiva',   commander: "Atraxa, Praetors' Voice",  colors: 'WUBG',  bracket: 4 },
  { username: 'Ifrit',   commander: "Gishath, Sun's Avatar",    colors: 'RGW',   bracket: 2 },
  { username: 'Bahamut', commander: 'Yawgmoth, Thran Physician',colors: 'B',     bracket: 4 },
  { username: 'Leviath', commander: 'Lathril, Blade of the Elves', colors: 'BG', bracket: 2 },
  { username: 'Titan',   commander: 'Krenko, Mob Boss',         colors: 'R',     bracket: 1 },
]

const NOTES = [
  'Combo al turno 8, tavolo spazzato.',
  'Partita lunga, vinta ai punti vita.',
  'Wrath provvidenziale e poi alpha strike.',
  'Furto di mana e chiusura rapida.',
  null, null,
  'Politica fino all\'ultimo, poi colpo a sorpresa.',
]

const rint = (n) => Math.floor(Math.random() * n)
const pick = (a) => a[rint(a.length)]
const shuffle = (a) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = rint(i + 1);[a[i], a[j]] = [a[j], a[i]] } return a }

async function main() {
  console.log('Pulizia tabelle...')
  await prisma.gamePlayer.deleteMany({})
  await prisma.game.deleteMany({})
  await prisma.deck.deleteMany({})
  await prisma.user.deleteMany({})

  const hash = await bcrypt.hash('test', 10)

  const admin = await prisma.user.create({ data: { username: 'admin', password: hash, role: 'ADMIN' } })

  const players = []
  for (const p of PLAYERS) {
    const u = await prisma.user.create({ data: { username: p.username, password: hash, role: 'PLAYER' } })
    const d = await prisma.deck.create({ data: { name: p.commander.split(',')[0], commander: p.commander, colors: p.colors, bracket: p.bracket, userId: u.id } })
    players.push({ user: u, deck: d })
  }

  // ~28 partite negli ultimi ~5 mesi (copre 2 stagioni)
  const now = Date.now()
  const fiveMonths = 5 * 30 * 24 * 60 * 60 * 1000
  let made = 0
  for (let g = 0; g < 28; g++) {
    const size = pick([3, 4, 4, 4, 5])
    const seated = shuffle(players).slice(0, size)
    const playedAt = new Date(now - Math.random() * fiveMonths)
    // piazzamenti 1..size in ordine casuale
    const placements = shuffle([...Array(size).keys()].map(i => i + 1))
    const rows = seated.map((s, i) => ({ s, placement: placements[i] }))
    rows.sort((a, b) => a.placement - b.placement)
    // eliminazioni: ogni perdente eliminato da uno con piazzamento migliore
    const data = rows.map(({ s, placement }) => {
      let eliminatedById = null
      if (placement > 1) {
        const better = rows.filter(r => r.placement < placement)
        eliminatedById = pick(better).s.user.id
      }
      return { userId: s.user.id, deckId: s.deck.id, placement, isWinner: placement === 1, eliminatedById }
    })
    await prisma.game.create({
      data: { playedAt, notes: pick(NOTES), createdByUserId: seated[0].user.id, players: { create: data } },
    })
    made++
  }

  console.log(`Seed completato: 1 admin + ${players.length} giocatori, ${players.length} mazzi, ${made} partite.`)
  console.log('Credenziali: admin/test e ogni giocatore con password "test".')
}

main().catch(e => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
