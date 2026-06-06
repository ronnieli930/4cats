import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  stepCountIs,
  streamText,
  tool,
} from "ai";
import { z } from "zod";
import { getModel, SYSTEM_PROMPT } from "@/lib/ai/providers";
import {
  buildPetProfilePrompt,
  formatPriceRange,
  speciesToPetType,
} from "@/lib/pet-data/format";
import {
  postalToLatLng,
  searchFood,
  searchGroomers,
  searchVets,
} from "@/lib/pet-data/search";
import { getPetCareContext } from "@/lib/pet-queries";

const PET_TYPES = [
  "dog",
  "cat",
  "rabbit",
  "bird",
  "fish",
  "reptile",
  "small_pet",
] as const;

export async function POST(req: Request) {
  const { messages } = await req.json();

  const { pet } = await getPetCareContext();
  const profileText = buildPetProfilePrompt(pet);
  const defaultPetType = speciesToPetType(pet?.species);
  const petLatLng = pet?.locationPostalCode
    ? postalToLatLng(pet.locationPostalCode)
    : null;

  const system = `${SYSTEM_PROMPT}

You can ground answers in a real Singapore catalogue using tools:
- search_food: real pet-food products (brand, price, ingredients, buy link). Use it before recommending any food, and never invent products or prices.
- search_groomers / search_vets: nearby places with ratings and contacts. "Near me" means near the pet's saved location.

Always prefer tool results over guessing. When recommending products or places, include the price/rating and that a link/contact is available. Keep a warm, concise tone.

--- PET PROFILE ---
${profileText}`;

  const result = streamText({
    model: getModel(),
    system,
    messages: await convertToModelMessages(messages),
    stopWhen: stepCountIs(5),
    tools: {
      search_food: tool({
        description:
          "Semantic search over real Singapore pet-food products. Returns brand, price, availability, buy URL and an ingredient snippet.",
        inputSchema: z.object({
          query: z
            .string()
            .describe(
              "Food query, e.g. 'hypoallergenic small breed dog kibble'.",
            ),
          petType: z
            .enum(PET_TYPES)
            .nullable()
            .describe("Pet type filter, or null."),
          brand: z.string().nullable().describe("Brand filter, or null."),
        }),
        execute: async ({ query, petType, brand }) => {
          const results = await searchFood({
            query,
            petType: petType ?? defaultPetType,
            brand: brand ?? undefined,
            limit: 6,
          });
          return results.map((r) => ({
            title: r.title,
            brand: r.brand,
            price: formatPriceRange(r.priceMinCents, r.priceMaxCents),
            petType: r.petType,
            productType: r.productType,
            available: r.available,
            url: r.url,
            ingredients: r.snippet.slice(0, 300),
          }));
        },
      }),
      search_groomers: tool({
        description:
          "Find pet groomers near the pet's saved location (or a given postal code).",
        inputSchema: z.object({
          postalCode: z
            .string()
            .nullable()
            .describe("SG postal code to search near, or null for saved home."),
          radiusKm: z.number().min(1).max(25).nullable(),
        }),
        execute: async ({ postalCode, radiusKm }) => {
          const coords = postalCode ? postalToLatLng(postalCode) : petLatLng;
          if (!coords) {
            return {
              error:
                "No location available. Ask the user for a Singapore postal code.",
            };
          }
          const places = await searchGroomers({
            ...coords,
            radiusKm: radiusKm ?? 8,
            limit: 5,
          });
          return places.map((p) => ({
            name: p.name,
            address: p.address,
            rating: p.rating,
            reviews: p.userRatingCount,
            distanceKm: Number(p.distanceKm.toFixed(1)),
            phone: p.phone,
            website: p.websiteUrl,
            mapsUrl: p.googleMapsUrl,
            tags: [...p.serviceTags, ...p.suitabilityTags],
          }));
        },
      }),
      search_vets: tool({
        description:
          "Find vet clinics near the pet's saved location (or a given postal code). Includes exotic/avian/rabbit-friendly clinics.",
        inputSchema: z.object({
          postalCode: z
            .string()
            .nullable()
            .describe("SG postal code to search near, or null for saved home."),
          radiusKm: z.number().min(1).max(25).nullable(),
        }),
        execute: async ({ postalCode, radiusKm }) => {
          const coords = postalCode ? postalToLatLng(postalCode) : petLatLng;
          if (!coords) {
            return {
              error:
                "No location available. Ask the user for a Singapore postal code.",
            };
          }
          const places = await searchVets({
            ...coords,
            radiusKm: radiusKm ?? 8,
            limit: 5,
          });
          return places.map((p) => ({
            name: p.name,
            address: p.address,
            rating: p.rating,
            reviews: p.userRatingCount,
            distanceKm: Number(p.distanceKm.toFixed(1)),
            phone: p.phone,
            website: p.websiteUrl,
            mapsUrl: p.googleMapsUrl,
            tags: [...p.serviceTags, ...p.suitabilityTags],
          }));
        },
      }),
    },
  });

  return createUIMessageStreamResponse({
    stream: result.toUIMessageStream(),
  });
}
