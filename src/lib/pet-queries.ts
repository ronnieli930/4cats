import "server-only";

import { cookies } from "next/headers";
import { cache } from "react";
import { prisma } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";

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
  /** The active pet (cookie-selected, else the first). */
  pet: PetDTO | null;
  /** Lightweight list of all the user's pets, for the switcher. */
  pets: PetSummary[];
};

function displayNameFromUser(user: {
  email?: string | null;
  user_metadata?: Record<string, unknown>;
}): string {
  const meta = user.user_metadata?.full_name;
  if (typeof meta === "string" && meta.trim()) {
    return meta.trim();
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
    return { userDisplayName: "there", pet: null, pets: [] };
  }

  const userDisplayName = displayNameFromUser(user);

  const summaries = await prisma.pet.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, species: true, photoUrl: true },
  });
  if (summaries.length === 0) {
    return { userDisplayName, pet: null, pets: [] };
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

  return { userDisplayName, pet: row ? mapPet(row) : null, pets: summaries };
});

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

  return rows.map((row) => mapPet(row));
});
