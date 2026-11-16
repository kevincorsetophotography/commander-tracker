// Rete di sicurezza per gli handler async con Express 4.
//
// Express 4 non intercetta le Promise rifiutate: se un handler `async` lancia
// (es. Prisma che rifiuta un argomento non valido) l'errore diventa una
// unhandledRejection, la richiesta resta appesa e da Node 15 in poi il
// processo termina. Qui avvolgiamo ogni handler in modo che le rejection
// finiscano in next(err) e quindi nell'error middleware finale.

// Avvolge un handler (req, res, next): errori sincroni e Promise rifiutate → next(err).
// Gli error handler a 4 argomenti NON vanno avvolti: Express li riconosce
// dall'arità (fn.length), che il wrapper deve preservare.
function asyncHandler(fn) {
  if (typeof fn !== 'function' || fn.length > 3 || fn.__asyncWrapped) return fn;
  const wrapped = function (req, res, next) {
    let result;
    try {
      result = fn.call(this, req, res, next);
    } catch (err) {
      return next(err);
    }
    if (result && typeof result.then === 'function') {
      result.then(undefined, next);
    }
    return result;
  };
  wrapped.__asyncWrapped = true;
  return wrapped;
}

// Avvolge, in place, tutti gli handler di un Router già definito:
// middleware di router.use(), handler di ogni rotta e router annidati.
function wrapRouter(router) {
  const stack = router && router.stack;
  if (!Array.isArray(stack)) return router;
  for (const layer of stack) {
    if (layer.route) {
      for (const inner of layer.route.stack) inner.handle = asyncHandler(inner.handle);
    } else if (Array.isArray(layer.handle && layer.handle.stack)) {
      wrapRouter(layer.handle); // router annidato
    } else {
      layer.handle = asyncHandler(layer.handle);
    }
  }
  return router;
}

// Error middleware finale: logga e risponde JSON senza stack.
function errorHandler(err, req, res, next) {
  // JSON malformato o body troppo grande (body-parser): errore del client
  const status = err && (err.status || err.statusCode);
  if (status >= 400 && status < 500 && err.expose && !res.headersSent) {
    const msg = err.type === 'entity.parse.failed' ? 'JSON non valido' : 'Richiesta non valida';
    return res.status(status).json({ error: msg });
  }
  console.error(`[error] ${req.method} ${req.originalUrl}:`, (err && err.stack) || err);
  // Risposta già partita: delega al gestore di default, che chiude la connessione
  if (res.headersSent) return next(err);
  res.status(500).json({ error: 'Errore interno del server' });
}

module.exports = { asyncHandler, wrapRouter, errorHandler };
