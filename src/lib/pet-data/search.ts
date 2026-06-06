/**
 * Pet-data retrieval layer — the handoff surface between the data pipeline and
 * the AI agent. The agent's tools (search_food / search_groomers / search_vets)
 * should call these functions and format the grounded results.
 *
 * Backed by the pipeline's pgvector store (match_knowledge_chunks) and geo RPC
 * (nearby_service_places). Server-side only: needs DATABASE_URL + OPENAI_API_KEY.
 *
 * Intentionally self-contained (its own pg pool + OpenAI client) so it has no
 * dependency on the app's Prisma client. Swap to Prisma $queryRaw if preferred.
 */
import OpenAI from "openai";
import { Pool } from "pg";

const EMBEDDING_MODEL = "text-embedding-3-small";

let pool: Pool | undefined;
function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error("DATABASE_URL is not set");
    const isLocal = /@(localhost|127\.0\.0\.1|0\.0\.0\.0)[:/]/.test(connectionString);
    pool = new Pool({
      connectionString,
      ssl: isLocal ? false : { rejectUnauthorized: false },
      max: 4,
    });
  }
  return pool;
}

let openai: OpenAI | undefined;
function getOpenAI(): OpenAI {
  if (!openai) openai = new OpenAI();
  return openai;
}

async function embedQuery(text: string): Promise<string> {
  const res = await getOpenAI().embeddings.create({
    model: EMBEDDING_MODEL,
    input: text,
  });
  // pgvector accepts a "[v1,v2,...]" string literal cast to ::vector.
  return `[${res.data[0].embedding.join(",")}]`;
}

export type PetType =
  | "dog"
  | "cat"
  | "rabbit"
  | "bird"
  | "fish"
  | "reptile"
  | "small_pet";

export interface FoodResult {
  id: string;
  title: string;
  brand: string | null;
  petType: string | null;
  productType: string | null;
  priceMinCents: number | null;
  priceMaxCents: number | null;
  available: boolean | null;
  url: string | null;
  similarity: number;
  snippet: string;
}

export interface FoodSearchOptions {
  query: string;
  petType?: PetType;
  /** Match against a product brand (e.g. "Acana") for "is X safe?" lookups. */
  brand?: string;
  limit?: number;
}

/**
 * Semantic search over food products. Filters by pet_type / brand when given.
 * Returns grounded products (brand, price, ingredients snippet) for the agent.
 */
export async function searchFood(opts: FoodSearchOptions): Promise<FoodResult[]> {
  const { query, petType, brand, limit = 6 } = opts;
  const embedding = await embedQuery(query);
  const filter: Record<string, unknown> = { kind: "product" };
  if (petType) filter.pet_type = petType;
  if (brand) filter.brand = brand;

  const { rows } = await getPool().query(
    `select id, entity_id, title, body, metadata, similarity
       from public.match_knowledge_chunks($1::vector, $2, $3::jsonb)`,
    [embedding, limit, JSON.stringify(filter)],
  );

  return rows.map((r) => {
    const m = r.metadata ?? {};
    return {
      id: r.entity_id,
      title: r.title,
      brand: m.brand ?? null,
      petType: m.pet_type ?? null,
      productType: m.product_type ?? null,
      priceMinCents: m.price_min_cents ?? null,
      priceMaxCents: m.price_max_cents ?? null,
      available: m.available ?? null,
      url: m.url ?? null,
      similarity: Number(r.similarity),
      snippet: String(r.body ?? "").slice(0, 600),
    };
  });
}

export interface PlaceReview {
  rating: number | null;
  text: string | null;
  authorName: string | null;
  relativeTime: string | null;
}

export interface ServicePlaceResult {
  id: string;
  kind: string;
  name: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  rating: number | null;
  userRatingCount: number | null;
  phone: string | null;
  websiteUrl: string | null;
  googleMapsUrl: string | null;
  serviceTags: string[];
  suitabilityTags: string[];
  reviewSummary: string | null;
  distanceKm: number;
  reviews: PlaceReview[];
}

export interface PlaceSearchOptions {
  lat: number;
  lng: number;
  radiusKm?: number;
  limit?: number;
  /** Attach up to `reviewsPerPlace` top reviews for sentiment grounding. */
  withReviews?: boolean;
  reviewsPerPlace?: number;
}

async function searchPlaces(
  kind: "groomer" | "vet",
  opts: PlaceSearchOptions,
): Promise<ServicePlaceResult[]> {
  const {
    lat,
    lng,
    radiusKm = 8,
    limit = 5,
    withReviews = true,
    reviewsPerPlace = 2,
  } = opts;

  const { rows } = await getPool().query(
    `select * from public.nearby_service_places($1, $2, $3, $4, $5)`,
    [kind, lat, lng, radiusKm, limit],
  );

  const places: ServicePlaceResult[] = rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    name: r.name,
    address: r.formatted_address ?? null,
    lat: r.lat ?? null,
    lng: r.lng ?? null,
    rating: r.rating != null ? Number(r.rating) : null,
    userRatingCount: r.user_rating_count ?? null,
    phone: r.national_phone_number ?? null,
    websiteUrl: r.website_url ?? null,
    googleMapsUrl: r.google_maps_url ?? null,
    serviceTags: r.service_tags ?? [],
    suitabilityTags: r.suitability_tags ?? [],
    reviewSummary: r.review_summary ?? null,
    distanceKm: Number(r.distance_km),
    reviews: [],
  }));

  if (withReviews && places.length) {
    const ids = places.map((p) => p.id);
    const { rows: reviewRows } = await getPool().query(
      `select service_place_id, rating, text, author_name,
              relative_publish_time_description
         from (
           select *, row_number() over (
             partition by service_place_id order by rating desc nulls last
           ) rn
           from public.place_reviews
           where service_place_id = any($1) and text is not null
         ) ranked
       where rn <= $2`,
      [ids, reviewsPerPlace],
    );
    const byPlace = new Map<string, PlaceReview[]>();
    for (const rv of reviewRows) {
      const list = byPlace.get(rv.service_place_id) ?? [];
      list.push({
        rating: rv.rating ?? null,
        text: rv.text ?? null,
        authorName: rv.author_name ?? null,
        relativeTime: rv.relative_publish_time_description ?? null,
      });
      byPlace.set(rv.service_place_id, list);
    }
    for (const p of places) p.reviews = byPlace.get(p.id) ?? [];
  }

  return places;
}

export function searchGroomers(opts: PlaceSearchOptions) {
  return searchPlaces("groomer", opts);
}

export function searchVets(opts: PlaceSearchOptions) {
  return searchPlaces("vet", opts);
}

/**
 * Approximate lat/lng for a Singapore postal code using postal-district
 * centroids (first 2 digits). Good enough to seed nearby_service_places without
 * a Geocoding API call. Returns null for unknown districts.
 */
export function postalToLatLng(
  postalCode: string,
): { lat: number; lng: number } | null {
  const digits = postalCode.replace(/\D/g, "");
  if (digits.length < 2) return null;
  const district = digits.slice(0, 2);
  return SG_DISTRICT_CENTROIDS[district] ?? null;
}

// Centroids by 2-digit postal district (approx). Covers the main island.
const SG_DISTRICT_CENTROIDS: Record<string, { lat: number; lng: number }> = {
  "01": { lat: 1.2833, lng: 103.8517 }, "02": { lat: 1.2792, lng: 103.843 },
  "03": { lat: 1.2761, lng: 103.834 }, "04": { lat: 1.2649, lng: 103.823 },
  "05": { lat: 1.2746, lng: 103.79 }, "06": { lat: 1.2901, lng: 103.852 },
  "07": { lat: 1.2996, lng: 103.857 }, "08": { lat: 1.3088, lng: 103.857 },
  "09": { lat: 1.3052, lng: 103.832 }, "10": { lat: 1.3104, lng: 103.815 },
  "11": { lat: 1.3231, lng: 103.815 }, "12": { lat: 1.3257, lng: 103.857 },
  "13": { lat: 1.3344, lng: 103.882 }, "14": { lat: 1.3196, lng: 103.886 },
  "15": { lat: 1.3047, lng: 103.905 }, "16": { lat: 1.3236, lng: 103.943 },
  "17": { lat: 1.3409, lng: 103.961 }, "18": { lat: 1.3526, lng: 103.945 },
  "19": { lat: 1.3667, lng: 103.892 }, "20": { lat: 1.3565, lng: 103.848 },
  "21": { lat: 1.3387, lng: 103.776 }, "22": { lat: 1.3329, lng: 103.743 },
  "23": { lat: 1.3636, lng: 103.764 }, "24": { lat: 1.3771, lng: 103.74 },
  "25": { lat: 1.3833, lng: 103.745 }, "26": { lat: 1.3795, lng: 103.813 },
  "27": { lat: 1.4255, lng: 103.835 }, "28": { lat: 1.4019, lng: 103.87 },
  "29": { lat: 1.3667, lng: 103.892 }, "30": { lat: 1.3142, lng: 103.864 },
  "31": { lat: 1.3261, lng: 103.871 }, "32": { lat: 1.3296, lng: 103.857 },
  "33": { lat: 1.3196, lng: 103.886 }, "34": { lat: 1.3196, lng: 103.9 },
  "35": { lat: 1.31, lng: 103.892 }, "36": { lat: 1.318, lng: 103.886 },
  "37": { lat: 1.318, lng: 103.892 }, "38": { lat: 1.3104, lng: 103.886 },
  "39": { lat: 1.3142, lng: 103.892 }, "40": { lat: 1.3047, lng: 103.905 },
  "41": { lat: 1.3047, lng: 103.9 }, "42": { lat: 1.3047, lng: 103.918 },
  "43": { lat: 1.3047, lng: 103.918 }, "44": { lat: 1.3104, lng: 103.918 },
  "45": { lat: 1.3104, lng: 103.93 }, "46": { lat: 1.3329, lng: 103.943 },
  "47": { lat: 1.3409, lng: 103.943 }, "48": { lat: 1.3409, lng: 103.955 },
  "49": { lat: 1.3526, lng: 103.945 }, "50": { lat: 1.3526, lng: 103.96 },
  "51": { lat: 1.3526, lng: 103.96 }, "52": { lat: 1.3496, lng: 103.943 },
  "53": { lat: 1.3636, lng: 103.892 }, "54": { lat: 1.3636, lng: 103.9 },
  "55": { lat: 1.3636, lng: 103.87 }, "56": { lat: 1.3565, lng: 103.835 },
  "57": { lat: 1.3565, lng: 103.825 }, "58": { lat: 1.3142, lng: 103.806 },
  "59": { lat: 1.3296, lng: 103.806 }, "60": { lat: 1.3387, lng: 103.697 },
  "61": { lat: 1.3387, lng: 103.71 }, "62": { lat: 1.3387, lng: 103.71 },
  "63": { lat: 1.3387, lng: 103.71 }, "64": { lat: 1.3387, lng: 103.72 },
  "65": { lat: 1.3387, lng: 103.74 }, "66": { lat: 1.3387, lng: 103.75 },
  "67": { lat: 1.3567, lng: 103.75 }, "68": { lat: 1.3567, lng: 103.75 },
  "69": { lat: 1.3567, lng: 103.69 }, "70": { lat: 1.3567, lng: 103.69 },
  "71": { lat: 1.3567, lng: 103.69 }, "72": { lat: 1.4019, lng: 103.74 },
  "73": { lat: 1.4019, lng: 103.74 }, "75": { lat: 1.4498, lng: 103.82 },
  "76": { lat: 1.4498, lng: 103.82 }, "77": { lat: 1.4255, lng: 103.78 },
  "78": { lat: 1.4255, lng: 103.78 }, "79": { lat: 1.4255, lng: 103.79 },
  "80": { lat: 1.3795, lng: 103.9 }, "81": { lat: 1.3565, lng: 103.96 },
  "82": { lat: 1.3795, lng: 103.96 },
};
