import { BrowserRouter, Routes, Route, Navigate, NavLink } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'
import Login from './pages/Login'
import DecksPage from './pages/DecksPage'
import NewGamePage from './pages/NewGamePage'
import DashboardPage from './pages/DashboardPage'
import AdminPage from './pages/AdminPage'

function Layout() {
  const { user, logout } = useAuth()

  const navStyle = ({ isActive }) => ({
    padding: '8px 16px',
    borderRadius: 20,
    textDecoration: 'none',
    fontSize: 13,
    fontWeight: 500,
    background: isActive ? '#534AB7' : 'transparent',
    color: isActive ? '#fff' : '#666',
    transition: 'all 0.15s',
  })

  return (
    <div style={{ minHeight: '100vh', background: '#f5f4f0', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ background: '#fff', borderBottom: '0.5px solid #e0ddd5', padding: '0 1rem' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 52 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 500, fontSize: 15, marginRight: 8 }}>Commander Tracker</span>
            <NavLink to="/" end style={navStyle}>Riepilogo</NavLink>
            <NavLink to="/mazzi" style={navStyle}>Mazzi</NavLink>
            <NavLink to="/nuova-partita" style={navStyle}>+ Partita</NavLink>
            {user?.role === 'ADMIN' && <NavLink to="/admin" style={navStyle}>Admin</NavLink>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 13, color: '#888' }}>{user?.username}</span>
            <button onClick={logout} style={{ padding: '6px 14px', border: '0.5px solid #ccc', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 12, color: '#666' }}>
              Esci
            </button>
          </div>
        </div>
      </div>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '1.5rem 1rem' }}>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/mazzi" element={<DecksPage />} />
          <Route path="/nuova-partita" element={<NewGamePage />} />
          <Route path="/admin" element={user?.role === 'ADMIN' ? <AdminPage /> : <Navigate to="/" replace />} />
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
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/*" element={<PrivateRoute><Layout /></PrivateRoute>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
