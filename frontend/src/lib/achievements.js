// Calcola gli achievement di un giocatore dai dati già disponibili (nessuna chiamata extra).
export function getAchievements({ myGames, myDecks, pid }) {
  const total = myGames.length
  const wins = myGames.filter(g => g.players.find(p => p.user.id === pid)?.isWinner).length

  // streak migliore (cronologico)
  const chrono = [...myGames].sort((a, b) => new Date(a.playedAt) - new Date(b.playedAt))
  let cur = 0, best = 0
  for (const g of chrono) {
    if (g.players.find(p => p.user.id === pid)?.isWinner) { cur++; best = Math.max(best, cur) }
    else cur = 0
  }

  // colori con cui ha VINTO
  const wonColors = new Set()
  for (const g of myGames) {
    const me = g.players.find(p => p.user.id === pid)
    if (me?.isWinner) (me.deck.colors || '').split('').forEach(c => wonColors.add(c))
  }

  // piazzamento medio (partite con placement)
  const placed = myGames.filter(g => g.players.find(p => p.user.id === pid)?.placement != null)
  const avgPlacement = placed.length
    ? placed.reduce((s, g) => s + g.players.find(p => p.user.id === pid).placement, 0) / placed.length
    : null

  const winRate = total ? Math.round(wins / total * 100) : 0
  const deckCount = myDecks.length

  const defs = [
    { id: 'first_win',  icon: '🏆', title: 'Prima vittoria',  desc: 'Vinci almeno una partita',                 unlocked: wins >= 1 },
    { id: 'rookie',     icon: '🃏', title: 'Esordiente',       desc: 'Gioca la tua prima partita',               unlocked: total >= 1 },
    { id: 'streak3',    icon: '🔥', title: 'Sul fuoco',        desc: '3 vittorie consecutive',                    unlocked: best >= 3 },
    { id: 'streak5',    icon: '💎', title: 'Implacabile',      desc: '5 vittorie consecutive',                    unlocked: best >= 5 },
    { id: 'collector',  icon: '🎴', title: 'Collezionista',    desc: 'Possiedi 3 o più mazzi',                    unlocked: deckCount >= 3 },
    { id: 'rainbow',    icon: '🌈', title: 'Arcobaleno',       desc: 'Vinci con mazzi di tutti e 5 i colori',     unlocked: ['W','U','B','R','G'].every(c => wonColors.has(c)) },
    { id: 'survivor',   icon: '🛡️', title: 'Sopravvissuto',    desc: 'Piazzamento medio ≤ 2 (min 3 partite)',     unlocked: placed.length >= 3 && avgPlacement != null && avgPlacement <= 2 },
    { id: 'veteran',    icon: '⚔️', title: 'Veterano',         desc: 'Gioca 20 partite',                          unlocked: total >= 20 },
    { id: 'dominator',  icon: '👑', title: 'Dominatore',       desc: 'Win rate ≥ 40% (min 10 partite)',           unlocked: total >= 10 && winRate >= 40 },
  ]

  return defs
}
