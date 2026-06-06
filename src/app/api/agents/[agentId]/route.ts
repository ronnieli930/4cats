import { extractAllTextOutput, run, user as userMessage } from "@openai/agents";
import { generateText, type ModelMessage, stepCountIs } from "ai";
import { NextResponse } from "next/server";
import {
  type BookingAgentContext,
  buildBookingAgent,
  createBookingDraftDirect,
  resolvePlaceId,
} from "@/lib/agents/booking-agent";
import {
  buildFoodAgent,
  type FoodAgentContext,
  type FoodProduct,
} from "@/lib/agents/food-agent";
import {
  buildGroomingAgent,
  type GroomingAgentContext,
  type ServicePlaceCard,
} from "@/lib/agents/grooming-agent";
import type { MemeAgentContext } from "@/lib/agents/meme-agent";
import { memeAgent } from "@/lib/agents/meme-agent";
import { buildVetAgent, type VetAgentContext } from "@/lib/agents/vet-agent";
import { buildAssistantSystemPrompt, buildPetTools } from "@/lib/ai/pet-tools";
import { getModel, SYSTEM_PROMPT } from "@/lib/ai/providers";
import { getUser } from "@/lib/auth/server";
import type { BookingDraft } from "@/lib/booking/types";
import { downscaleForVisionPreview } from "@/lib/image/downscale-for-vision";
import { enrichPlaceCards } from "@/lib/pet-data/enrich-places";
import {
  buildPetProfilePrompt,
  buildRecommendationContext,
  buildUserSettingsPrompt,
  speciesToPetType,
} from "@/lib/pet-data/format";
import { postalToLatLng } from "@/lib/pet-data/search";
import { getPetCareContext } from "@/lib/pet-queries";
import {
  buildObjectKey,
  getSignedDownloadUrl,
  isStorageConfigured,
  parseDataUrl,
  uploadImage,
} from "@/lib/storage/s3";

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

  if (agentId === "general") {
    return handleGeneralAgent(req);
  }

  if (agentId === "food") {
    return handleFoodAgent(req);
  }

  if (agentId === "grooming") {
    return handleGroomingAgent(req);
  }

  if (agentId === "vet") {
    return handleVetAgent(req);
  }

  if (agentId === "booking") {
    return handleBookingAgent(req, sessionUser);
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

    // Persist the generated meme to private S3 and return a signed URL instead
    // of the heavy base64 data URL. Falls back to the data URL if storage is
    // unconfigured or the upload fails, so the demo still works either way.
    let memeImageUrl: string | undefined;
    if (memeImageDataUrl && isStorageConfigured()) {
      try {
        const parsed = parseDataUrl(memeImageDataUrl);
        if (parsed) {
          const key = buildObjectKey(
            `memes/${sessionUser.id}`,
            parsed.contentType,
          );
          await uploadImage({
            key,
            body: parsed.bytes,
            contentType: parsed.contentType,
          });
          memeImageUrl = await getSignedDownloadUrl(key);
        }
      } catch {
        // keep memeImageDataUrl fallback below
      }
    }

    return NextResponse.json({
      assistantText: assistantText || undefined,
      memeImageUrl,
      memeImageDataUrl: memeImageUrl ? undefined : memeImageDataUrl,
      toolError,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Agent run failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

async function handleGeneralAgent(req: Request): Promise<Response> {
  let body: {
    message?: string;
    history?: { role: "user" | "assistant"; content: string }[];
  } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    /* empty body is fine */
  }

  const message =
    typeof body.message === "string" && body.message.trim()
      ? body.message.trim()
      : "";
  if (!message) {
    return NextResponse.json({ error: "Empty message." }, { status: 400 });
  }

  const { pet, settings } = await getPetCareContext();
  const system = buildAssistantSystemPrompt(
    SYSTEM_PROMPT,
    buildPetProfilePrompt(pet),
    buildUserSettingsPrompt(settings),
  );
  const petLatLng = pet?.locationPostalCode
    ? postalToLatLng(pet.locationPostalCode)
    : null;

  const history: ModelMessage[] = (body.history ?? [])
    .filter((m) => m.content?.trim())
    .slice(-10)
    .map((m) => ({ role: m.role, content: m.content }));

  try {
    const { text } = await generateText({
      model: getModel(),
      system,
      messages: [...history, { role: "user", content: message }],
      stopWhen: stepCountIs(5),
      tools: buildPetTools({
        defaultPetType: speciesToPetType(pet?.species),
        petLatLng,
      }),
    });
    return NextResponse.json({ assistantText: text || undefined });
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
  const { pet, settings } = await getPetCareContext();
  const contextText = buildRecommendationContext(pet, settings);

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
    const agent = buildFoodAgent(contextText);
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

async function handleVetAgent(req: Request): Promise<Response> {
  // Accepts multipart/form-data (image + message + lat/lng) or JSON.
  let message = "";
  let imageBlob: Blob | null = null;
  let lat: number | undefined;
  let lng: number | undefined;

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
    const latField = form.get("lat");
    const lngField = form.get("lng");
    if (typeof latField === "string" && latField) lat = Number(latField);
    if (typeof lngField === "string" && lngField) lng = Number(lngField);
  } else {
    try {
      const body = (await req.json()) as {
        message?: string;
        lat?: number;
        lng?: number;
      };
      message = typeof body.message === "string" ? body.message.trim() : "";
      if (typeof body.lat === "number") lat = body.lat;
      if (typeof body.lng === "number") lng = body.lng;
    } catch {
      /* empty body is fine */
    }
  }

  if (!message) {
    message =
      "My pet isn't feeling well — please assess the symptoms and suggest what to do and which vet to see.";
  }

  const { pet, settings } = await getPetCareContext();
  const contextText = buildRecommendationContext(pet, settings);

  // Resolve a seed location: browser GPS (preferred) → pet's saved postal code.
  let locationNote: string;
  if (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng)
  ) {
    locationNote = "Using the user's shared current location (browser GPS).";
  } else if (pet?.locationPostalCode) {
    const coords = postalToLatLng(pet.locationPostalCode);
    if (coords) {
      lat = coords.lat;
      lng = coords.lng;
      locationNote = `Using the pet's saved home area (postal ${pet.locationPostalCode}${pet.locationLabel ? `, ${pet.locationLabel}` : ""}).`;
    } else {
      lat = undefined;
      lng = undefined;
      locationNote =
        "No usable location yet — give triage advice, then ask the user for a Singapore postal code.";
    }
  } else {
    lat = undefined;
    lng = undefined;
    locationNote =
      "No location on file — give triage advice, then ask the user to share their location or a Singapore postal code.";
  }

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

  const runContext: VetAgentContext = {
    defaultLat: lat,
    defaultLng: lng,
    petPhotoDataUrl: photoDataUrl,
    foundPlaces: new Map<string, ServicePlaceCard>(),
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
    const agent = buildVetAgent(contextText, locationNote);
    const result = await run(agent, agentInput, {
      context: runContext,
      maxTurns: 12,
    });

    const assistantText = extractAllTextOutput(result.newItems).trim();
    const ctx = result.runContext.context as VetAgentContext;
    const places = await enrichPlaceCards(Array.from(ctx.foundPlaces.values()));
    const toolError = parseToolError(
      result.newItems as { type: string; output?: unknown }[],
    );

    return NextResponse.json({
      assistantText: assistantText || undefined,
      places,
      toolError,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Agent run failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

async function handleGroomingAgent(req: Request): Promise<Response> {
  let body: { message?: string; lat?: number; lng?: number } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    /* empty body is fine */
  }

  const message =
    typeof body.message === "string" && body.message.trim()
      ? body.message.trim()
      : "Suggest the best grooming stores near me for my pet.";

  const { pet, settings } = await getPetCareContext();
  const contextText = buildRecommendationContext(pet, settings);

  // Resolve a seed location: browser GPS (preferred) → pet's saved postal code.
  let lat: number | undefined;
  let lng: number | undefined;
  let locationNote: string;
  if (typeof body.lat === "number" && typeof body.lng === "number") {
    lat = body.lat;
    lng = body.lng;
    locationNote = "Using the user's shared current location (browser GPS).";
  } else if (pet?.locationPostalCode) {
    const coords = postalToLatLng(pet.locationPostalCode);
    if (coords) {
      lat = coords.lat;
      lng = coords.lng;
      locationNote = `Using the pet's saved home area (postal ${pet.locationPostalCode}${pet.locationLabel ? `, ${pet.locationLabel}` : ""}).`;
    } else {
      locationNote =
        "No usable location yet — ask the user for a Singapore postal code.";
    }
  } else {
    locationNote =
      "No location on file — ask the user to share their location or give a Singapore postal code.";
  }

  const runContext: GroomingAgentContext = {
    defaultLat: lat,
    defaultLng: lng,
    foundPlaces: new Map<string, ServicePlaceCard>(),
  };

  try {
    const agent = buildGroomingAgent(contextText, locationNote);
    const result = await run(agent, message, {
      context: runContext,
      maxTurns: 12,
    });

    const assistantText = extractAllTextOutput(result.newItems).trim();
    const ctx = result.runContext.context as GroomingAgentContext;
    const places = await enrichPlaceCards(Array.from(ctx.foundPlaces.values()));
    const toolError = parseToolError(
      result.newItems as { type: string; output?: unknown }[],
    );

    return NextResponse.json({
      assistantText: assistantText || undefined,
      places,
      toolError,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Agent run failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

type SessionUser = NonNullable<Awaited<ReturnType<typeof getUser>>>;

function bookingSuccessText(draft: BookingDraft): string {
  if (draft.channel === "email" && draft.mailtoUrl) {
    return `I've prepared a booking email to **${draft.placeName}** (${draft.toEmail}). Tap **Open in email** below to review and send it from your mail app — that's the real reservation request.`;
  }
  if (draft.channel === "calendly" && draft.bookingUrl) {
    return `**${draft.placeName}** accepts online bookings. Use the **Book online** button below to complete your reservation.`;
  }
  if (draft.channel === "phone" && draft.phone) {
    return `**${draft.placeName}** doesn't have a booking email on file. Please **call them** using the button below to make your reservation.`;
  }
  return `I saved your booking request for **${draft.placeName}**, but couldn't find email, online booking, or phone contact details. Try their website or Google Maps listing.`;
}

async function handleBookingAgent(
  req: Request,
  sessionUser: SessionUser,
): Promise<Response> {
  let body: {
    message?: string;
    servicePlaceId?: string;
    requestedService?: string;
    requestedTimeWindow?: string;
    recentPlaces?: { id: string; name: string }[];
  } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  const recentPlaces = Array.isArray(body.recentPlaces)
    ? body.recentPlaces.filter((p) => p?.id && p?.name)
    : [];
  const presetPlaceId =
    typeof body.servicePlaceId === "string" ? body.servicePlaceId : undefined;

  const { pet, settings } = await getPetCareContext();
  const contextText = buildRecommendationContext(pet, settings);

  const runContext: BookingAgentContext = {
    user: sessionUser,
    pet,
    recentPlaces,
    presetPlaceId,
  };

  if (presetPlaceId) {
    try {
      const draft = await createBookingDraftDirect(runContext, {
        servicePlaceId: presetPlaceId,
        requestedService: body.requestedService,
        requestedTimeWindow: body.requestedTimeWindow,
        notes: message || null,
      });
      return NextResponse.json({
        assistantText: bookingSuccessText(draft),
        bookingDraft: draft,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Booking failed";
      return NextResponse.json({ error: msg }, { status: 400 });
    }
  }

  if (!message) {
    return NextResponse.json(
      { error: "Please describe what you'd like to book." },
      { status: 400 },
    );
  }

  const resolvedId = resolvePlaceId(message, recentPlaces);
  if (resolvedId) {
    try {
      const draft = await createBookingDraftDirect(runContext, {
        servicePlaceId: resolvedId,
        requestedService: body.requestedService,
        requestedTimeWindow: body.requestedTimeWindow,
        notes: message,
      });
      return NextResponse.json({
        assistantText: bookingSuccessText(draft),
        bookingDraft: draft,
      });
    } catch {
      /* fall through to LLM agent */
    }
  }

  const recentPlacesNote =
    recentPlaces.length > 0
      ? recentPlaces.map((p) => `- ${p.name} (id: ${p.id})`).join("\n")
      : "No places in recent context — ask the user which groomer or vet they mean.";
  const presetNote =
    "No preset place — infer from the user's message and recent places.";

  try {
    const agent = buildBookingAgent(contextText, recentPlacesNote, presetNote);
    const result = await run(agent, message, {
      context: runContext,
      maxTurns: 8,
    });

    const assistantText = extractAllTextOutput(result.newItems).trim();
    const ctx = result.runContext.context as BookingAgentContext;
    const draft = ctx.draft;
    const toolError = parseToolError(
      result.newItems as { type: string; output?: unknown }[],
    );

    return NextResponse.json({
      assistantText:
        assistantText ||
        (draft ? bookingSuccessText(draft) : undefined) ||
        toolError ||
        "Tell me which groomer or vet you'd like to book, and your preferred date/time.",
      bookingDraft: draft,
      toolError,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Booking agent failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
