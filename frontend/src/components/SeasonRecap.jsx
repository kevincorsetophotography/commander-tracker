import { useRef, useMemo, useEffect, useState } from 'react'
import html2canvas from 'html2canvas'
import QRCode from 'qrcode'
import { useTheme } from '../hooks/useTheme'
import { seasonOf } from '../lib/seasons'

// ── palette brand (sempre dark, indipendente dal tema app) ────────────────────
const C = {
  bg:      '#07080F',
  card:    '#0C0E1C',
  text:    '#FFFFFF',
  sub:     '#8A97B8',
  muted:   '#4A5475',
  green:   '#34F08F',
  purple:  '#8B5CF6',
  gold:    '#F5C542',
  silver:  '#9BAEC8',
  bronze:  '#C47D42',
  glowG:   '0 0 28px rgba(52,240,143,0.62), 0 0 60px rgba(52,240,143,0.22)',
}

const W = 360, H = 450, SCALE = 3

// ── helpers ───────────────────────────────────────────────────────────────────
const SCRYFALL_ART = n =>
  `https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(n)}&format=image&version=art_crop`

const b64 = blob => new Promise(r => { const x = new FileReader(); x.onload = () => r(x.result); x.readAsDataURL(blob) })
const fetchDU = async url => { try { const r = await fetch(url, { mode: 'cors' }); return b64(await r.blob()) } catch { return null } }
const hue = (s = '') => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) & 0xffffff, 0) % 360

// ── data ──────────────────────────────────────────────────────────────────────
function computeSeasonData(games, seasonKey) {
  const sg = games.filter(g => seasonOf(g.playedAt).key === seasonKey)
  const dk = {}, kk = {}
  let totalKills = 0
  for (const g of sg) {
    for (const p of g.players) {
      if (!dk[p.deck.id]) dk[p.deck.id] = { id: p.deck.id, name: p.deck.name, commander: p.deck.commander, games: 0, wins: 0 }
      dk[p.deck.id].games++; if (p.isWinner) dk[p.deck.id].wins++
      if (p.eliminatedById) {
        totalKills++
        const k = g.players.find(x => x.user.id === p.eliminatedById)
        if (k) kk[k.user.username] = (kk[k.user.username] || 0) + 1
      }
    }
  }
  const spotlight = Object.values(dk)
    .filter(d => d.games >= 3)
    .map(d => ({ ...d, wr: Math.round(d.wins / d.games * 100) }))
    .sort((a, b) => b.wr - a.wr || b.wins - a.wins)[0] || null

  const sorted = [...sg].sort((a, b) => new Date(a.playedAt) - new Date(b.playedAt))
  const sm = {}
  for (const g of sorted) for (const p of g.players) {
    if (!sm[p.user.id]) sm[p.user.id] = { username: p.user.username, cur: 0, best: 0 }
    const r = sm[p.user.id]; if (p.isWinner) { r.cur++; r.best = Math.max(r.best, r.cur) } else r.cur = 0
  }
  const topStreak    = Object.values(sm).sort((a, b) => b.best - a.best)[0] || null
  const topKiller    = Object.entries(kk).sort((a, b) => b[1] - a[1])[0] || null
  const deckCount    = Object.keys(dk).length
  const uniquePlayers = new Set(sg.flatMap(g => g.players.map(p => p.user.id))).size
  return { seasonGames: sg, spotlight, topStreak, topKiller, deckCount, uniquePlayers, totalKills }
}

// ── shared sub-components ─────────────────────────────────────────────────────
function Avatar({ src, name, size, ring }) {
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, border: `2px solid ${ring}`, background: `hsl(${hue(name)},44%,28%)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {src
        ? <img src={src} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 15%' }} />
        : <span style={{ fontSize: size * 0.36, fontWeight: 900, color: '#fff' }}>{(name || '?').slice(0, 2).toUpperCase()}</span>}
    </div>
  )
}

function GLine({ col = '#34F08F', op = 0.5 }) {
  const hex = Math.round(op * 255).toString(16).padStart(2, '0')
  return <div style={{ height: 1, background: `linear-gradient(90deg, transparent, ${col}${hex}, transparent)` }} />
}

function SlideHeader({ n }) {
  return (
    <div style={{ padding: '11px 16px 9px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span style={{ fontSize: 10, fontWeight: 800, color: C.green, letterSpacing: '0.05em' }}>
        {String(n).padStart(2, '0')}<span style={{ color: C.muted }}>/03</span>
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <img src="/logo.png" alt="" style={{ width: 26, height: 26, objectFit: 'contain' }} />
        <div>
          <div style={{ fontSize: 7, fontWeight: 900, color: C.green, letterSpacing: '0.18em', lineHeight: 1 }}>COMMANDERONE</div>
          <div style={{ fontSize: 5.5, color: C.muted, letterSpacing: '0.14em', marginTop: 1 }}>VILLASTELLONE</div>
        </div>
      </div>
      <div style={{ width: 50 }} />
    </div>
  )
}

// ── SLIDE 1 — Chi ha dominato? ────────────────────────────────────────────────
function Slide1({ champion, second, third, seasonLabel, imgUrls, total, uniquePlayers, deckCount }) {
  return (
    <div style={{
      width: W, height: H, overflow: 'hidden',
      background: `radial-gradient(ellipse 95% 65% at 50% 78%, rgba(139,92,246,0.32) 0%, transparent 55%), radial-gradient(ellipse 55% 45% at 10% 18%, rgba(52,240,143,0.15) 0%, transparent 50%), #07080F`,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      display: 'flex', flexDirection: 'column',
    }}>
      <SlideHeader n={1} />
      <div style={{ margin: '0 16px' }}><GLine op={0.55} /></div>

      {/* Title */}
      <div style={{ padding: '10px 16px 4px', textAlign: 'center' }}>
        <div style={{ fontSize: 8, fontWeight: 800, color: C.green, letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: 3 }}>RECAP STAGIONE</div>
        <div style={{ fontSize: 22, fontWeight: 900, color: C.text, textTransform: 'uppercase', letterSpacing: '0.04em', lineHeight: 1 }}>{seasonLabel}</div>
        <div style={{ fontSize: 7, color: C.sub, marginTop: 5, fontStyle: 'italic', letterSpacing: '0.04em' }}>La stagione è appena finita. E questa è la nostra leggenda.</div>
      </div>

      {/* Champion */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4px 16px' }}>
        {/* Crown */}
        <div style={{ fontSize: 22, lineHeight: 1, marginBottom: -8, zIndex: 1, position: 'relative', filter: 'drop-shadow(0 0 8px rgba(245,197,66,0.9))' }}>👑</div>
        {/* Glowing card */}
        <div style={{
          width: '100%', borderRadius: 14, padding: '12px 14px 14px',
          background: 'linear-gradient(160deg, rgba(52,240,143,0.07) 0%, rgba(52,240,143,0.02) 50%, rgba(139,92,246,0.06) 100%)',
          border: `2px solid ${C.green}`,
          boxShadow: C.glowG,
        }}>
          <div style={{ fontSize: 7, fontWeight: 800, color: C.green, letterSpacing: '0.28em', textTransform: 'uppercase', textAlign: 'center', marginBottom: 9 }}>CAMPIONE STAGIONALE</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Avatar src={imgUrls[`player_${champion?.id}`]} name={champion?.username || '?'} size={54} ring={C.green} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 24, fontWeight: 900, color: C.text, textTransform: 'uppercase', letterSpacing: '0.05em', lineHeight: 1 }}>{champion?.username || '—'}</div>
              <div style={{ fontSize: 8.5, color: C.sub, marginTop: 4 }}>
                {champion?.wins || 0} vittorie · {champion?.games ? Math.round(champion.wins / champion.games * 100) : 0}% win rate
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 48, fontWeight: 900, color: C.green, lineHeight: 1, textShadow: '0 0 20px rgba(52,240,143,0.7)' }}>{champion?.points ?? 0}</div>
              <div style={{ fontSize: 6.5, color: C.sub, textTransform: 'uppercase', letterSpacing: '0.14em' }}>PUNTI</div>
            </div>
          </div>
        </div>
      </div>

      {/* Podio 2°/3° */}
      <div style={{ display: 'flex', gap: 8, padding: '0 14px 8px' }}>
        {[{ p: second, col: C.silver, n: '2' }, { p: third, col: C.bronze, n: '3' }].map(({ p, col, n }) => (
          <div key={n} style={{ flex: 1, borderRadius: 10, padding: '8px 11px', background: C.card, border: `1px solid ${col}35`, display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: col, lineHeight: 1, minWidth: 18, textShadow: `0 0 10px ${col}80` }}>{n}</div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 800, color: C.text }}>{p?.username || '—'}</div>
              <div style={{ fontSize: 8, color: C.sub }}>{p?.points ?? 0} punti · {p?.wins ?? 0} vitt.</div>
            </div>
          </div>
        ))}
      </div>

      {/* Stats row */}
      <div style={{ padding: '0 16px 6px' }}>
        <GLine col={C.muted} op={0.45} />
        <div style={{ display: 'flex', justifyContent: 'space-around', padding: '8px 0 6px' }}>
          {[{ icon: '⚔️', v: total, l: 'PARTITE' }, { icon: '👥', v: uniquePlayers, l: 'GIOCATORI' }, { icon: '🃏', v: deckCount, l: 'DECK' }].map(({ icon, v, l }) => (
            <div key={l} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 15, lineHeight: 1 }}>{icon}</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: C.text, lineHeight: 1.15 }}>{v}</div>
              <div style={{ fontSize: 6.5, color: C.muted, letterSpacing: '0.14em' }}>{l}</div>
            </div>
          ))}
        </div>
        <GLine col={C.muted} op={0.3} />
      </div>

      {/* Footer text */}
      <div style={{ padding: '5px 16px 11px', textAlign: 'center', fontSize: 7.5, letterSpacing: '0.04em', color: C.sub }}>
        GRAZIE A TUTTI I GIOCATORI PER QUESTA STAGIONE <span style={{ color: C.green, fontWeight: 800 }}>INCREDIBILE</span>!
      </div>
    </div>
  )
}

// ── SLIDE 2 — La stagione in numeri ──────────────────────────────────────────
function Slide2({ total, uniquePlayers, deckCount, avgParticipation, topStreak, totalKills }) {
  const stats = [
    { icon: '⚔️', val: total,                label: 'PARTITE DISPUTATE',      col: '#34F08F' },
    { icon: '👥', val: uniquePlayers,         label: 'GIOCATORI ATTIVI',       col: '#8B5CF6' },
    { icon: '🃏', val: deckCount,              label: 'DECK REGISTRATI',        col: '#22D3EE' },
    { icon: '📈', val: `${avgParticipation}%`, label: 'PARTECIPAZIONE MEDIA',  col: '#22D3EE' },
    { icon: '🔥', val: topStreak?.best || 0,  label: 'STREAK RECORD',          col: '#FB923C' },
    { icon: '💀', val: totalKills,            label: 'ELIMINAZIONI TOTALI',    col: '#8B5CF6' },
  ]
  return (
    <div style={{
      width: W, height: H, overflow: 'hidden',
      background: `radial-gradient(ellipse 70% 55% at 85% 10%, rgba(139,92,246,0.26) 0%, transparent 55%), radial-gradient(ellipse 55% 40% at 10% 90%, rgba(52,240,143,0.09) 0%, transparent 50%), #07080F`,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      display: 'flex', flexDirection: 'column',
    }}>
      <SlideHeader n={2} />
      <div style={{ margin: '0 16px' }}><GLine op={0.55} /></div>

      {/* Title */}
      <div style={{ padding: '8px 16px 10px', textAlign: 'center' }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: C.sub, letterSpacing: '0.3em', textTransform: 'uppercase', lineHeight: 1 }}>LA STAGIONE</div>
        <div style={{ fontSize: 38, fontWeight: 900, color: C.green, letterSpacing: '0.06em', textTransform: 'uppercase', lineHeight: 1, textShadow: '0 0 32px rgba(52,240,143,0.55)' }}>IN NUMERI</div>
      </div>

      {/* 2×3 grid */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, padding: '0 12px' }}>
        {stats.map(({ icon, val, label, col }) => (
          <div key={label} style={{
            borderRadius: 10, padding: '8px 6px 10px',
            background: C.card,
            border: `1px solid ${col}28`,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3,
          }}>
            <div style={{ fontSize: 26, lineHeight: 1 }}>{icon}</div>
            <div style={{ fontSize: 32, fontWeight: 900, color: C.text, lineHeight: 1 }}>{val}</div>
            <div style={{ fontSize: 6, fontWeight: 700, color: col, letterSpacing: '0.14em', textAlign: 'center', textTransform: 'uppercase', lineHeight: 1.35 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Footer decorativo */}
      <div style={{ padding: '12px 16px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ height: 1, flex: 1, background: 'linear-gradient(90deg, transparent, rgba(52,240,143,0.5))' }} />
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 8.5, fontWeight: 900, color: C.green, letterSpacing: '0.24em' }}>COMMANDERONE</div>
          <div style={{ fontSize: 6, color: C.muted, letterSpacing: '0.18em' }}>VILLASTELLONE</div>
        </div>
        <div style={{ height: 1, flex: 1, background: 'linear-gradient(90deg, rgba(52,240,143,0.5), transparent)' }} />
      </div>
    </div>
  )
}

// ── SLIDE 3 — Hall of Fame ────────────────────────────────────────────────────
function Slide3({ mostWins, mostGames, topKiller, bestWinRate, topStreak, mostConsistent, spotlight, imgUrls, qrDataUrl }) {
  const awards = [
    { icon: '🏆', col: '#F5C542', label: 'PIÙ VITTORIE',  name: mostWins?.username || '—',      stat: `${mostWins?.wins || 0} vitt.` },
    { icon: '🎯', col: '#22D3EE', label: 'PIÙ PRESENTE',  name: mostGames?.username || '—',     stat: `${mostGames?.games || 0} gg` },
    { icon: '📈', col: '#34F08F', label: 'MIGLIOR WIN',   name: bestWinRate?.username || '—',   stat: `${bestWinRate?.games ? Math.round(bestWinRate.wins / bestWinRate.games * 100) : 0}%` },
    { icon: '⚔️', col: '#F472B6', label: 'PIÙ SPIETATO',  name: topKiller?.[0] || '—',         stat: `${topKiller?.[1] || 0} kill` },
    { icon: '🔥', col: '#FB923C', label: 'STREAK RECORD', name: topStreak?.username || '—',     stat: `${topStreak?.best || 0} wins` },
    { icon: '💎', col: '#8B5CF6', label: 'PIÙ COSTANTE',  name: mostConsistent?.username || '—', stat: `${(mostConsistent?.avg || 0).toFixed(1)} avg` },
  ]
  return (
    <div style={{
      width: W, height: H, overflow: 'hidden',
      background: `radial-gradient(ellipse 80% 55% at 50% 22%, rgba(139,92,246,0.25) 0%, transparent 55%), #07080F`,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      display: 'flex', flexDirection: 'column',
    }}>
      <SlideHeader n={3} />
      <div style={{ margin: '0 16px' }}><GLine op={0.55} /></div>

      {/* Title */}
      <div style={{ padding: '8px 16px 6px', textAlign: 'center' }}>
        <div style={{ fontSize: 28, fontWeight: 900, color: C.text, letterSpacing: '0.08em', textTransform: 'uppercase', lineHeight: 1 }}>HALL OF FAME</div>
        <div style={{ fontSize: 7.5, fontWeight: 700, color: C.green, letterSpacing: '0.22em', textTransform: 'uppercase', marginTop: 3 }}>I PROTAGONISTI DELLA STAGIONE</div>
      </div>

      {/* Awards 3×2 grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, padding: '8px 12px 6px' }}>
        {awards.map(({ icon, col, label, name, stat }) => (
          <div key={label} style={{ borderRadius: 10, padding: '8px 6px', textAlign: 'center', background: C.card, border: `1px solid ${col}28` }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: `${col}18`, border: `1.5px solid ${col}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 5px', fontSize: 14, lineHeight: 1 }}>{icon}</div>
            <div style={{ fontSize: 6, fontWeight: 800, color: col, letterSpacing: '0.14em', textTransform: 'uppercase', lineHeight: 1.2 }}>{label}</div>
            <div style={{ fontSize: 11, fontWeight: 900, color: C.text, marginTop: 2, lineHeight: 1 }}>{name}</div>
            <div style={{ fontSize: 7.5, color: C.sub, marginTop: 2 }}>{stat}</div>
          </div>
        ))}
      </div>

      {/* Deck della stagione */}
      {spotlight && (
        <div style={{ margin: '2px 12px 0', borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(52,240,143,0.4)', height: 58, position: 'relative', flexShrink: 0, boxShadow: '0 0 16px rgba(52,240,143,0.2)' }}>
          {imgUrls?.deck && <img src={imgUrls.deck} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 20%', opacity: 0.45 }} />}
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, rgba(7,8,15,0.93) 42%, rgba(7,8,15,0.35))', padding: '0 14px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ fontSize: 6.5, fontWeight: 800, color: C.green, letterSpacing: '0.22em', textTransform: 'uppercase' }}>🃏 DECK DELLA STAGIONE</div>
            <div style={{ fontSize: 14, fontWeight: 900, color: C.text, textTransform: 'uppercase', letterSpacing: '0.04em', lineHeight: 1.1 }}>{spotlight.name}</div>
          </div>
        </div>
      )}

      {/* Thank you */}
      <div style={{ textAlign: 'center', padding: '8px 16px 4px' }}>
        <div style={{ fontSize: 12, fontWeight: 900, color: C.green, fontStyle: 'italic', textShadow: '0 0 18px rgba(52,240,143,0.55)' }}>GRAZIE A TUTTA LA COMMUNITY!</div>
        <div style={{ fontSize: 7.5, color: C.sub, marginTop: 2, letterSpacing: '0.05em' }}>Ci vediamo alla prossima stagione!</div>
      </div>

      {/* Footer QR */}
      <div style={{ marginTop: 'auto', borderTop: '1px solid rgba(255,255,255,0.06)', padding: '8px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <img src="/logo.png" alt="" style={{ width: 26, height: 26, objectFit: 'contain' }} />
          <div>
            <div style={{ fontSize: 8.5, fontWeight: 900, color: C.green, letterSpacing: '0.15em' }}>COMMANDERONE</div>
            <div style={{ fontSize: 6, color: C.muted, letterSpacing: '0.14em' }}>VILLASTELLONE</div>
          </div>
        </div>
        {qrDataUrl && (
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 6.5, color: C.green, fontWeight: 700, letterSpacing: '0.1em', marginBottom: 4 }}>SCOPRI DI PIÙ SUL PORTALE</div>
            <img src={qrDataUrl} alt="QR" style={{ width: 46, height: 46, borderRadius: 6, imageRendering: 'pixelated' }} />
          </div>
        )}
      </div>
    </div>
  )
}

// ── MODAL ──────────────────────────────────────────────────────────────────────
export default function SeasonRecap({ season, seasonKey, seasons, games, playerStats, onClose }) {
  const { t } = useTheme()
  const refs = [useRef(null), useRef(null), useRef(null)]
  const [imgUrls, setImgUrls]     = useState({})
  const [qrDataUrl, setQrDataUrl] = useState(null)
  const [loading, setLoading]     = useState(true)
  const [dlState, setDlState]     = useState(null)

  const seasonLabel = seasons.find(s => s.key === seasonKey)?.label || seasonKey
  const { seasonGames, spotlight, topStreak, topKiller, deckCount, uniquePlayers, totalKills } =
    useMemo(() => computeSeasonData(games, seasonKey), [games, seasonKey])

  const top3           = season.standings.filter(s => s.qualified).slice(0, 3)
  const statsMap       = useMemo(() => Object.fromEntries((playerStats || []).map(p => [p.id, p])), [playerStats])
  const mostWins       = useMemo(() => [...season.standings].sort((a, b) => b.wins - a.wins)[0] || null, [season])
  const mostGames      = useMemo(() => [...season.standings].sort((a, b) => b.games - a.games)[0] || null, [season])
  const bestWinRate    = useMemo(() => season.standings.filter(s => s.games >= 3).sort((a, b) => b.wins / b.games - a.wins / a.games)[0] || null, [season])
  const mostConsistent = useMemo(() => season.standings.filter(s => s.games >= 3).map(s => ({ ...s, avg: s.points / s.games })).sort((a, b) => b.avg - a.avg)[0] || null, [season])
  const avgParticipation = useMemo(() => {
    if (!seasonGames.length || !playerStats?.length) return 0
    return Math.round(seasonGames.reduce((sum, g) => sum + g.players.length, 0) / seasonGames.length / playerStats.length * 100)
  }, [seasonGames, playerStats])

  useEffect(() => {
    setLoading(true); setImgUrls({}); setQrDataUrl(null)
    const toLoad = {}
    for (const s of top3) { const ps = statsMap[s.id]; if (ps?.avatarCardName) toLoad[`player_${s.id}`] = SCRYFALL_ART(ps.avatarCardName) }
    if (spotlight?.commander) toLoad.deck = SCRYFALL_ART(spotlight.commander)
    Promise.allSettled([
      Promise.all(
        Object.entries(toLoad).map(([k, url]) => fetchDU(url).then(du => du ? [k, du] : null).catch(() => null))
      ).then(rs => { const m = {}; for (const r of rs) if (r) m[r[0]] = r[1]; setImgUrls(m) }),
      QRCode.toDataURL(window.location.origin, { width: 160, margin: 2, color: { dark: '#ECEDFB', light: '#07080F' } })
        .then(setQrDataUrl).catch(() => {}),
    ]).finally(() => setLoading(false))
  }, [seasonKey])

  async function capture(idx) {
    if (!refs[idx].current) return
    const canvas = await html2canvas(refs[idx].current, { scale: SCALE, backgroundColor: C.bg, useCORS: false, logging: false, imageTimeout: 0 })
    const a = Object.assign(document.createElement('a'), { download: `commanderone-${seasonKey}-slide-${idx + 1}.png`, href: canvas.toDataURL('image/png') })
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
  }
  async function downloadOne(idx) { setDlState(idx); try { await capture(idx) } finally { setDlState(null) } }
  async function downloadAll() {
    setDlState('all')
    try { for (let i = 0; i < 3; i++) { await capture(i); if (i < 2) await new Promise(r => setTimeout(r, 500)) } }
    finally { setDlState(null) }
  }

  const busy = dlState !== null || loading
  const s1 = { champion: top3[0], second: top3[1], third: top3[2], seasonLabel, imgUrls, total: seasonGames.length, uniquePlayers, deckCount }
  const s2 = { total: seasonGames.length, uniquePlayers, deckCount, avgParticipation, topStreak, totalKills }
  const s3 = { mostWins, mostGames, topKiller, bestWinRate, topStreak, mostConsistent, spotlight, imgUrls, qrDataUrl }

  const slideInfo = [
    { label: 'Slide 1 — Chi ha dominato?', sub: 'Campione + podio' },
    { label: 'Slide 2 — La stagione in numeri', sub: 'Stats chiave' },
    { label: 'Slide 3 — Hall of Fame', sub: 'Premi + QR code' },
  ]

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(6px)', overflowY: 'auto', padding: '16px 12px 40px' }}>
      <div onClick={e => e.stopPropagation()} className="ct-modal-in" style={{ maxWidth: 400, margin: '0 auto' }}>

        {/* Toolbar */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 900, color: t.text }}>Carousel Instagram</div>
            <div style={{ fontSize: 10, color: t.textMuted, marginTop: 2 }}>3 slide · {W * SCALE}×{H * SCALE}px · 4:5</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={downloadAll} disabled={busy} style={{ padding: '8px 14px', borderRadius: 20, border: 'none', background: busy ? t.bgMuted : t.primary, color: busy ? t.textMuted : '#04111A', fontWeight: 800, fontSize: 12, cursor: busy ? 'default' : 'pointer' }}>
              {dlState === 'all' ? '⏳ Download…' : loading ? '⏳ Caricamento…' : '⬇ Scarica Tutte'}
            </button>
            <button onClick={onClose} style={{ width: 36, height: 36, borderRadius: '50%', border: `1px solid ${t.border}`, background: t.bgSurface, color: t.text, fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
          </div>
        </div>

        {/* 3 slides */}
        {[<Slide1 {...s1} />, <Slide2 {...s2} />, <Slide3 {...s3} />].map((comp, idx) => (
          <div key={idx} style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: t.text }}>{slideInfo[idx].label}</div>
                <div style={{ fontSize: 10, color: t.textMuted }}>{slideInfo[idx].sub}</div>
              </div>
              <button onClick={() => downloadOne(idx)} disabled={busy} style={{ padding: '6px 12px', borderRadius: 16, border: `1px solid ${t.primaryBorder}`, background: t.primaryBg, color: t.primary, fontWeight: 700, fontSize: 11, cursor: busy ? 'default' : 'pointer' }}>
                {dlState === idx ? '⏳…' : '⬇ PNG'}
              </button>
            </div>
            <div style={{ overflowX: 'auto', borderRadius: 14, boxShadow: '0 8px 32px rgba(0,0,0,0.7)' }}>
              <div ref={refs[idx]} style={{ display: 'inline-block' }}>{comp}</div>
            </div>
          </div>
        ))}

        <p style={{ textAlign: 'center', fontSize: 10, color: t.textMuted, marginTop: 4 }}>Tocca fuori per chiudere</p>
      </div>
    </div>
  )
}
