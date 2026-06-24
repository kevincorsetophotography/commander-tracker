import { useRef, useMemo, useEffect, useState } from 'react'
import html2canvas from 'html2canvas'
import QRCode from 'qrcode'
import { useTheme } from '../hooks/useTheme'
import { seasonOf } from '../lib/seasons'

// ─── brand palette fissa (sempre dark, indipendente dal tema app) ────────────
const C = {
  bg:      '#080A1C',
  surface: '#0D1020',
  card:    '#111524',
  card2:   '#0F1322',
  border:  'rgba(86,94,150,0.28)',
  text:    '#ECEDFB',
  sub:     '#929BC4',
  muted:   '#5A6391',
  green:   '#34F08F',
  purple:  '#8B5CF6',
  gold:    '#F5C542',
  silver:  '#A8B2CC',
  bronze:  '#C87F4A',
  gradGP:  'linear-gradient(135deg, #34F08F 0%, #8B5CF6 100%)',
  gradGold:'linear-gradient(135deg, #2C2000 0%, #1A1500 100%)',
  gradPurp:'linear-gradient(135deg, rgba(139,92,246,0.18) 0%, rgba(139,92,246,0.05) 100%)',
}

// ─── dimensioni slide ─────────────────────────────────────────────────────────
const W = 360   // DOM width px
const H = 450   // DOM height px → 1080×1350 con scale:3 (Instagram 4:5)
const SCALE = 3

// ─── helpers ─────────────────────────────────────────────────────────────────
const SCRYFALL_ART = (n) => `https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(n)}&format=image&version=art_crop`

function blobToDataUrl(blob) {
  return new Promise(r => { const x = new FileReader(); x.onload = () => r(x.result); x.readAsDataURL(blob) })
}
async function fetchDataUrl(url) {
  const r = await fetch(url, { mode: 'cors' }); return blobToDataUrl(await r.blob())
}
function hue(s = '') { return [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) & 0xffffff, 0) % 360 }

function computeSeasonData(games, seasonKey) {
  const sg = games.filter(g => seasonOf(g.playedAt).key === seasonKey)
  const dk = {}, kk = {}
  for (const g of sg) {
    for (const p of g.players) {
      if (!dk[p.deck.id]) dk[p.deck.id] = { id: p.deck.id, name: p.deck.name, commander: p.deck.commander, owner: p.user.username, games: 0, wins: 0 }
      dk[p.deck.id].games++; if (p.isWinner) dk[p.deck.id].wins++
      if (p.eliminatedById) {
        const killer = g.players.find(x => x.user.id === p.eliminatedById)
        if (killer) kk[killer.user.username] = (kk[killer.user.username] || 0) + 1
      }
    }
  }
  const spotlightDeck = Object.values(dk).filter(d => d.games >= 3).map(d => ({ ...d, winRate: Math.round(d.wins / d.games * 100) })).sort((a, b) => b.winRate - a.winRate || b.wins - a.wins)[0] || null
  const sorted = [...sg].sort((a, b) => new Date(a.playedAt) - new Date(b.playedAt))
  const sm = {}
  for (const g of sorted) for (const p of g.players) {
    if (!sm[p.user.id]) sm[p.user.id] = { username: p.user.username, cur: 0, best: 0 }
    const r = sm[p.user.id]; if (p.isWinner) { r.cur++; r.best = Math.max(r.best, r.cur) } else r.cur = 0
  }
  const topStreak  = Object.values(sm).sort((a, b) => b.best - a.best)[0] || null
  const topKiller  = Object.entries(kk).sort((a, b) => b[1] - a[1])[0] || null
  const deckCount  = Object.keys(dk).length
  const uniquePlayers = new Set(sg.flatMap(g => g.players.map(p => p.user.id))).size
  return { seasonGames: sg, spotlightDeck, topStreak, topKiller, deckCount, uniquePlayers }
}

// ─── sub-componente avatar ────────────────────────────────────────────────────
function Avatar({ src, name, size, ring }) {
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, border: `2px solid ${ring || C.border}`, background: `hsl(${hue(name)},50%,30%)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {src
        ? <img src={src} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 15%' }} />
        : <span style={{ fontSize: size * 0.36, fontWeight: 800, color: '#fff' }}>{(name || '?').slice(0, 2).toUpperCase()}</span>
      }
    </div>
  )
}

// ─── sub-componente header comune ─────────────────────────────────────────────
function SlideHeader({ seasonLabel, accentColor = C.green }) {
  return (
    <>
      <div style={{ height: 4, background: C.gradGP }} />
      <div style={{ padding: '11px 18px 9px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${C.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <img src="/logo.png" alt="logo" style={{ width: 22, height: 22, objectFit: 'contain' }} />
          <div>
            <div style={{ fontSize: 8, fontWeight: 900, color: accentColor, letterSpacing: '0.15em', textTransform: 'uppercase', lineHeight: 1 }}>Commanderone</div>
            <div style={{ fontSize: 6.5, color: C.muted, letterSpacing: '0.08em', marginTop: 1 }}>Villastellone</div>
          </div>
        </div>
        <div style={{ fontSize: 7, color: C.muted, fontWeight: 600, letterSpacing: '0.06em' }}>{seasonLabel}</div>
      </div>
    </>
  )
}

// ─── SLIDE 1 — Chi ha dominato? ───────────────────────────────────────────────
function Slide1({ champion, second, third, seasonLabel, imgUrls, total, uniquePlayers, deckCount }) {
  return (
    <div style={{ width: W, height: H, background: C.bg, display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <SlideHeader seasonLabel={seasonLabel} accentColor={C.gold} />

      {/* Title */}
      <div style={{ padding: '14px 18px 10px' }}>
        <div style={{ fontSize: 8, fontWeight: 700, color: C.gold, textTransform: 'uppercase', letterSpacing: '0.2em', marginBottom: 4 }}>Chi ha dominato?</div>
        <div style={{ fontSize: 19, fontWeight: 900, color: C.text, lineHeight: 1.1 }}>{seasonLabel}</div>
      </div>

      {/* Champion */}
      {champion && (
        <div style={{ margin: '0 14px', borderRadius: 16, overflow: 'hidden', background: C.gradGold, border: `1px solid ${C.gold}55` }}>
          <div style={{ padding: '8px 16px 4px', fontSize: 7, fontWeight: 800, color: C.gold, letterSpacing: '0.2em', textTransform: 'uppercase' }}>🏆 Campione Stagionale</div>
          <div style={{ padding: '6px 16px 14px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <Avatar src={imgUrls[`player_${champion.id}`]} name={champion.username} size={60} ring={C.gold} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 24, fontWeight: 900, color: C.text, lineHeight: 1 }}>{champion.username}</div>
              <div style={{ fontSize: 10, color: C.sub, marginTop: 5 }}>{champion.wins} vittorie · {champion.games ? Math.round(champion.wins / champion.games * 100) : 0}% win rate</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 40, fontWeight: 900, color: C.gold, lineHeight: 1 }}>{champion.points}</div>
              <div style={{ fontSize: 7, color: C.sub, textTransform: 'uppercase', letterSpacing: '0.08em' }}>punti</div>
            </div>
          </div>
        </div>
      )}

      {/* Podio 2°/3° */}
      <div style={{ display: 'flex', gap: 10, margin: '10px 14px 0' }}>
        {[{ p: second, col: C.silver, medal: '🥈', pos: '2° Posto' }, { p: third, col: C.bronze, medal: '🥉', pos: '3° Posto' }].map(({ p, col, medal, pos }) => p && (
          <div key={p.id} style={{ flex: 1, borderRadius: 12, padding: '10px 12px', background: C.card, border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Avatar src={imgUrls[`player_${p.id}`]} name={p.username} size={38} ring={col} />
            <div>
              <div style={{ fontSize: 7, fontWeight: 700, color: col, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{medal} {pos}</div>
              <div style={{ fontSize: 13, fontWeight: 800, color: C.text }}>{p.username}</div>
              <div style={{ fontSize: 9, color: C.sub }}>{p.points} pt · {p.wins} vitt.</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ flex: 1 }} />

      {/* Footer stat bar */}
      <div style={{ borderTop: `1px solid ${C.border}`, padding: '10px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 20 }}>
          {[{ v: total, l: 'partite' }, { v: uniquePlayers, l: 'giocatori' }, { v: deckCount, l: 'deck' }].map(({ v, l }) => (
            <div key={l} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 900, color: C.text, lineHeight: 1 }}>{v}</div>
              <div style={{ fontSize: 7, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 2 }}>{l}</div>
            </div>
          ))}
        </div>
        <img src="/logo.png" alt="" style={{ width: 28, height: 28, objectFit: 'contain', opacity: 0.6 }} />
      </div>
    </div>
  )
}

// ─── SLIDE 2 — La stagione in numeri ─────────────────────────────────────────
function Slide2({ seasonLabel, total, uniquePlayers, topStreak, topKiller, bestWinRate, mostGames, deckCount }) {
  const rows = [
    topKiller   && { icon: '⚔️', label: 'Eliminazioni record', value: `${topKiller[1]}  (${topKiller[0]})` },
    bestWinRate && { icon: '📈', label: 'Miglior win rate', value: `${bestWinRate.games ? Math.round(bestWinRate.wins / bestWinRate.games * 100) : 0}%  (${bestWinRate.username})` },
    mostGames   && { icon: '🎮', label: 'Più partite giocate', value: `${mostGames.games}  (${mostGames.username})` },
    { icon: '🃏', label: 'Deck registrati', value: `${deckCount}` },
  ].filter(Boolean)

  return (
    <div style={{ width: W, height: H, background: C.bg, display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <SlideHeader seasonLabel={seasonLabel} accentColor={C.green} />

      {/* Title */}
      <div style={{ padding: '14px 18px 12px' }}>
        <div style={{ fontSize: 8, fontWeight: 700, color: C.green, textTransform: 'uppercase', letterSpacing: '0.2em', marginBottom: 4 }}>La stagione in numeri</div>
        <div style={{ fontSize: 19, fontWeight: 900, color: C.text, lineHeight: 1.1 }}>{seasonLabel}</div>
      </div>

      {/* Big numbers 2-col */}
      <div style={{ display: 'flex', gap: 10, padding: '0 14px' }}>
        {[{ v: total, l: 'Partite Disputate' }, { v: uniquePlayers, l: 'Giocatori Attivi' }].map(({ v, l }) => (
          <div key={l} style={{ flex: 1, borderRadius: 14, padding: '14px 12px', textAlign: 'center', background: C.card, border: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 36, fontWeight: 900, color: C.text, lineHeight: 1 }}>{v}</div>
            <div style={{ fontSize: 7.5, color: C.muted, marginTop: 5, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{l}</div>
          </div>
        ))}
      </div>

      {/* Streak feature */}
      {topStreak?.best > 1 && (
        <div style={{ margin: '10px 14px 0', borderRadius: 14, padding: '12px 16px', background: `linear-gradient(135deg, ${C.gold}20, ${C.gold}08)`, border: `1px solid ${C.gold}40`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 7.5, fontWeight: 800, color: C.gold, textTransform: 'uppercase', letterSpacing: '0.18em', marginBottom: 3 }}>🔥 Streak Record</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: C.text }}>{topStreak.username}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 38, fontWeight: 900, color: C.gold, lineHeight: 1 }}>{topStreak.best}</div>
            <div style={{ fontSize: 7, color: C.sub }}>vittorie di fila</div>
          </div>
        </div>
      )}

      {/* Stat rows */}
      <div style={{ margin: '10px 14px 0', borderRadius: 14, padding: '4px 14px', background: C.card, border: `1px solid ${C.border}` }}>
        {rows.map(({ icon, label, value }, i) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 0', borderBottom: i < rows.length - 1 ? `1px solid ${C.border}` : 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, lineHeight: 1 }}>{icon}</span>
              <span style={{ fontSize: 10, color: C.sub }}>{label}</span>
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, color: C.text }}>{value}</span>
          </div>
        ))}
      </div>

      <div style={{ flex: 1 }} />

      <div style={{ borderTop: `1px solid ${C.border}`, padding: '8px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 8, color: C.muted }}>commanderone.app</div>
        <img src="/logo.png" alt="" style={{ width: 24, height: 24, objectFit: 'contain', opacity: 0.5 }} />
      </div>
    </div>
  )
}

// ─── SLIDE 3 — Hall of Fame ───────────────────────────────────────────────────
function Slide3({ seasonLabel, mostWins, mostGames, topKiller, bestWinRate, topStreak, spotlightDeck, qrDataUrl }) {
  const awards = [
    mostWins      && { icon: '🏆', label: 'Più vittorie', winner: mostWins.username },
    mostGames     && { icon: '🎮', label: 'Più presente', winner: `${mostGames.username} (${mostGames.games} gg)` },
    bestWinRate   && { icon: '📈', label: 'Miglior win rate', winner: `${bestWinRate.username} (${bestWinRate.games ? Math.round(bestWinRate.wins/bestWinRate.games*100) : 0}%)` },
    topKiller     && { icon: '⚔️', label: 'Più spietato', winner: `${topKiller[0]} (${topKiller[1]} kill)` },
    topStreak?.best > 1 && { icon: '🔥', label: 'Streak record', winner: `${topStreak.username} (${topStreak.best})` },
    spotlightDeck && { icon: '🃏', label: 'Deck della stagione', winner: spotlightDeck.name },
  ].filter(Boolean)

  return (
    <div style={{ width: W, height: H, background: C.bg, display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <SlideHeader seasonLabel={seasonLabel} accentColor={C.purple} />

      {/* Title */}
      <div style={{ padding: '14px 18px 10px' }}>
        <div style={{ fontSize: 8, fontWeight: 700, color: C.purple, textTransform: 'uppercase', letterSpacing: '0.2em', marginBottom: 4 }}>Hall of Fame</div>
        <div style={{ fontSize: 19, fontWeight: 900, color: C.text, lineHeight: 1.1 }}>{seasonLabel}</div>
      </div>

      {/* Awards */}
      <div style={{ margin: '0 14px', borderRadius: 14, padding: '4px 16px', background: C.card, border: `1px solid ${C.border}` }}>
        {awards.map(({ icon, label, winner }, i) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: i < awards.length - 1 ? `1px solid ${C.border}` : 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, lineHeight: 1, width: 18, textAlign: 'center' }}>{icon}</span>
              <span style={{ fontSize: 9.5, color: C.sub }}>{label}</span>
            </div>
            <span style={{ fontSize: 10.5, fontWeight: 800, color: C.text }}>{winner}</span>
          </div>
        ))}
      </div>

      <div style={{ flex: 1 }} />

      {/* Thank you */}
      <div style={{ padding: '0 18px 10px', textAlign: 'center' }}>
        <div style={{ fontSize: 10.5, color: C.sub, fontStyle: 'italic', lineHeight: 1.6 }}>
          Grazie a tutti i giocatori della stagione!
        </div>
        <div style={{ fontSize: 9, color: C.muted, marginTop: 4 }}>La prossima stagione è già iniziata 🐸</div>
      </div>

      {/* QR + brand footer */}
      <div style={{ borderTop: `1px solid ${C.border}`, padding: '10px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src="/logo.png" alt="logo" style={{ width: 28, height: 28, objectFit: 'contain' }} />
          <div>
            <div style={{ fontSize: 9, fontWeight: 900, color: C.green, letterSpacing: '0.1em' }}>commanderone.app</div>
            <div style={{ fontSize: 7, color: C.muted, marginTop: 1 }}>Scansiona per il portale</div>
          </div>
        </div>
        {qrDataUrl && (
          <img src={qrDataUrl} alt="QR" style={{ width: 52, height: 52, borderRadius: 8, imageRendering: 'pixelated' }} />
        )}
      </div>
    </div>
  )
}

// ─── MODAL wrapper ────────────────────────────────────────────────────────────
export default function SeasonRecap({ season, seasonKey, seasons, games, playerStats, onClose }) {
  const { t } = useTheme()
  const refs = [useRef(null), useRef(null), useRef(null)]
  const [imgUrls, setImgUrls]   = useState({})
  const [qrDataUrl, setQrDataUrl] = useState(null)
  const [loading, setLoading]   = useState(true)
  const [dlState, setDlState]   = useState(null) // null | 'all' | 0 | 1 | 2

  const seasonMeta = seasons.find(s => s.key === seasonKey)
  const seasonLabel = seasonMeta?.label || seasonKey

  const { seasonGames, spotlightDeck, topStreak, topKiller, deckCount, uniquePlayers } =
    useMemo(() => computeSeasonData(games, seasonKey), [games, seasonKey])

  const top3        = season.standings.filter(s => s.qualified).slice(0, 3)
  const statsMap    = useMemo(() => Object.fromEntries((playerStats || []).map(p => [p.id, p])), [playerStats])
  const mostWins    = useMemo(() => [...season.standings].sort((a, b) => b.wins - a.wins)[0] || null, [season])
  const mostGames   = useMemo(() => [...season.standings].sort((a, b) => b.games - a.games)[0] || null, [season])
  const bestWinRate = useMemo(() => season.standings.filter(s => s.games >= 3).sort((a, b) => (b.wins/b.games) - (a.wins/a.games))[0] || null, [season])

  // Pre-carica immagini come data URL + genera QR
  useEffect(() => {
    setLoading(true); setImgUrls({}); setQrDataUrl(null)
    const toLoad = {}
    for (const s of top3) {
      const ps = statsMap[s.id]
      if (ps?.avatarCardName) toLoad[`player_${s.id}`] = SCRYFALL_ART(ps.avatarCardName)
    }
    if (spotlightDeck?.commander) toLoad.deck = SCRYFALL_ART(spotlightDeck.commander)

    Promise.allSettled([
      // immagini
      Promise.allSettled(
        Object.entries(toLoad).map(([k, url]) => fetchDataUrl(url).then(du => [k, du]).catch(() => [k, null]))
      ).then(results => {
        const loaded = {}
        for (const r of results) if (r.status === 'fulfilled' && r.value[1]) loaded[r.value[0]] = r.value[1]
        setImgUrls(loaded)
      }),
      // QR code
      QRCode.toDataURL(window.location.origin, { width: 160, margin: 2, color: { dark: '#ECEDFB', light: '#0D1020' } })
        .then(du => setQrDataUrl(du)).catch(() => {}),
    ]).finally(() => setLoading(false))
  }, [seasonKey])

  async function capture(idx) {
    if (!refs[idx].current) return
    const canvas = await html2canvas(refs[idx].current, { scale: SCALE, backgroundColor: C.bg, useCORS: false, logging: false, imageTimeout: 0 })
    const link = document.createElement('a')
    link.download = `commanderone-${seasonKey}-slide-${idx + 1}.png`
    link.href = canvas.toDataURL('image/png')
    document.body.appendChild(link); link.click(); document.body.removeChild(link)
  }

  async function downloadOne(idx) {
    setDlState(idx); try { await capture(idx) } finally { setDlState(null) }
  }

  async function downloadAll() {
    setDlState('all')
    try {
      for (let i = 0; i < 3; i++) {
        await capture(i)
        if (i < 2) await new Promise(r => setTimeout(r, 500))
      }
    } finally { setDlState(null) }
  }

  const s1 = { champion: top3[0], second: top3[1], third: top3[2], seasonLabel, imgUrls, total: seasonGames.length, uniquePlayers, deckCount }
  const s2 = { seasonLabel, total: seasonGames.length, uniquePlayers, topStreak, topKiller, bestWinRate, mostGames, deckCount }
  const s3 = { seasonLabel, mostWins, mostGames, topKiller, bestWinRate, topStreak, spotlightDeck, qrDataUrl }

  const busy = dlState !== null || loading

  const slideLabels = [
    { label: '📊 Slide 1 — Chi ha dominato', sub: 'Podio + campione' },
    { label: '📈 Slide 2 — La stagione in numeri', sub: 'Stats chiave' },
    { label: '🏅 Slide 3 — Hall of Fame', sub: 'Premi + QR' },
  ]

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(6px)', overflowY: 'auto', padding: '16px 12px 40px' }}>
      <div onClick={e => e.stopPropagation()} className="ct-modal-in" style={{ maxWidth: 420, margin: '0 auto' }}>

        {/* Barra azioni */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 900, color: t.text }}>Carousel Instagram</div>
            <div style={{ fontSize: 10, color: t.textMuted, marginTop: 2 }}>3 slide · {W * SCALE}×{H * SCALE}px · formato 4:5</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={downloadAll}
              disabled={busy}
              style={{ padding: '8px 14px', borderRadius: 20, border: 'none', background: busy ? t.bgMuted : t.primary, color: busy ? t.textMuted : '#04111A', fontWeight: 800, fontSize: 12, cursor: busy ? 'default' : 'pointer' }}
            >
              {dlState === 'all' ? '⏳ Download…' : loading ? '⏳ Caricamento…' : '⬇ Scarica Tutte'}
            </button>
            <button onClick={onClose} style={{ width: 36, height: 36, borderRadius: '50%', border: `1px solid ${t.border}`, background: t.bgSurface, color: t.text, fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
          </div>
        </div>

        {/* 3 slide stacked */}
        {[
          { comp: <Slide1 {...s1} />, idx: 0 },
          { comp: <Slide2 {...s2} />, idx: 1 },
          { comp: <Slide3 {...s3} />, idx: 2 },
        ].map(({ comp, idx }) => (
          <div key={idx} style={{ marginBottom: 20 }}>
            {/* slide label + download button */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: t.text }}>{slideLabels[idx].label}</div>
                <div style={{ fontSize: 10, color: t.textMuted }}>{slideLabels[idx].sub}</div>
              </div>
              <button
                onClick={() => downloadOne(idx)}
                disabled={busy}
                style={{ padding: '6px 12px', borderRadius: 16, border: `1px solid ${t.primaryBorder}`, background: t.primaryBg, color: t.primary, fontWeight: 700, fontSize: 11, cursor: busy ? 'default' : 'pointer' }}
              >
                {dlState === idx ? '⏳…' : '⬇ PNG'}
              </button>
            </div>
            {/* slide preview — scrollabile se più larga del viewport */}
            <div style={{ overflowX: 'auto', borderRadius: 14, boxShadow: '0 8px 32px rgba(0,0,0,0.6)' }}>
              <div ref={refs[idx]} style={{ display: 'inline-block' }}>
                {comp}
              </div>
            </div>
          </div>
        ))}

        <p style={{ textAlign: 'center', fontSize: 10, color: t.textMuted, marginTop: 4 }}>Tocca fuori per chiudere</p>
      </div>
    </div>
  )
}
