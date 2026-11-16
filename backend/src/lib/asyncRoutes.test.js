import { describe, it, expect, afterAll, beforeAll, vi } from 'vitest'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const express = require('express')
const { asyncHandler, wrapRouter, errorHandler } = require('./asyncRoutes')

let server, base
const unhandled = vi.fn()

beforeAll(async () => {
  process.on('unhandledRejection', unhandled)
  const router = express.Router()
  router.use(async (req, res, next) => { if (req.query.mwfail) throw new Error('middleware boom'); next() })
  router.get('/async-boom', async () => { throw new Error('async boom') })
  router.get('/sync-boom', () => { throw new Error('sync boom') })
  router.get('/later-boom', async () => { await new Promise(r => setTimeout(r, 5)); throw new Error('later boom') })
  router.get('/ok', async (req, res) => res.json({ ok: true }))
  router.post('/ok', async (req, res) => res.json({ ok: true }))
  const nested = express.Router()
  nested.get('/boom', async () => { throw new Error('nested boom') })
  router.use('/nested', nested)

  const app = express()
  app.use(express.json())
  app.use('/api', wrapRouter(router))
  app.use(errorHandler)
  await new Promise(r => { server = app.listen(0, r) })
  base = `http://127.0.0.1:${server.address().port}/api`
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterAll(() => {
  server?.close()
  process.off('unhandledRejection', unhandled)
  vi.restoreAllMocks()
})

describe('asyncRoutes', () => {
  it('un errore in un handler async risponde 500 JSON senza stack e il server resta su', async () => {
    for (const path of ['/async-boom', '/later-boom', '/sync-boom', '/nested/boom', '/ok?mwfail=1']) {
      const res = await fetch(base + path)
      expect(res.status, path).toBe(500)
      const body = await res.json()
      expect(body).toEqual({ error: 'Errore interno del server' })
      expect(JSON.stringify(body)).not.toMatch(/boom|at /)
    }
    const ok = await fetch(base + '/ok')
    expect(ok.status).toBe(200)
    expect(await ok.json()).toEqual({ ok: true })
    expect(unhandled).not.toHaveBeenCalled()
  })

  it('JSON malformato → 400', async () => {
    const res = await fetch(base + '/ok', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{nope' })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'JSON non valido' })
  })

  it('preserva gli error handler a 4 argomenti e non avvolge due volte', () => {
    const errMw = (err, req, res, next) => next(err)
    expect(asyncHandler(errMw)).toBe(errMw)
    const w = asyncHandler(async () => {})
    expect(w.length).toBe(3)
    expect(asyncHandler(w)).toBe(w)
  })
})
