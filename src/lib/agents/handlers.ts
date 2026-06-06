import "server-only";

import { extractAllTextOutput, run, user as userMessage } from "@openai/agents";
import { generateText, type ModelMessage, stepCountIs } from "ai";
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
import {
  extractToolsFromAgentItems,
  extractToolsFromGenerateText,
} from "@/lib/agents/tool-trace";
import { buildVetAgent, type VetAgentContext } from "@/lib/agents/vet-agent";
import { buildAssistantSystemPrompt, buildPetTools } from "@/lib/ai/pet-tools";
import { getModel, SYSTEM_PROMPT } from "@/lib/ai/providers";
import type { BookingDraft } from "@/lib/booking/types";
import type { ChatMessageData } from "@/lib/chat/types";
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

export type AgentRunResult = {
  assistantText?: string;
  products?: FoodProduct[];
  places?: ServicePlaceCard[];
  bookingDraft?: BookingDraft;
  memeImageDataUrl?: string;
  /** Signed URL of the meme persisted to S3 (preferred over the data URL). */
  memeImageUrl?: string;
  toolError?: string;
  toolsUsed?: string[];
  error?: string;
  status?: number;
};

type SessionUser = {
  id: string;
  email?: string;
};

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

async function imageBlobToPreview(imageBlob: Blob): Promise<string | null> {
  if (imageBlob.size > MAX_IMAGE_BYTES) return null;
  const mediaType = imageBlob.type || "image/png";
  if (!ALLOWED_IMAGE_TYPES.has(mediaType)) return null;
  try {
    const buf = Buffer.from(await imageBlob.arrayBuffer());
    const preview = await downscaleForVisionPreview(buf);
    return `data:image/jpeg;base64,${preview.toString("base64")}`;
  } catch {
    return null;
  }
}

export async function runGeneralAgent(args: {
  message: string;
  history?: { role: "user" | "assistant"; content: string }[];
}): Promise<AgentRunResult> {
  const message = args.message.trim();
  if (!message) {
    return { error: "Empty message.", status: 400 };
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

  const history: ModelMessage[] = (args.history ?? [])
    .filter((m) => m.content?.trim())
    .slice(-10)
    .map((m) => ({ role: m.role, content: m.content }));

  try {
    const result = await generateText({
      model: getModel(),
      system,
      messages: [...history, { role: "user", content: message }],
      stopWhen: stepCountIs(5),
      tools: buildPetTools({
        defaultPetType: speciesToPetType(pet?.species),
        petLatLng,
      }),
    });
    return {
      assistantText: result.text || undefined,
      toolsUsed: extractToolsFromGenerateText(result),
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Agent run failed";
    return { error: msg, status: 500 };
  }
}

export async function runFoodAgent(args: {
  message: string;
  imageBlob?: Blob | null;
}): Promise<AgentRunResult> {
  const message =
    args.message.trim() ||
    "Suggest the best food for my pet based on their profile, with prices and where to buy.";

  const { pet, settings } = await getPetCareContext();
  const contextText = buildRecommendationContext(pet, settings);

  let photoDataUrl: string | undefined;
  if (args.imageBlob) {
    if (args.imageBlob.size > MAX_IMAGE_BYTES) {
      return {
        error: `Image too large (max ${MAX_IMAGE_BYTES / (1024 * 1024)} MB).`,
        status: 400,
      };
    }
    photoDataUrl = (await imageBlobToPreview(args.imageBlob)) ?? undefined;
    if (!photoDataUrl) {
      return {
        error: "Could not read the image. Try a different PNG, JPEG, or WebP.",
        status: 400,
      };
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

    return {
      assistantText: assistantText || undefined,
      products,
      toolError,
      toolsUsed: extractToolsFromAgentItems(
        result.newItems as { type: string; name?: string; rawItem?: unknown }[],
      ),
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Agent run failed";
    return { error: msg, status: 500 };
  }
}

export async function runGroomingAgent(args: {
  message: string;
  lat?: number;
  lng?: number;
}): Promise<AgentRunResult> {
  const message =
    args.message.trim() ||
    "Suggest the best grooming stores near me for my pet.";

  const { pet, settings } = await getPetCareContext();
  const contextText = buildRecommendationContext(pet, settings);

  let lat: number | undefined;
  let lng: number | undefined;
  let locationNote: string;
  if (typeof args.lat === "number" && typeof args.lng === "number") {
    lat = args.lat;
    lng = args.lng;
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

    return {
      assistantText: assistantText || undefined,
      places,
      toolError,
      toolsUsed: extractToolsFromAgentItems(
        result.newItems as { type: string; name?: string; rawItem?: unknown }[],
      ),
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Agent run failed";
    return { error: msg, status: 500 };
  }
}

export async function runVetAgent(args: {
  message: string;
  imageBlob?: Blob | null;
  lat?: number;
  lng?: number;
}): Promise<AgentRunResult> {
  const message =
    args.message.trim() ||
    "My pet isn't feeling well — please assess the symptoms and suggest what to do and which vet to see.";

  const { pet, settings } = await getPetCareContext();
  const contextText = buildRecommendationContext(pet, settings);

  let lat: number | undefined;
  let lng: number | undefined;
  let locationNote: string;
  if (
    typeof args.lat === "number" &&
    typeof args.lng === "number" &&
    Number.isFinite(args.lat) &&
    Number.isFinite(args.lng)
  ) {
    lat = args.lat;
    lng = args.lng;
    locationNote = "Using the user's shared current location (browser GPS).";
  } else if (pet?.locationPostalCode) {
    const coords = postalToLatLng(pet.locationPostalCode);
    if (coords) {
      lat = coords.lat;
      lng = coords.lng;
      locationNote = `Using the pet's saved home area (postal ${pet.locationPostalCode}${pet.locationLabel ? `, ${pet.locationLabel}` : ""}).`;
    } else {
      locationNote =
        "No location on file — give triage advice, then ask the user for a Singapore postal code.";
    }
  } else {
    locationNote =
      "No location on file — give triage advice, then ask the user to share their location or a Singapore postal code.";
  }

  let photoDataUrl: string | undefined;
  if (args.imageBlob) {
    if (args.imageBlob.size > MAX_IMAGE_BYTES) {
      return {
        error: `Image too large (max ${MAX_IMAGE_BYTES / (1024 * 1024)} MB).`,
        status: 400,
      };
    }
    photoDataUrl = (await imageBlobToPreview(args.imageBlob)) ?? undefined;
    if (!photoDataUrl) {
      return {
        error: "Could not read the image. Try a different PNG, JPEG, or WebP.",
        status: 400,
      };
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

    return {
      assistantText: assistantText || undefined,
      places,
      toolError,
      toolsUsed: extractToolsFromAgentItems(
        result.newItems as { type: string; name?: string; rawItem?: unknown }[],
      ),
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Agent run failed";
    return { error: msg, status: 500 };
  }
}

export async function runMemeAgent(args: {
  message: string;
  imageBlob: Blob;
}): Promise<AgentRunResult> {
  if (args.imageBlob.size > MAX_IMAGE_BYTES) {
    return {
      error: `Image too large (max ${MAX_IMAGE_BYTES / (1024 * 1024)} MB).`,
      status: 400,
    };
  }

  const mediaType = args.imageBlob.type || "image/png";
  if (!ALLOWED_IMAGE_TYPES.has(mediaType)) {
    return {
      error: "Unsupported image type. Use PNG, JPEG, or WebP.",
      status: 400,
    };
  }

  const buf = Buffer.from(await args.imageBlob.arrayBuffer());
  const message =
    args.message.trim() || "Create a funny, shareable meme featuring my pet.";

  const runContext: MemeAgentContext = {
    petImage: buf,
    petMediaType: mediaType,
  };

  let visionPreviewDataUrl: string;
  try {
    const preview = await downscaleForVisionPreview(buf);
    visionPreviewDataUrl = `data:image/jpeg;base64,${preview.toString("base64")}`;
  } catch {
    return {
      error:
        "Could not read or resize the image. Try a different PNG, JPEG, or WebP file.",
      status: 400,
    };
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
    const toolError = parseToolError(
      result.newItems as { type: string; output?: unknown }[],
    );

    // Persist the meme to private S3 and prefer a signed URL over the heavy
    // base64 data URL. Falls back to the data URL if storage is unconfigured.
    let memeImageUrl: string | undefined;
    if (memeImageDataUrl && isStorageConfigured()) {
      try {
        const parsed = parseDataUrl(memeImageDataUrl);
        if (parsed) {
          const key = buildObjectKey("memes", parsed.contentType);
          await uploadImage({
            key,
            body: parsed.bytes,
            contentType: parsed.contentType,
          });
          memeImageUrl = await getSignedDownloadUrl(key);
        }
      } catch {
        // keep the memeImageDataUrl fallback
      }
    }

    return {
      assistantText: assistantText || undefined,
      memeImageUrl,
      memeImageDataUrl: memeImageUrl ? undefined : memeImageDataUrl,
      toolError,
      toolsUsed: extractToolsFromAgentItems(
        result.newItems as { type: string; name?: string; rawItem?: unknown }[],
      ),
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Agent run failed";
    return { error: msg, status: 500 };
  }
}

export async function runBookingAgent(args: {
  message: string;
  sessionUser: SessionUser;
  servicePlaceId?: string;
  requestedService?: string;
  requestedTimeWindow?: string;
  recentPlaces?: { id: string; name: string }[];
}): Promise<AgentRunResult> {
  const message = args.message.trim();
  const recentPlaces = Array.isArray(args.recentPlaces)
    ? args.recentPlaces.filter((p) => p?.id && p?.name)
    : [];
  const presetPlaceId = args.servicePlaceId;

  const { pet, settings } = await getPetCareContext();
  const contextText = buildRecommendationContext(pet, settings);

  const runContext: BookingAgentContext = {
    user: args.sessionUser,
    pet,
    recentPlaces,
    presetPlaceId,
  };

  if (presetPlaceId) {
    try {
      const draft = await createBookingDraftDirect(runContext, {
        servicePlaceId: presetPlaceId,
        requestedService: args.requestedService,
        requestedTimeWindow: args.requestedTimeWindow,
        notes: message || null,
      });
      return {
        assistantText: bookingSuccessText(draft),
        bookingDraft: draft,
        toolsUsed: ["create_booking_draft"],
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Booking failed";
      return { error: msg, status: 400 };
    }
  }

  if (!message) {
    return { error: "Please describe what you'd like to book.", status: 400 };
  }

  const resolvedId = resolvePlaceId(message, recentPlaces);
  if (resolvedId) {
    try {
      const draft = await createBookingDraftDirect(runContext, {
        servicePlaceId: resolvedId,
        requestedService: args.requestedService,
        requestedTimeWindow: args.requestedTimeWindow,
        notes: message,
      });
      return {
        assistantText: bookingSuccessText(draft),
        bookingDraft: draft,
        toolsUsed: ["create_booking_draft"],
      };
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

    return {
      assistantText:
        assistantText ||
        (draft ? bookingSuccessText(draft) : undefined) ||
        toolError ||
        "Tell me which groomer or vet you'd like to book, and your preferred date/time.",
      bookingDraft: draft,
      toolError,
      toolsUsed: extractToolsFromAgentItems(
        result.newItems as { type: string; name?: string; rawItem?: unknown }[],
      ),
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Booking agent failed";
    return { error: msg, status: 500 };
  }
}

export function agentResultToMessageContent(
  agentId: string,
  result: AgentRunResult,
): { content: string; data?: ChatMessageData | null } {
  if (result.error) {
    return { content: `Sorry — ${result.error}`, data: { isError: true } };
  }

  if (agentId === "meme") {
    const memeImage = result.memeImageUrl ?? result.memeImageDataUrl;
    return {
      content:
        result.assistantText ||
        (memeImage
          ? "Here's your meme! 🐾"
          : result.toolError || "No image returned."),
      data: { imageUrl: memeImage },
    };
  }

  if (agentId === "food") {
    return {
      content:
        result.assistantText ||
        result.toolError ||
        "I couldn't find a good match just now — add a bit more detail.",
      data: { products: result.products },
    };
  }

  if (agentId === "grooming" || agentId === "vet") {
    return {
      content:
        result.assistantText ||
        result.toolError ||
        (agentId === "vet"
          ? "I couldn't assess that just now — try describing the symptoms in a bit more detail."
          : "I couldn't find a good match just now — try sharing your location."),
      data: { places: result.places },
    };
  }

  if (agentId === "booking") {
    return {
      content:
        result.assistantText ||
        "Tell me which groomer or vet you'd like to book.",
      data: result.bookingDraft ? { bookingDraft: result.bookingDraft } : null,
    };
  }

  return {
    content: result.assistantText || "I'm not sure how to help with that yet.",
  };
}
