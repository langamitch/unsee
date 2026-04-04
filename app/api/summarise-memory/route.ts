import Groq from 'groq-sdk'
import { NextRequest } from 'next/server'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export async function POST(req: NextRequest) {
  const { messages } = await req.json() as { messages: ChatMessage[] }

  const transcript = messages
    .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
    .join('\n')

  const result = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    stream: false,
    messages: [
      {
        role: 'user',
        content: `Summarise this conversation in 3-5 bullet points so it can be used as memory context in future turns. Be factual and concise — capture what was asked and what was answered.\n\n${transcript}`,
      },
    ],
  })

  const summary = result.choices[0]?.message?.content ?? ''
  return Response.json({ summary })
}