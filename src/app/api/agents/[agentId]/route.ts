import { extractAllTextOutput, run, user as userMessage } from "@openai/agents";
import { NextResponse } from "next/server";
import {
  buildFoodAgent,
  type FoodAgentContext,
  type FoodProduct,
} from "@/lib/agents/food-agent";
import type { MemeAgentContext } from "@/lib/agents/meme-agent";
import { memeAgent } from "@/lib/agents/meme-agent";
import { getUser } from "@/lib/auth/server";
import { downscaleForVisionPreview } from "@/lib/image/downscale-for-vision";
import { buildPetProfilePrompt } from "@/lib/pet-data/format";
import { getPetCareContext } from "@/lib/pet-queries";

const ALLOWED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

function parseMemeToolError(
  newItems: { type: string; output?: unknown }[],
): string | undefined {
  for (let i = newItems.length - 1; i >= 0; i--) {
    const item = newItems[i];
    if (item.type !== "tool_call_output_item") continue;
    const raw = typeof item.output === "string" ? item.output : "";
    try {
      const parsed = JSON.parse(raw) as { ok?: boolean; error?: string };
      if (parsed.ok === false && parsed.error) {
        return parsed.error;
      }
    } catch {
      /* continue */
    }
  }
  return undefined;
}

export async function POST(
  req: Request,
  context: { params: Promise<{ agentId: string }> },
) {
  const sessionUser = await getUser();
  if (!sessionUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      {
        error:
          "Server is missing OPENAI_API_KEY for OpenAI agents and image generation.",
      },
      { status: 503 },
    );
  }

  const { agentId } = await context.params;

  if (agentId === "food") {
    return handleFoodAgent(req);
  }

  if (agentId !== "meme") {
    return NextResponse.json(
      { error: `Unknown agent: ${agentId}` },
      { status: 404 },
    );
  }

  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    return NextResponse.json(
      {
        error:
          "Expected multipart/form-data with fields: image (file), message (optional text).",
      },
      { status: 400 },
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data." }, { status: 400 });
  }

  const image = form.get("image");
  if (!(image instanceof Blob) || image.size === 0) {
    return NextResponse.json({ error: "Missing image file." }, { status: 400 });
  }

  if (image.size > MAX_IMAGE_BYTES) {
    return NextResponse.json(
      { error: `Image too large (max ${MAX_IMAGE_BYTES / (1024 * 1024)} MB).` },
      { status: 400 },
    );
  }

  const mediaType = image.type || "image/png";
  if (!ALLOWED_IMAGE_TYPES.has(mediaType)) {
    return NextResponse.json(
      { error: "Unsupported image type. Use PNG, JPEG, or WebP." },
      { status: 400 },
    );
  }

  const buf = Buffer.from(await image.arrayBuffer());
  const messageField = form.get("message");
  const message =
    typeof messageField === "string" && messageField.trim()
      ? messageField.trim()
      : "Create a funny, shareable meme featuring my pet.";

  const runContext: MemeAgentContext = {
    petImage: buf,
    petMediaType: mediaType,
  };

  let visionPreviewDataUrl: string;
  try {
    const preview = await downscaleForVisionPreview(buf);
    visionPreviewDataUrl = `data:image/jpeg;base64,${preview.toString("base64")}`;
  } catch {
    return NextResponse.json(
      {
        error:
          "Could not read or resize the image. Try a different PNG, JPEG, or WebP file.",
      },
      { status: 400 },
    );
  }

  const agentInput = [
    userMessage([
      { type: "input_text", text: message },
      { type: "input_image", image: visionPreviewDataUrl },
    ]),
  ];

  try {
    const result = await run(memeAgent, agentInput, {
      context: runContext,
      maxTurns: 12,
    });

    const assistantText = extractAllTextOutput(result.newItems).trim();
    const sessionCtx = result.runContext.context as MemeAgentContext;
    const memeImageDataUrl = sessionCtx.generatedMemeDataUrl;
    const toolError = parseMemeToolError(
      result.newItems as { type: string; output?: unknown }[],
    );

    return NextResponse.json({
      assistantText: assistantText || undefined,
      memeImageDataUrl,
      toolError,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Agent run failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

function parseToolError(
  newItems: { type: string; output?: unknown }[],
): string | undefined {
  for (let i = newItems.length - 1; i >= 0; i--) {
    const item = newItems[i];
    if (item.type !== "tool_call_output_item") continue;
    const raw = typeof item.output === "string" ? item.output : "";
    try {
      const parsed = JSON.parse(raw) as { ok?: boolean; error?: string };
      if (parsed.ok === false && parsed.error) return parsed.error;
    } catch {
      /* continue */
    }
  }
  return undefined;
}

async function handleFoodAgent(req: Request): Promise<Response> {
  // Accepts multipart/form-data: optional `image`, optional `message`.
  let message = "";
  let imageBlob: Blob | null = null;

  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return NextResponse.json(
        { error: "Invalid form data." },
        { status: 400 },
      );
    }
    const messageField = form.get("message");
    if (typeof messageField === "string") message = messageField.trim();
    const image = form.get("image");
    if (image instanceof Blob && image.size > 0) imageBlob = image;
  } else {
    try {
      const body = (await req.json()) as { message?: string };
      message = typeof body.message === "string" ? body.message.trim() : "";
    } catch {
      /* empty body is fine */
    }
  }

  if (!message) {
    message =
      "Suggest the best food for my pet based on their profile, with prices and where to buy.";
  }

  // Authoritative pet profile from the server (don't trust the client).
  const { pet } = await getPetCareContext();
  const profileText = buildPetProfilePrompt(pet);

  let photoDataUrl: string | undefined;
  if (imageBlob) {
    if (imageBlob.size > MAX_IMAGE_BYTES) {
      return NextResponse.json(
        {
          error: `Image too large (max ${MAX_IMAGE_BYTES / (1024 * 1024)} MB).`,
        },
        { status: 400 },
      );
    }
    const mediaType = imageBlob.type || "image/png";
    if (!ALLOWED_IMAGE_TYPES.has(mediaType)) {
      return NextResponse.json(
        { error: "Unsupported image type. Use PNG, JPEG, or WebP." },
        { status: 400 },
      );
    }
    try {
      const buf = Buffer.from(await imageBlob.arrayBuffer());
      const preview = await downscaleForVisionPreview(buf);
      photoDataUrl = `data:image/jpeg;base64,${preview.toString("base64")}`;
    } catch {
      return NextResponse.json(
        {
          error:
            "Could not read the image. Try a different PNG, JPEG, or WebP.",
        },
        { status: 400 },
      );
    }
  }

  const runContext: FoodAgentContext = {
    petPhotoDataUrl: photoDataUrl,
    foundProducts: new Map<string, FoodProduct>(),
  };

  const agentInput = photoDataUrl
    ? [
        userMessage([
          { type: "input_text", text: message },
          { type: "input_image", image: photoDataUrl },
        ]),
      ]
    : message;

  try {
    const agent = buildFoodAgent(profileText);
    const result = await run(agent, agentInput, {
      context: runContext,
      maxTurns: 12,
    });

    const assistantText = extractAllTextOutput(result.newItems).trim();
    const ctx = result.runContext.context as FoodAgentContext;
    const products = Array.from(ctx.foundProducts.values());
    const toolError = parseToolError(
      result.newItems as { type: string; output?: unknown }[],
    );

    return NextResponse.json({
      assistantText: assistantText || undefined,
      products,
      toolError,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Agent run failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
