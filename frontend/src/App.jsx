import { useState, useEffect, lazy, Suspense } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { LazyMotion, domAnimation, m, MotionConfig } from 'motion/react'
import { Toaster } from 'sonner'
import { BrowserRouter, Routes, Route, Navigate, NavLink, useLocation, useNavigate } from 'react-router-dom'

function RedirectWithSearch({ to }) {
  const { search } = useLocation()
  return <Navigate to={to + search} replace />
}
import { AuthProvider, useAuth } from './hooks/useAuth'
import { ThemeProvider, useTheme } from './hooks/useTheme'
import { FeedbackProvider } from './hooks/useFeedback'
import { useIsMobile } from './hooks/useIsMobile'
import Login from './pages/Login'
const DecksPage = lazy(() => import('./pages/DecksPage'))
const NewGamePage = lazy(() => import('./pages/NewGamePage'))
import FeedPage from './pages/FeedPage'
const GruppoPage = lazy(() => import('./pages/GruppoPage'))
const AdminPage = lazy(() => import('./pages/AdminPage'))
const PlayerProfilePage = lazy(() => import('./pages/PlayerProfilePage'))
const DeckProfilePage = lazy(() => import('./pages/DeckProfilePage'))
const EventsPage = lazy(() => import('./pages/EventsPage'))
const EventDetailPage = lazy(() => import('./pages/EventDetailPage'))
const GamePage = lazy(() => import('./pages/GamePage'))
const JudgePage = lazy(() => import('./pages/JudgePage'))
const GiocaPage = lazy(() => import('./pages/GiocaPage'))
const GuidaPage = lazy(() => import('./pages/GuidaPage'))
const LandingPage = lazy(() => import('./pages/LandingPage'))
import NotificationBell from './components/NotificationBell'
import PlayerAvatar from './components/PlayerAvatar'
import { Icon } from './components/ui'
import { SkeletonList } from './components/Skeleton'
import { api } from './lib/api'

function NavItem({ to, end, children }) {
  const { t } = useTheme()
  const [hover, setHover] = useState(false)
  return (
    <NavLink
      to={to}
      end={end}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={({ isActive }) => ({
        padding: '7px 15px',
        borderRadius: 10,
        textDecoration: 'none',
        fontSize: 13,
        fontWeight: 600,
        letterSpacing: '0.01em',
        background: isActive ? t.primary : hover ? t.bgMuted : 'transparent',
        color: isActive ? t.primaryFg : hover ? t.text : t.textSub,
        boxShadow: isActive ? t.glow : 'none',
        transition: 'all 0.18s ease',
      })}
    >
      {children}
    </NavLink>
  )
}

function IconButton({ onClick, title, children }) {
  const { t } = useTheme()
  const [hover, setHover] = useState(false)
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        padding: '6px 12px',
        border: `1px solid ${hover ? t.borderStrong : t.border}`,
        borderRadius: 10,
        background: hover ? t.bgMuted : t.bgSurfaceAlt,
        cursor: 'pointer',
        fontSize: 13,
        fontWeight: 500,
        color: t.textSub,
        transition: 'all 0.18s ease',
      }}
    >
      {children}
    </button>
  )
}

function Brand({ logoSize = 42, titleSize = 14, compact = false }) {
  const { t, dark } = useTheme()
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
      <img
        src="/logo.png"
        alt="Commanderone"
        onError={e => { e.currentTarget.style.display = 'none' }}
        style={{ height: logoSize, width: logoSize, objectFit: 'contain', filter: dark ? `drop-shadow(0 0 10px ${t.primaryBorder})` : 'none' }}
      />
      {!compact && (
        <div style={{ lineHeight: 1.12 }}>
          <div className={`ct-wordmark ${dark ? 'dark' : 'light'}`} style={{ fontWeight: 900, fontSize: titleSize, letterSpacing: '0.04em' }}>COMMANDERONE</div>
          <div style={{ fontSize: titleSize * 0.64, color: t.textMuted, letterSpacing: '0.18em', fontWeight: 600 }}>VILLASTELLONE</div>
        </div>
      )}
    </div>
  )
}

// Avatar + username, riusato in alto a destra.
function UserChip({ titleSize = 13, avatar = 26, hideLabel = false }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { t } = useTheme()
  return (
    <span
      onClick={() => user?.id && navigate(`/giocatore/${user.id}`)}
      title="Vai al tuo profilo"
      style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0, cursor: 'pointer' }}
    >
      <PlayerAvatar username={user?.username} avatarCardName={user?.avatarCardName} avatarScryfallId={user?.avatarScryfallId} size={avatar} highlight />
      {!hideLabel && (
        <span style={{ fontSize: titleSize, fontWeight: 600, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {user?.username}
        </span>
      )}
    </span>
  )
}

// ── Nav mobile v2: pillola flottante Feed | Eventi | [GIOCA] | Gruppo | Io ──

function PillItem({ to, end, icon, label, active, dot }) {
  const { t } = useTheme()
  return (
    <NavLink
      to={to}
      end={end}
      aria-label={label}
      className="ct-press"
      style={{
        flex: 1, minWidth: 0, minHeight: 52, textDecoration: 'none', position: 'relative',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
        color: active ? t.primary : t.textSub, transition: 'color 0.15s ease',
      }}
    >
      {active && (
        <m.span layoutId="ct-pill-indicator" transition={{ type: 'spring', stiffness: 520, damping: 38 }} style={{
          position: 'absolute', top: 2, width: 18, height: 3, borderRadius: 3, background: t.primary,
          boxShadow: `0 0 8px ${t.primary}`,
        }} />
      )}
      <span style={{ position: 'relative', display: 'flex', filter: active ? `drop-shadow(0 0 6px ${t.primaryBorder})` : 'none' }}>
        <Icon name={icon} size={23} />
        {dot && <span style={{ position: 'absolute', top: -1, right: -3, width: 8, height: 8, borderRadius: '50%', background: t.primary, boxShadow: `0 0 6px ${t.primary}` }} />}
      </span>
      <span style={{ fontSize: 12, fontWeight: active ? 700 : 600, letterSpacing: '0.01em' }}>{label}</span>
    </NavLink>
  )
}

function PillNav({ user, hasUpcomingEvent }) {
  const { t, dark } = useTheme()
  const { pathname } = useLocation()
  const isPlay = ['/gioca', '/nuova-partita', '/giudice'].some(p => pathname.startsWith(p))
  const myProfile = `/giocatore/${user?.id}`
  return (
    <div style={{
      position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 30, pointerEvents: 'none',
      padding: '0 12px calc(12px + env(safe-area-inset-bottom))',
    }}>
      <nav aria-label="Navigazione principale" style={{
        pointerEvents: 'auto', maxWidth: 448, margin: '0 auto', height: 64, borderRadius: 999,
        background: dark ? 'rgba(14,18,43,0.85)' : 'rgba(255,255,255,0.88)',
        backdropFilter: 'blur(18px) saturate(160%)', WebkitBackdropFilter: 'blur(18px) saturate(160%)',
        border: `1px solid ${dark ? 'rgba(52,240,143,0.25)' : t.primaryBorder}`,
        boxShadow: dark ? '0 12px 40px rgba(0,0,0,0.6)' : '0 10px 30px rgba(20,20,42,0.16)',
        display: 'flex', alignItems: 'center', padding: '0 6px',
      }}>
        <PillItem to="/" end icon="feed" label="Feed" active={pathname === '/'} />
        <PillItem to="/eventi" icon="calendar" label="Eventi" dot={hasUpcomingEvent}
          active={pathname.startsWith('/eventi') || pathname.startsWith('/evento')} />
        <div style={{ flex: '0 0 68px', display: 'flex', justifyContent: 'center' }}>
          <NavLink
            to="/gioca"
            aria-label="Gioca"
            className={`ct-press ${isPlay ? '' : 'ct-glow-pulse'}`}
            style={{
              width: 58, height: 58, marginTop: -26, borderRadius: '50%', textDecoration: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: t.primary, color: t.primaryFg,
              border: `4px solid ${dark ? '#0e122b' : t.bgPage}`,
              boxShadow: isPlay ? `0 0 26px ${t.primary}` : undefined,
            }}
          >
            <Icon name="swords" size={28} stroke={2.2} />
          </NavLink>
        </div>
        <PillItem to="/gruppo" icon="groups" label="Gruppo" active={pathname.startsWith('/gruppo')} />
        <PillItem to={myProfile} icon="person" label="Io" active={pathname === myProfile} />
      </nav>
    </div>
  )
}

// ── Menu account (tap sull'avatar): profilo, mazzi, tema, guida, admin, esci ──
function AccountMenu() {
  const { user, logout } = useAuth()
  const { t, dark, toggleDark } = useTheme()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const go = (to) => { setOpen(false); navigate(to) }

  const Row = ({ icon, label, sub, onClick, danger, right }) => (
    <button onClick={onClick} className="ct-press" style={{
      width: '100%', display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', minHeight: 56,
      background: 'transparent', border: 'none', borderTop: `1px solid ${t.border}`, cursor: 'pointer', textAlign: 'left',
      color: danger ? t.danger : t.text, fontSize: 15, fontWeight: 600,
    }}>
      <span style={{ color: danger ? t.danger : t.primary, display: 'flex' }}><Icon name={icon} size={20} /></span>
      <span style={{ flex: 1, minWidth: 0 }}>
        {label}
        {sub && <span style={{ display: 'block', fontSize: 12, fontWeight: 500, color: t.textSub, marginTop: 2 }}>{sub}</span>}
      </span>
      {right === undefined ? <span style={{ color: t.textMuted, display: 'flex' }}><Icon name="chevron" size={18} /></span> : right}
    </button>
  )

  return (
    <>
      <button onClick={() => setOpen(true)} aria-label="Menu account" className="ct-press"
        style={{ padding: 0, border: 'none', background: 'transparent', cursor: 'pointer', borderRadius: '50%', display: 'flex' }}>
        <PlayerAvatar username={user?.username} avatarCardName={user?.avatarCardName} avatarScryfallId={user?.avatarScryfallId} size={34} highlight />
      </button>
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Overlay style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(4,6,18,0.6)' }} />
          <Dialog.Content aria-describedby={undefined} className="ct-sheet-in" style={{
            position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 61, margin: '0 auto', outline: 'none',
            width: '100%', maxWidth: 480, boxSizing: 'border-box', background: dark ? '#0e122b' : '#FFFFFF',
            borderRadius: '24px 24px 0 0', border: `1px solid ${t.border}`, borderBottom: 'none',
            paddingBottom: 'calc(12px + env(safe-area-inset-bottom))', boxShadow: '0 -12px 40px rgba(0,0,0,0.45)',
          }}>
            <div style={{ width: 40, height: 4, borderRadius: 4, background: t.borderStrong, margin: '10px auto 6px' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px 16px' }}>
              <PlayerAvatar username={user?.username} avatarCardName={user?.avatarCardName} avatarScryfallId={user?.avatarScryfallId} size={48} highlight />
              <div style={{ minWidth: 0 }}>
                <Dialog.Title style={{ margin: 0, fontSize: 18, fontWeight: 800, color: t.text, wordBreak: 'break-word' }}>{user?.username}</Dialog.Title>
                <div style={{ fontSize: 13, color: t.textSub }}>{user?.role === 'ADMIN' ? 'Amministratore' : 'Giocatore'}</div>
              </div>
            </div>
            <Row icon="person" label="Il mio profilo" onClick={() => go(`/giocatore/${user?.id}`)} />
            <Row icon="cards" label="I miei mazzi" onClick={() => go('/mazzi')} />
            <Row icon={dark ? 'sun' : 'moon'} label={dark ? 'Tema chiaro' : 'Tema scuro'}
              sub={dark ? 'Ora: scuro (consigliato per la serata)' : 'Ora: chiaro'} onClick={toggleDark}
              right={<span style={{ fontSize: 13, fontWeight: 700, color: t.primary }}>Cambia</span>} />
            <Row icon="book" label="Guida utente" onClick={() => go('/guida')} />
            {user?.role === 'ADMIN' && <Row icon="shield" label="Pannello Admin" onClick={() => go('/admin')} />}
            <Row icon="logout" label="Esci" danger onClick={() => { setOpen(false); logout() }} right={null} />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  )
}

function Layout() {
  const { user, logout } = useAuth()
  const { t, dark, toggleDark } = useTheme()
  const isMobile = useIsMobile()
  const { pathname } = useLocation()
  const hideNav = pathname.startsWith('/nuova-partita')

  // Pallino su "Eventi" se c'è un evento futuro (una sola chiamata all'avvio).
  const [hasUpcomingEvent, setHasUpcomingEvent] = useState(false)
  useEffect(() => {
    api.getEvents()
      .then(list => setHasUpcomingEvent(list.some(e => new Date(e.startsAt).getTime() > Date.now() - 6 * 3600000)))
      .catch(() => {})
  }, [])

  const routes = (
    <Routes>
      <Route path="/"              element={<FeedPage />} />
      <Route path="/gruppo"        element={<GruppoPage />} />
      {/* Gioca: nuova landing */}
      <Route path="/gioca"         element={<GiocaPage />} />
      <Route path="/eventi"        element={<EventsPage />} />
      {/* Redirect /tornei → /eventi per retrocompatibilità deep-link */}
      <Route path="/tornei"        element={<RedirectWithSearch to="/eventi" />} />
      <Route path="/giocatore/:id" element={<PlayerProfilePage />} />
      <Route path="/mazzo/:id"     element={<DeckProfilePage />} />
      <Route path="/mazzi"         element={<DecksPage />} />
      <Route path="/partita/:id"   element={<GamePage />} />
      <Route path="/evento/:id"    element={<EventDetailPage />} />
      <Route path="/nuova-partita" element={<NewGamePage />} />
      <Route path="/giudice"       element={<JudgePage />} />
      <Route path="/guida"         element={<GuidaPage />} />
      <Route path="/admin"         element={user?.role === 'ADMIN' ? <AdminPage /> : <Navigate to="/" replace />} />
    </Routes>
  )

  const navBar = {
    background: t.bgNav,
    backdropFilter: 'blur(16px) saturate(160%)',
    WebkitBackdropFilter: 'blur(16px) saturate(160%)',
    borderBottom: `1px solid ${t.border}`,
    position: 'sticky', top: 0, zIndex: 20,
  }

  return (
    <div style={{ minHeight: '100dvh', position: 'relative', color: t.text }}>
      <div className={`ct-aurora ${dark ? 'dark' : 'light'}`} />

      <div style={{ position: 'relative', zIndex: 1 }}>

        {isMobile ? (
          /* ── HEADER MOBILE v2: brand · campanella · avatar (menu account) ── */
          <div style={{ ...navBar, padding: '0 0.85rem', paddingTop: 'env(safe-area-inset-top)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, minHeight: 60 }}>
              {/* Logo + scritta come su main (wordmark sfumato); cede per primo se lo spazio manca */}
              <div style={{ minWidth: 0, overflow: 'hidden', flexShrink: 1 }}>
                <Brand logoSize={34} titleSize={13} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                <NotificationBell />
                <AccountMenu />
              </div>
            </div>
          </div>
        ) : (
          /* ── NAVBAR DESKTOP ── */
          <div style={{ ...navBar, padding: '0 1rem' }}>
            <div style={{ maxWidth: 980, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 62, padding: '8px 0', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <div style={{ marginRight: 8 }}><Brand /></div>
                <NavItem to="/" end>Feed</NavItem>
                <NavItem to="/gioca">Gioca</NavItem>
                <NavItem to="/eventi">Eventi</NavItem>
                <NavItem to="/gruppo">Gruppo</NavItem>
                <NavItem to="/mazzi">Mazzi</NavItem>
                {user?.role === 'ADMIN' && <NavItem to="/admin">Admin</NavItem>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <UserChip />
                <NotificationBell />
                <IconButton onClick={toggleDark} title={dark ? 'Passa a light mode' : 'Passa a dark mode'}>{dark ? '☀' : '🌙'}</IconButton>
                <IconButton onClick={logout} title="Esci">Esci</IconButton>
              </div>
            </div>
          </div>
        )}

        {/* Contenuto */}
        <div style={{ maxWidth: 980, margin: '0 auto', padding: isMobile ? `1rem 0.85rem calc(${hideNav ? 24 : 112}px + env(safe-area-inset-bottom))` : '1.75rem 1rem 3rem' }}>
          <Suspense fallback={<SkeletonList rows={5} />}>
            <m.div
              key={pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            >
              {routes}
            </m.div>
          </Suspense>
        </div>
      </div>

      {/* ── NAV MOBILE v2 (nascosta nel logger "Registra partita", a schermo intero) ── */}
      {isMobile && !hideNav && <PillNav user={user} hasUpcomingEvent={hasUpcomingEvent} />}
    </div>
  )
}

function PrivateRoute({ children }) {
  const { user } = useAuth()
  return user ? children : <Navigate to="/login" replace />
}

// Toast sonner (conferma dopo il salvataggio partita, con "Annulla").
function ThemedToaster() {
  const { t, dark } = useTheme()
  return (
    <Toaster
      theme={dark ? 'dark' : 'light'}
      position="top-center"
      offset={16}
      toastOptions={{
        style: {
          background: dark ? '#0e122b' : '#FFFFFF', color: t.text, border: `1px solid ${t.primaryBorder}`,
          borderRadius: 16, fontSize: 15, fontFamily: 'inherit', boxShadow: t.shadow,
        },
      }}
    />
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <FeedbackProvider>
        <AuthProvider>
          <MotionConfig reducedMotion="user">
          <LazyMotion features={domAnimation} strict>
          <ThemedToaster />
          <BrowserRouter>
            <Suspense fallback={null}>
            <Routes>
              <Route path="/login" element={<Login />} />
              {/* Landing pubblica, scollegata dal portale: nessun redirect in base al login. */}
              <Route path="/info"  element={<LandingPage />} />
              <Route path="/*"     element={<PrivateRoute><Layout /></PrivateRoute>} />
            </Routes>
            </Suspense>
          </BrowserRouter>
          </LazyMotion>
          </MotionConfig>
        </AuthProvider>
      </FeedbackProvider>
    </ThemeProvider>
  )
}
