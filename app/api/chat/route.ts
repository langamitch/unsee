import Groq from "groq-sdk";
import { NextRequest } from "next/server";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export async function POST(req: NextRequest) {
  const { analysis, messages } = (await req.json()) as {
    videoId: string;
    analysis: string;
    messages: ChatMessage[];
  };

  if (!messages?.length) {
    return Response.json({ error: "Missing required fields" }, { status: 400 });
  }

  try {
    const stream = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      stream: true,
      messages: [
        {
          role: "system",
          content: `You are a video analysis assistant. Answer follow-up questions based on this video analysis:\n\n${analysis}\n\nBe concise and reference specific details from the transcript when relevant.`,
        },
        // Pass full conversation history for multi-turn context
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ],
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        for await (const chunk of stream) {
          const text = chunk.choices[0]?.delta?.content ?? "";
          if (text) controller.enqueue(encoder.encode(text));
        }
        controller.close();
      },
    });

    return new Response(readable, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Request failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
