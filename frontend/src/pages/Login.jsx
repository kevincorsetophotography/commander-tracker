import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useTheme } from '../hooks/useTheme'

export default function Login() {
  const { login, register } = useAuth()
  const { t } = useTheme()
  const navigate = useNavigate()
  const [mode, setMode] = useState('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (mode === 'login') await login(username, password)
      else await register(username, password)
      navigate('/')
    } catch (err) {
      setError(err.error || 'Errore di connessione')
    } finally {
      setLoading(false)
    }
  }

  const inputStyle = {
    width: '100%', padding: '10px 12px', borderRadius: 8,
    border: `0.5px solid ${t.border}`, fontSize: 14,
    boxSizing: 'border-box', background: t.inputBg, color: t.text, outline: 'none',
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: t.bgPage, fontFamily: 'system-ui, sans-serif' }}>

      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
        <img src="/logo.png" alt="" onError={e => { e.currentTarget.style.display = 'none' }} style={{ height: 56, width: 56, objectFit: 'contain' }} />
        <div style={{ lineHeight: 1.2 }}>
          <div style={{ fontWeight: 800, fontSize: 18, color: t.primary, letterSpacing: '0.06em' }}>COMMANDERONE</div>
          <div style={{ fontSize: 11, color: t.textMuted, letterSpacing: '0.14em' }}>VILLASTELLONE</div>
        </div>
      </div>

      {/* Card */}
      <div style={{ background: t.bgSurface, border: `0.5px solid ${t.border}`, borderRadius: 16, padding: '2rem', width: '100%', maxWidth: 360, color: t.text }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>
            {mode === 'login' ? 'Accedi' : 'Crea account'}
          </div>
          <div style={{ fontSize: 13, color: t.textSub }}>
            {mode === 'login' ? 'Bentornato!' : 'Registra un nuovo giocatore'}
          </div>
        </div>

        <form onSubmit={submit}>
          <div style={{ marginBottom: 12 }}>
            <input type="text" placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} required style={inputStyle} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required style={inputStyle} />
          </div>
          {error && <div style={{ color: t.danger, fontSize: 13, marginBottom: 12 }}>{error}</div>}
          <button
            type="submit"
            disabled={loading}
            style={{ width: '100%', padding: '10px', background: t.primary, color: t.primaryFg, border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
          >
            {loading ? '...' : mode === 'login' ? 'Accedi' : 'Registrati'}
          </button>
        </form>

        <div style={{ marginTop: 16, textAlign: 'center', fontSize: 13, color: t.textSub }}>
          {mode === 'login' ? 'Non hai un account?' : 'Hai già un account?'}{' '}
          <span
            onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError('') }}
            style={{ color: t.primary, cursor: 'pointer', fontWeight: 500 }}
          >
            {mode === 'login' ? 'Registrati' : 'Accedi'}
          </span>
        </div>
      </div>
    </div>
  )
}
