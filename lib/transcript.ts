import ytdl from 'ytdl-core'
import { YoutubeTranscript, YoutubeTranscriptDisabledError, YoutubeTranscriptNotAvailableError, YoutubeTranscriptNotAvailableLanguageError } from 'youtube-transcript/dist/youtube-transcript.esm.js'

export interface TranscriptSegment {
  text: string;
  offset: number; // milliseconds
}

export interface ProcessedTranscript {
  segments: TranscriptSegment[];
  fullText: string;
  // Pre-built text with timestamps every ~60s for the LLM to reference
  timedText: string;
}

export async function fetchTranscript(
  videoId: string,
): Promise<ProcessedTranscript> {
  try {
    return await fetchTranscriptFromYoutubeTranscript(videoId)
  } catch (err: unknown) {
    if (
      err instanceof YoutubeTranscriptDisabledError ||
      err instanceof YoutubeTranscriptNotAvailableError ||
      err instanceof YoutubeTranscriptNotAvailableLanguageError
    ) {
      return await fetchTranscriptViaYtdl(videoId)
    }
    throw err
  }
}

interface YoutubeTranscriptSegment {
  text: string
  offset: number
}

interface YoutubeTranscriptTrack {
  baseUrl: string
  languageCode: string
}

async function fetchTranscriptFromYoutubeTranscript(videoId: string): Promise<ProcessedTranscript> {
  const raw = await YoutubeTranscript.fetchTranscript(videoId) as YoutubeTranscriptSegment[]

  const segments: TranscriptSegment[] = raw.map((s) => ({
    text: s.text.trim(),
    offset: Math.round(s.offset),
  }))

  const fullText = segments.map((s) => s.text).join(" ");

  // Inject a [MM:SS] marker every ~60 seconds so the LLM can cite timestamps
  let timedText = "";
  let lastMarkerAt = -60000;
  for (const seg of segments) {
    if (seg.offset - lastMarkerAt >= 60000) {
      const mins = Math.floor(seg.offset / 60000);
      const secs = Math.floor((seg.offset % 60000) / 1000);
      timedText += ` [${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}]`;
      lastMarkerAt = seg.offset;
    }
    timedText += " " + seg.text;
  }

  return { segments, fullText, timedText: timedText.trim() };
}

async function fetchTranscriptViaYtdl(videoId: string): Promise<ProcessedTranscript> {
  const info = await ytdl.getInfo(videoId)
  const tracks = info.player_response?.captions?.playerCaptionsTracklistRenderer?.captionTracks as YoutubeTranscriptTrack[] | undefined
  if (!Array.isArray(tracks) || tracks.length === 0) {
    throw new Error(`No captions available for this video (${videoId})`)
  }

  const track = tracks.find((track) => track.languageCode === 'en') ?? tracks[0]
  const url = track.baseUrl
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
  })

  if (!response.ok) {
    throw new Error(`Unable to fetch captions for this video (${videoId})`)
  }

  const xml = await response.text()
  const segments = parseTranscriptXml(xml)
  if (segments.length === 0) {
    throw new Error(`No captions were parsed for this video (${videoId})`)
  }

  const fullText = segments.map((s) => s.text).join(' ')
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

function parseTranscriptXml(xml: string): TranscriptSegment[] {
  const segments: TranscriptSegment[] = []
  const regex = /<p\s+t="(\d+)"\s+d="(\d+)"[^>]*>([\s\S]*?)<\/p>/g
  let match: RegExpExecArray | null

  while ((match = regex.exec(xml)) !== null) {
    const offset = parseInt(match[1], 10)
    const textContent = match[3]
    let text = ''
    const innerRegex = /<s[^>]*>([^<]*)<\/s>/g
    let innerMatch: RegExpExecArray | null
    while ((innerMatch = innerRegex.exec(textContent)) !== null) {
      text += innerMatch[1]
    }
    if (!text) {
      text = textContent.replace(/<[^>]+>/g, '')
    }
    text = decodeEntities(text).trim()
    if (text) {
      segments.push({ text, offset })
    }
  }

  return segments
}

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_match, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_match, dec) => String.fromCodePoint(parseInt(dec, 10)))
}

export function formatTimestamp(ms: number): string {
  const totalSecs = Math.floor(ms / 1000);
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

// Parse [MM:SS] tags out of an LLM response into clickable data
export interface ParsedSegment {
  type: "text" | "timestamp";
  content: string;
  seconds?: number; // for type=timestamp
}

export function parseTimestamps(text: string): ParsedSegment[] {
  const parts: ParsedSegment[] = [];
  const regex = /\[(\d{2}):(\d{2})\]/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: "text", content: text.slice(lastIndex, match.index) });
    }
    const seconds = parseInt(match[1]) * 60 + parseInt(match[2]);
    parts.push({ type: "timestamp", content: match[0], seconds });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push({ type: "text", content: text.slice(lastIndex) });
  }

  return parts;
}
