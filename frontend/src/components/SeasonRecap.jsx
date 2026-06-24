import { useRef, useMemo, useEffect, useState } from 'react'
import html2canvas from 'html2canvas'
import QRCode from 'qrcode'
import { useTheme } from '../hooks/useTheme'
import { seasonOf } from '../lib/seasons'

// ── palette brand ──────────────────────────────────────────────────────────────
const C = {
  bg:     '#07080F',
  card:   '#0C0E1C',
  text:   '#FFFFFF',
  sub:    '#8A97B8',
  muted:  '#4A5475',
  green:  '#34F08F',
  purple: '#8B5CF6',
  gold:   '#F5C542',
  silver: '#9BAEC8',
  bronze: '#C47D42',
  cyan:   '#22D3EE',
  orange: '#FB923C',
  pink:   '#F472B6',
  glowG:  '0 0 32px rgba(52,240,143,0.65), 0 0 70px rgba(52,240,143,0.22)',
}

const W = 360, H = 450, SCALE = 3

// ── helpers ────────────────────────────────────────────────────────────────────
const ART = n => `https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(n)}&format=image&version=art_crop`
const b64 = blob => new Promise(r => { const x = new FileReader(); x.onload = () => r(x.result); x.readAsDataURL(blob) })
const fetchDU = async url => { try { const r = await fetch(url, { mode: 'cors' }); return b64(await r.blob()) } catch { return null } }
const hue = (s = '') => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) & 0xffffff, 0) % 360

// ── data ───────────────────────────────────────────────────────────────────────
function computeSeason(games, key) {
  const sg = games.filter(g => seasonOf(g.playedAt).key === key)
  const dk = {}, kk = {}
  let totalKills = 0
  for (const g of sg) {
    for (const p of g.players) {
      if (!dk[p.deck.id]) dk[p.deck.id] = { id: p.deck.id, name: p.deck.name, commander: p.deck.commander, games: 0, wins: 0 }
      dk[p.deck.id].games++; if (p.isWinner) dk[p.deck.id].wins++
      if (p.eliminatedById) { totalKills++; const k = g.players.find(x => x.user.id === p.eliminatedById); if (k) kk[k.user.username] = (kk[k.user.username] || 0) + 1 }
    }
  }
  const spotlight = Object.values(dk).filter(d => d.games >= 3).map(d => ({ ...d, wr: Math.round(d.wins / d.games * 100) })).sort((a, b) => b.wr - a.wr || b.wins - a.wins)[0] || null
  const sorted = [...sg].sort((a, b) => new Date(a.playedAt) - new Date(b.playedAt))
  const sm = {}
  for (const g of sorted) for (const p of g.players) {
    if (!sm[p.user.id]) sm[p.user.id] = { username: p.user.username, cur: 0, best: 0 }
    const r = sm[p.user.id]; if (p.isWinner) { r.cur++; r.best = Math.max(r.best, r.cur) } else r.cur = 0
  }
  const topStreak = Object.values(sm).sort((a, b) => b.best - a.best)[0] || null
  const topKiller = Object.entries(kk).sort((a, b) => b[1] - a[1])[0] || null
  const deckCount = Object.keys(dk).length
  const uniquePlayers = new Set(sg.flatMap(g => g.players.map(p => p.user.id))).size
  return { sg, spotlight, topStreak, topKiller, deckCount, uniquePlayers, totalKills }
}

// ── atoms ──────────────────────────────────────────────────────────────────────
function Avatar({ src, name, size, ring }) {
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, border: `2.5px solid ${ring}`, background: `hsl(${hue(name)},44%,28%)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {src ? <img src={src} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 15%' }} />
           : <span style={{ fontSize: size * 0.35, fontWeight: 900, color: '#fff', letterSpacing: '-0.02em' }}>{(name || '?').slice(0, 2).toUpperCase()}</span>}
    </div>
  )
}

function GLine({ col = '#34F08F', op = 0.45 }) {
  const h = Math.round(op * 255).toString(16).padStart(2, '0')
  return <div style={{ height: 1, background: `linear-gradient(90deg, transparent, ${col}${h}, transparent)` }} />
}

// slide top bar: counter + logo
function TopBar({ n }) {
  return (
    <div style={{ padding: '10px 16px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span style={{ fontSize: 10, fontWeight: 800, color: C.green, letterSpacing: '0.04em' }}>
        {String(n).padStart(2, '0')}<span style={{ color: C.muted, fontWeight: 600 }}>/03</span>
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <img src="/logo.png" alt="" style={{ width: 24, height: 24, objectFit: 'contain' }} />
        <div>
          <div style={{ fontSize: 6.5, fontWeight: 900, color: C.green, letterSpacing: '0.2em', lineHeight: 1 }}>COMMANDERONE</div>
          <div style={{ fontSize: 5, color: C.muted, letterSpacing: '0.16em', marginTop: 1 }}>VILLASTELLONE</div>
        </div>
      </div>
      <div style={{ width: 44 }} />
    </div>
  )
}

// ── SLIDE 1 ────────────────────────────────────────────────────────────────────
function Slide1({ champion, second, third, label, imgUrls, total, uniquePlayers, deckCount }) {
  return (
    <div style={{
      width: W, height: H, overflow: 'hidden',
      background: `radial-gradient(ellipse 100% 70% at 50% 82%, rgba(139,92,246,0.35) 0%, transparent 55%), radial-gradient(ellipse 55% 40% at 8% 15%, rgba(52,240,143,0.16) 0%, transparent 48%), #07080F`,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      display: 'flex', flexDirection: 'column',
    }}>
      <TopBar n={1} />
      <div style={{ margin: '0 16px 10px' }}><GLine op={0.5} /></div>

      {/* Season title block */}
      <div style={{ textAlign: 'center', padding: '0 16px 12px' }}>
        <div style={{ fontSize: 8.5, fontWeight: 800, color: C.green, letterSpacing: '0.32em', textTransform: 'uppercase', marginBottom: 5 }}>RECAP STAGIONE</div>
        <div style={{ fontSize: 26, fontWeight: 900, color: C.text, textTransform: 'uppercase', letterSpacing: '0.03em', lineHeight: 1 }}>{label}</div>
        <div style={{ fontSize: 7.5, color: C.sub, marginTop: 6, fontStyle: 'italic' }}>La stagione è appena finita. E questa è la nostra leggenda.</div>
      </div>

      {/* Champion card — hero element */}
      <div style={{ padding: '0 14px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{ fontSize: 24, textAlign: 'center', lineHeight: 1, marginBottom: -10, position: 'relative', zIndex: 1, filter: 'drop-shadow(0 0 10px rgba(245,197,66,0.95))' }}>👑</div>
        <div style={{
          borderRadius: 16, padding: '14px 16px 16px',
          background: 'linear-gradient(150deg, rgba(52,240,143,0.08) 0%, rgba(52,240,143,0.025) 50%, rgba(139,92,246,0.07) 100%)',
          border: `2px solid ${C.green}`,
          boxShadow: C.glowG,
        }}>
          <div style={{ fontSize: 7, fontWeight: 800, color: C.green, letterSpacing: '0.3em', textTransform: 'uppercase', textAlign: 'center', marginBottom: 12 }}>CAMPIONE STAGIONALE</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <Avatar src={imgUrls[`p_${champion?.id}`]} name={champion?.username || '?'} size={60} ring={C.green} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 26, fontWeight: 900, color: C.text, textTransform: 'uppercase', letterSpacing: '0.04em', lineHeight: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {champion?.username || '—'}
              </div>
              <div style={{ fontSize: 9, color: C.sub, marginTop: 5, letterSpacing: '0.02em' }}>
                {champion?.wins || 0} vittorie · {champion?.games ? Math.round(champion.wins / champion.games * 100) : 0}% win rate
              </div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontSize: 52, fontWeight: 900, color: C.green, lineHeight: 1, textShadow: '0 0 24px rgba(52,240,143,0.75)' }}>{champion?.points ?? 0}</div>
              <div style={{ fontSize: 7, color: C.sub, textTransform: 'uppercase', letterSpacing: '0.16em', marginTop: 2 }}>PUNTI</div>
            </div>
          </div>
        </div>
      </div>

      {/* Podio */}
      <div style={{ display: 'flex', gap: 8, padding: '10px 14px 8px' }}>
        {[{ p: second, col: C.silver, n: '2°' }, { p: third, col: C.bronze, n: '3°' }].map(({ p, col, n }) => (
          <div key={n} style={{ flex: 1, borderRadius: 12, padding: '10px 12px', background: C.card, borderTop: `2px solid ${col}`, display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ fontSize: 20, fontWeight: 900, color: col, lineHeight: 1, textShadow: `0 0 12px ${col}90`, minWidth: 22 }}>{n}</div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p?.username || '—'}</div>
              <div style={{ fontSize: 8.5, color: C.sub, marginTop: 2 }}>{p?.points ?? 0} pt · {p?.wins ?? 0} vitt.</div>
            </div>
          </div>
        ))}
      </div>

      {/* Stats footer */}
      <div style={{ padding: '0 16px 8px' }}>
        <GLine col={C.muted} op={0.35} />
        <div style={{ display: 'flex', justifyContent: 'space-around', padding: '10px 0 8px' }}>
          {[{ icon: '⚔️', v: total, l: 'PARTITE' }, { icon: '👥', v: uniquePlayers, l: 'GIOCATORI' }, { icon: '🃏', v: deckCount, l: 'DECK' }].map(({ icon, v, l }) => (
            <div key={l} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 16, lineHeight: 1, marginBottom: 4 }}>{icon}</div>
              <div style={{ fontSize: 20, fontWeight: 900, color: C.text, lineHeight: 1 }}>{v}</div>
              <div style={{ fontSize: 7, color: C.muted, letterSpacing: '0.14em', marginTop: 3 }}>{l}</div>
            </div>
          ))}
        </div>
        <GLine col={C.muted} op={0.25} />
      </div>

      {/* Footer message */}
      <div style={{ padding: '6px 16px 12px', textAlign: 'center', fontSize: 8, letterSpacing: '0.05em', color: C.sub }}>
        GRAZIE A TUTTI I GIOCATORI PER QUESTA STAGIONE&nbsp;<span style={{ color: C.green, fontWeight: 800 }}>INCREDIBILE</span>!
      </div>
    </div>
  )
}

// ── SLIDE 2 ────────────────────────────────────────────────────────────────────
function Slide2({ total, uniquePlayers, deckCount, avgParticipation, topStreak, totalKills }) {
  const stats = [
    { val: total,                label: 'PARTITE\nDISPUTATE',      col: C.green,  icon: '⚔️' },
    { val: uniquePlayers,        label: 'GIOCATORI\nATTIVI',        col: C.purple, icon: '👥' },
    { val: deckCount,             label: 'DECK\nREGISTRATI',        col: C.cyan,   icon: '🃏' },
    { val: `${avgParticipation}%`, label: 'PARTECIPAZIONE\nMEDIA', col: C.cyan,   icon: '📊' },
    { val: topStreak?.best || 0, label: 'STREAK\nRECORD',          col: C.orange, icon: '🔥' },
    { val: totalKills,           label: 'ELIMINAZIONI\nTOTALI',    col: C.purple, icon: '💀' },
  ]
  return (
    <div style={{
      width: W, height: H, overflow: 'hidden',
      background: `radial-gradient(ellipse 65% 50% at 88% 8%, rgba(139,92,246,0.28) 0%, transparent 55%), radial-gradient(ellipse 50% 38% at 8% 92%, rgba(52,240,143,0.1) 0%, transparent 48%), #07080F`,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      display: 'flex', flexDirection: 'column',
    }}>
      <TopBar n={2} />
      <div style={{ margin: '0 16px 6px' }}><GLine op={0.5} /></div>

      {/* Title — anchor visivo della slide */}
      <div style={{ textAlign: 'center', padding: '4px 16px 12px' }}>
        <div style={{ fontSize: 9.5, fontWeight: 600, color: C.sub, letterSpacing: '0.32em', textTransform: 'uppercase', lineHeight: 1, marginBottom: 2 }}>LA STAGIONE</div>
        <div style={{ fontSize: 42, fontWeight: 900, color: C.green, letterSpacing: '0.05em', textTransform: 'uppercase', lineHeight: 1, textShadow: '0 0 36px rgba(52,240,143,0.6)' }}>IN NUMERI</div>
      </div>

      {/* Grid 2×3 — il cuore della slide */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7, padding: '0 12px' }}>
        {stats.map(({ val, label, col, icon }) => (
          <div key={label} style={{
            borderRadius: 12, padding: '0 10px',
            background: C.card,
            border: `1.5px solid ${col}40`,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 0,
          }}>
            <div style={{ fontSize: 22, lineHeight: 1, marginBottom: 6 }}>{icon}</div>
            <div style={{ fontSize: 34, fontWeight: 900, color: C.text, lineHeight: 1 }}>{val}</div>
            <div style={{ fontSize: 6.5, fontWeight: 700, color: col, letterSpacing: '0.14em', textAlign: 'center', textTransform: 'uppercase', lineHeight: 1.4, marginTop: 5, whiteSpace: 'pre-line' }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Footer decorativo */}
      <div style={{ padding: '14px 16px 12px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ height: 1, flex: 1, background: 'linear-gradient(90deg, transparent, rgba(52,240,143,0.5))' }} />
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 9, fontWeight: 900, color: C.green, letterSpacing: '0.26em' }}>COMMANDERONE</div>
          <div style={{ fontSize: 6, color: C.muted, letterSpacing: '0.2em', marginTop: 1 }}>VILLASTELLONE</div>
        </div>
        <div style={{ height: 1, flex: 1, background: 'linear-gradient(90deg, rgba(52,240,143,0.5), transparent)' }} />
      </div>
    </div>
  )
}

// ── SLIDE 3 ────────────────────────────────────────────────────────────────────
function Slide3({ mostWins, mostGames, topKiller, bestWinRate, topStreak, mostConsistent, spotlight, imgUrls, qrDataUrl }) {
  const wr = p => p?.games ? Math.round(p.wins / p.games * 100) : 0
  const awards = [
    { icon: '🏆', col: C.gold,   label: 'PIÙ VITTORIE',  name: mostWins?.username || '—',      stat: `${mostWins?.wins || 0} vitt.` },
    { icon: '🎯', col: C.cyan,   label: 'PIÙ PRESENTE',  name: mostGames?.username || '—',     stat: `${mostGames?.games || 0} gg` },
    { icon: '📈', col: C.green,  label: 'MIGLIOR WIN',   name: bestWinRate?.username || '—',   stat: `${wr(bestWinRate)}%` },
    { icon: '⚔️', col: C.pink,   label: 'PIÙ SPIETATO',  name: topKiller?.[0] || '—',         stat: `${topKiller?.[1] || 0} kill` },
    { icon: '🔥', col: C.orange, label: 'STREAK',        name: topStreak?.username || '—',     stat: `${topStreak?.best || 0} consec.` },
    { icon: '💎', col: C.purple, label: 'PIÙ COSTANTE',  name: mostConsistent?.username || '—', stat: `${(mostConsistent?.avg || 0).toFixed(1)} avg` },
  ]
  return (
    <div style={{
      width: W, height: H, overflow: 'hidden',
      background: `radial-gradient(ellipse 85% 52% at 50% 20%, rgba(139,92,246,0.28) 0%, transparent 55%), #07080F`,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      display: 'flex', flexDirection: 'column',
    }}>
      <TopBar n={3} />
      <div style={{ margin: '0 16px 8px' }}><GLine op={0.5} /></div>

      {/* Title — compatto per lasciare spazio agli award */}
      <div style={{ textAlign: 'center', padding: '0 16px 10px' }}>
        <div style={{ fontSize: 24, fontWeight: 900, color: C.text, letterSpacing: '0.1em', textTransform: 'uppercase', lineHeight: 1 }}>HALL OF FAME</div>
        <div style={{ fontSize: 7.5, fontWeight: 700, color: C.green, letterSpacing: '0.24em', textTransform: 'uppercase', marginTop: 4 }}>I PROTAGONISTI DELLA STAGIONE</div>
      </div>

      {/* Award tiles 3×2 — content principale */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, padding: '0 12px' }}>
        {awards.map(({ icon, col, label, name, stat }) => (
          <div key={label} style={{ borderRadius: 11, padding: '10px 6px 9px', textAlign: 'center', background: C.card, border: `1.5px solid ${col}40` }}>
            {/* icon circle */}
            <div style={{ width: 30, height: 30, borderRadius: '50%', background: `${col}1A`, border: `1.5px solid ${col}60`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 6px', fontSize: 15, lineHeight: 1 }}>{icon}</div>
            <div style={{ fontSize: 6.5, fontWeight: 800, color: col, letterSpacing: '0.14em', textTransform: 'uppercase', lineHeight: 1.2 }}>{label}</div>
            <div style={{ fontSize: 12, fontWeight: 900, color: C.text, marginTop: 3, lineHeight: 1 }}>{name}</div>
            <div style={{ fontSize: 8, color: C.sub, marginTop: 3 }}>{stat}</div>
          </div>
        ))}
      </div>

      {/* Deck della stagione */}
      {spotlight && (
        <div style={{ margin: '8px 12px 0', borderRadius: 11, overflow: 'hidden', border: `1.5px solid rgba(52,240,143,0.45)`, height: 56, position: 'relative', flexShrink: 0, boxShadow: '0 0 18px rgba(52,240,143,0.18)' }}>
          {imgUrls?.deck && <img src={imgUrls.deck} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 22%', opacity: 0.5 }} />}
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, rgba(7,8,15,0.92) 40%, rgba(7,8,15,0.3))', padding: '0 14px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ fontSize: 6.5, fontWeight: 800, color: C.green, letterSpacing: '0.22em', textTransform: 'uppercase' }}>🃏 DECK DELLA STAGIONE</div>
            <div style={{ fontSize: 15, fontWeight: 900, color: C.text, textTransform: 'uppercase', letterSpacing: '0.04em', lineHeight: 1.1, marginTop: 2 }}>{spotlight.name}</div>
          </div>
        </div>
      )}

      {/* Thank you */}
      <div style={{ textAlign: 'center', padding: '10px 16px 6px' }}>
        <div style={{ fontSize: 13, fontWeight: 900, color: C.green, fontStyle: 'italic', textShadow: '0 0 20px rgba(52,240,143,0.6)', letterSpacing: '0.02em' }}>GRAZIE A TUTTA LA COMMUNITY!</div>
        <div style={{ fontSize: 8, color: C.sub, marginTop: 3, letterSpacing: '0.06em' }}>Ci vediamo alla prossima stagione!</div>
      </div>

      {/* Footer QR */}
      <div style={{ marginTop: 'auto', borderTop: '1px solid rgba(255,255,255,0.07)', padding: '8px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <img src="/logo.png" alt="" style={{ width: 24, height: 24, objectFit: 'contain' }} />
          <div>
            <div style={{ fontSize: 8, fontWeight: 900, color: C.green, letterSpacing: '0.18em' }}>COMMANDERONE</div>
            <div style={{ fontSize: 5.5, color: C.muted, letterSpacing: '0.16em', marginTop: 1 }}>VILLASTELLONE</div>
          </div>
        </div>
        {qrDataUrl && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
            <div style={{ fontSize: 6.5, color: C.green, fontWeight: 700, letterSpacing: '0.1em' }}>SCOPRI DI PIÙ</div>
            <img src={qrDataUrl} alt="QR" style={{ width: 44, height: 44, borderRadius: 7, imageRendering: 'pixelated' }} />
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
  const { sg, spotlight, topStreak, topKiller, deckCount, uniquePlayers, totalKills } =
    useMemo(() => computeSeason(games, seasonKey), [games, seasonKey])

  const top3           = season.standings.filter(s => s.qualified).slice(0, 3)
  const statsMap       = useMemo(() => Object.fromEntries((playerStats || []).map(p => [p.id, p])), [playerStats])
  const mostWins       = useMemo(() => [...season.standings].sort((a, b) => b.wins - a.wins)[0] || null, [season])
  const mostGames      = useMemo(() => [...season.standings].sort((a, b) => b.games - a.games)[0] || null, [season])
  const bestWinRate    = useMemo(() => season.standings.filter(s => s.games >= 3).sort((a, b) => b.wins / b.games - a.wins / a.games)[0] || null, [season])
  const mostConsistent = useMemo(() => season.standings.filter(s => s.games >= 3).map(s => ({ ...s, avg: s.points / s.games })).sort((a, b) => b.avg - a.avg)[0] || null, [season])
  const avgParticipation = useMemo(() => {
    if (!sg.length || !playerStats?.length) return 0
    return Math.round(sg.reduce((s, g) => s + g.players.length, 0) / sg.length / playerStats.length * 100)
  }, [sg, playerStats])

  useEffect(() => {
    setLoading(true); setImgUrls({}); setQrDataUrl(null)
    const toLoad = {}
    // usa chiave "p_<id>" per le immagini avatar dei giocatori top3
    for (const s of top3) { const ps = statsMap[s.id]; if (ps?.avatarCardName) toLoad[`p_${s.id}`] = ART(ps.avatarCardName) }
    if (spotlight?.commander) toLoad.deck = ART(spotlight.commander)
    Promise.allSettled([
      Promise.all(Object.entries(toLoad).map(([k, url]) => fetchDU(url).then(du => du ? [k, du] : null).catch(() => null)))
        .then(rs => { const m = {}; for (const r of rs) if (r) m[r[0]] = r[1]; setImgUrls(m) }),
      QRCode.toDataURL(window.location.origin, { width: 160, margin: 2, color: { dark: '#ECEDFB', light: '#07080F' } }).then(setQrDataUrl).catch(() => {}),
    ]).finally(() => setLoading(false))
  }, [seasonKey])

  async function capture(idx) {
    if (!refs[idx].current) return
    const cv = await html2canvas(refs[idx].current, { scale: SCALE, backgroundColor: C.bg, useCORS: false, logging: false, imageTimeout: 0 })
    const a = Object.assign(document.createElement('a'), { download: `commanderone-${seasonKey}-slide-${idx + 1}.png`, href: cv.toDataURL('image/png') })
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
  }
  async function downloadOne(idx) { setDlState(idx); try { await capture(idx) } finally { setDlState(null) } }
  async function downloadAll() {
    setDlState('all')
    try { for (let i = 0; i < 3; i++) { await capture(i); if (i < 2) await new Promise(r => setTimeout(r, 500)) } }
    finally { setDlState(null) }
  }

  const busy = dlState !== null || loading
  const s1 = { champion: top3[0], second: top3[1], third: top3[2], label: seasonLabel, imgUrls, total: sg.length, uniquePlayers, deckCount }
  const s2 = { total: sg.length, uniquePlayers, deckCount, avgParticipation, topStreak, totalKills }
  const s3 = { mostWins, mostGames, topKiller, bestWinRate, topStreak, mostConsistent, spotlight, imgUrls, qrDataUrl }
  const info = [
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

        {[<Slide1 {...s1} />, <Slide2 {...s2} />, <Slide3 {...s3} />].map((comp, idx) => (
          <div key={idx} style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: t.text }}>{info[idx].label}</div>
                <div style={{ fontSize: 10, color: t.textMuted }}>{info[idx].sub}</div>
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
