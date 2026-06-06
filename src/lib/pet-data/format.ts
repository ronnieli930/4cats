/** Presentation helpers for grounded pet-data results (price, pet type). */
import type { PetDTO } from "@/lib/pet-queries";

/** Product shape surfaced to the UI (grounded — never invented by the model). */
export type FoodProduct = {
  id: string;
  title: string;
  brand: string | null;
  priceLabel: string | null;
  petType: string | null;
  productType: string | null;
  available: boolean | null;
  url: string | null;
};

/** Service place shape surfaced to the UI (groomers / vets). */
export type ServicePlaceCard = {
  id: string;
  name: string;
  address: string | null;
  rating: number | null;
  reviewCount: number | null;
  distanceKm: number;
  phone: string | null;
  websiteUrl: string | null;
  googleMapsUrl: string | null;
  tags: string[];
};

/** Format SG cents to a "S$12.90" string. */
export function formatPriceCents(
  cents: number | null | undefined,
): string | null {
  if (cents == null || Number.isNaN(cents)) return null;
  return `S$${(cents / 100).toFixed(2)}`;
}

/** Format a price range; collapses to a single value when min === max. */
export function formatPriceRange(
  minCents: number | null | undefined,
  maxCents: number | null | undefined,
): string | null {
  const min = formatPriceCents(minCents);
  const max = formatPriceCents(maxCents);
  if (min && max && minCents !== maxCents) return `${min} – ${max}`;
  return min ?? max ?? null;
}

const PET_TYPE_LABELS: Record<string, string> = {
  dog: "Dog",
  cat: "Cat",
  rabbit: "Small pet",
  small_pet: "Small pet",
  bird: "Bird",
  fish: "Fish",
  reptile: "Reptile",
};

export function petTypeLabel(
  petType: string | null | undefined,
): string | null {
  if (!petType) return null;
  return PET_TYPE_LABELS[petType.toLowerCase()] ?? petType;
}

/** Map an app pet `species` string to the data layer's `PetType` filter, if confident. */
/** Compact, model-friendly description of a pet for system/context prompts. */
export function buildPetProfilePrompt(pet: PetDTO | null): string {
  if (!pet) {
    return "No pet profile is on file yet. Ask the user for their pet's species, age and any dietary needs before recommending food.";
  }
  const lines: string[] = [`Name: ${pet.name}`, `Species: ${pet.species}`];
  if (pet.breed?.trim()) lines.push(`Breed: ${pet.breed.trim()}`);
  if (pet.ageYears != null) lines.push(`Age: ${pet.ageYears} years`);
  if (pet.weightKg != null) lines.push(`Weight: ${pet.weightKg} kg`);
  lines.push(
    `Medical conditions: ${pet.medicalConditions.length ? pet.medicalConditions.join(", ") : "none on file"}`,
  );
  lines.push(
    `Dietary restrictions: ${pet.dietaryRestrictions.length ? pet.dietaryRestrictions.join(", ") : "none on file"}`,
  );
  const area = pet.locationLabel?.trim() || pet.locationPostalCode?.trim();
  if (area) lines.push(`Location: ${area}`);
  return lines.join("\n");
}

export function speciesToPetType(
  species: string | null | undefined,
):
  | "dog"
  | "cat"
  | "rabbit"
  | "bird"
  | "fish"
  | "reptile"
  | "small_pet"
  | undefined {
  if (!species) return undefined;
  const s = species.toLowerCase();
  if (s === "dog") return "dog";
  if (s === "cat") return "cat";
  if (s === "rabbit" || s === "small_pet") return "rabbit";
  if (s === "bird") return "bird";
  if (s === "fish") return "fish";
  if (s === "reptile") return "reptile";
  return undefined;
}
