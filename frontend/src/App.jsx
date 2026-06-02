import { useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate, NavLink } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'
import { ThemeProvider, useTheme } from './hooks/useTheme'
import { FeedbackProvider } from './hooks/useFeedback'
import Login from './pages/Login'
import DecksPage from './pages/DecksPage'
import NewGamePage from './pages/NewGamePage'
import DashboardPage from './pages/DashboardPage'
import AdminPage from './pages/AdminPage'
import PlayerProfilePage from './pages/PlayerProfilePage'
import DeckProfilePage from './pages/DeckProfilePage'

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

function Layout() {
  const { user, logout } = useAuth()
  const { t, dark, toggleDark } = useTheme()

  return (
    <div style={{ minHeight: '100vh', position: 'relative', color: t.text }}>
      {/* Sfondo aurora */}
      <div className={`ct-aurora ${dark ? 'dark' : 'light'}`} />

      <div style={{ position: 'relative', zIndex: 1 }}>
        {/* Navbar */}
        <div style={{
          background: t.bgNav,
          backdropFilter: 'blur(16px) saturate(160%)',
          WebkitBackdropFilter: 'blur(16px) saturate(160%)',
          borderBottom: `1px solid ${t.border}`,
          padding: '0 1rem',
          position: 'sticky',
          top: 0,
          zIndex: 20,
        }}>
          <div style={{ maxWidth: 980, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 62, padding: '8px 0', gap: 12, flexWrap: 'wrap' }}>

            {/* Logo + nav links */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginRight: 8 }}>
                <div style={{
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <img
                    src="/logo.png"
                    alt="Commanderone"
                    onError={e => { e.currentTarget.style.display = 'none' }}
                    style={{ height: 42, width: 42, objectFit: 'contain', filter: dark ? `drop-shadow(0 0 10px ${t.primaryBorder})` : 'none' }}
                  />
                </div>
                <div style={{ lineHeight: 1.12 }}>
                  <div className={`ct-wordmark ${dark ? 'dark' : 'light'}`} style={{ fontWeight: 900, fontSize: 14, letterSpacing: '0.04em' }}>COMMANDERONE</div>
                  <div style={{ fontSize: 9, color: t.textMuted, letterSpacing: '0.18em', fontWeight: 600 }}>VILLASTELLONE</div>
                </div>
              </div>
              <NavItem to="/" end>Riepilogo</NavItem>
              <NavItem to="/mazzi">Mazzi</NavItem>
              <NavItem to="/nuova-partita">+ Partita</NavItem>
              {user?.role === 'ADMIN' && <NavItem to="/admin">Admin</NavItem>}
            </div>

            {/* Right side */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                fontSize: 13,
                fontWeight: 600,
                color: t.text,
                display: 'flex',
                alignItems: 'center',
                gap: 7,
              }}>
                <span style={{
                  width: 26, height: 26, borderRadius: '50%',
                  background: t.primaryBg, color: t.primary,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700,
                  border: `1px solid ${t.primaryBorder}`,
                }}>
                  {user?.username?.substring(0, 2).toUpperCase()}
                </span>
                {user?.username}
              </span>
              <IconButton onClick={toggleDark} title={dark ? 'Passa a light mode' : 'Passa a dark mode'}>
                {dark ? '☀' : '🌙'}
              </IconButton>
              <IconButton onClick={logout} title="Esci">Esci</IconButton>
            </div>
          </div>
        </div>

        {/* Page content */}
        <div style={{ maxWidth: 980, margin: '0 auto', padding: '1.75rem 1rem 3rem' }}>
          <Routes>
            <Route path="/"              element={<DashboardPage />} />
            <Route path="/giocatore/:id" element={<PlayerProfilePage />} />
            <Route path="/mazzo/:id"     element={<DeckProfilePage />} />
            <Route path="/mazzi"         element={<DecksPage />} />
            <Route path="/nuova-partita" element={<NewGamePage />} />
            <Route path="/admin"         element={user?.role === 'ADMIN' ? <AdminPage /> : <Navigate to="/" replace />} />
          </Routes>
        </div>
      </div>
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
