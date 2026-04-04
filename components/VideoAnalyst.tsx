'use client'

import { useState, useRef, useEffect, KeyboardEvent } from 'react'
import MessageBubble from './MessageBubble'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface VideoEntry {
  videoId: string
  analysis: string
  status: 'analysing' | 'ready' | 'error'
  error?: string
}

type AppMode = 'single' | 'compare'

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

function TypingDots() {
  return (
    <span style={{ display: 'inline-flex', gap: 3, alignItems: 'center' }}>
      {[0, 1, 2].map(i => (
        <span key={i} style={{
          width: 5, height: 5, borderRadius: '50%',
          background: 'var(--text-muted)', display: 'inline-block',
          animation: `dotPulse 1.4s ${i * 0.2}s ease-in-out infinite`,
        }} />
      ))}
      <style>{`@keyframes dotPulse { 0%,100%{opacity:.3;transform:scale(.8)} 50%{opacity:1;transform:scale(1)} }`}</style>
    </span>
  )
}

function VideoCard({ entry, index, onRemove, showRemove }: {
  entry: VideoEntry
  index: number
  onRemove: () => void
  showRemove: boolean
}) {
  const [open, setOpen] = useState(true)

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)',
      overflow: 'hidden',
      marginBottom: 12,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 16px',
        borderBottom: open && entry.analysis ? '1px solid var(--border)' : 'none',
        cursor: 'pointer',
      }} onClick={() => setOpen(o => !o)}>
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <img
            src={`https://img.youtube.com/vi/${entry.videoId}/mqdefault.jpg`}
            alt=""
            style={{ width: 64, height: 36, objectFit: 'cover', borderRadius: 5, display: 'block' }}
          />
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
            justifyContent: 'center', background: 'rgba(0,0,0,0.35)', borderRadius: 5,
          }}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M4 2.5L13 8L4 13.5V2.5Z" fill="white" fillOpacity="0.9" />
            </svg>
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500, marginBottom: 1 }}>
            Video {index + 1}
            {entry.status === 'analysing' && <span style={{ color: 'var(--text-muted)', marginLeft: 8 }}>analysing...</span>}
            {entry.status === 'ready' && <span style={{ color: 'var(--accent)', marginLeft: 8 }}>✓ ready</span>}
            {entry.status === 'error' && <span style={{ color: '#f87171', marginLeft: 8 }}>error</span>}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {entry.videoId}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {entry.status === 'analysing' && <TypingDots />}
          {showRemove && (
            <button onClick={e => { e.stopPropagation(); onRemove() }} style={{
              width: 26, height: 26, borderRadius: '50%',
              background: 'transparent', border: '1px solid var(--border)',
              color: 'var(--text-muted)', fontSize: 14, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--font)',
            }}>×</button>
          )}
          <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{open ? '▲' : '▼'}</span>
        </div>
      </div>

      {open && entry.analysis && (
        <div style={{
          padding: '16px 18px', fontSize: 14, lineHeight: 1.75,
          color: 'var(--text)', whiteSpace: 'pre-wrap',
        }}>
          <MessageBubble content={entry.analysis} videoId={entry.videoId} role="assistant" />
        </div>
      )}
      {open && entry.error && (
        <div style={{ padding: '14px 18px', fontSize: 13, color: '#f87171' }}>{entry.error}</div>
      )}
    </div>
  )
}

export default function VideoAnalyst() {
  const [mode, setMode] = useState<AppMode>('single')
  const [urlInput, setUrlInput] = useState('')
  const [videos, setVideos] = useState<VideoEntry[]>([])
  const [comparison, setComparison] = useState('')
  const [comparing, setComparing] = useState(false)

  // Chat state
  const [messages, setMessages] = useState<Message[]>([])
  const [question, setQuestion] = useState('')
  const [streamingReply, setStreamingReply] = useState('')
  // Rolling memory summary — updated every 4 turns
  const [memorySummary, setMemorySummary] = useState('')

  const [error, setError] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const allReady = videos.length > 0 && videos.every(v => v.status === 'ready')
  const primaryVideo = videos[0]

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingReply])

  // Summarise memory every 4 completed assistant turns
  useEffect(() => {
    const assistantTurns = messages.filter(m => m.role === 'assistant').length
    if (assistantTurns > 0 && assistantTurns % 4 === 0) {
      fetch('/api/summarise-memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages }),
      })
        .then(r => r.json())
        .then(d => { if (d.summary) setMemorySummary(d.summary) })
        .catch(() => null) // non-critical, fail silently
    }
  }, [messages])

  async function analyseVideo(videoId: string): Promise<string> {
    const res = await fetch('/api/analyse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoId }),
    })

    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error ?? 'Analysis failed')
    }

    const reader = res.body?.getReader()
    const decoder = new TextDecoder()
    let full = ''

    while (reader) {
      const { done, value } = await reader.read()
      if (done) break
      const chunk = decoder.decode(value)
      full += chunk
      // Update the specific video's analysis as it streams
      setVideos(prev => prev.map(v =>
        v.videoId === videoId ? { ...v, analysis: full } : v
      ))
    }

    return full
  }

  async function handleAdd() {
    const vid = extractVideoId(urlInput.trim())
    if (!vid) { setError('Invalid YouTube URL'); return }
    if (videos.find(v => v.videoId === vid)) { setError('Already added'); return }
    if (mode === 'compare' && videos.length >= 3) { setError('Max 3 videos'); return }

    setError('')
    setUrlInput('')

    const entry: VideoEntry = { videoId: vid, analysis: '', status: 'analysing' }
    setVideos(prev => [...prev, entry])

    try {
      await analyseVideo(vid)
      setVideos(prev => prev.map(v => v.videoId === vid ? { ...v, status: 'ready' } : v))
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed'
      setVideos(prev => prev.map(v => v.videoId === vid ? { ...v, status: 'error', error: msg } : v))
    }
  }

  async function handleCompare() {
    if (videos.length < 2 || !allReady) return
    setComparing(true)
    setComparison('')

    const res = await fetch('/api/compare', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videos: videos.map(v => ({ videoId: v.videoId, analysis: v.analysis })) }),
    })

    const reader = res.body?.getReader()
    const decoder = new TextDecoder()
    let full = ''
    while (reader) {
      const { done, value } = await reader.read()
      if (done) break
      full += decoder.decode(value)
      setComparison(full)
    }
    setComparing(false)
  }

  async function handleAsk() {
    const q = question.trim()
    if (!q || !allReady || streamingReply) return

    setQuestion('')
    const newMessages: Message[] = [...messages, { role: 'user', content: q }]
    setMessages(newMessages)
    setStreamingReply(' ')

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoId: primaryVideo.videoId,
          analysis: primaryVideo.analysis,
          messages: newMessages,
          memorySummary,
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
        setStreamingReply(full)
      }

      setMessages(prev => [...prev, { role: 'assistant', content: full }])
      setStreamingReply('')
    } catch (err: unknown) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: err instanceof Error ? err.message : 'Something went wrong',
      }])
      setStreamingReply('')
    }
  }

  function reset() {
    setVideos([])
    setMessages([])
    setMemorySummary('')
    setComparison('')
    setUrlInput('')
    setQuestion('')
    setStreamingReply('')
    setError('')
  }

  const showChat = mode === 'single' && allReady
  const canCompare = mode === 'compare' && videos.length >= 2 && allReady

  return (
    <div style={{ width: '100%', maxWidth: 640 }}>

      {/* Mode toggle */}
      {videos.length === 0 && (
        <div style={{
          display: 'flex', gap: 4,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          padding: 4,
          marginBottom: 16,
          width: 'fit-content',
        }}>
          {(['single', 'compare'] as AppMode[]).map(m => (
            <button key={m} onClick={() => setMode(m)} style={{
              padding: '6px 16px',
              background: mode === m ? 'var(--surface-2)' : 'transparent',
              border: mode === m ? '1px solid var(--border-hover)' : '1px solid transparent',
              borderRadius: 6,
              color: mode === m ? 'var(--text)' : 'var(--text-muted)',
              fontFamily: 'var(--font)',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.15s',
              textTransform: 'capitalize',
            }}>
              {m === 'single' ? 'Single Video' : 'Compare Videos'}
            </button>
          ))}
        </div>
      )}

      {/* URL input */}
      {(videos.length === 0 || (mode === 'compare' && videos.length < 3 && !comparing)) && (
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: 6, display: 'flex', gap: 6,
          marginBottom: error ? 8 : 20,
        }}>
          <input
            value={urlInput}
            onChange={e => { setUrlInput(e.target.value); setError('') }}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            placeholder={mode === 'compare' && videos.length > 0
              ? `Add video ${videos.length + 1} of 3...`
              : 'Paste a YouTube URL...'}
            style={{
              flex: 1, height: 42, background: 'transparent', border: 'none',
              color: 'var(--text)', fontFamily: 'var(--font)', fontSize: 14,
              padding: '0 12px', outline: 'none',
            }}
          />
          <button onClick={handleAdd} disabled={!urlInput.trim()} style={{
            height: 42, padding: '0 20px',
            background: urlInput.trim() ? 'var(--accent)' : 'var(--surface-2)',
            color: urlInput.trim() ? '#000' : 'var(--text-muted)',
            border: 'none', borderRadius: 6,
            fontFamily: 'var(--font)', fontSize: 13, fontWeight: 600,
            cursor: urlInput.trim() ? 'pointer' : 'not-allowed',
            transition: 'all 0.15s', whiteSpace: 'nowrap',
          }}>
            {mode === 'compare' && videos.length > 0 ? 'Add →' : 'Analyse →'}
          </button>
        </div>
      )}

      {error && <p style={{ color: '#f87171', fontSize: 13, marginBottom: 16, paddingLeft: 4 }}>{error}</p>}

      {/* Video cards */}
      {videos.map((entry, i) => (
        <VideoCard
          key={entry.videoId}
          entry={entry}
          index={i}
          showRemove={mode === 'compare' && !comparing}
          onRemove={() => setVideos(prev => prev.filter(v => v.videoId !== entry.videoId))}
        />
      ))}

      {/* Compare button */}
      {canCompare && !comparison && (
        <button onClick={handleCompare} style={{
          width: '100%', height: 44, marginBottom: 16,
          background: 'transparent',
          border: '1px solid var(--accent)',
          borderRadius: 'var(--radius)',
          color: 'var(--accent)',
          fontFamily: 'var(--font)', fontSize: 14, fontWeight: 500,
          cursor: 'pointer', transition: 'background 0.15s',
        }}
          onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = 'var(--accent-dim)')}
          onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
        >
          Compare {videos.length} Videos →
        </button>
      )}

      {/* Comparison result */}
      {(comparison || comparing) && (
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)', overflow: 'hidden', marginBottom: 16,
        }}>
          <div style={{
            padding: '10px 16px', borderBottom: '1px solid var(--border)',
            fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span>Comparison</span>
            {comparing && <TypingDots />}
          </div>
          <div style={{ padding: '16px 18px', fontSize: 14, lineHeight: 1.75, color: 'var(--text)', whiteSpace: 'pre-wrap' }}>
            {comparison || ''}
          </div>
        </div>
      )}

      {/* Reset */}
      {videos.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
          <button onClick={reset} style={{
            padding: '6px 14px', background: 'transparent',
            border: '1px solid var(--border)', borderRadius: 6,
            color: 'var(--text-secondary)', fontFamily: 'var(--font)',
            fontSize: 13, cursor: 'pointer',
          }}>
            Reset
          </button>
        </div>
      )}

      {/* Chat */}
      {showChat && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {memorySummary && (
            <div style={{
              padding: '8px 12px', background: 'var(--surface)',
              border: '1px solid var(--border)', borderRadius: 6,
              fontSize: 12, color: 'var(--text-muted)', marginBottom: 4,
            }}>
              <span style={{ color: 'var(--accent)', marginRight: 6 }}>◈</span>
              Memory active — {messages.filter(m => m.role === 'assistant').length} turns remembered
            </div>
          )}

          {messages.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 8 }}>
              {messages.map((msg, i) => (
                <div key={i} style={{
                  alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '82%',
                  padding: '10px 14px',
                  background: msg.role === 'user' ? 'var(--accent-dim)' : 'var(--surface)',
                  border: `1px solid ${msg.role === 'user' ? '#2d3d00' : 'var(--border)'}`,
                  borderRadius: msg.role === 'user' ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
                  fontSize: 14, lineHeight: 1.65,
                  color: msg.role === 'user' ? 'var(--accent)' : 'var(--text)',
                  whiteSpace: 'pre-wrap',
                }}>
                  <MessageBubble content={msg.content} videoId={primaryVideo.videoId} role={msg.role} />
                </div>
              ))}

              {streamingReply && (
                <div style={{
                  alignSelf: 'flex-start', maxWidth: '82%',
                  padding: '10px 14px', background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: '12px 12px 12px 4px',
                  fontSize: 14, lineHeight: 1.65, color: 'var(--text)', whiteSpace: 'pre-wrap',
                }}>
                  {streamingReply.trim()
                    ? <MessageBubble content={streamingReply} videoId={primaryVideo.videoId} role="assistant" />
                    : <TypingDots />}
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}

          {messages.length === 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
              {['What are the key timestamps?', 'What is the main argument?', 'Who is the target audience?', 'Summarise in one sentence'].map(q => (
                <button key={q} onClick={() => { setQuestion(q); setTimeout(handleAsk, 0) }} style={{
                  padding: '7px 13px', background: 'var(--surface)',
                  border: '1px solid var(--border)', borderRadius: 999,
                  color: 'var(--text-secondary)', fontFamily: 'var(--font)',
                  fontSize: 13, cursor: 'pointer', transition: 'all 0.15s',
                }}
                  onMouseEnter={e => { const el = e.target as HTMLElement; el.style.borderColor = 'var(--border-hover)'; el.style.color = 'var(--text)' }}
                  onMouseLeave={e => { const el = e.target as HTMLElement; el.style.borderColor = 'var(--border)'; el.style.color = 'var(--text-secondary)' }}
                >{q}</button>
              ))}
            </div>
          )}

          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)', padding: 6, display: 'flex', gap: 6,
          }}>
            <input
              ref={inputRef}
              value={question}
              onChange={e => setQuestion(e.target.value)}
              onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' && handleAsk()}
              placeholder="Ask a follow-up question..."
              disabled={!!streamingReply}
              style={{
                flex: 1, height: 42, background: 'transparent', border: 'none',
                color: 'var(--text)', fontFamily: 'var(--font)', fontSize: 14,
                padding: '0 12px', outline: 'none',
              }}
            />
            <button onClick={handleAsk} disabled={!question.trim() || !!streamingReply} style={{
              height: 42, padding: '0 18px',
              background: question.trim() && !streamingReply ? 'var(--accent)' : 'var(--surface-2)',
              color: question.trim() && !streamingReply ? '#000' : 'var(--text-muted)',
              border: 'none', borderRadius: 6,
              fontFamily: 'var(--font)', fontSize: 13, fontWeight: 600,
              cursor: !question.trim() || !!streamingReply ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s', whiteSpace: 'nowrap',
            }}>
              Send →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}