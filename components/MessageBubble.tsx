import { parseTimestamps } from '@/lib/transcript'

interface Props {
  content: string
  videoId: string
  role: 'user' | 'assistant'
}

export default function MessageBubble({ content, videoId, role }: Props) {
  if (role === 'user') {
    return <span>{content}</span>
  }

  const parts = parseTimestamps(content)

  return (
    <>
      {parts.map((part, i) => {
        if (part.type === 'timestamp' && part.seconds !== undefined) {
          return (
            
              key={i}
              href={`https://youtu.be/${videoId}?t=${part.seconds}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-block',
                padding: '1px 7px',
                background: 'var(--accent-dim)',
                border: '1px solid #2d3d00',
                borderRadius: 4,
                color: 'var(--accent)',
                fontSize: 12,
                fontWeight: 500,
                textDecoration: 'none',
                margin: '0 2px',
                fontFamily: 'monospace',
                cursor: 'pointer',
                transition: 'background 0.1s',
              }}
              onMouseEnter={e => ((e.target as HTMLElement).style.background = '#253300')}
              onMouseLeave={e => ((e.target as HTMLElement).style.background = 'var(--accent-dim)')}
            >
              {part.content}
            </a>
          )
        }
        return <span key={i}>{part.content}</span>
      })}
    </>
  )
}