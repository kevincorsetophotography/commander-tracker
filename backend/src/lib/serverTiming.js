// Misura dei tempi per richiesta: tempo totale nel server e tempo passato nelle query
// Prisma (somma + numero). Esposto nell'header Server-Timing (visibile in DevTools →
// Network → Timing) e, per le richieste lente, in una riga di log su Railway.
const { AsyncLocalStorage } = require('node:async_hooks');

const store = new AsyncLocalStorage();
const SLOW_MS = Number(process.env.SLOW_REQUEST_MS) || 300;

function attachPrisma(prisma) {
  prisma.$use(async (params, next) => {
    const ctx = store.getStore();
    if (!ctx) return next(params);
    const t = process.hrtime.bigint();
    try { return await next(params); }
    finally { ctx.db += Number(process.hrtime.bigint() - t) / 1e6; ctx.queries += 1; }
  });
}

function middleware(req, res, next) {
  const ctx = { start: process.hrtime.bigint(), db: 0, queries: 0 };
  const writeHead = res.writeHead;
  res.writeHead = function (...args) {
    const total = Number(process.hrtime.bigint() - ctx.start) / 1e6;
    if (!res.headersSent) {
      res.setHeader('Server-Timing', `app;dur=${total.toFixed(1)}, db;dur=${ctx.db.toFixed(1)};desc="${ctx.queries} query"`);
    }
    if (total >= SLOW_MS) {
      console.log(`[slow] ${req.method} ${req.originalUrl.split('?')[0]} ${res.statusCode} total=${total.toFixed(0)}ms db=${ctx.db.toFixed(0)}ms queries=${ctx.queries}`);
    }
    return writeHead.apply(this, args);
  };
  store.run(ctx, next);
}

module.exports = { attachPrisma, middleware };
