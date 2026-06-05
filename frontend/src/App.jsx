import { useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate, NavLink } from 'react-router-dom'
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

function Brand({ logoSize = 42, titleSize = 14 }) {
  const { t, dark } = useTheme()
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
      <img
        src="/logo.png"
        alt="Commanderone"
        onError={e => { e.currentTarget.style.display = 'none' }}
        style={{ height: logoSize, width: logoSize, objectFit: 'contain', filter: dark ? `drop-shadow(0 0 10px ${t.primaryBorder})` : 'none' }}
      />
      <div style={{ lineHeight: 1.12 }}>
        <div className={`ct-wordmark ${dark ? 'dark' : 'light'}`} style={{ fontWeight: 900, fontSize: titleSize, letterSpacing: '0.04em' }}>COMMANDERONE</div>
        <div style={{ fontSize: titleSize * 0.64, color: t.textMuted, letterSpacing: '0.18em', fontWeight: 600 }}>VILLASTELLONE</div>
      </div>
    </div>
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
      <Route path="/"              element={<DashboardPage />} />
      <Route path="/giocatore/:id" element={<PlayerProfilePage />} />
      <Route path="/mazzo/:id"     element={<DeckProfilePage />} />
      <Route path="/mazzi"         element={<DecksPage />} />
      <Route path="/eventi"        element={<EventsPage />} />
      <Route path="/nuova-partita" element={<NewGamePage />} />
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
          <div style={{ ...navBar, padding: '0 1rem', paddingTop: 'env(safe-area-inset-top)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 58, gap: 8 }}>
              <Brand logoSize={40} titleSize={15} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <IconButton onClick={toggleDark} title={dark ? 'Light mode' : 'Dark mode'}>{dark ? '☀' : '🌙'}</IconButton>
                <IconButton onClick={logout} title="Esci">Esci</IconButton>
              </div>
            </div>
          </div>
        ) : (
          /* ── NAVBAR DESKTOP ── */
          <div style={{ ...navBar, padding: '0 1rem' }}>
            <div style={{ maxWidth: 980, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 62, padding: '8px 0', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <div style={{ marginRight: 8 }}><Brand /></div>
                <NavItem to="/" end>Riepilogo</NavItem>
                <NavItem to="/mazzi">Mazzi</NavItem>
                <NavItem to="/eventi">Eventi</NavItem>
                <NavItem to="/nuova-partita">+ Partita</NavItem>
                {user?.role === 'ADMIN' && <NavItem to="/admin">Admin</NavItem>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: t.text, display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span style={{ width: 26, height: 26, borderRadius: '50%', background: t.primaryBg, color: t.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, border: `1px solid ${t.primaryBorder}` }}>
                    {user?.username?.substring(0, 2).toUpperCase()}
                  </span>
                  {user?.username}
                </span>
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
          <DockItem to="/" end icon="🏠" label="Home" />
          <DockItem to="/mazzi" icon="🎴" label="Mazzi" />
          <DockItem to="/nuova-partita" icon="＋" label="Partita" />
          <DockItem to="/eventi" icon="📅" label="Eventi" />
          <DockItem to={`/giocatore/${user?.id}`} icon="👤" label="Tu" />
          {user?.role === 'ADMIN' && <DockItem to="/admin" icon="⚙" label="Admin" />}
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
