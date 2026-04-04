import VideoAnalyst from '../components/VideoAnalyst'

export default function Home() {
  return (
    <main style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '72px 24px 48px',
    }}>
      {/* Nav bar */}
      <nav style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: 52,
        borderBottom: '1px solid var(--border)',
        background: 'rgba(8,8,8,0.85)',
        backdropFilter: 'blur(12px)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 28px',
        zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 22,
            height: 22,
            borderRadius: 6,
            background: 'var(--accent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            {/* play icon */}
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M2.5 1.5L8.5 5L2.5 8.5V1.5Z" fill="#000" />
            </svg>
          </div>
          <span style={{ fontWeight: 600, fontSize: 14, letterSpacing: '-0.01em' }}>YT Analyst</span>
        </div>
      </nav>

      {/* Hero */}
      <div style={{ width: '100%', maxWidth: 640, marginBottom: 48 }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 999,
          padding: '4px 12px',
          marginBottom: 24,
        }}>
          <div style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: 'var(--accent)',
            boxShadow: '0 0 6px var(--accent)',
          }} />
          <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>
            Powered by Llama 3.3 · Groq
          </span>
        </div>

        <h1 style={{
          fontSize: 'clamp(32px, 5vw, 48px)',
          fontWeight: 600,
          letterSpacing: '-0.03em',
          lineHeight: 1.15,
          marginBottom: 16,
        }}>
          Understand any<br />
          <span style={{ color: 'var(--text-muted)' }}>YouTube video instantly.</span>
        </h1>

        <p style={{
          fontSize: 16,
          color: 'var(--text-secondary)',
          fontWeight: 400,
          lineHeight: 1.6,
          maxWidth: 480,
        }}>
          Paste a link, get a full breakdown — summary, topics, takeaways. Then ask anything.
        </p>
      </div>

      <VideoAnalyst />
    </main>
  )
}