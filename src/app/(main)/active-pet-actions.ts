"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { ACTIVE_PET_COOKIE } from "@/lib/pet-queries";
import { createClient } from "@/lib/supabase/server";

export type SetActivePetState = { error?: string; ok?: boolean } | null;

/** Switch the active pet for the signed-in user (multi-pet switching). */
export async function setActivePet(petId: string): Promise<SetActivePetState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  const pet = await prisma.pet.findFirst({
    where: { id: petId, userId: user.id },
    select: { id: true },
  });
  if (!pet) return { error: "Pet not found" };

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_PET_COOKIE, pet.id, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });

  // Refresh every surface that reads the active pet (dashboard, discovery,
  // assistant, profiles, sidebar/top-bar via the layout).
  revalidatePath("/", "layout");
  return { ok: true };
}
