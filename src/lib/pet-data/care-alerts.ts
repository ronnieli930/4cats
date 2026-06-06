import { Cross, type LucideIcon, Sparkles, Sun } from "lucide-react";
import type { PetDTO } from "@/lib/pet-queries";

export type CareAlertLevel = "attention" | "watch" | "info" | "good";

export type CareAlert = {
  id: string;
  level: CareAlertLevel;
  label: string;
  message: string;
  cta?: { href: string; text: string };
};

const OFF_MOODS = new Set(["off", "anxious", "tired", "sad", "lethargic"]);

/**
 * Derive a profile-aware list of AI care alerts from the pet's recent care logs
 * and conditions. Ordered most-urgent first. Used by both the dashboard hero
 * alert (first item) and the top-bar notifications bell (full list).
 */
export function buildCareAlerts(pet: PetDTO): CareAlert[] {
  const alerts: CareAlert[] = [];
  const recent = pet.careLogs.slice(0, 6);

  const symptoms = [...new Set(recent.flatMap((l) => l.symptoms))].filter(
    Boolean,
  );
  if (symptoms.length > 0) {
    alerts.push({
      id: "symptoms",
      level: "attention",
      label: "Vet check suggested",
      message: `${pet.name} recently logged ${symptoms.slice(0, 3).join(", ")}. If it keeps up, a quick vet visit is worth booking.`,
      cta: { href: "/discovery", text: "Find a vet nearby" },
    });
  }

  const offMoods = recent.filter(
    (l) => l.mood && OFF_MOODS.has(l.mood.toLowerCase()),
  );
  if (offMoods.length >= 2) {
    alerts.push({
      id: "mood",
      level: "watch",
      label: "Mood watch",
      message: `${pet.name} has seemed ${offMoods[0].mood?.toLowerCase()} across recent check-ins. Keep an eye on appetite and energy.`,
    });
  }

  if (pet.medicalConditions.length > 0) {
    alerts.push({
      id: "conditions",
      level: "info",
      label: "Care reminder",
      message: `${pet.name} has ${pet.medicalConditions.slice(0, 2).join(" & ")} on file — keep meds and diet consistent, and watch for flare-ups in SG's humidity.`,
      cta: { href: "/assistant", text: "Ask the assistant" },
    });
  }

  const latestFed = recent.find((l) => l.fed != null);
  if (latestFed?.fed === false) {
    alerts.push({
      id: "fed",
      level: "watch",
      label: "Reminder",
      message: `${pet.name} isn't marked as fed in the latest check-in — don't forget today's meal.`,
    });
  }

  if (alerts.length === 0) {
    alerts.push({
      id: "good",
      level: "good",
      label: "All good",
      message:
        recent.length > 0
          ? `No concerns in ${pet.name}'s recent check-ins. Keep up the daily logs and regular vet visits.`
          : `Start logging ${pet.name}'s meals, mood, and weight to get personalised care alerts here.`,
    });
  }

  return alerts;
}

/** Highest-priority alert, for the single dashboard hero card. */
export function topCareAlert(pet: PetDTO): CareAlert {
  return buildCareAlerts(pet)[0];
}

/** True when there is at least one alert that isn't the "all good" state. */
export function hasActiveCareAlerts(alerts: CareAlert[]): boolean {
  return alerts.some((a) => a.level !== "good");
}

export const ALERT_ICON: Record<CareAlertLevel, LucideIcon> = {
  attention: Cross,
  watch: Sun,
  info: Sparkles,
  good: Sun,
};

export const ALERT_ICON_TONE: Record<CareAlertLevel, string> = {
  attention: "text-rose-500",
  watch: "text-amber-500",
  info: "text-primary",
  good: "text-amber-500",
};
