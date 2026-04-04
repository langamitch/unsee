import { YoutubeTranscript } from 'youtube-transcript'

export interface TranscriptSegment {
  text: string
  offset: number // milliseconds
}

export interface ProcessedTranscript {
  segments: TranscriptSegment[]
  fullText: string
  // Pre-built text with timestamps every ~60s for the LLM to reference
  timedText: string
}

export async function fetchTranscript(videoId: string): Promise<ProcessedTranscript> {
  const raw = await YoutubeTranscript.fetchTranscript(videoId)

  const segments: TranscriptSegment[] = raw.map(s => ({
    text: s.text.trim(),
    offset: Math.round(s.offset),
  }))

  const fullText = segments.map(s => s.text).join(' ')

  // Inject a [MM:SS] marker every ~60 seconds so the LLM can cite timestamps
  let timedText = ''
  let lastMarkerAt = -60000
  for (const seg of segments) {
    if (seg.offset - lastMarkerAt >= 60000) {
      const mins = Math.floor(seg.offset / 60000)
      const secs = Math.floor((seg.offset % 60000) / 1000)
      timedText += ` [${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}]`
      lastMarkerAt = seg.offset
    }
    timedText += ' ' + seg.text
  }

  return { segments, fullText, timedText: timedText.trim() }
}

export function formatTimestamp(ms: number): string {
  const totalSecs = Math.floor(ms / 1000)
  const mins = Math.floor(totalSecs / 60)
  const secs = totalSecs % 60
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

// Parse [MM:SS] tags out of an LLM response into clickable data
export interface ParsedSegment {
  type: 'text' | 'timestamp'
  content: string
  seconds?: number // for type=timestamp
}

export function parseTimestamps(text: string): ParsedSegment[] {
  const parts: ParsedSegment[] = []
  const regex = /\[(\d{2}):(\d{2})\]/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', content: text.slice(lastIndex, match.index) })
    }
    const seconds = parseInt(match[1]) * 60 + parseInt(match[2])
    parts.push({ type: 'timestamp', content: match[0], seconds })
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < text.length) {
    parts.push({ type: 'text', content: text.slice(lastIndex) })
  }

  return parts
}