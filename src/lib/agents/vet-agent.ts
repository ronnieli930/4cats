import "server-only";

import { Agent, tool } from "@openai/agents";
import { z } from "zod";
import type { ServicePlaceCard } from "@/lib/pet-data/format";
import {
  postalToLatLng,
  type ServicePlaceResult,
  searchVets,
} from "@/lib/pet-data/search";

export type { ServicePlaceCard };

export type VetAgentContext = {
  /** Seed location resolved by the route (browser geolocation or pet's home). */
  defaultLat?: number;
  defaultLng?: number;
  /** Optional downscaled photo (vision preview already built by the route). */
  petPhotoDataUrl?: string;
  /** Collected by `search_vets` so the route can render place cards. */
  foundPlaces: Map<string, ServicePlaceCard>;
};

function toCard(p: ServicePlaceResult): ServicePlaceCard {
  return {
    id: p.id,
    name: p.name,
    address: p.address,
    rating: p.rating,
    reviewCount: p.userRatingCount,
    distanceKm: Number(p.distanceKm.toFixed(1)),
    phone: p.phone,
    websiteUrl: p.websiteUrl,
    googleMapsUrl: p.googleMapsUrl,
    tags: [...p.serviceTags, ...p.suitabilityTags],
  };
}

const VET_AGENT_MODEL = process.env.AI_AGENT_MODEL ?? "gpt-4o";

const searchVetsTool = tool({
  name: "search_vets",
  description:
    "Find real veterinary clinics near a location in Singapore, with rating, distance, contacts and top reviews. Includes exotic/avian/rabbit-friendly clinics (check suitability tags). Call this before recommending any clinic — never invent clinics, ratings, or contacts. By default it searches near the user's resolved location; pass a postal code to search elsewhere.",
  parameters: z.object({
    postalCode: z
      .string()
      .nullable()
      .describe(
        "Singapore postal code to search near. Null to use the user's resolved location (browser GPS or saved home).",
      ),
    radiusKm: z
      .number()
      .min(1)
      .max(25)
      .nullable()
      .describe("Search radius in km (default 10)."),
    limit: z
      .number()
      .int()
      .min(1)
      .max(8)
      .nullable()
      .describe("Max results (default 5)."),
  }),
  execute: async (input, runContext) => {
    const ctx = runContext?.context as VetAgentContext | undefined;
    const coords = input.postalCode
      ? postalToLatLng(input.postalCode)
      : ctx?.defaultLat != null && ctx?.defaultLng != null
        ? { lat: ctx.defaultLat, lng: ctx.defaultLng }
        : null;

    if (!coords) {
      return JSON.stringify({
        ok: false,
        error:
          "No location available. Ask the user for a Singapore postal code, or have them share their location.",
      });
    }

    try {
      const places = await searchVets({
        lat: coords.lat,
        lng: coords.lng,
        radiusKm: input.radiusKm ?? 10,
        limit: input.limit ?? 5,
        withReviews: true,
        reviewsPerPlace: 2,
      });

      if (ctx) {
        for (const p of places) ctx.foundPlaces.set(p.id, toCard(p));
      }

      const items = places.map((p) => ({
        id: p.id,
        name: p.name,
        address: p.address,
        rating: p.rating,
        reviews: p.userRatingCount,
        distanceKm: Number(p.distanceKm.toFixed(1)),
        phone: p.phone,
        website: p.websiteUrl,
        tags: [...p.serviceTags, ...p.suitabilityTags],
        reviewSnippets: p.reviews
          .map((r) => r.text?.slice(0, 200))
          .filter(Boolean),
      }));
      return JSON.stringify({ ok: true, count: items.length, items });
    } catch (e) {
      const error = e instanceof Error ? e.message : "Vet search failed";
      return JSON.stringify({ ok: false, error });
    }
  },
});

const BASE_INSTRUCTIONS = `You are the Vet Finder for "Little Lovely Pets", a Singapore pet-care app. You help a worried pet owner understand their pet's symptoms and find the right vet near them. You are NOT a veterinarian and must not give a definitive diagnosis — you provide first-aid-level guidance and triage, then point them to professional care.

How to work:
1. TRIAGE FIRST. Read the described symptoms (and the photo if provided) and judge urgency:
   - EMERGENCY (e.g. difficulty breathing, collapse, seizures, severe bleeding, suspected poisoning, bloated hard abdomen, inability to urinate, heatstroke, trauma): tell them clearly to seek a 24-hour emergency vet IMMEDIATELY, before anything else.
   - URGENT (worsening, lethargy with not eating >24h, repeated vomiting/diarrhoea, eye injuries, limping that won't bear weight): advise seeing a vet today/within 24h.
   - ROUTINE (mild, single, non-worsening): suggest monitoring with clear "watch for" red flags and a routine appointment.
2. If a PHOTO is provided, describe what you can/can't tell from it (e.g. visible swelling, discharge, skin lesion, body condition). Always say it's an estimate from a photo and cannot replace an exam.
3. Give SUGGESTED ACTIONS: 2–4 concrete, safe steps the owner can take now (e.g. what to monitor, do/don't, safe home care). Never recommend human medications or dosages.
4. RECOMMEND VETS. ALWAYS call the search_vets tool before suggesting any clinic. Recommend ONLY clinics returned by the tool — never invent clinics, ratings, distances, or contacts. Match the pet: for rabbits/birds/reptiles/other exotics, prefer clinics whose tags/reviews indicate exotic/avian/small-pet experience. Recommend 2–3 clinics, each with: name, distance, rating (with review count), and a one-line reason it fits (cite an exotic/emergency suitability tag or review detail when relevant). Note that contact/booking details are available.
5. If no location is available, still give triage + actions, then ask for a Singapore postal code (or to share location) so you can find nearby clinics.
6. Be calm, warm and concise. Use light Markdown: a short urgency line, a brief "What I can see" (if photo), a "What to do now" bullet list, then "Vets near you". Do not paste raw JSON, IDs, or full URLs — the app shows clickable clinic cards with call/website/directions buttons. Always end with a one-line reminder that this isn't a diagnosis and to confirm with a vet.`;

/** Builds a per-request agent with the pet profile + location baked into instructions. */
export function buildVetAgent(
  petProfileText: string,
  locationNote: string,
): Agent<VetAgentContext> {
  return new Agent<VetAgentContext>({
    name: "Vet Finder",
    model: VET_AGENT_MODEL,
    instructions: `${BASE_INSTRUCTIONS}\n\n--- PET PROFILE ---\n${petProfileText}\n\n--- LOCATION ---\n${locationNote}`,
    tools: [searchVetsTool],
  });
}
