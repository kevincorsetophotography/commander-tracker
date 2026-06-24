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

  const now = Date.now()
  const fiveMonths = 5 * 30 * 24 * 60 * 60 * 1000
  let made = 0

  // winner: elemento di `seated` che vince (null = random)
  const createGame = async (playedAt, seated, winner = null) => {
    // Costruisco ordine: winner è sempre placement=1, gli altri shufflati dopo
    let ordered
    if (winner) {
      const rest = shuffle(seated.filter(s => s !== winner))
      ordered = [winner, ...rest]
    } else {
      ordered = shuffle(seated)
    }
    const data = ordered.map((s, i) => {
      const placement = i + 1
      let eliminatedById = null
      if (placement > 1) {
        const better = ordered.slice(0, i)
        eliminatedById = pick(better).user.id
      }
      return { userId: s.user.id, deckId: s.deck.id, placement, isWinner: placement === 1, eliminatedById }
    })
    await prisma.game.create({
      data: { playedAt, notes: pick(NOTES), createdByUserId: seated[0].user.id, players: { create: data } },
    })
    made++
  }

  // ~28 partite negli ultimi ~5 mesi (copre 2 stagioni)
  for (let g = 0; g < 28; g++) {
    const size = pick([3, 4, 4, 4, 5])
    const seated = shuffle(players).slice(0, size)
    const playedAt = new Date(now - Math.random() * fiveMonths)
    await createGame(playedAt, seated)
  }

  // 6 partite recenti (ultimi 7 giorni) → attiva Deck Spotlight e WeeklyActivity
  // Ramuh (The Ur-Dragon) vince 4 su 6 per essere in spotlight
  const ramuh   = players[0]  // The Ur-Dragon
  const shiva   = players[1]  // Atraxa
  const ifrit   = players[2]  // Gishath
  const bahamut = players[3]  // Yawgmoth
  const leviath = players[4]  // Lathril
  const titan   = players[5]  // Krenko

  const daysAgo = (d) => new Date(now - d * 86400000)

  // Giorno 7 fa — Ramuh vince
  await createGame(daysAgo(7), [ramuh, shiva, ifrit, bahamut], ramuh)
  // Giorno 5 fa — Ramuh vince
  await createGame(daysAgo(5), [ramuh, leviath, titan, ifrit], ramuh)
  // Giorno 4 fa — Shiva vince
  await createGame(daysAgo(4), [shiva, ramuh, bahamut, titan], shiva)
  // Giorno 3 fa — Ramuh vince
  await createGame(daysAgo(3), [ramuh, shiva, leviath, ifrit, bahamut], ramuh)
  // Giorno 2 fa — Titan vince
  await createGame(daysAgo(2), [titan, ramuh, shiva, bahamut], titan)
  // Giorno 1 fa — Ramuh vince
  await createGame(daysAgo(1), [ramuh, ifrit, leviath, titan], ramuh)

  console.log(`Seed completato: 1 admin + ${players.length} giocatori, ${players.length} mazzi, ${made} partite (di cui 6 recenti).`)
  console.log('Credenziali: admin/test e ogni giocatore con password "test".')
}

main().catch(e => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
