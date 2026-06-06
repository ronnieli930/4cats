import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  streamText,
} from "ai";
import { getModel, SYSTEM_PROMPT } from "@/lib/ai/providers";

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = streamText({
    model: getModel(),
    system: SYSTEM_PROMPT,
    messages: await convertToModelMessages(messages),
  });

  return createUIMessageStreamResponse({
    stream: result.toUIMessageStream(),
  });
}
