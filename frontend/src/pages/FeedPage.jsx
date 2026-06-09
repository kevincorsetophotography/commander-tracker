import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { useTheme } from '../hooks/useTheme'
import { useAuth } from '../hooks/useAuth'
import { seasonOf, computeStandings } from '../lib/seasons'
import { Skeleton, SkeletonList } from '../components/Skeleton'

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

function ordinal(n) {
  if (n <= 3) return `${n}°`
  return `${n}°`
}

// ─── sub-components ────────────────────────────────────────

function WinBar({ pct, t }) {
  return (
    <div style={{ height: 5, borderRadius: 3, background: t.bgMuted, overflow: 'hidden', marginTop: 8 }}>
      <div style={{ height: '100%', width: `${pct}%`, background: t.primary, borderRadius: 3, transition: 'width 0.6s ease' }} />
    </div>
  )
}

function SnapshotCard({ snapshot, t, user, navigate }) {
  if (!snapshot) return null
  const { total, wins, streak, myStanding, myRank, seasonLabel } = snapshot
  const winPct = total ? Math.round(wins / total * 100) : 0

  return (
    <div
      onClick={() => navigate('/gruppo')}
      style={{
        background: t.bgSurface,
        border: `1px solid ${t.border}`,
        borderRadius: 18,
        padding: '1.25rem 1.4rem',
        boxShadow: t.shadow,
        marginBottom: 16,
        cursor: 'pointer',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: t.text }}>Ciao, {user?.username}</div>
          <div style={{ fontSize: 13, color: t.textSub, marginTop: 2 }}>{seasonLabel}</div>
        </div>
        {myRank && (
          <button
            onClick={e => { e.stopPropagation(); navigate(`/giocatore/${user?.id}`) }}
            style={{
              background: t.primaryBg, border: `1px solid ${t.primaryBorder}`,
              borderRadius: 12, padding: '6px 14px', cursor: 'pointer',
              fontSize: 18, fontWeight: 800, color: t.primary,
              lineHeight: 1,
            }}
          >
            {ordinal(myRank)}
          </button>
        )}
      </div>

      {total > 0 ? (
        <>
          <div style={{ fontSize: 13, color: t.textSub, marginTop: 8 }}>
            {myStanding ? `${myStanding.points} pt · ` : ''}
            {wins} {wins === 1 ? 'vittoria' : 'vittorie'} su {total}
            {streak >= 2 && (
              <span style={{ marginLeft: 10, color: t.primary, fontWeight: 700 }}>
                Streak {streak}
              </span>
            )}
          </div>
          <WinBar pct={winPct} t={t} />
        </>
      ) : (
        <div style={{ fontSize: 13, color: t.textMuted, marginTop: 8 }}>
          Ancora nessuna partita questa stagione.
        </div>
      )}
    </div>
  )
}

function EventBanner({ event, t, navigate }) {
  const dateStr = new Date(event.startsAt).toLocaleDateString('it-IT', {
    weekday: 'long', day: 'numeric', month: 'long',
  })
  const rsvpCount = event.rsvps?.length || 0

  return (
    <div
      onClick={() => navigate(`/evento/${event.id}`)}
      style={{
        background: t.primaryBg,
        border: `1px solid ${t.primaryBorder}`,
        borderRadius: 14,
        padding: '1rem 1.25rem',
        marginBottom: 16,
        cursor: 'pointer',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 11, color: t.primary, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>
          Prossimo evento
        </div>
        <div style={{ fontSize: 15, fontWeight: 700, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {event.title}
        </div>
        <div style={{ fontSize: 12, color: t.textSub, marginTop: 3 }}>
          {dateStr}{rsvpCount > 0 ? ` · ${rsvpCount} iscritti` : ''}
        </div>
      </div>
      <span style={{ fontSize: 20, color: t.primary, fontWeight: 700, flexShrink: 0, marginLeft: 12 }}>›</span>
    </div>
  )
}

function GameFeedItem({ game, user, t, navigate }) {
  const me = game.players.find(p => p.user.id === user?.id)
  const winner = game.players.find(p => p.isWinner)
  const iWon = me?.isWinner
  const iPlayed = !!me

  const others = game.players
    .filter(p => p.user.id !== user?.id)
    .map(p => p.user.username)
    .join(', ')
  const allPlayers = game.players.map(p => p.user.username).join(', ')

  let icon, title, sub, titleColor
  if (iWon) {
    icon = '🏆'; title = 'Hai vinto!'; sub = others ? `Contro ${others}` : ''; titleColor = '#4caf50'
  } else if (iPlayed) {
    icon = '⚔'; title = `Ha vinto ${winner?.user?.username || '?'}`; sub = others ? `Con ${others}` : ''; titleColor = t.text
  } else {
    icon = '⚔'; title = `${winner?.user?.username || '?'} ha vinto`; sub = allPlayers; titleColor = t.text
  }

  return (
    <div
      onClick={() => navigate(`/partita/${game.id}`)}
      style={{
        background: t.bgSurface,
        border: `1px solid ${t.border}`,
        borderRadius: 12,
        padding: '0.85rem 1rem',
        marginBottom: 8,
        cursor: 'pointer',
        display: 'flex', alignItems: 'flex-start', gap: 12,
      }}
    >
      <span style={{ fontSize: 20, lineHeight: '24px', flexShrink: 0 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: titleColor }}>{title}</div>
        {sub && (
          <div style={{ fontSize: 12, color: t.textSub, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {sub}
          </div>
        )}
      </div>
      <span style={{ fontSize: 11, color: t.textMuted, flexShrink: 0, marginTop: 2 }}>
        {relativeDate(game.playedAt)}
      </span>
    </div>
  )
}

function NotifFeedItem({ notif, t, navigate }) {
  const icons = { achievement: '🏅', comment: '💬', reaction: '👍' }
  const icon = icons[notif.type] || '📢'
  const isUnread = !notif.read

  return (
    <div
      onClick={() => notif.link && navigate(notif.link)}
      style={{
        background: isUnread ? t.primaryBg : t.bgSurface,
        border: `1px solid ${isUnread ? t.primaryBorder : t.border}`,
        borderRadius: 12,
        padding: '0.85rem 1rem',
        marginBottom: 8,
        cursor: notif.link ? 'pointer' : 'default',
        display: 'flex', alignItems: 'flex-start', gap: 12,
      }}
    >
      <span style={{ fontSize: 20, lineHeight: '24px', flexShrink: 0 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {notif.title}
        </div>
        {notif.body && (
          <div style={{ fontSize: 12, color: t.textSub, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {notif.body}
          </div>
        )}
      </div>
      <span style={{ fontSize: 11, color: t.textMuted, flexShrink: 0, marginTop: 2 }}>
        {relativeDate(notif.createdAt)}
      </span>
    </div>
  )
}

// ─── main ──────────────────────────────────────────────────

export default function FeedPage() {
  const { t } = useTheme()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [games, setGames] = useState([])
  const [events, setEvents] = useState([])
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([api.getGames(), api.getEvents(), api.getNotifications()])
      .then(([g, e, n]) => { setGames(g); setEvents(e); setNotifications(n) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

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

    const currentSeasonKey = seasonOf(new Date()).key
    const { standings } = computeStandings(games, currentSeasonKey)
    const myStanding = standings.find(s => s.id === user.id)
    const myRank = myStanding ? standings.indexOf(myStanding) + 1 : null
    const seasonLabel = seasonOf(new Date()).label

    return { total, wins, streak, myStanding, myRank, seasonLabel }
  }, [games, user])

  const nextEvent = useMemo(() => {
    const now = new Date()
    return events
      .filter(e => new Date(e.startsAt) > now)
      .sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt))[0] || null
  }, [events])

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
        <div style={{ background: t.bgSurface, border: `1px solid ${t.border}`, borderRadius: 18, padding: '1.25rem 1.4rem', marginBottom: 16, boxShadow: t.shadow }}>
          <Skeleton w={160} h={22} r={6} />
          <Skeleton w={120} h={12} r={6} style={{ marginTop: 8 }} />
          <Skeleton w="100%" h={5} r={3} style={{ marginTop: 16 }} />
        </div>
        <SkeletonList rows={5} />
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <SnapshotCard snapshot={snapshot} t={t} user={user} navigate={navigate} />

      {nextEvent && <EventBanner event={nextEvent} t={t} navigate={navigate} />}

      {feedItems.length > 0 ? (
        <>
          <div style={{ fontSize: 12, fontWeight: 700, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
            Attivita recente
          </div>
          {feedItems.map(item =>
            item.type === 'game'
              ? <GameFeedItem key={`g-${item.data.id}`} game={item.data} user={user} t={t} navigate={navigate} />
              : <NotifFeedItem key={`n-${item.data.id}`} notif={item.data} t={t} navigate={navigate} />
          )}
        </>
      ) : (
        <div style={{ textAlign: 'center', padding: '3rem 1rem', color: t.textMuted, fontSize: 14 }}>
          Ancora nessuna attivita. Registra la prima partita!
        </div>
      )}
    </div>
  )
}
