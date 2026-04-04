'use client'

import { useState, useRef, useEffect, KeyboardEvent } from 'react'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

type Phase = 'idle' | 'analysing' | 'ready' | 'error'

function extractVideoId(url: string): string | null {
  try {
    const u = new URL(url)
    if (u.hostname.includes('youtu.be')) return u.pathname.slice(1).split('?')[0]
    return u.searchParams.get('v')
  } catch {
    const m = url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
    return m ? m[1] : null
  }
}

export default function VideoAnalyst() {
  const [url, setUrl] = useState('')
  const [videoId, setVideoId] = useState<string | null>(null)
  const [phase, setPhase] = useState<Phase>('idle')
  const [analysis, setAnalysis] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [question, setQuestion] = useState('')
  const [asking, setAsking] = useState('')
  const [error, setError] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, asking])

  async function handleAnalyse() {
    const vid = extractVideoId(url.trim())
    if (!vid) {
      setError('Could not find a valid YouTube video ID in that URL.')
      return
    }

    setVideoId(vid)
    setPhase('analysing')
    setError('')
    setAnalysis('')
    setMessages([])

    try {
      const res = await fetch('/api/analyse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId: vid }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Analysis failed')
      }

      // Stream the response
      const reader = res.body?.getReader()
      const decoder = new TextDecoder()
      let full = ''

      while (reader) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value)
        full += chunk
        setAnalysis(full)
      }

      setPhase('ready')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setPhase('error')
    }
  }

  async function handleAsk() {
    const q = question.trim()
    if (!q || !videoId || phase !== 'ready') return

    setQuestion('')
    setMessages(prev => [...prev, { role: 'user', content: q }])
    setAsking('...')

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoId,
          analysis, // give the route context of the initial analysis
          messages: [...messages, { role: 'user', content: q }],
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Request failed')
      }

      const reader = res.body?.getReader()
      const decoder = new TextDecoder()
      let full = ''

      while (reader) {
        const { done, value } = await reader.read()
        if (done) break
        full += decoder.decode(value)
        setAsking(full)
      }

      setMessages(prev => [...prev, { role: 'assistant', content: full }])
      setAsking('')
    } catch (err: unknown) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: err instanceof Error ? `Error: ${err.message}` : 'Something went wrong'
      }])
      setAsking('')
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) handleAsk()
  }

  function reset() {
    setUrl('')
    setVideoId(null)
    setPhase('idle')
    setAnalysis('')
    setMessages([])
    setQuestion('')
    setAsking('')
    setError('')
  }

  return (
    <div style={{ width: '100%', maxWidth: 672, display: 'flex', flexDirection: 'column', gap: 0 }}>

      {/* URL input */}
      <div style={{
        display: 'flex',
        gap: 8,
        marginBottom: phase === 'idle' || phase === 'error' ? 0 : 24,
      }}>
        <input
          value={url}
          onChange={e => setUrl(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAnalyse()}
          placeholder="https://youtube.com/watch?v=..."
          disabled={phase === 'analysing' || phase === 'ready'}
          style={{
            flex: 1,
            height: 44,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            color: 'var(--text)',
            fontFamily: 'var(--font-mono)',
            fontSize: 13,
            padding: '0 14px',
            outline: 'none',
            transition: 'border-color 0.15s',
          }}
          onFocus={e => (e.target.style.borderColor = 'var(--border-hover)')}
          onBlur={e => (e.target.style.borderColor = 'var(--border)')}
        />
        {phase !== 'ready' ? (
          <button
            onClick={handleAnalyse}
            disabled={phase === 'analysing' || !url}
            style={{
              height: 44,
              padding: '0 18px',
              background: phase === 'analysing' ? 'var(--surface)' : 'var(--accent)',
              color: phase === 'analysing' ? 'var(--text-muted)' : '#000',
              border: '1px solid transparent',
              borderRadius: 'var(--radius)',
              fontFamily: 'var(--font-mono)',
              fontSize: 13,
              fontWeight: 500,
              cursor: phase === 'analysing' ? 'not-allowed' : 'pointer',
              whiteSpace: 'nowrap',
              transition: 'opacity 0.15s',
            }}
          >
            {phase === 'analysing' ? 'Analysing...' : 'Analyse'}
          </button>
        ) : (
          <button
            onClick={reset}
            style={{
              height: 44,
              padding: '0 18px',
              background: 'transparent',
              color: 'var(--text-muted)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              fontFamily: 'var(--font-mono)',
              fontSize: 13,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            Reset
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <p style={{ color: '#e24b4a', fontSize: 12, marginTop: 8 }}>{error}</p>
      )}

      {/* Video thumbnail + analysis */}
      {(phase === 'analysing' || phase === 'ready') && videoId && (
        <div style={{
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          overflow: 'hidden',
          marginBottom: 16,
        }}>
          {/* Thumb strip */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '10px 14px',
            borderBottom: '1px solid var(--border)',
            background: 'var(--surface)',
          }}>
            <img
              src={`https://img.youtube.com/vi/${videoId}/mqdefault.jpg`}
              alt=""
              style={{ width: 64, height: 36, objectFit: 'cover', borderRadius: 2, flexShrink: 0 }}
            />
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                {phase === 'analysing' ? 'Processing' : 'Analysed'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                {videoId}
              </div>
            </div>
            {phase === 'analysing' && (
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
                {[0, 1, 2].map(i => (
                  <span key={i} style={{
                    display: 'inline-block',
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: 'var(--accent)',
                    animation: `blink 1.2s ${i * 0.2}s ease-in-out infinite`,
                  }} />
                ))}
              </div>
            )}
          </div>

          {/* Analysis text — streams in */}
          {analysis && (
            <div style={{
              padding: '16px 18px',
              fontSize: 13,
              lineHeight: 1.75,
              color: 'var(--text)',
              whiteSpace: 'pre-wrap',
            }}>
              {analysis}
            </div>
          )}
        </div>
      )}

      {/* Chat thread */}
      {phase === 'ready' && (
        <>
          {messages.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 12 }}>
              {messages.map((msg, i) => (
                <div key={i} style={{
                  alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '85%',
                  padding: '10px 14px',
                  background: msg.role === 'user' ? 'var(--accent-dim)' : 'var(--surface)',
                  border: `1px solid ${msg.role === 'user' ? 'var(--accent)' : 'var(--border)'}`,
                  borderRadius: 'var(--radius)',
                  fontSize: 13,
                  lineHeight: 1.7,
                  color: msg.role === 'user' ? 'var(--accent)' : 'var(--text)',
                  whiteSpace: 'pre-wrap',
                }}>
                  {msg.content}
                </div>
              ))}

              {/* Streaming assistant reply */}
              {asking && (
                <div style={{
                  alignSelf: 'flex-start',
                  maxWidth: '85%',
                  padding: '10px 14px',
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  fontSize: 16,
                  lineHeight: 1.7,
                  color: 'var(--text)',
                  whiteSpace: 'pre-wrap',
                }}>
                  {asking}
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}

          {/* Follow-up input */}
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={question}
              onChange={e => setQuestion(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a follow-up question..."
              disabled={!!asking}
              style={{
                flex: 1,
                height: 44,
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                color: 'var(--text)',
                fontFamily: 'var(--font-mono)',
                fontSize: 16,
                padding: '0 14px',
                outline: 'none',
              }}
              onFocus={e => (e.target.style.borderColor = 'var(--border-hover)')}
              onBlur={e => (e.target.style.borderColor = 'var(--border)')}
              autoFocus
            />
            <button
              onClick={handleAsk}
              disabled={!question.trim() || !!asking}
              style={{
                height: 44,
                padding: '0 18px',
                background: 'transparent',
                color: !question.trim() || asking ? 'var(--text-dim)' : 'var(--text)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                fontFamily: 'var(--font-mono)',
                fontSize: 13,
                cursor: !question.trim() || asking ? 'not-allowed' : 'pointer',
              }}
            >
              Ask →
            </button>
          </div>
        </>
      )}

      <style>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.2; }
        }
        input:disabled { opacity: 0.5; cursor: not-allowed; }
      `}</style>
    </div>
  )
}