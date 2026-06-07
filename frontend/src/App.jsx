import { useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate, NavLink, useLocation } from 'react-router-dom'

function RedirectWithSearch({ to }) {
  const { search } = useLocation()
  return <Navigate to={to + search} replace />
}
import { AuthProvider, useAuth } from './hooks/useAuth'
import { ThemeProvider, useTheme } from './hooks/useTheme'
import { FeedbackProvider } from './hooks/useFeedback'
import { useIsMobile } from './hooks/useIsMobile'
import Login from './pages/Login'
import DecksPage from './pages/DecksPage'
import NewGamePage from './pages/NewGamePage'
import DashboardPage from './pages/DashboardPage'
import AdminPage from './pages/AdminPage'
import PlayerProfilePage from './pages/PlayerProfilePage'
import DeckProfilePage from './pages/DeckProfilePage'
import EventsPage from './pages/EventsPage'
import EventDetailPage from './pages/EventDetailPage'
import GamePage from './pages/GamePage'
import JudgePage from './pages/JudgePage'
import GiocaPage from './pages/GiocaPage'
import NotificationBell from './components/NotificationBell'

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

// Avatar (iniziali) + username, riusato in alto a destra.
function UserChip({ titleSize = 13, avatar = 26 }) {
  const { t } = useTheme()
  const { user } = useAuth()
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
      <span style={{ width: avatar, height: avatar, borderRadius: '50%', background: t.primaryBg, color: t.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: avatar * 0.42, fontWeight: 700, border: `1px solid ${t.primaryBorder}`, flexShrink: 0 }}>
        {user?.username?.substring(0, 2).toUpperCase()}
      </span>
      <span style={{ fontSize: titleSize, fontWeight: 600, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {user?.username}
      </span>
    </span>
  )
}

function DockItem({ to, end, icon, label }) {
  const { t } = useTheme()
  return (
    <NavLink
      to={to}
      end={end}
      style={({ isActive }) => ({
        flex: 1, minWidth: 0, textDecoration: 'none',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
        minHeight: 56, padding: '8px 2px', borderRadius: 14,
        color: isActive ? t.primary : t.textSub,
        background: isActive ? t.primaryBg : 'transparent',
        transition: 'all 0.15s ease',
      })}
    >
      <span style={{ fontSize: 24, lineHeight: 1 }}>{icon}</span>
      <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.02em' }}>{label}</span>
    </NavLink>
  )
}

function Layout() {
  const { user, logout } = useAuth()
  const { t, dark, toggleDark } = useTheme()
  const isMobile = useIsMobile()

  const routes = (
    <Routes>
      {/* Feed: placeholder → DashboardPage fino a FeedPage (Fase 3) */}
      <Route path="/"              element={<DashboardPage />} />
      {/* Gruppo: placeholder → DashboardPage fino a GruppoPage (Fase 4) */}
      <Route path="/gruppo"        element={<DashboardPage />} />
      {/* Gioca: nuova landing */}
      <Route path="/gioca"         element={<GiocaPage />} />
      {/* Tornei: alias di /eventi, sarà rinominato in Fase 6 */}
      <Route path="/tornei"        element={<EventsPage />} />
      {/* Redirect /eventi → /tornei preservando querystring (deep-link notifiche) */}
      <Route path="/eventi"        element={<RedirectWithSearch to="/tornei" />} />
      <Route path="/giocatore/:id" element={<PlayerProfilePage />} />
      <Route path="/mazzo/:id"     element={<DeckProfilePage />} />
      <Route path="/mazzi"         element={<DecksPage />} />
      <Route path="/partita/:id"   element={<GamePage />} />
      <Route path="/evento/:id"    element={<EventDetailPage />} />
      <Route path="/nuova-partita" element={<NewGamePage />} />
      <Route path="/giudice"       element={<JudgePage />} />
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
          /* ── HEADER MOBILE (brand grande) ── */
          <div style={{ ...navBar, padding: '0 0.5rem', paddingTop: 'env(safe-area-inset-top)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, padding: '8px 0' }}>
              {/* su schermi molto stretti è il brand a cedere, non username/azioni */}
              <div style={{ minWidth: 0, overflow: 'hidden', flexShrink: 1 }}>
                <Brand logoSize={34} titleSize={13} />
              </div>
              {/* A destra: nome utente sopra, azioni sotto */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
                <UserChip titleSize={12.5} avatar={22} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <NotificationBell />
                  <IconButton onClick={toggleDark} title={dark ? 'Light mode' : 'Dark mode'}>{dark ? '☀' : '🌙'}</IconButton>
                  <IconButton onClick={logout} title="Esci">Esci</IconButton>
                </div>
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
                <NavItem to="/tornei">Tornei</NavItem>
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
        <div style={{ maxWidth: 980, margin: '0 auto', padding: isMobile ? '1rem 0.85rem calc(104px + env(safe-area-inset-bottom))' : '1.75rem 1rem 3rem' }}>
          {routes}
        </div>
      </div>

      {/* ── DOCK MOBILE ── */}
      {isMobile && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 30,
          background: t.bgNav,
          backdropFilter: 'blur(16px) saturate(160%)',
          WebkitBackdropFilter: 'blur(16px) saturate(160%)',
          borderTop: `1px solid ${t.border}`,
          display: 'flex', gap: 4,
          padding: '6px 8px calc(6px + env(safe-area-inset-bottom)) 8px',
        }}>
          <DockItem to="/" end icon="🏠" label="Feed" />
          <DockItem to="/gioca"  icon="🎮" label="Gioca" />
          <DockItem to="/tornei" icon="📅" label="Tornei" />
          <DockItem to="/gruppo" icon="📊" label="Gruppo" />
          <DockItem to={`/giocatore/${user?.id}`} icon="👤" label="Io" />
        </div>
      )}
    </div>
  )
}

function PrivateRoute({ children }) {
  const { user } = useAuth()
  return user ? children : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <ThemeProvider>
      <FeedbackProvider>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/*"     element={<PrivateRoute><Layout /></PrivateRoute>} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </FeedbackProvider>
    </ThemeProvider>
  )
}
