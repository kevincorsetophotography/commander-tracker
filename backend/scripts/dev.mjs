// Orchestratore di sviluppo locale.
// Avvia un PostgreSQL "embedded" isolato, sincronizza lo schema, semina dati di
// test se il DB è vuoto, poi lancia il backend con nodemon.
// La produzione (Railway) NON è coinvolta: usa il suo DATABASE_URL.
import 'dotenv/config'
import EmbeddedPostgres from 'embedded-postgres'
import { existsSync } from 'fs'
import { execSync, spawn } from 'child_process'

const DB_DIR = './.devdb'
const PORT = 5433
const DB_NAME = 'commanderone_dev'

const pg = new EmbeddedPostgres({
  databaseDir: DB_DIR,
  user: 'dev',
  password: 'dev',
  port: PORT,
  persistent: true,
})

let child = null
let shuttingDown = false
async function shutdown() {
  if (shuttingDown) return
  shuttingDown = true
  console.log('\n👋 Spengo l\'ambiente locale...')
  try { child?.kill() } catch {}
  try { await pg.stop() } catch {}
  process.exit(0)
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

try {
  if (!existsSync(DB_DIR)) {
    console.log('🛠  Inizializzo il database locale (solo la prima volta)...')
    await pg.initialise()
  }
  console.log(`🐘 Avvio PostgreSQL locale su :${PORT}...`)
  await pg.start()
  try { await pg.createDatabase(DB_NAME) } catch { /* esiste già */ }

  console.log('📦 Sincronizzo lo schema (prisma db push)...')
  execSync('npx prisma db push --skip-generate', { stdio: 'inherit' })

  const { PrismaClient } = await import('@prisma/client')
  const prisma = new PrismaClient()
  const userCount = await prisma.user.count()
  await prisma.$disconnect()

  if (userCount === 0) {
    console.log('🌱 Database vuoto: eseguo il seed di test...')
    execSync('node prisma/seed.mjs', { stdio: 'inherit' })
  } else {
    console.log(`✅ Database locale pronto (${userCount} utenti).`)
  }

  console.log('🚀 Avvio il backend (nodemon)...\n')
  child = spawn('npx', ['nodemon', 'src/index.js'], { stdio: 'inherit', shell: true })
  child.on('exit', () => shutdown())
} catch (e) {
  console.error('❌ Errore avvio ambiente dev:', e?.message || e)
  await shutdown()
}
