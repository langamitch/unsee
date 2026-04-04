import Groq from 'groq-sdk'
import { NextRequest } from 'next/server'
import { fetchTranscript } from '@/lib/transcript'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

export async function POST(req: NextRequest) {
  const { videoId } = await req.json()

  if (!videoId || typeof videoId !== 'string') {
    return Response.json({ error: 'Missing videoId' }, { status: 400 })
  }

  try {
    const { timedText } = await fetchTranscript(videoId)

    if (!timedText.trim()) {
      return Response.json({ error: 'No transcript available for this video.' }, { status: 400 })
    }

    const stream = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      stream: true,
      messages: [
        {
          role: 'system',
          content: `You are a sharp video analyst. The transcript contains [MM:SS] timestamp markers — use them when citing specific moments. Always reference timestamps when mentioning quotes or topic shifts.`,
        },
        {
          role: 'user',
          content: `Analyse this YouTube video transcript with the following structure:

**Summary**
2-3 sentences capturing the core message.

**Chapters**
List the major topic shifts with their timestamps in [MM:SS] format and a one-line description each.

**Key Quotes**
3-5 notable direct quotes from the transcript, each with its [MM:SS] timestamp.

**Sentiment Arc**
How does the tone/energy evolve throughout the video? (e.g. starts neutral, builds urgency, ends motivational)

**Takeaways**
The 3 most important things a viewer should remember.

**Audience**
Who is this video made for and what level of knowledge does it assume?

Transcript:
${timedText.slice(0, 14000)}`,
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