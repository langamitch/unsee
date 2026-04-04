import Groq from 'groq-sdk'
import { NextRequest } from 'next/server'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export async function POST(req: NextRequest) {
  const { videoId, analysis, messages, memorySummary } = await req.json() as {
    videoId: string
    analysis: string
    messages: ChatMessage[]
    // Running summary of prior conversation turns — injected for memory
    memorySummary: string
  }

  if (!messages?.length) {
    return Response.json({ error: 'Missing required fields' }, { status: 400 })
  }

  try {
    const stream = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      stream: true,
      messages: [
        {
          role: 'system',
          content: `You are a video analysis assistant for YouTube video ID: ${videoId}.

Video Analysis:
${analysis}

${memorySummary ? `Conversation so far (memory summary):\n${memorySummary}\n` : ''}
Answer follow-up questions specifically based on the video content. Reference [MM:SS] timestamps when pointing to specific moments. Be concise.`,
        },
        ...messages.map(m => ({ role: m.role, content: m.content })),
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
    const message = err instanceof Error ? err.message : 'Request failed'
    return Response.json({ error: message }, { status: 500 })
  }
}