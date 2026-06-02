import { BrowserRouter, Routes, Route, Navigate, NavLink } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'
import { ThemeProvider, useTheme } from './hooks/useTheme'
import Login from './pages/Login'
import DecksPage from './pages/DecksPage'
import NewGamePage from './pages/NewGamePage'
import DashboardPage from './pages/DashboardPage'
import AdminPage from './pages/AdminPage'

function Layout() {
  const { user, logout } = useAuth()
  const { t, dark, toggleDark } = useTheme()

  const navLink = ({ isActive }) => ({
    padding: '6px 14px',
    borderRadius: 20,
    textDecoration: 'none',
    fontSize: 13,
    fontWeight: 500,
    background: isActive ? t.primary : 'transparent',
    color: isActive ? t.primaryFg : t.textSub,
    transition: 'all 0.15s',
  })

  return (
    <div style={{ minHeight: '100vh', background: t.bgPage, fontFamily: 'system-ui, sans-serif', color: t.text, transition: 'background 0.2s, color 0.2s' }}>
      {/* Navbar */}
      <div style={{ background: t.bgNav, borderBottom: `0.5px solid ${t.border}`, padding: '0 1rem', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: 960, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 56 }}>

          {/* Logo + nav links */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginRight: 10, textDecoration: 'none' }}>
              <img
                src="/logo.png"
                alt="Commanderone"
                onError={e => { e.currentTarget.style.display = 'none' }}
                style={{ height: 38, width: 38, objectFit: 'contain' }}
              />
              <div style={{ lineHeight: 1.15 }}>
                <div style={{ fontWeight: 800, fontSize: 13, color: t.primary, letterSpacing: '0.06em' }}>COMMANDERONE</div>
                <div style={{ fontSize: 9, color: t.textMuted, letterSpacing: '0.14em' }}>VILLASTELLONE</div>
              </div>
            </div>
            <NavLink to="/"               end style={navLink}>Riepilogo</NavLink>
            <NavLink to="/mazzi"              style={navLink}>Mazzi</NavLink>
            <NavLink to="/nuova-partita"      style={navLink}>+ Partita</NavLink>
            {user?.role === 'ADMIN' && <NavLink to="/admin" style={navLink}>Admin</NavLink>}
          </div>

          {/* Right side */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 13, color: t.textSub }}>{user?.username}</span>
            <button
              onClick={toggleDark}
              title={dark ? 'Passa a light mode' : 'Passa a dark mode'}
              style={{ padding: '5px 10px', border: `0.5px solid ${t.border}`, borderRadius: 8, background: t.bgSurface, cursor: 'pointer', fontSize: 14, color: t.textSub }}
            >
              {dark ? '☀' : '🌙'}
            </button>
            <button
              onClick={logout}
              style={{ padding: '6px 14px', border: `0.5px solid ${t.border}`, borderRadius: 8, background: t.bgSurface, cursor: 'pointer', fontSize: 12, color: t.textSub }}
            >
              Esci
            </button>
          </div>
        </div>
      </div>

      {/* Page content */}
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '1.5rem 1rem' }}>
        <Routes>
          <Route path="/"              element={<DashboardPage />} />
          <Route path="/mazzi"         element={<DecksPage />} />
          <Route path="/nuova-partita" element={<NewGamePage />} />
          <Route path="/admin"         element={user?.role === 'ADMIN' ? <AdminPage /> : <Navigate to="/" replace />} />
        </Routes>
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
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/*"     element={<PrivateRoute><Layout /></PrivateRoute>} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  )
}
