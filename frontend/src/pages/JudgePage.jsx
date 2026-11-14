import { useState, useEffect } from 'react'
import { api } from '../lib/api'
import { useTheme } from '../hooks/useTheme'
import { useAuth } from '../hooks/useAuth'
import PlayerAvatar from '../components/PlayerAvatar'
import { Icon, SectionLabel, bento } from '../components/ui'

function ConfidenceBadge({ value }) {
  const pct = Math.round(value * 100)
  const color = value >= 0.85 ? '#4caf50' : value >= 0.6 ? '#ff9800' : '#f44336'
  const label = value >= 0.85 ? 'Alta' : value >= 0.6 ? 'Media' : 'Bassa'
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
      background: color + '20', color, border: `1px solid ${color}50`
    }}>
      Confidenza {label} · {pct}%
    </span>
  )
}

function Tag({ children, color }) {
  const { t } = useTheme()
  return (
    <span style={{
      padding: '4px 10px', borderRadius: 999, fontSize: 13, fontWeight: 600,
      background: color ? color + '18' : t.bgMuted,
      color: color || t.textSub,
      border: `1px solid ${color ? color + '40' : t.border}`
    }}>
      {children}
    </span>
  )
}

function HistoryItem({ item, t }) {
  const [open, setOpen] = useState(false)
  const date = new Date(item.createdAt).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })
  const pct = Math.round(item.confidence * 100)
  const confColor = item.confidence >= 0.85 ? '#4caf50' : item.confidence >= 0.6 ? '#ff9800' : '#f44336'

  return (
    <div style={bento(t, { borderRadius: 16, overflow: 'hidden' })}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          width: '100%', textAlign: 'left', background: 'none', border: 'none',
          padding: '0.85rem 0.95rem', cursor: 'pointer', minHeight: 56,
          display: 'flex', alignItems: 'center', gap: 11,
        }}
      >
        <PlayerAvatar username={item.user.username} avatarCardName={item.user.avatarCardName || null} avatarScryfallId={item.user.avatarScryfallId || null} size={32} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: t.text, lineHeight: 1.35, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: open ? 'unset' : 2, WebkitBoxOrient: 'vertical', wordBreak: 'break-word' }}>
            {item.question}
          </div>
          <div style={{ fontSize: 12, color: t.textSub, display: 'flex', alignItems: 'center', gap: 6, marginTop: 3, flexWrap: 'wrap' }}>
            <span>{item.user.username}</span>
            <span>·</span>
            <span>{date}</span>
            <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: confColor, flexShrink: 0 }} />
            <span style={{ color: confColor, fontWeight: 600 }}>{pct}%</span>
          </div>
        </div>
        <span style={{
          color: t.textSub, flexShrink: 0, display: 'flex',
          transition: 'transform 0.2s', transform: open ? 'rotate(90deg)' : 'rotate(0deg)'
        }}><Icon name="chevron" size={18} /></span>
      </button>

      {open && (
        <div style={{ padding: '0 0.9rem 0.9rem 0.9rem', borderTop: `1px solid ${t.border}` }}>
          <div className="ct-section-open" style={{ fontSize: 15, color: t.text, lineHeight: 1.65, paddingTop: '0.75rem', whiteSpace: 'pre-wrap' }}>
            {item.answer}
          </div>
        </div>
      )}
    </div>
  )
}

export default function JudgePage() {
  const { t } = useTheme()
  const { user } = useAuth()
  const [question, setQuestion]   = useState('')
  const [result, setResult]       = useState(null)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')
  const [showSources, setShowSources] = useState(false)
  const [history, setHistory]     = useState([])

  useEffect(() => {
    api.getJudgeHistory()
      .then(setHistory)
      .catch(() => {})
  }, [])

  const ask = async () => {
    const q = question.trim()
    if (!q || q.length < 5) { setError('Scrivi almeno una domanda completa.'); return }
    setLoading(true); setError(''); setResult(null); setShowSources(false)
    try {
      const data = await api.askJudge(q)
      setResult(data)
      // aggiorna storico aggiungendo la nuova domanda in cima (ottimistico)
      setHistory(prev => [{
        id: Date.now(), question: q, answer: data.answer,
        confidence: data.confidence, createdAt: new Date().toISOString(),
        user: { username: user?.username || 'Tu', avatarCardName: user?.avatarCardName || null, avatarScryfallId: user?.avatarScryfallId || null }
      }, ...prev.slice(0, 29)])
    } catch (err) {
      setError(err.error || 'Errore durante la consulenza. Riprova.')
    } finally {
      setLoading(false)
    }
  }

  const handleKey = (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) ask()
  }

  const glass = bento(t, { padding: '1.1rem 1.1rem' })

  const inputSt = {
    width: '100%', boxSizing: 'border-box',
    padding: '12px 14px', borderRadius: 14,
    border: `1px solid ${t.border}`, fontSize: 16,
    background: t.inputBg, color: t.text, outline: 'none',
    fontFamily: 'inherit', resize: 'vertical',
    lineHeight: 1.5,
  }

  const btnPrimary = {
    padding: '0 20px', minHeight: 50, background: t.primary, color: t.primaryFg,
    border: 'none', borderRadius: 14, fontSize: 16, fontWeight: 800, boxShadow: t.glow,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, flex: 1,
    cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1,
    transition: 'opacity 0.15s',
  }

  return (
    <div style={{ maxWidth: 680, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <span style={{ width: 46, height: 46, borderRadius: 14, background: 'rgba(139,92,246,0.18)', color: t.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon name="book" size={24} /></span>
        <div style={{ fontSize: 26, fontWeight: 800, color: t.text, letterSpacing: '-0.02em' }}>Giudice</div>
      </div>
      <div style={{ fontSize: 14, color: t.textSub, marginBottom: '1.25rem', lineHeight: 1.5 }}>
        Fai una domanda sulle regole di Magic: The Gathering Commander.
        Le risposte si basano su oracle text Scryfall e Comprehensive Rules.
      </div>

      {/* Domanda */}
      <div style={{ ...glass, marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: t.text, marginBottom: 8 }}>
          La tua domanda <span style={{ fontWeight: 500, fontSize: 12, color: t.textSub }}>(Ctrl+Invio per inviare)</span>
        </div>
        <textarea
          value={question}
          onChange={e => setQuestion(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Es: Posso rispondere con una contromagia a una copia creata da Storm? Come funziona Rhystic Study se un avversario paga {1}?"
          rows={4}
          style={inputSt}
          disabled={loading}
        />
        {error && (
          <div role="alert" style={{ marginTop: 8, padding: '9px 12px', borderRadius: 12, background: t.dangerBg, color: t.danger, fontSize: 14, fontWeight: 600, border: `1px solid ${t.dangerBorder}` }}>
            {error}
          </div>
        )}
        <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <button style={btnPrimary} onClick={ask} disabled={loading} className="ct-press">
            {loading ? <><span className="ct-glow-pulse" style={{ width: 10, height: 10, borderRadius: '50%', background: t.primaryFg }} /> Il giudice sta consultando le regole…</> : <><Icon name="book" size={19} stroke={2.2} /> Chiedi al Giudice</>}
          </button>
          {result && !loading && (
            <button
              className="ct-press" style={{ minHeight: 50, padding: '0 16px', background: t.bgSurfaceAlt, color: t.text, border: `1px solid ${t.border}`, borderRadius: 14, fontSize: 15, fontWeight: 700, cursor: 'pointer' }}
              onClick={() => { setResult(null); setQuestion('') }}
            >
              Nuova domanda
            </button>
          )}
        </div>
      </div>

      {/* Risposta corrente */}
      {result && (
        <div className="ct-fade-up">

          <div style={{ ...glass, marginBottom: 12, border: `1px solid ${t.primaryBorder}`, boxShadow: `${t.shadow}${t.glow !== 'none' ? ', ' + t.glow : ''}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: t.primary, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Ruling</span>
              <ConfidenceBadge value={result.confidence} />
            </div>
            <div style={{ fontSize: 17, color: t.text, lineHeight: 1.6, fontWeight: 600 }}>
              {result.answer}
            </div>
          </div>

          {result.explanation && (
            <div style={{ ...glass, marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: t.textSub, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Spiegazione</div>
              <div style={{ fontSize: 14, color: t.text, lineHeight: 1.7 }}>{result.explanation}</div>
            </div>
          )}

          {(result.cardsDetected?.length > 0 || result.rulesUsed?.length > 0) && (
            <div style={{ ...glass, marginBottom: 12 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
                {result.cardsDetected?.length > 0 && (
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: t.textSub, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Carte rilevate</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {result.cardsDetected.map(c => <Tag key={c} color={t.primary}>{c}</Tag>)}
                    </div>
                  </div>
                )}
                {result.rulesUsed?.length > 0 && (
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: t.textSub, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Regole citate</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {result.rulesUsed.map(r => <Tag key={r}>CR {r}</Tag>)}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {result.sources?.length > 0 && (
            <div style={{ ...glass, marginBottom: 12 }}>
              <button
                onClick={() => setShowSources(v => !v)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px 0', minHeight: 40, display: 'flex', alignItems: 'center', gap: 6, color: t.text, fontSize: 14, fontWeight: 700 }}
              >
                <span style={{ display: 'flex', transition: 'transform 0.2s', transform: showSources ? 'rotate(90deg)' : 'rotate(0deg)' }}><Icon name="chevron" size={17} /></span>
                Sezioni CR usate ({result.sources.length})
              </button>
              {showSources && (
                <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {result.sources.map(s => (
                    <div key={s.id} style={{ padding: '8px 12px', background: t.bgMuted, borderRadius: 8, border: `0.5px solid ${t.border}` }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: t.primary, marginRight: 8 }}>{s.id}</span>
                      <span style={{ fontSize: 13, color: t.text }}>{s.text.replace(/^\d[\d.a-z]*\.\s+/, '')}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div style={{ marginTop: 12, marginBottom: 24, fontSize: 12, color: t.textMuted, textAlign: 'center' }}>
            Le risposte del judge bot sono orientative. Per decisioni ufficiali consulta sempre un judge certificato.
          </div>
        </div>
      )}

      {/* Storico domande del gruppo */}
      {history.length > 0 && (
        <div>
          <div style={{ marginTop: result ? 0 : 8 }}>
            <SectionLabel t={t} icon="groups">Domande recenti del gruppo</SectionLabel>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {history.map((item, i) => (
              <div key={item.id} className="ct-fade-up" style={{ animationDelay: `${Math.min(i, 6) * 40}ms` }}>
                <HistoryItem item={item} t={t} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
