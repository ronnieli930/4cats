import "server-only";

import { cookies } from "next/headers";
import { cache } from "react";
import { prisma } from "@/lib/db";
import { resolveStoredImageUrl } from "@/lib/storage/s3";
import { createClient } from "@/lib/supabase/server";

/**
 * Replace a stored photo reference with a usable URL: a private S3 object key
 * becomes a short-lived signed URL, an http(s) URL passes through, null stays
 * null. Applied to every pet leaving this module so the UI can render directly.
 */
async function withResolvedPhoto<T extends { photoUrl: string | null }>(
  item: T,
): Promise<T> {
  return { ...item, photoUrl: await resolveStoredImageUrl(item.photoUrl) };
}

/** Cookie holding the user's currently-selected pet id (multi-pet switching). */
export const ACTIVE_PET_COOKIE = "llp_active_pet";

type PetRow = {
  id: string;
  name: string;
  species: string;
  breed: string | null;
  photoUrl: string | null;
  ageYears: { toString(): string } | null;
  weightKg: { toString(): string } | null;
  medicalConditions: string[];
  dietaryRestrictions: string[];
  locationPostalCode: string | null;
  locationLabel: string | null;
  notes: string | null;
  careLogs?: {
    id: string;
    fed: boolean | null;
    mood: string | null;
    weightKg: { toString(): string } | null;
    symptoms: string[];
    notes: string | null;
    loggedAt: Date;
  }[];
};

function mapPet(row: PetRow): PetDTO {
  return {
    id: row.id,
    name: row.name,
    species: row.species,
    breed: row.breed,
    photoUrl: row.photoUrl,
    ageYears: row.ageYears != null ? row.ageYears.toString() : null,
    weightKg: row.weightKg != null ? row.weightKg.toString() : null,
    medicalConditions: row.medicalConditions,
    dietaryRestrictions: row.dietaryRestrictions,
    locationPostalCode: row.locationPostalCode,
    locationLabel: row.locationLabel,
    notes: row.notes,
    careLogs: (row.careLogs ?? []).map((log) => ({
      id: log.id,
      fed: log.fed,
      mood: log.mood,
      weightKg: log.weightKg != null ? log.weightKg.toString() : null,
      symptoms: log.symptoms,
      notes: log.notes,
      loggedAt: log.loggedAt.toISOString(),
    })),
  };
}

export type PetCareLogDTO = {
  id: string;
  fed: boolean | null;
  mood: string | null;
  weightKg: string | null;
  symptoms: string[];
  notes: string | null;
  loggedAt: string;
};

export type PetDTO = {
  id: string;
  name: string;
  species: string;
  breed: string | null;
  photoUrl: string | null;
  ageYears: string | null;
  weightKg: string | null;
  medicalConditions: string[];
  dietaryRestrictions: string[];
  locationPostalCode: string | null;
  locationLabel: string | null;
  notes: string | null;
  careLogs: PetCareLogDTO[];
};

export type PetSummary = {
  id: string;
  name: string;
  species: string;
  photoUrl: string | null;
};

export type PetCareContext = {
  userDisplayName: string;
  settings: UserSettingsDTO | null;
  /** The active pet (cookie-selected, else the first). */
  pet: PetDTO | null;
  /** Lightweight list of all the user's pets, for the switcher. */
  pets: PetSummary[];
};

export type UserSettingsDTO = {
  displayName: string | null;
  gender: string | null;
  monthlyFoodBudgetCents: number | null;
  monthlyGroomingBudgetCents: number | null;
  monthlyVetBudgetCents: number | null;
  monthlySuppliesBudgetCents: number | null;
  currency: string;
};

type UserSettingsRow = {
  displayName: string | null;
  gender: string | null;
  monthlyFoodBudgetCents: number | null;
  monthlyGroomingBudgetCents: number | null;
  monthlyVetBudgetCents: number | null;
  monthlySuppliesBudgetCents: number | null;
  currency: string;
};

function mapUserSettings(row: UserSettingsRow): UserSettingsDTO {
  return {
    displayName: row.displayName,
    gender: row.gender,
    monthlyFoodBudgetCents: row.monthlyFoodBudgetCents,
    monthlyGroomingBudgetCents: row.monthlyGroomingBudgetCents,
    monthlyVetBudgetCents: row.monthlyVetBudgetCents,
    monthlySuppliesBudgetCents: row.monthlySuppliesBudgetCents,
    currency: row.currency,
  };
}

function displayNameFromUser(
  user: {
    email?: string | null;
    user_metadata?: Record<string, unknown>;
  },
  settings: UserSettingsDTO | null,
): string {
  if (settings?.displayName?.trim()) {
    return settings.displayName.trim();
  }
  const meta = user.user_metadata ?? {};
  const first = meta.first_name;
  const last = meta.last_name;
  if (typeof first === "string" && first.trim()) {
    const parts = [first.trim()];
    if (typeof last === "string" && last.trim()) {
      parts.push(last.trim());
    }
    return parts.join(" ");
  }
  const fullName = meta.full_name;
  if (typeof fullName === "string" && fullName.trim()) {
    return fullName.trim();
  }
  const email = user.email;
  if (email) {
    return email.split("@")[0] ?? "there";
  }
  return "there";
}

/** One fetch per request for layout + pages (React cache). */
export const getPetCareContext = cache(async (): Promise<PetCareContext> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { userDisplayName: "there", settings: null, pet: null, pets: [] };
  }

  const settingsRow = await prisma.userSettings.findUnique({
    where: { userId: user.id },
  });
  const settings = settingsRow ? mapUserSettings(settingsRow) : null;
  const userDisplayName = displayNameFromUser(user, settings);

  const summaries = await prisma.pet.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, species: true, photoUrl: true },
  });
  if (summaries.length === 0) {
    return { userDisplayName, settings, pet: null, pets: [] };
  }

  // Active pet = cookie selection (if it still belongs to the user), else first.
  const cookieStore = await cookies();
  const cookieId = cookieStore.get(ACTIVE_PET_COOKIE)?.value;
  const activeId =
    cookieId && summaries.some((p) => p.id === cookieId)
      ? cookieId
      : summaries[0].id;

  const row = await prisma.pet.findFirst({
    where: { id: activeId, userId: user.id },
    include: {
      careLogs: {
        orderBy: { loggedAt: "desc" },
        take: 20,
      },
    },
  });

  const [pet, pets] = await Promise.all([
    row ? withResolvedPhoto(mapPet(row)) : Promise.resolve(null),
    Promise.all(summaries.map(withResolvedPhoto)),
  ]);

  return { userDisplayName, settings, pet, pets };
});

/** Owner account settings for the Settings page (auth-scoped). */
export const getUserSettings = cache(
  async (): Promise<UserSettingsDTO | null> => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return null;
    }

    const row = await prisma.userSettings.findUnique({
      where: { userId: user.id },
    });
    return row ? mapUserSettings(row) : null;
  },
);

/** All pets for the signed-in user (for the multi-pet Profiles screen). */
export const getUserPets = cache(async (): Promise<PetDTO[]> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return [];
  }

  const rows = await prisma.pet.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
  });

  return Promise.all(rows.map((row) => withResolvedPhoto(mapPet(row))));
});
