// Segnapunti a schermo intero ("life counter") — regole pure di layout e gesti (testate in lifeCounter.test.js).
//
// Il telefono sta al centro del tavolo, in verticale. Ogni giocatore ha un pannello ruotato verso
// il lato del telefono da cui siede. Rotazioni in gradi (senso orario, come CSS rotate()):
//    0 = legge dal lato in basso   180 = dal lato in alto
//   90 = dal lato sinistro         -90 = dal lato destro
// I posti seguono l'ordine di seduta in senso orario attorno al telefono.

export const GAP = 4

// Pannelli in pixel per n giocatori (3-5; 1-2 ripiegano su colonne semplici) in un'area W×H.
// Restituisce { panels: [{ x, y, w, h, rot }], center: { x, y } } — panels[i] è il posto i.
export function layoutFor(n, W, H, g = GAP) {
  const half = (W - g) / 2
  const colL = (y, h, rot = 90) => ({ x: 0, y, w: half, h, rot })
  const colR = (y, h, rot = -90) => ({ x: half + g, y, w: half, h, rot })

  if (n === 3) {
    // uno largo in alto (capotavola) + due ai lati lunghi
    const topH = Math.round(H * 0.38)
    const bh = H - topH - g
    return {
      panels: [{ x: 0, y: 0, w: W, h: topH, rot: 180 }, colR(topH + g, bh), colL(topH + g, bh)],
      center: { x: W / 2, y: topH + g / 2 },
    }
  }
  if (n === 5) {
    // due colonne da due + uno largo in fondo
    const botH = Math.round(H * 0.27)
    const gridH = H - botH - g
    const rh = (gridH - g) / 2
    return {
      panels: [colL(0, rh), colR(0, rh), colR(rh + g, rh), { x: 0, y: gridH + g, w: W, h: botH, rot: 0 }, colL(rh + g, rh)],
      center: { x: W / 2, y: rh + g / 2 },
    }
  }
  if (n === 4) {
    const rh = (H - g) / 2
    return {
      panels: [colL(0, rh), colR(0, rh), colR(rh + g, rh), colL(rh + g, rh)],
      center: { x: W / 2, y: H / 2 },
    }
  }
  if (n === 2) {
    const rh = (H - g) / 2
    return { panels: [{ x: 0, y: 0, w: W, h: rh, rot: 180 }, { x: 0, y: rh + g, w: W, h: rh, rot: 0 }], center: { x: W / 2, y: H / 2 } }
  }
  return { panels: n === 1 ? [{ x: 0, y: 0, w: W, h: H, rot: 0 }] : [], center: { x: W / 2, y: H / 2 } }
}

// Dimensioni del contenuto ruotato (larghezza/altezza "dal punto di vista" del giocatore)
export const localSize = (p) => (Math.abs(p.rot) === 90 ? { w: p.h, h: p.w } : { w: p.w, h: p.h })

// Spostamento sullo schermo (dx, dy) → spostamento nel riferimento del pannello ruotato
export function toLocal(dx, dy, rot) {
  const r = (rot * Math.PI) / 180
  const c = Math.round(Math.cos(r)), s = Math.round(Math.sin(r))
  return { x: (dx * c + dy * s) || 0, y: (-dx * s + dy * c) || 0 }
}

export const SWIPE_MIN = 36

// Swipe orizzontale nel verso del pannello: dito verso sinistra = pagina successiva (+1),
// verso destra = precedente (-1); 0 = non è uno swipe (troppo corto o troppo verticale).
export function swipeStep(dx, dy, rot, min = SWIPE_MIN) {
  const l = toLocal(dx, dy, rot)
  if (Math.abs(l.x) < min || Math.abs(l.x) < Math.abs(l.y) * 1.2) return 0
  return l.x < 0 ? 1 : -1
}

// Cosa può modificare il contatore di un giocatore: vita, veleno, danni da ciascun avversario.
export function targetsFor(userId, seatUserIds) {
  return [
    { kind: 'life' },
    { kind: 'poison' },
    ...seatUserIds.filter(id => id !== userId).map(from => ({ kind: 'cmd', from })),
  ]
}

// Pagina successiva/precedente, ciclica
export const stepIndex = (i, step, n) => (n > 0 ? (((i + step) % n) + n) % n : 0)

export function valueOf(p, target) {
  if (!p || !target) return 0
  if (target.kind === 'poison') return p.poison
  if (target.kind === 'cmd') return p.cmd?.[target.from] || 0
  return p.life
}

export function actionFor(target, userId, delta) {
  if (target.kind === 'poison') return { type: 'poison', userId, delta }
  if (target.kind === 'cmd') return { type: 'cmd', userId, fromUserId: target.from, delta }
  return { type: 'life', userId, delta }
}

const signed = (n) => (n > 0 ? `+${n}` : `−${Math.abs(n)}`)

// Descrizione breve di una voce dello storico (per "Annulla ultima azione")
export function describeEntry(e, nameOf) {
  if (!e) return ''
  const who = nameOf(e.userId)
  let what
  if (e.type === 'poison') what = `${signed(e.d.poison)} veleno a ${who}`
  else if (e.type === 'cmd') what = `${signed(e.d.cmd)} danni da ${nameOf(e.fromUserId)} a ${who}`
  else what = `${signed(e.d.life)} vita a ${who}`
  return e.by != null ? `${nameOf(e.by)}: ${what}` : what
}
