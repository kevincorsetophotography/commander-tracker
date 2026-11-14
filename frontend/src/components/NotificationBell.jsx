import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { useTheme } from '../hooks/useTheme'
import { useIsMobile } from '../hooks/useIsMobile'
import { Icon } from './ui'

const POLL_MS = 60000

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'ora'
  if (m < 60) return `${m}m fa`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h fa`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}g fa`
  return new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })
}

export default function NotificationBell() {
  const { t, dark } = useTheme()
  const isMobile = useIsMobile()
  const navigate = useNavigate()
  const [count, setCount] = useState(0)
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const timer = useRef(null)

  const fetchCount = useCallback(async () => {
    try { const { count } = await api.getUnreadCount(); setCount(count) } catch {}
  }, [])

  useEffect(() => {
    fetchCount()
    timer.current = setInterval(fetchCount, POLL_MS)
    return () => clearInterval(timer.current)
  }, [fetchCount])

  const openPanel = async () => {
    setOpen(true)
    setLoading(true)
    try {
      const list = await api.getNotifications()
      setItems(list)
      if (list.some(n => !n.read)) {
        await api.markNotificationsRead()
        setCount(0)
      }
    } catch {} finally { setLoading(false) }
  }

  const toggle = () => { if (open) setOpen(false); else openPanel() }

  const goTo = (n) => {
    setOpen(false)
    if (n.link) navigate(n.link)
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={toggle}
        title="Notifiche"
        className="ct-press"
        aria-label={count > 0 ? `Notifiche, ${count} non lette` : 'Notifiche'}
        style={{
          position: 'relative', width: 44, height: 44, borderRadius: 14, cursor: 'pointer',
          border: `1px solid ${t.border}`, background: t.bgSurfaceAlt, color: t.text,
          display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.18s ease',
        }}
      >
        <Icon name="bell" size={21} />
        {count > 0 && (
          <span style={{
            position: 'absolute', top: -5, right: -5, minWidth: 20, height: 20, padding: '0 5px',
            borderRadius: 10, background: t.primary, color: t.primaryFg, boxShadow: `0 0 8px ${t.primaryBorder}`,
            fontSize: 12, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxSizing: 'border-box',
          }}>
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && (() => {
        const panel = (
        <>
          {/* backdrop per chiudere al click fuori (su mobile scurisce la pagina sotto il pannello) */}
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40, background: isMobile ? 'rgba(4,6,18,0.6)' : 'transparent' }} />

          <div className={isMobile ? 'ct-sheet-in' : 'ct-modal-in'} style={{
            // Mobile: pannello OPACO che sale dal basso (prima era un dropdown semitrasparente, illeggibile).
            ...(isMobile
              ? { position: 'fixed', left: 0, right: 0, bottom: 0, width: '100%', maxHeight: '85vh', borderRadius: '24px 24px 0 0', padding: '4px 8px calc(16px + env(safe-area-inset-bottom))', borderBottom: 'none' }
              : { position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: 340, maxWidth: 'calc(100vw - 20px)', maxHeight: '70vh', borderRadius: 14, padding: 4 }),
            zIndex: 50, overflowY: 'auto', boxSizing: 'border-box',
            background: dark ? '#0e122b' : '#FFFFFF', border: `1px solid ${t.border}`,
            boxShadow: '0 -12px 40px rgba(0,0,0,0.45)',
          }}>
            {isMobile && <div style={{ width: 40, height: 4, borderRadius: 4, background: t.borderStrong, margin: '8px auto 4px' }} />}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 10px 8px' }}>
              <span style={{ fontSize: isMobile ? 18 : 13, fontWeight: 800, color: t.text }}>Notifiche</span>
              {isMobile && (
                <button onClick={() => setOpen(false)} aria-label="Chiudi" style={{ width: 40, height: 40, border: 'none', background: 'transparent', color: t.textSub, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="close" size={20} />
                </button>
              )}
            </div>

            {loading && <div style={{ padding: '10px', fontSize: 13, color: t.textSub }}>Caricamento…</div>}

            {!loading && items.length === 0 && (
              <div style={{ padding: '18px 12px', fontSize: 13, color: t.textMuted, textAlign: 'center' }}>
                Nessuna notifica
              </div>
            )}

            {!loading && items.map(n => (
              <div
                key={n.id}
                onClick={() => goTo(n)}
                style={{
                  display: 'flex', gap: 8, padding: '9px 10px', borderRadius: 8, cursor: n.link ? 'pointer' : 'default',
                  background: n.read ? 'transparent' : (t.primaryBg || t.bgMuted),
                  marginBottom: 2,
                }}
              >
                {!n.read && <span style={{ width: 7, height: 7, borderRadius: '50%', background: t.primary, marginTop: 6, flexShrink: 0 }} />}
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: t.text, wordBreak: 'break-word' }}>{n.title}</div>
                  {n.body && <div style={{ fontSize: 12, color: t.textSub, marginTop: 2, wordBreak: 'break-word' }}>{n.body}</div>}
                  <div style={{ fontSize: 12, color: t.textMuted, marginTop: 3 }}>{timeAgo(n.createdAt)}</div>
                </div>
              </div>
            ))}
          </div>
        </>
        )
        // Mobile: portal su body (l'header con backdrop-filter farebbe da contenitore ai fixed).
        return isMobile ? createPortal(panel, document.body) : panel
      })()}
    </div>
  )
}
