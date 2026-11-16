import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)

// Prisma finto: lib/prisma.js riusa globalThis.__prisma se presente (niente DB nei test)
const fakePrisma = { user: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() } }
globalThis.__prisma = fakePrisma
process.env.JWT_SECRET = 'test-secret-test-secret-test-secret-123456'
process.env.INVITE_CODE = 'invito'

const express = require('express')
const bcrypt = require('bcryptjs')
const authRoutes = require('./auth')
const { wrapRouter, errorHandler } = require('../lib/asyncRoutes')

let server, base, hash
const post = (path, body, raw) => fetch(base + path, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: raw ?? JSON.stringify(body),
})

beforeAll(async () => {
  hash = await bcrypt.hash('giusta', 4)
  const app = express()
  app.use(express.json())
  app.use('/api/auth', wrapRouter(authRoutes)) // montato come in index.js
  app.use(errorHandler)
  await new Promise(r => { server = app.listen(0, r) })
  base = `http://127.0.0.1:${server.address().port}/api/auth`
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterAll(() => { server?.close(); delete globalThis.__prisma; vi.restoreAllMocks() })
beforeEach(() => {
  fakePrisma.user.findUnique.mockReset()
  fakePrisma.user.create.mockReset()
})

describe('POST /api/auth/login', () => {
  it('body vuoto → 400, senza toccare il DB', async () => {
    const res = await post('/login', {})
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/richiesti/)
    expect(fakePrisma.user.findUnique).not.toHaveBeenCalled()
  })

  it('nessun body / body non JSON → 400', async () => {
    const r1 = await fetch(base + '/login', { method: 'POST' })
    expect(r1.status).toBe(400)
    const r2 = await post('/login', null, '{rotto')
    expect(r2.status).toBe(400)
  })

  it.each([
    [{ username: 123, password: 'x' }],
    [{ username: 'a', password: 42 }],
    [{ username: { contains: 'a' }, password: 'x' }],
    [{ username: ['a'], password: 'x' }],
    [{ username: 'a', password: null }],
    [{ username: '', password: '' }],
  ])('campi non stringa o vuoti → 400 (%j)', async (body) => {
    const res = await post('/login', body)
    expect(res.status).toBe(400)
    expect(fakePrisma.user.findUnique).not.toHaveBeenCalled()
  })

  it('campi troppo lunghi → 400', async () => {
    expect((await post('/login', { username: 'a'.repeat(33), password: 'x' })).status).toBe(400)
    expect((await post('/login', { username: 'a', password: 'x'.repeat(129) })).status).toBe(400)
  })

  it('utente inesistente → 401', async () => {
    fakePrisma.user.findUnique.mockResolvedValue(null)
    const res = await post('/login', { username: 'nessuno', password: 'x' })
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'Credenziali non valide' })
  })

  it('password errata → 401', async () => {
    fakePrisma.user.findUnique.mockResolvedValue({ id: 1, username: 'ramuh', password: hash, role: 'PLAYER' })
    const res = await post('/login', { username: 'ramuh', password: 'sbagliata' })
    expect(res.status).toBe(401)
  })

  it('credenziali giuste → 200 con token', async () => {
    fakePrisma.user.findUnique.mockResolvedValue({ id: 1, username: 'ramuh', password: hash, role: 'PLAYER' })
    const res = await post('/login', { username: 'ramuh', password: 'giusta' })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.token).toBeTypeOf('string')
    expect(body.user).toMatchObject({ id: 1, username: 'ramuh' })
    expect(body.user.password).toBeUndefined()
  })

  it('errore del DB → 500 generico, niente stack', async () => {
    fakePrisma.user.findUnique.mockRejectedValue(new Error('db giù: segreto interno'))
    const res = await post('/login', { username: 'ramuh', password: 'giusta' })
    expect(res.status).toBe(500)
    const text = await res.text()
    expect(text).not.toMatch(/segreto|at /)
  })
})

describe('POST /api/auth/register', () => {
  it('body vuoto o campi non stringa → 400', async () => {
    expect((await post('/register', {})).status).toBe(400)
    expect((await post('/register', { username: 1, password: 2, inviteCode: 'invito' })).status).toBe(400)
  })

  it('inviteCode non stringa → 403 (prima faceva crashare .trim())', async () => {
    const res = await post('/register', { username: 'nuovo', password: 'pw', inviteCode: 12345 })
    expect(res.status).toBe(403)
    expect(fakePrisma.user.create).not.toHaveBeenCalled()
  })

  it('username già esistente → 409', async () => {
    fakePrisma.user.create.mockRejectedValue(Object.assign(new Error('dup'), { code: 'P2002' }))
    const res = await post('/register', { username: 'ramuh', password: 'pw', inviteCode: 'invito' })
    expect(res.status).toBe(409)
  })

  it('registrazione valida → 200', async () => {
    fakePrisma.user.create.mockResolvedValue({ id: 9, username: 'nuovo', role: 'PLAYER' })
    const res = await post('/register', { username: 'nuovo', password: 'pw', inviteCode: ' invito ' })
    expect(res.status).toBe(200)
    expect((await res.json()).user.username).toBe('nuovo')
  })
})
