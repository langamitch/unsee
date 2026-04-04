import Groq from 'groq-sdk'
import { YoutubeTranscript } from 'youtube-transcript'
import { NextRequest } from 'next/server'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

export async function POST(req: NextRequest) {
  const { videoId } = await req.json()

  if (!videoId || typeof videoId !== 'string') {
    return Response.json({ error: 'Missing videoId' }, { status: 400 })
  }

  try {
    // Fetch transcript — throws if video has no captions or is private
    const transcript = await YoutubeTranscript.fetchTranscript(videoId)
    const transcriptText = transcript.map(t => t.text).join(' ')

    if (!transcriptText.trim()) {
      return Response.json({ error: 'No transcript available for this video.' }, { status: 400 })
    }

    const stream = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      stream: true,
      messages: [
        {
          role: 'system',
          content: 'You are a sharp video analyst. Analyse YouTube video transcripts concisely and insightfully.',
        },
        {
          role: 'user',
          content: `Analyse this YouTube video transcript. Structure your response as:\n\n**Summary**\n2-3 sentence overview.\n\n**Main Topics**\nKey subjects covered.\n\n**Key Takeaways**\nMost important points.\n\n**Tone & Style**\nHow the presenter delivers content.\n\nTranscript:\n${transcriptText.slice(0, 12000)}`, // cap at ~12k chars to stay within context
        },
      ],
    })

    const encoder = new TextEncoder()
    const readable = new ReadableStream({
      async start(controller) {
        for await (const chunk of stream) {
          const text = chunk.choices[0]?.delta?.content ?? ''
          if (text) controller.enqueue(encoder.encode(text))
        }
        controller.close()
      },
    })

    return new Response(readable, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Analysis failed'
    return Response.json({ error: message }, { status: 500 })
  }
}