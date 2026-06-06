import "server-only";

import { Agent, tool } from "@openai/agents";
import { z } from "zod";
import {
  type FoodProduct,
  formatPriceRange,
  petTypeLabel,
} from "@/lib/pet-data/format";
import { type FoodResult, searchFood } from "@/lib/pet-data/search";

export type { FoodProduct };

export type FoodAgentContext = {
  /** Optional downscaled photo bytes (vision preview already built by the route). */
  petPhotoDataUrl?: string;
  /** Collected by `search_food` so the route can render product cards. */
  foundProducts: Map<string, FoodProduct>;
};

function toProduct(r: FoodResult): FoodProduct {
  return {
    id: r.id,
    title: r.title,
    brand: r.brand,
    priceLabel: formatPriceRange(r.priceMinCents, r.priceMaxCents),
    petType: petTypeLabel(r.petType),
    productType: r.productType,
    available: r.available,
    url: r.url,
  };
}

const FOOD_AGENT_MODEL = process.env.AI_AGENT_MODEL ?? "gpt-4o";

const searchFoodTool = tool({
  name: "search_food",
  description:
    "Semantic search over a Singapore catalogue of real pet-food products. Returns grounded items with brand, price, availability, buy URL and an ingredient snippet. Call this BEFORE recommending any product — never invent brands, prices, or ingredients. Search multiple times with different queries (e.g. by life stage, protein, condition) when helpful.",
  parameters: z.object({
    query: z
      .string()
      .describe(
        "Natural-language food query, e.g. 'hypoallergenic small breed dog kibble', 'grain-free chicken-free cat food', 'senior dog joint support'.",
      ),
    petType: z
      .enum(["dog", "cat", "rabbit", "bird", "fish", "reptile", "small_pet"])
      .nullable()
      .describe("Filter by pet type when known. Null for no filter."),
    brand: z
      .string()
      .nullable()
      .describe(
        "Filter to a specific brand (e.g. 'Acana') for an 'is X safe?' lookup. Null for no filter.",
      ),
    limit: z
      .number()
      .int()
      .min(1)
      .max(8)
      .nullable()
      .describe("Max results (default 6)."),
  }),
  execute: async (input, runContext) => {
    const ctx = runContext?.context as FoodAgentContext | undefined;
    try {
      const results = await searchFood({
        query: input.query,
        petType: input.petType ?? undefined,
        brand: input.brand ?? undefined,
        limit: input.limit ?? 6,
      });

      if (ctx) {
        for (const r of results) {
          ctx.foundProducts.set(r.id, toProduct(r));
        }
      }

      // Compact payload for the model (full product cached in context for the UI).
      const items = results.map((r) => ({
        id: r.id,
        title: r.title,
        brand: r.brand,
        price: formatPriceRange(r.priceMinCents, r.priceMaxCents),
        petType: r.petType,
        productType: r.productType,
        available: r.available,
        url: r.url,
        ingredients: r.snippet.slice(0, 320),
        similarity: Number(r.similarity.toFixed(3)),
      }));
      return JSON.stringify({ ok: true, count: items.length, items });
    } catch (e) {
      const error = e instanceof Error ? e.message : "Food search failed";
      return JSON.stringify({ ok: false, error });
    }
  },
});

const BASE_INSTRUCTIONS = `You are the Food Finder for "Little Lovely Pets", a Singapore pet-care app. Your job: recommend the right food for the user's pet, say why it fits, give the price, and tell them where to buy it.

How to work:
1. ALWAYS call the search_food tool before recommending anything. Recommend ONLY products returned by the tool — never invent brands, prices, ingredients, or links. Run a few targeted searches (life stage, protein source, medical condition, body condition) when useful.
2. Ground every recommendation in the pet's profile below: species/breed, age, weight, medical conditions and dietary restrictions. Respect restrictions strictly (e.g. if "no chicken", do not recommend chicken-based foods; flag if the only matches contain it).
3. If a pet PHOTO is provided, use it to estimate species, breed, rough size and body condition (under/ideal/overweight) and factor that in — but say it's an estimate from the photo.
4. Recommend 2–4 specific products. For each, give: product name + brand, a one-line reason it fits this pet, the price (from the data), and that it can be bought via its link. Add a short safety note when a medical condition or restriction is relevant.
5. Be warm, concise, and use light Markdown (short intro, then a bullet per product). Do not paste raw JSON, IDs, or long ingredient dumps. End with a brief reminder to consult a vet for medical diets.

The app shows clickable product cards (name, price, buy button) for every product you found, so you don't need to repeat full URLs — refer to products by name.`;

/** Builds a per-request agent with the pet profile baked into instructions. */
export function buildFoodAgent(
  petProfileText: string,
): Agent<FoodAgentContext> {
  return new Agent<FoodAgentContext>({
    name: "Food Finder",
    model: FOOD_AGENT_MODEL,
    instructions: `${BASE_INSTRUCTIONS}\n\n--- PET PROFILE ---\n${petProfileText}`,
    tools: [searchFoodTool],
  });
}
