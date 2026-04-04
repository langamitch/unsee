import Groq from 'groq-sdk'
import { NextRequest } from 'next/server'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

export async function POST(req: NextRequest) {
  const { videos } = await req.json() as {
    videos: Array<{ videoId: string; analysis: string }>
  }

  if (!videos?.length || videos.length < 2) {
    return Response.json({ error: 'Need at least 2 videos to compare' }, { status: 400 })
  }

  const videosContext = videos
    .map((v, i) => `Video ${i + 1} (ID: ${v.videoId}):\n${v.analysis}`)
    .join('\n\n---\n\n')

  try {
    const stream = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      stream: true,
      messages: [
        {
          role: 'system',
          content: 'You are a comparative video analyst. Compare videos objectively and highlight meaningful differences and similarities.',
        },
        {
          role: 'user',
          content: `Compare these ${videos.length} YouTube videos:

${videosContext}

Structure your comparison as:

**Overview**
One sentence on what each video is about.

**Common Themes**
What do they share in terms of topics, arguments, or approach?

**Key Differences**
Where do they diverge — in perspective, depth, tone, or conclusions?

**Sentiment Comparison**
How does the emotional tone differ between them?

**Which to Watch First**
A recommendation based on difficulty, depth, or logical order.`,
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
    const message = err instanceof Error ? err.message : 'Comparison failed'
    return Response.json({ error: message }, { status: 500 })
  }
}