"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { buildObjectKey, uploadImage } from "@/lib/storage/s3";
import { createClient } from "@/lib/supabase/server";

const updateSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  breed: z
    .string()
    .trim()
    .transform((s) => (s === "" ? null : s))
    .nullable(),
  ageYears: z.preprocess(
    (v) => (v === "" || v == null ? null : v),
    z.coerce.number().min(0).max(40).nullable(),
  ),
  weightKg: z.preprocess(
    (v) => (v === "" || v == null ? null : v),
    z.coerce.number().min(0.1).max(200).nullable(),
  ),
  locationPostalCode: z
    .string()
    .trim()
    .transform((s) => (s === "" ? null : s))
    .nullable(),
  locationLabel: z
    .string()
    .trim()
    .transform((s) => (s === "" ? null : s))
    .nullable(),
  notes: z
    .string()
    .trim()
    .transform((s) => (s === "" ? null : s))
    .nullable(),
  medicalConditions: z.string().transform((s) =>
    s
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean),
  ),
  dietaryRestrictions: z.string().transform((s) =>
    s
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean),
  ),
});

export type UpdatePetState = { error?: string; ok?: boolean } | null;

function revalidateAll() {
  revalidatePath("/");
  revalidatePath("/profiles");
  revalidatePath("/assistant");
  revalidatePath("/discovery");
}

export async function updatePet(
  _prev: UpdatePetState,
  formData: FormData,
): Promise<UpdatePetState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const petId = String(formData.get("petId") ?? "");
  const pet = petId
    ? await prisma.pet.findFirst({
        where: { id: petId, userId: user.id },
        select: { id: true },
      })
    : await prisma.pet.findFirst({
        where: { userId: user.id },
        orderBy: { createdAt: "asc" },
        select: { id: true },
      });
  if (!pet) {
    return { error: "No pet profile found." };
  }

  const parsed = updateSchema.safeParse({
    name: formData.get("name"),
    breed: formData.get("breed") ?? "",
    ageYears: formData.get("ageYears") ?? "",
    weightKg: formData.get("weightKg") ?? "",
    locationPostalCode: formData.get("locationPostalCode") ?? "",
    locationLabel: formData.get("locationLabel") ?? "",
    notes: formData.get("notes") ?? "",
    medicalConditions: formData.get("medicalConditions") ?? "",
    dietaryRestrictions: formData.get("dietaryRestrictions") ?? "",
  });

  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Invalid input";
    return { error: msg };
  }

  await prisma.pet.update({
    where: { id: pet.id },
    data: {
      name: parsed.data.name,
      breed: parsed.data.breed,
      ageYears: parsed.data.ageYears,
      weightKg: parsed.data.weightKg,
      locationPostalCode: parsed.data.locationPostalCode,
      locationLabel: parsed.data.locationLabel,
      notes: parsed.data.notes,
      medicalConditions: parsed.data.medicalConditions,
      dietaryRestrictions: parsed.data.dietaryRestrictions,
    },
  });

  revalidateAll();
  return { ok: true };
}

const createSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  species: z.enum(["dog", "cat", "small_pet"]),
  breed: z
    .string()
    .trim()
    .transform((s) => (s === "" ? null : s))
    .nullable(),
});

export type CreatePetState = { error?: string; ok?: boolean } | null;

export async function createPet(
  _prev: CreatePetState,
  formData: FormData,
): Promise<CreatePetState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const parsed = createSchema.safeParse({
    name: formData.get("name"),
    species: formData.get("species"),
    breed: formData.get("breed") ?? "",
  });
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Invalid input";
    return { error: msg };
  }

  await prisma.pet.create({
    data: {
      userId: user.id,
      name: parsed.data.name,
      species: parsed.data.species,
      breed: parsed.data.breed,
    },
  });

  revalidateAll();
  return { ok: true };
}

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const ALLOWED_PHOTO_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export type UploadPhotoState = { error?: string; ok?: boolean } | null;

export async function uploadPetPhoto(
  _prev: UploadPhotoState,
  formData: FormData,
): Promise<UploadPhotoState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const petId = String(formData.get("petId") ?? "");
  const file = formData.get("photo");

  if (!(file instanceof File) || file.size === 0) {
    return { error: "Please choose a photo to upload." };
  }
  if (file.size > MAX_PHOTO_BYTES) {
    return { error: "Photo must be 5 MB or smaller." };
  }
  if (!ALLOWED_PHOTO_TYPES.has(file.type)) {
    return { error: "Use a JPG, PNG, WEBP or GIF image." };
  }

  const pet = await prisma.pet.findFirst({
    where: { id: petId, userId: user.id },
    select: { id: true },
  });
  if (!pet) {
    return { error: "No pet profile found." };
  }

  // Store on private S3 (Supabase Storage S3 protocol). We persist the object
  // KEY; pet-queries resolves it to a short-lived signed URL on read.
  const key = buildObjectKey(`pets/${user.id}`, file.type);
  try {
    const body = Buffer.from(await file.arrayBuffer());
    await uploadImage({ key, body, contentType: file.type });
  } catch (e) {
    const message = e instanceof Error ? e.message : "unknown error";
    return { error: `Upload failed: ${message}` };
  }

  await prisma.pet.update({
    where: { id: pet.id },
    data: { photoUrl: key },
  });

  revalidateAll();
  return { ok: true };
}
