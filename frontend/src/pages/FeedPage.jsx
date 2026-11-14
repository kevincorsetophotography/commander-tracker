import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { mergeRsvps } from '../lib/rsvp'
import { toast as sonner } from 'sonner'
import { useTheme } from '../hooks/useTheme'
import { useAuth } from '../hooks/useAuth'
import { useFeedback } from '../hooks/useFeedback'
import { seasonOf, computeStandings } from '../lib/seasons'
import { useCardArt } from '../lib/cardCache'
import { Skeleton, SkeletonList } from '../components/Skeleton'
import PlayerAvatar from '../components/PlayerAvatar'
import BracketBadge from '../components/BracketBadge'
import { Icon, ManaPips, Ring, bento, SectionLabel, RsvpButton } from '../components/ui'
import NumberFlow from '@number-flow/react'

// Feed v2 (restyle Stitch): serata in evidenza, bento rank/win rate, podio,
// mazzo del momento, settimana, feed partite + notifiche. Stessi dati di prima.

// ─── helpers ──────────────────────────────────────────────

function relativeDate(date) {
  const now = new Date()
  const d = new Date(date)
  const diffDays = Math.floor((now - d) / 86400000)
  if (diffDays === 0) return 'Oggi'
  if (diffDays === 1) return 'Ieri'
  if (diffDays < 7) return `${diffDays} gg fa`
  return d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })
}

// "oggi" / "domani" / "tra N giorni" rispetto al giorno di calendario locale.
function countdownLabel(startsAt) {
  const start = new Date(startsAt)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const day = new Date(start); day.setHours(0, 0, 0, 0)
  const diff = Math.round((day - today) / 86400000)
  if (diff <= 0) return 'Oggi'
  if (diff === 1) return 'Domani'
  return `Tra ${diff} giorni`
}

const commanderName = (c) => (c ? c.split('//')[0].trim() : '')

// ─── sezioni ──────────────────────────────────────────────

function Greeting({ t, user, seasonLabel }) {
  return (
    <div className="ct-fade-up" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
      <div style={{ fontSize: 26, fontWeight: 800, color: t.text, letterSpacing: '-0.02em', minWidth: 0, wordBreak: 'break-word' }}>
        Ciao, {user?.username}
      </div>
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 999,
        background: t.bgSurfaceAlt, border: `1px solid ${t.border}`, color: t.textSub, fontSize: 13, fontWeight: 700,
      }}>
        <span style={{ color: t.primary, display: 'flex' }}><Icon name="trophy" size={15} /></span>
        Stagione {seasonLabel}
      </span>
    </div>
  )
}

function NextEventCard({ event, t, user, navigate, onRsvp, busy }) {
  const start = new Date(event.startsAt)
  const dateStr = start.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })
  const timeStr = event.allDay ? null : start.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
  const rsvps = event.rsvps || []
  const going = rsvps.some(r => r.userId === user?.id)
  const shown = rsvps.slice(0, 5)
  const label = countdownLabel(event.startsAt)

  return (
    <div
      className="ct-fade-up"
      onClick={() => navigate(`/evento/${event.id}`)}
      style={bento(t, {
        padding: '1.1rem 1.15rem 1.15rem', marginBottom: 14, cursor: 'pointer', animationDelay: '50ms',
        border: `1px solid ${t.primaryBorder}`, boxShadow: `${t.shadow}, ${t.glow === 'none' ? '0 0 0 transparent' : t.glow}`,
      })}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: t.primary }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: t.primary, boxShadow: `0 0 8px ${t.primary}` }} />
          Prossima serata
        </span>
        <span style={{ padding: '4px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700, color: t.primary, background: t.primaryBg, border: `1px solid ${t.primaryBorder}` }}>
          {label}
        </span>
      </div>

      <div style={{ fontSize: 20, fontWeight: 800, color: t.text, lineHeight: 1.2, wordBreak: 'break-word' }}>{event.title}</div>
      <div style={{ fontSize: 15, fontWeight: 600, color: t.text, marginTop: 6, textTransform: 'capitalize' }}>
        {dateStr}{timeStr ? ` · ${timeStr}` : ''}
      </div>
      {event.location && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, color: t.textSub, marginTop: 4 }}>
          <Icon name="pin" size={16} /> <span style={{ minWidth: 0, wordBreak: 'break-word' }}>{event.location}</span>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14 }}>
        {shown.length > 0 && (
          <div style={{ display: 'flex' }}>
            {shown.map((r, i) => (
              <div key={r.userId} style={{ marginLeft: i ? -10 : 0, borderRadius: '50%', boxShadow: `0 0 0 2px ${t.bgPage}` }}>
                <PlayerAvatar username={r.user?.username} avatarCardName={r.user?.avatarCardName} avatarScryfallId={r.user?.avatarScryfallId} size={30} />
              </div>
            ))}
          </div>
        )}
        <span style={{ fontSize: 14, color: t.textSub }}>
          {rsvps.length === 0 ? 'Ancora nessun iscritto' : `${rsvps.length} ${rsvps.length === 1 ? 'iscritto' : 'iscritti'}`}
        </span>
      </div>

      <div style={{ marginTop: 14 }}>
        <RsvpButton going={going} full busy={busy} onClick={() => onRsvp(event)} t={t} />
      </div>
    </div>
  )
}

function StatsBento({ snapshot, t, user, navigate }) {
  if (!snapshot) return null
  const { total, wins, streak, myStanding, myRank, standingsCount, leader } = snapshot
  const winPct = total ? Math.round(wins / total * 100) : 0
  const gap = myStanding && leader && leader.id !== myStanding.id ? leader.points - myStanding.points : 0

  const tile = (extra) => bento(t, { padding: '0.95rem 1rem', cursor: 'pointer', minWidth: 0, ...extra })
  const label = { fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: t.textSub }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
      <div className="ct-fade-up ct-lift" onClick={() => navigate('/gruppo')} style={tile({ animationDelay: '90ms' })}>
        <div style={label}>Classifica</div>
        {myRank ? (
          <>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, marginTop: 6 }}>
              <span style={{ fontSize: 34, fontWeight: 900, color: t.text, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>#<NumberFlow value={myRank} /></span>
              <span style={{ fontSize: 13, color: t.textSub }}>su {standingsCount}</span>
            </div>
            <div style={{ fontSize: 16, fontWeight: 800, color: t.primary, marginTop: 6 }}><NumberFlow value={myStanding.points} /> punti</div>
            <div style={{ fontSize: 13, color: t.textSub, marginTop: 4, lineHeight: 1.35 }}>
              {gap > 0 ? `−${gap} pt da ${leader.username}` : 'In testa alla stagione'}
            </div>
            {!myStanding.qualified && (
              <div style={{ fontSize: 12, color: t.textMuted, marginTop: 4 }}>Non ancora qualificato</div>
            )}
          </>
        ) : (
          <div style={{ fontSize: 14, color: t.textSub, marginTop: 8, lineHeight: 1.4 }}>Nessuna partita in questa stagione</div>
        )}
      </div>

      <div className="ct-fade-up ct-lift" onClick={() => navigate(`/giocatore/${user?.id}`)} style={tile({ animationDelay: '130ms' })}>
        <div style={label}>Win rate</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
          <Ring pct={winPct} size={56} stroke={6} color={t.primary} track={t.bgMuted} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: t.text, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{wins}V–{total - wins}S</div>
            <div style={{ fontSize: 13, color: t.textSub }}>{total} partite</div>
          </div>
        </div>
        {streak >= 2 && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 10, padding: '4px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700, color: t.primary, background: t.primaryBg, border: `1px solid ${t.primaryBorder}` }}>
            <Icon name="flame" size={14} /> {streak} vittorie di fila
          </div>
        )}
      </div>
    </div>
  )
}

const PODIUM = ['#F5C518', '#C9D1E0', '#D9915A']

function Podium({ standings, t, user, navigate }) {
  if (standings.length < 2) return null
  return (
    <div className="ct-fade-up" style={bento(t, { padding: '1rem 1rem 0.6rem', marginBottom: 14, animationDelay: '170ms' })}>
      <SectionLabel t={t} icon="trophy" right={
        <button onClick={() => navigate('/gruppo')} style={{ background: 'none', border: 'none', color: t.primary, fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 2, padding: '6px 0' }}>
          Classifica <Icon name="chevron" size={16} />
        </button>
      }>Podio stagione</SectionLabel>
      {standings.map((s, i) => {
        const me = s.id === user?.id
        return (
          <div key={s.id} onClick={() => navigate(`/giocatore/${s.id}`)} className="ct-press" style={{
            display: 'flex', alignItems: 'center', gap: 11, padding: '10px 10px', marginBottom: 8, borderRadius: 14, cursor: 'pointer',
            background: me ? t.primaryBg : t.bgSurfaceAlt, border: `1px solid ${me ? t.primaryBorder : t.border}`,
          }}>
            <span style={{
              width: 28, height: 28, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, fontWeight: 900, color: PODIUM[i], border: `1.5px solid ${PODIUM[i]}`,
            }}>{i + 1}</span>
            <PlayerAvatar username={s.username} avatarCardName={s.avatarCardName} avatarScryfallId={s.avatarScryfallId} size={38} highlight={me} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: t.text, wordBreak: 'break-word' }}>
                {s.username}{me && <span style={{ marginLeft: 6, fontSize: 12, fontWeight: 800, color: t.primaryFg, background: t.primary, padding: '1px 6px', borderRadius: 6 }}>Tu</span>}
              </div>
              <div style={{ fontSize: 13, color: t.textSub, marginTop: 2 }}>
                {s.games} partite · {s.games ? Math.round(s.wins / s.games * 100) : 0}% vittorie
              </div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <span style={{ fontSize: 20, fontWeight: 900, color: i === 0 ? t.primary : t.text, fontVariantNumeric: 'tabular-nums' }}><NumberFlow value={s.points} /></span>
              <span style={{ fontSize: 13, color: t.textSub, marginLeft: 3 }}>pt</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function DeckSpotlight({ spotlight, t, navigate }) {
  const { status, art } = useCardArt(spotlight?.commander)
  if (!spotlight) return null
  return (
    <div className="ct-fade-up ct-lift" onClick={() => navigate(`/mazzo/${spotlight.id}`)}
      style={bento(t, { overflow: 'hidden', marginBottom: 14, cursor: 'pointer', animationDelay: '210ms', padding: 0 })}>
      <div style={{ position: 'relative', height: 132, background: '#0f1225' }}>
        {status === 'ready' && (
          <img src={art} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 22%' }} />
        )}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(8,10,28,0.15) 0%, rgba(8,10,28,0.85) 100%)' }} />
        <span style={{
          position: 'absolute', top: 12, left: 12, display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '5px 11px', borderRadius: 999, fontSize: 12, fontWeight: 800, color: '#fff',
          background: 'rgba(139,92,246,0.85)',
        }}>
          <Icon name="sparkle" size={14} /> Mazzo del momento
        </span>
        <div style={{ position: 'absolute', right: 14, bottom: 10, textAlign: 'right' }}>
          <div style={{ fontSize: 34, fontWeight: 900, color: '#34F08F', lineHeight: 1, textShadow: '0 2px 12px rgba(0,0,0,0.9)' }}>{spotlight.recentWinRate}%</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', fontWeight: 600 }}>vittorie · 10 giorni</div>
        </div>
      </div>
      <div style={{ padding: '0.85rem 1rem 1rem' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: t.text, wordBreak: 'break-word' }}>{spotlight.name}</div>
            {spotlight.commander && <div style={{ fontSize: 14, color: t.textSub, marginTop: 2, wordBreak: 'break-word' }}>{commanderName(spotlight.commander)}</div>}
          </div>
          <ManaPips colors={spotlight.colors} size={22} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
          <span style={{ fontSize: 13, color: t.textSub }}>di <strong style={{ color: t.text }}>{spotlight.owner}</strong> · {spotlight.recentWins}/{spotlight.recentGames} vinte</span>
          <BracketBadge bracket={spotlight.bracket} size="lg" />
        </div>
      </div>
    </div>
  )
}

const DAY_LETTERS = ['D', 'L', 'M', 'M', 'G', 'V', 'S']

function WeeklyActivity({ activity, t }) {
  if (activity.count === 0 && activity.lastWeekCount === 0) return null
  const diff = activity.count - activity.lastWeekCount
  const trendColor = diff > 0 ? t.win : diff < 0 ? t.danger : t.textSub
  const trendLabel = diff > 0 ? `+${diff} vs scorsa` : diff < 0 ? `${diff} vs scorsa` : 'come la scorsa'
  const today = new Date().getDay()

  return (
    <div className="ct-fade-up" style={bento(t, { padding: '1rem', marginBottom: 18, animationDelay: '250ms' })}>
      <SectionLabel t={t} icon="chart" right={
        <span style={{ fontSize: 12, fontWeight: 700, color: trendColor, padding: '3px 9px', borderRadius: 999, background: t.bgSurfaceAlt, border: `1px solid ${t.border}` }}>{trendLabel}</span>
      }>Questa settimana</SectionLabel>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14 }}>
        <div style={{ flexShrink: 0 }}>
          <span style={{ fontSize: 36, fontWeight: 900, color: t.text, lineHeight: 1 }}><NumberFlow value={activity.count} /></span>
          <span style={{ fontSize: 14, color: t.textSub, marginLeft: 6 }}>{activity.count === 1 ? 'partita' : 'partite'}</span>
        </div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', gap: 5 }}>
          {activity.days.map((count, i) => {
            const pct = activity.maxDay > 0 ? count / activity.maxDay : 0
            const isToday = i === 6
            return (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div className="ct-bar-fill" style={{
                  width: '100%', height: count > 0 ? Math.max(pct * 44, 8) : 3, borderRadius: 4, transformOrigin: 'bottom',
                  background: count === 0 ? t.bgMuted : isToday ? t.primary : t.accent,
                  opacity: count === 0 ? 1 : isToday ? 1 : 0.75,
                }} />
                <span style={{ fontSize: 12, fontWeight: isToday ? 800 : 600, color: isToday ? t.primary : t.textMuted }}>
                  {DAY_LETTERS[(today - 6 + i + 7) % 7]}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── Feed items ────────────────────────────────────────────

function reactionSummary(reactions = []) {
  const counts = {}
  for (const r of reactions) counts[r.emoji] = (counts[r.emoji] || 0) + 1
  return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 3)
}

function GameFeedItem({ game, user, t, navigate }) {
  const me = game.players.find(p => p.user.id === user?.id)
  const winner = game.players.find(p => p.isWinner)
  const iWon = !!me?.isWinner
  const others = [...game.players]
    .filter(p => !p.isWinner)
    .sort((a, b) => (a.placement ?? 99) - (b.placement ?? 99))
  const reactions = reactionSummary(game.reactions)
  const comments = game._count?.comments || 0

  return (
    <div onClick={() => navigate(`/partita/${game.id}`)} className="ct-lift" style={bento(t, {
      padding: '0.9rem 1rem', marginBottom: 10, cursor: 'pointer',
      border: `1px solid ${iWon ? t.primaryBorder : t.border}`,
      background: iWon ? t.winBg : t.bgSurface,
    })}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 11 }}>
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <PlayerAvatar username={winner?.user?.username} avatarCardName={winner?.user?.avatarCardName} avatarScryfallId={winner?.user?.avatarScryfallId} size={44} highlight={iWon} />
          <span style={{ position: 'absolute', bottom: -4, right: -5, width: 22, height: 22, borderRadius: '50%', background: t.primary, color: t.primaryFg, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `2px solid ${t.bgPage}` }}>
            <Icon name="trophy" size={12} stroke={2.4} />
          </span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: t.text, lineHeight: 1.3, wordBreak: 'break-word' }}>
              {iWon ? <span style={{ color: t.win }}>Hai vinto!</span> : <>{winner?.user?.username || '?'} <span style={{ fontWeight: 500, color: t.textSub }}>ha vinto</span></>}
            </div>
            <span style={{ fontSize: 12, color: t.textMuted, flexShrink: 0, marginTop: 2 }}>{relativeDate(game.playedAt)}</span>
          </div>
          {winner?.deck && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 14, color: t.textSub, wordBreak: 'break-word' }}>{winner.deck.name}</span>
              <ManaPips colors={winner.deck.colors} size={16} />
            </div>
          )}
        </div>
      </div>

      {others.length > 0 && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${t.border}`, display: 'flex', flexWrap: 'wrap', gap: '6px 12px' }}>
          {others.map(p => (
            <span key={p.id || p.user.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: p.user.id === user?.id ? t.primary : t.textSub }}>
              <PlayerAvatar username={p.user.username} avatarCardName={p.user.avatarCardName} avatarScryfallId={p.user.avatarScryfallId} size={22} />
              {p.placement ? `${p.placement}° ` : ''}{p.user.username}
            </span>
          ))}
        </div>
      )}

      {(reactions.length > 0 || comments > 0) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10 }}>
          {reactions.map(([emoji, n]) => (
            <span key={emoji} style={{ padding: '3px 9px', borderRadius: 999, fontSize: 13, background: t.bgSurfaceAlt, border: `1px solid ${t.border}`, color: t.text }}>{emoji} {n}</span>
          ))}
          {comments > 0 && (
            <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 13, color: t.textSub }}>
              <Icon name="comment" size={15} /> {comments}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

function parseUsernameFromTitle(notif) {
  try {
    if (notif.type === 'comment') return notif.title.split(' ha commentato')[0].replace(/^💬\s*/, '')
    if (notif.type === 'reaction') return notif.title.split(' ')[1]
  } catch { /* ignore */ }
  return null
}

const NOTIF_META = {
  comment:     { icon: 'comment', label: 'Commento' },
  reaction:    { icon: 'flame',   label: 'Reazione' },
  achievement: { icon: 'trophy',  label: 'Achievement' },
}

function NotifFeedItem({ notif, t, navigate }) {
  const isUnread = !notif.read
  const isSocial = notif.type === 'comment' || notif.type === 'reaction'
  const avatarUser = notif.fromUser || (isSocial ? { username: parseUsernameFromTitle(notif), avatarCardName: null, avatarScryfallId: null } : null)
  const meta = NOTIF_META[notif.type] || { icon: 'bell', label: 'Novità' }

  return (
    <div onClick={() => notif.link && navigate(notif.link)} className="ct-press" style={bento(t, {
      padding: '0.85rem 1rem', marginBottom: 10, cursor: notif.link ? 'pointer' : 'default',
      display: 'flex', alignItems: 'flex-start', gap: 11,
      background: isUnread ? t.primaryBg : t.bgSurface, border: `1px solid ${isUnread ? t.primaryBorder : t.border}`,
    })}>
      {avatarUser
        ? <PlayerAvatar username={avatarUser.username} avatarCardName={avatarUser.avatarCardName} avatarScryfallId={avatarUser.avatarScryfallId} size={40} />
        : <span style={{ width: 40, height: 40, borderRadius: 12, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(139,92,246,0.18)', color: t.accent }}><Icon name={meta.icon} size={20} /></span>}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: t.accent }}>{meta.label}</span>
          <span style={{ fontSize: 12, color: t.textMuted, flexShrink: 0 }}>{relativeDate(notif.createdAt)}</span>
        </div>
        <div style={{ fontSize: 14, fontWeight: 600, color: t.text, marginTop: 3, wordBreak: 'break-word' }}>{notif.title}</div>
        {notif.body && <div style={{ fontSize: 13, color: t.textSub, marginTop: 3, wordBreak: 'break-word' }}>{notif.body}</div>}
      </div>
    </div>
  )
}

// ─── main ──────────────────────────────────────────────────

export default function FeedPage() {
  const { t } = useTheme()
  const { user } = useAuth()
  const { toast } = useFeedback()
  const navigate = useNavigate()

  const [games, setGames]               = useState([])
  const [events, setEvents]             = useState([])
  const [notifications, setNotifications] = useState([])
  const [playerStats, setPlayerStats]   = useState([])
  const [loading, setLoading]           = useState(true)
  const [rsvpBusy, setRsvpBusy]         = useState(false)

  useEffect(() => {
    Promise.allSettled([
      api.getGames(),
      api.getEvents(),
      api.getNotifications(),
      api.statsPlayers(),
    ])
      .then(([g, e, n, ps]) => {
        if (g.status  === 'fulfilled') setGames(g.value)
        if (e.status  === 'fulfilled') setEvents(e.value)
        if (n.status  === 'fulfilled') setNotifications(n.value)
        if (ps.status === 'fulfilled') setPlayerStats(ps.value)
      })
      .finally(() => setLoading(false))
  }, [])

  const toggleRsvp = async (ev) => {
    setRsvpBusy(true)
    try {
      const { rsvps } = await api.toggleRsvp(ev.id)
      setEvents(prev => prev.map(e => e.id === ev.id ? { ...e, rsvps: mergeRsvps(e.rsvps, rsvps, user) } : e))
      const nowGoing = rsvps.some(r => r.userId === user?.id)
      if (nowGoing) sonner.success('Iscritto!', { description: `Ci vediamo a “${ev.title}”` })
      else sonner('Iscrizione annullata', { description: ev.title })
    } catch (err) {
      toast(err.error || 'Errore adesione', 'error')
    } finally {
      setRsvpBusy(false)
    }
  }

  const withAvatar = (s) => ({
    ...s,
    avatarCardName:   playerStats.find(p => p.id === s.id)?.avatarCardName || null,
    avatarScryfallId: playerStats.find(p => p.id === s.id)?.avatarScryfallId || null,
  })

  // ── snapshot personale + classifica stagione ──
  const season = useMemo(() => {
    const key = seasonOf(new Date()).key
    return computeStandings(games, key)
  }, [games])

  const snapshot = useMemo(() => {
    if (!user) return null
    const myGames = games
      .filter(g => g.players.some(p => p.user.id === user.id))
      .sort((a, b) => new Date(b.playedAt) - new Date(a.playedAt))

    const total = myGames.length
    const wins = myGames.filter(g => g.players.find(p => p.user.id === user.id)?.isWinner).length

    let streak = 0
    for (const g of myGames) {
      if (g.players.find(p => p.user.id === user.id)?.isWinner) streak++
      else break
    }

    const { standings } = season
    const myStanding = standings.find(s => s.id === user.id)
    const myRank = myStanding ? standings.indexOf(myStanding) + 1 : null

    return { total, wins, streak, myStanding, myRank, standingsCount: standings.length, leader: standings[0] || null }
  }, [games, user, season])

  // ── prossimo evento ──
  const nextEvent = useMemo(() => {
    const now = Date.now()
    return events
      .filter(e => {
        const eventDate = new Date(e.startsAt)
        const parts = new Intl.DateTimeFormat('en', {
          timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit',
        }).formatToParts(eventDate)
        const y = +parts.find(p => p.type === 'year').value
        const mo = +parts.find(p => p.type === 'month').value
        const d = +parts.find(p => p.type === 'day').value
        const probe = new Date(Date.UTC(y, mo - 1, d + 1, 5, 0, 0))
        const romeHour = +new Intl.DateTimeFormat('en', {
          timeZone: 'Europe/Rome', hour: 'numeric', hour12: false,
        }).format(probe)
        return probe.getTime() - (romeHour - 5) * 3600000 > now
      })
      .sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt))[0] || null
  }, [events])

  // ── podio (top 3 qualificati stagione corrente) ──
  const topStandings = useMemo(
    () => season.standings.filter(s => s.qualified).slice(0, 3).map(withAvatar),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [season, playerStats],
  )

  // ── mazzo del momento (miglior win rate ultimi 10 giorni, min 3 partite) ──
  const spotlight = useMemo(() => {
    if (!games.length) return null
    const cutoff = Date.now() - 10 * 86400000
    const map = {}
    for (const g of games) {
      if (new Date(g.playedAt) < cutoff) continue
      for (const p of g.players) {
        if (!map[p.deck.id]) map[p.deck.id] = {
          id: p.deck.id, name: p.deck.name, commander: p.deck.commander,
          colors: p.deck.colors, bracket: p.deck.bracket,
          owner: p.user.username, games: 0, wins: 0,
        }
        map[p.deck.id].games++
        if (p.isWinner) map[p.deck.id].wins++
      }
    }
    const candidates = Object.values(map).filter(d => d.games >= 3)
    if (!candidates.length) return null
    candidates.sort((a, b) =>
      (b.wins / b.games) - (a.wins / a.games) || b.games - a.games
    )
    const best = candidates[0]
    return {
      ...best,
      recentGames: best.games,
      recentWins: best.wins,
      recentWinRate: Math.round(best.wins / best.games * 100),
    }
  }, [games])

  // ── attività settimanale ──
  const weeklyActivity = useMemo(() => {
    const now = Date.now()
    const oneWeek = 7 * 86400000
    const thisWeek  = games.filter(g => now - new Date(g.playedAt) < oneWeek)
    const lastWeek  = games.filter(g => {
      const age = now - new Date(g.playedAt)
      return age >= oneWeek && age < oneWeek * 2
    })
    const days = Array(7).fill(0)
    for (const g of thisWeek) {
      const idx = Math.floor((now - new Date(g.playedAt)) / 86400000)
      if (idx < 7) days[6 - idx]++
    }
    const maxDay = Math.max(...days, 1)
    return { count: thisWeek.length, lastWeekCount: lastWeek.length, days, maxDay }
  }, [games])

  // ── feed items ──
  const feedItems = useMemo(() => {
    const items = []
    for (const g of games.slice(0, 25)) {
      items.push({ type: 'game', data: g, date: new Date(g.playedAt) })
    }
    for (const n of notifications) {
      if (n.type === 'event') continue
      items.push({ type: 'notif', data: n, date: new Date(n.createdAt) })
    }
    return items.sort((a, b) => b.date - a.date).slice(0, 30)
  }, [games, notifications])

  if (loading) {
    return (
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <Skeleton w={200} h={28} r={8} style={{ marginBottom: 16 }} />
        <Skeleton w="100%" h={230} r={20} style={{ marginBottom: 14 }} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
          <Skeleton w="100%" h={140} r={20} />
          <Skeleton w="100%" h={140} r={20} />
        </div>
        <SkeletonList rows={4} />
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <Greeting t={t} user={user} seasonLabel={seasonOf(new Date()).label} />

      {nextEvent && <NextEventCard event={nextEvent} t={t} user={user} navigate={navigate} onRsvp={toggleRsvp} busy={rsvpBusy} />}

      <StatsBento snapshot={snapshot} t={t} user={user} navigate={navigate} />

      <Podium standings={topStandings} t={t} user={user} navigate={navigate} />

      <DeckSpotlight spotlight={spotlight} t={t} navigate={navigate} />

      <WeeklyActivity activity={weeklyActivity} t={t} />

      {feedItems.length > 0 ? (
        <>
          <SectionLabel t={t} icon="feed">Attività recente</SectionLabel>
          {feedItems.map((item, index) => (
            <div
              key={item.type === 'game' ? `g-${item.data.id}` : `n-${item.data.id}`}
              className="ct-fade-up"
              style={{ animationDelay: `${(Math.min(index, 8) * 40) + 280}ms` }}
            >
              {item.type === 'game'
                ? <GameFeedItem game={item.data} user={user} t={t} navigate={navigate} />
                : <NotifFeedItem notif={item.data} t={t} navigate={navigate} />
              }
            </div>
          ))}
        </>
      ) : (
        <div style={{ textAlign: 'center', padding: '3rem 1rem', color: t.textMuted, fontSize: 14 }}>
          Ancora nessuna attività. Registra la prima partita!
        </div>
      )}
    </div>
  )
}
