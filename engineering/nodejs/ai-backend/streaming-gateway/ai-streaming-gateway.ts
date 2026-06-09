import { Request, Response } from 'express';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function chatStream(req: Request, res: Response) {
  const { messages, tools } = req.body;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const stream = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages,
    tools,
    stream: true,
  });

  let eventId = 1;
  const heartbeat = setInterval(() => res.write(':heartbeat\n\n'), 30000);

  try {
    for await (const chunk of stream) {
      const data = JSON.stringify(chunk);
      res.write(`id: ${eventId++}\nevent: message\ndata: ${data}\n\n`);

      const toolCalls = (chunk.choices?.[0]?.delta?.tool_calls) as any[] | undefined;
      if (toolCalls?.length) {
        for (const tc of toolCalls) {
          if (tc.function?.name && tc.id) {
            res.write(`id: ${eventId++}\nevent: tool_call\ndata: ${JSON.stringify(tc)}\n\n`);
          }
        }
      }
    }
    res.write(`id: ${eventId++}\nevent: done\ndata: [DONE]\n\n`);
  } catch (err: any) {
    res.write(`id: ${eventId++}\nevent: error\ndata: ${JSON.stringify({ message: err.message })}\n\n`);
  } finally {
    clearInterval(heartbeat);
    res.end();
  }
}
