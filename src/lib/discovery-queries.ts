import "server-only";

import { cache } from "react";
import { prisma } from "@/lib/db";
import { resolvePostalToLatLng } from "@/lib/pet-data/search";
import type { PetDTO } from "@/lib/pet-queries";

export type ServiceKind = "groomer" | "vet" | "pet_store" | "cafe";

export type PlaceReviewDTO = {
  rating: number | null;
  text: string;
  authorName: string | null;
  relativeTime: string | null;
};

export type PlaceDTO = {
  id: string;
  kind: string;
  name: string;
  address: string | null;
  neighbourhood: string | null;
  lat: number | null;
  lng: number | null;
  rating: number | null;
  userRatingCount: number | null;
  distanceKm: number | null;
  serviceTags: string[];
  phone: string | null;
  websiteUrl: string | null;
  googleMapsUrl: string | null;
  bookingUrl: string | null;
  email: string | null;
  topReview: PlaceReviewDTO | null;
};

export type DiscoveryOrigin = {
  lat: number;
  lng: number;
  label: string;
} | null;

const DISCOVERY_PLACE_LIMIT = 50;
const DISCOVERY_DISTANCE_RADIUS_KM = 50;

function num(value: unknown): number | null {
  if (value == null) return null;
  const n = typeof value === "number" ? value : Number(value.toString());
  return Number.isFinite(n) ? n : null;
}

function bookingUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (
      /\.(css|js|mjs|map|png|jpe?g|gif|webp|svg|ico|woff2?|ttf|eot|pdf|zip)$/i.test(
        url.pathname,
      )
    ) {
      return null;
    }
    if (url.pathname.toLowerCase().includes("/wp-content/plugins/")) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

async function originForPet(pet: PetDTO): Promise<DiscoveryOrigin> {
  const postal = pet.locationPostalCode?.trim();
  if (postal) {
    const coords = await resolvePostalToLatLng(postal);
    if (coords) {
      return {
        ...coords,
        label: pet.locationLabel?.trim() || `near ${postal}`,
      };
    }
  }
  return null;
}

// Top-rated review per place (one query for the whole result set).
async function topReviewsByPlace(
  ids: string[],
): Promise<Map<string, PlaceReviewDTO>> {
  if (ids.length === 0) return new Map();
  const reviews = await prisma.placeReview.findMany({
    where: { servicePlaceId: { in: ids }, text: { not: null } },
    orderBy: [{ rating: "desc" }],
    select: {
      servicePlaceId: true,
      rating: true,
      text: true,
      authorName: true,
      relativePublishTimeDescription: true,
    },
  });
  const byPlace = new Map<string, PlaceReviewDTO>();
  for (const r of reviews) {
    const text = r.text?.trim();
    if (!text || byPlace.has(r.servicePlaceId)) continue;
    byPlace.set(r.servicePlaceId, {
      rating: r.rating,
      text,
      authorName: r.authorName,
      relativeTime: r.relativePublishTimeDescription,
    });
  }
  return byPlace;
}

type ServicePlaceRow = {
  id: string;
  kind: string;
  name: string;
  formattedAddress: string | null;
  neighbourhood: string | null;
  lat: number | null;
  lng: number | null;
  rating: { toString(): string } | null;
  userRatingCount: number | null;
  serviceTags: string[];
  nationalPhoneNumber: string | null;
  websiteUrl: string | null;
  googleMapsUrl: string | null;
  bookingUrl: string | null;
  primaryEmail: string | null;
};

function toPlaceDTO(
  row: ServicePlaceRow,
  distanceKm: number | null,
  review: PlaceReviewDTO | null,
): PlaceDTO {
  return {
    id: row.id,
    kind: row.kind,
    name: row.name,
    address: row.formattedAddress,
    neighbourhood: row.neighbourhood,
    lat: num(row.lat),
    lng: num(row.lng),
    rating: num(row.rating),
    userRatingCount: row.userRatingCount,
    distanceKm,
    serviceTags: row.serviceTags ?? [],
    phone: row.nationalPhoneNumber,
    websiteUrl: row.websiteUrl,
    googleMapsUrl: row.googleMapsUrl,
    bookingUrl: bookingUrl(row.bookingUrl),
    email: row.primaryEmail,
    topReview: review,
  };
}

const PLACE_SELECT = {
  id: true,
  kind: true,
  name: true,
  formattedAddress: true,
  neighbourhood: true,
  lat: true,
  lng: true,
  rating: true,
  userRatingCount: true,
  serviceTags: true,
  nationalPhoneNumber: true,
  websiteUrl: true,
  googleMapsUrl: true,
  bookingUrl: true,
  primaryEmail: true,
} as const;

/**
 * Places of `kind`, nearest-first when we have an origin (via the
 * nearby_service_places geo RPC), else top-rated as a fallback.
 */
export async function getPlaces(
  kind: ServiceKind,
  origin: DiscoveryOrigin,
  limit = DISCOVERY_PLACE_LIMIT,
  radiusKm = DISCOVERY_DISTANCE_RADIUS_KM,
): Promise<PlaceDTO[]> {
  if (origin) {
    const near = await prisma.$queryRaw<{ id: string; distance_km: number }[]>`
      select id, distance_km
      from nearby_service_places(${kind}::text, ${origin.lat}::float8, ${origin.lng}::float8, ${radiusKm}::float8, ${limit}::int)
    `;
    if (near.length > 0) {
      const ids = near.map((r) => r.id);
      const distance = new Map(near.map((r) => [r.id, num(r.distance_km)]));
      const [rows, reviews] = await Promise.all([
        prisma.servicePlace.findMany({
          where: { id: { in: ids } },
          select: PLACE_SELECT,
        }),
        topReviewsByPlace(ids),
      ]);
      const byId = new Map(rows.map((r) => [r.id, r]));
      // Preserve the RPC's distance ordering; drop any id without a row.
      return ids.flatMap((id) => {
        const row = byId.get(id);
        if (!row) return [];
        return [
          toPlaceDTO(row, distance.get(id) ?? null, reviews.get(id) ?? null),
        ];
      });
    }
  }

  const rows = await prisma.servicePlace.findMany({
    where: { kind },
    orderBy: [{ rating: "desc" }, { userRatingCount: "desc" }],
    take: limit,
    select: PLACE_SELECT,
  });
  const reviews = await topReviewsByPlace(rows.map((r) => r.id));
  return rows.map((r) => toPlaceDTO(r, null, reviews.get(r.id) ?? null));
}

export type ProductDTO = {
  id: string;
  source: string;
  title: string;
  brand: string | null;
  petType: string | null;
  productType: string | null;
  priceMinCents: number | null;
  priceMaxCents: number | null;
  available: boolean | null;
  url: string | null;
  ingredients: string | null;
  tags: string[];
};

function petTypesForSpecies(species: string): string[] {
  const s = species.toLowerCase();
  if (s === "dog") return ["dog"];
  if (s === "cat") return ["cat"];
  return ["small_pet", "rabbit", "bird", "fish", "reptile"];
}

/** Food/products matching the pet's species, for the discovery Food tab. */
export async function getFoodForPet(
  pet: PetDTO,
  limit = 48,
): Promise<ProductDTO[]> {
  const rows = await prisma.product.findMany({
    where: { petType: { in: petTypesForSpecies(pet.species) } },
    orderBy: [{ available: "desc" }, { brand: "asc" }, { title: "asc" }],
    take: limit,
    select: {
      id: true,
      source: true,
      title: true,
      brand: true,
      petType: true,
      productType: true,
      priceMinCents: true,
      priceMaxCents: true,
      available: true,
      url: true,
      ingredients: true,
      tags: true,
    },
  });
  return rows.map((r) => ({
    id: r.id,
    source: r.source,
    title: r.title,
    brand: r.brand,
    petType: r.petType,
    productType: r.productType,
    priceMinCents: r.priceMinCents,
    priceMaxCents: r.priceMaxCents,
    available: r.available,
    url: r.url,
    ingredients: r.ingredients ? r.ingredients.slice(0, 500) : null,
    tags: r.tags ?? [],
  }));
}

export type DiscoveryData = {
  origin: DiscoveryOrigin;
  groomers: PlaceDTO[];
  vets: PlaceDTO[];
  petStores: PlaceDTO[];
  cafes: PlaceDTO[];
  food: ProductDTO[];
};

/** Groomers, vets, pet stores, cafes, and food near/for the pet. */
export const getDiscoveryData = cache(
  async (pet: PetDTO): Promise<DiscoveryData> => {
    const origin = await originForPet(pet);
    const [groomers, vets, petStores, cafes, food] = await Promise.all([
      getPlaces("groomer", origin),
      getPlaces("vet", origin),
      getPlaces("pet_store", origin),
      getPlaces("cafe", origin),
      getFoodForPet(pet),
    ]);
    return { origin, groomers, vets, petStores, cafes, food };
  },
);

/** Top nearby places of one kind, for the dashboard summary card. */
export async function getNearbyTop(
  pet: PetDTO,
  kind: ServiceKind,
  limit = 3,
): Promise<{ origin: DiscoveryOrigin; places: PlaceDTO[] }> {
  const origin = await originForPet(pet);
  const places = await getPlaces(kind, origin, limit);
  return { origin, places };
}
