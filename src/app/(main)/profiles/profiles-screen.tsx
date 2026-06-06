"use client";

import {
  CircleAlert,
  HeartPulse,
  MapPin,
  Pencil,
  Plus,
  PlusCircle,
  Salad,
  Stethoscope,
  Verified,
} from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { setActivePet } from "@/app/(main)/active-pet-actions";
import { Mascot, type MascotSpecies } from "@/components/pet-care/mascot";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { PetDTO } from "@/lib/pet-queries";
import { cn } from "@/lib/utils";
import { AddPetForm } from "./add-pet-form";
import { PetPhotoUploader } from "./pet-photo-uploader";
import { ProfilesPetForm } from "./profiles-pet-form";

function toMascotSpecies(species: string): MascotSpecies {
  const s = species.toLowerCase();
  if (s === "dog" || s === "cat" || s === "rabbit") return s;
  if (s === "small_pet") return "rabbit";
  return "brand";
}

function speciesLabel(species: string): string {
  const s = species.toLowerCase();
  if (s === "dog") return "Dog";
  if (s === "cat") return "Cat";
  if (s === "rabbit" || s === "small_pet") return "Small pet";
  return species;
}

function petArea(pet: PetDTO): string {
  return pet.locationLabel?.trim() || pet.locationPostalCode?.trim() || "—";
}

function PetAvatar({
  species,
  size = 52,
  photoUrl,
  name,
}: {
  species: string;
  size?: number;
  photoUrl?: string | null;
  name?: string;
}) {
  return (
    <div
      className="grid shrink-0 place-items-center overflow-hidden rounded-full ring-2 ring-card"
      style={{
        width: size,
        height: size,
        background:
          "radial-gradient(120% 120% at 50% 18%, var(--primary-container), color-mix(in srgb, var(--primary-container) 60%, #fff))",
      }}
    >
      {photoUrl ? (
        // biome-ignore lint/performance/noImgElement: user-uploaded Supabase URL
        <img
          alt={name ?? "Pet"}
          className="size-full object-cover"
          src={photoUrl}
        />
      ) : (
        <Mascot
          species={toMascotSpecies(species)}
          size={size * 0.92}
          blink={false}
        />
      )}
    </div>
  );
}

function SectionTitle({
  icon: Icon,
  title,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <Icon className="size-5 text-primary" />
      <h3 className="font-llp-display text-lg font-bold text-foreground">
        {title}
      </h3>
    </div>
  );
}

function MiniChip({
  children,
  icon: Icon,
  tone = "neutral",
}: {
  children: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  tone?: "neutral" | "yellow" | "pink" | "green";
}) {
  const tones = {
    neutral: "bg-[var(--llp-surface-3)] text-[var(--llp-ink-2)]",
    yellow:
      "bg-[var(--llp-secondary-container)] text-[var(--llp-on-secondary-container)]",
    pink: "bg-[var(--primary-container)] text-[var(--on-primary-container)]",
    green: "bg-[var(--llp-success-container)] text-[#13633f]",
  } as const;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
        tones[tone],
      )}
    >
      {Icon ? <Icon className="size-3.5" /> : null}
      {children}
    </span>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-2xl bg-muted/50 px-4 py-3">
      <div className="truncate text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </div>
      <div className="font-llp-display mt-1 truncate text-xl font-bold text-foreground">
        {value}
      </div>
    </div>
  );
}

function PetMiniCard({
  pet,
  active,
  onSelect,
}: {
  pet: PetDTO;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "rounded-2xl border bg-card p-4 text-left shadow-[var(--llp-sh-1)] transition-all hover:-translate-y-0.5 hover:shadow-[var(--llp-sh-2)]",
        active ? "border-2 border-primary" : "border border-border",
      )}
    >
      <div className="flex items-center gap-3">
        <PetAvatar
          name={pet.name}
          photoUrl={pet.photoUrl}
          size={50}
          species={pet.species}
        />
        <div className="min-w-0 flex-1">
          <div className="font-llp-display truncate text-[17px] font-bold text-foreground">
            {pet.name}
          </div>
          <div className="truncate text-[12.5px] text-muted-foreground">
            {pet.breed?.trim() || speciesLabel(pet.species)}
          </div>
        </div>
        {active ? <Verified className="size-5 shrink-0 text-primary" /> : null}
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <MiniChip>{speciesLabel(pet.species)}</MiniChip>
        {pet.ageYears != null ? (
          <MiniChip>{`${Number(pet.ageYears)} ${Number(pet.ageYears) === 1 ? "yr" : "yrs"}`}</MiniChip>
        ) : null}
        <MiniChip icon={MapPin}>{petArea(pet)}</MiniChip>
      </div>
    </button>
  );
}

export function ProfilesScreen({
  pets,
  activePetId,
}: {
  pets: PetDTO[];
  activePetId: string | null;
}) {
  const [activeId, setActiveId] = useState(activePetId ?? pets[0]?.id ?? "");
  const [editOpen, setEditOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [, startTransition] = useTransition();

  const active = pets.find((p) => p.id === activeId) ?? pets[0];
  if (!active) return null;

  // Selecting a pet shows its detail AND makes it the active pet everywhere
  // (dashboard, discovery, assistant, sidebar/top-bar) via the cookie.
  function selectPet(id: string) {
    setActiveId(id);
    startTransition(() => {
      void setActivePet(id);
    });
  }

  const ageLabel =
    active.ageYears != null
      ? `${Number(active.ageYears)} ${Number(active.ageYears) === 1 ? "yr" : "yrs"}`
      : "—";
  const weightLabel =
    active.weightKg != null ? `${Number(active.weightKg)} kg` : "—";

  return (
    <main className="min-h-0 flex-1 overflow-y-auto bg-background px-5 py-7 md:px-8">
      <div className="mx-auto w-full max-w-6xl">
        {/* header */}
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-llp-display text-3xl font-bold tracking-tight text-foreground">
              Pet Profiles
            </h1>
            <p className="mt-1 text-[15px] text-muted-foreground">
              Every profile sharpens the AI&apos;s recommendations.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-[0_8px_20px_rgba(120,35,56,0.2)] transition-transform hover:scale-[1.03] active:scale-95"
          >
            <Plus className="size-4" />
            Add a pet
          </button>
        </div>

        {/* pet selector cards */}
        <div className="mb-6 grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-5">
          {pets.map((p) => (
            <PetMiniCard
              key={p.id}
              pet={p}
              active={p.id === active.id}
              onSelect={() => selectPet(p.id)}
            />
          ))}
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="grid min-h-[116px] place-items-center rounded-2xl border-2 border-dashed border-[var(--llp-outline-2)] text-muted-foreground transition-colors hover:border-primary hover:text-primary"
          >
            <div className="text-center">
              <PlusCircle className="mx-auto size-7 text-primary" />
              <div className="mt-1 text-[13.5px] font-semibold">Add a pet</div>
            </div>
          </button>
        </div>

        {/* detailed profile */}
        <div
          key={active.id}
          className="llp-card-in grid gap-5 lg:grid-cols-[1fr_1.4fr]"
        >
          {/* left: hero card */}
          <div className="overflow-hidden rounded-[var(--radius-xl)] border border-border bg-card shadow-[var(--llp-sh-1)]">
            <div
              className="px-6 py-7 text-center"
              style={{ background: "var(--primary-container)" }}
            >
              <div className="flex justify-center">
                <PetAvatar
                  name={active.name}
                  photoUrl={active.photoUrl}
                  size={108}
                  species={active.species}
                />
              </div>
              <div
                className="font-llp-display mt-3 text-2xl font-bold"
                style={{ color: "var(--on-primary-container)" }}
              >
                {active.name}
              </div>
              <div
                className="text-[13.5px]"
                style={{ color: "var(--on-primary-container)", opacity: 0.85 }}
              >
                {active.breed?.trim() || speciesLabel(active.species)} ·{" "}
                {speciesLabel(active.species)}
              </div>
              {active.medicalConditions.length > 0 ? (
                <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                  {active.medicalConditions.slice(0, 3).map((t) => (
                    <MiniChip key={t} icon={Verified} tone="yellow">
                      {t}
                    </MiniChip>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(96px,1fr))] gap-3 p-5">
              <StatTile label="Weight" value={weightLabel} />
              <StatTile label="Age" value={ageLabel} />
              <StatTile label="Area" value={petArea(active)} />
            </div>
            <div className="px-5 pb-5">
              <button
                type="button"
                onClick={() => setEditOpen(true)}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-border bg-card px-5 py-2.5 text-sm font-semibold text-foreground shadow-[var(--llp-sh-1)] transition-colors hover:bg-muted"
              >
                <Pencil className="size-4" />
                Edit profile
              </button>
            </div>
          </div>

          {/* right: detail cards */}
          <div className="flex flex-col gap-5">
            <div className="rounded-[var(--radius-xl)] border border-border bg-card p-6 shadow-[var(--llp-sh-1)]">
              <SectionTitle icon={HeartPulse} title="Health & conditions" />
              <div className="mt-4 flex flex-col gap-2.5">
                {active.medicalConditions.length === 0 ? (
                  <div className="flex items-center gap-3">
                    <div className="grid size-8 place-items-center rounded-full bg-[var(--llp-success-container)]">
                      <HeartPulse className="size-4 text-[#13633f]" />
                    </div>
                    <div className="flex-1 text-sm font-semibold text-foreground">
                      No conditions on file
                    </div>
                    <MiniChip tone="green">Looking healthy</MiniChip>
                  </div>
                ) : (
                  active.medicalConditions.map((cond) => (
                    <div className="flex items-center gap-3" key={cond}>
                      <div className="grid size-8 place-items-center rounded-full bg-[var(--llp-secondary-container)]">
                        <CircleAlert className="size-4 text-[var(--llp-secondary)]" />
                      </div>
                      <div className="flex-1 text-sm font-semibold text-foreground">
                        {cond}
                      </div>
                      <MiniChip tone="yellow">Monitor</MiniChip>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="rounded-[var(--radius-xl)] border border-border bg-card p-6 shadow-[var(--llp-sh-1)]">
                <SectionTitle icon={Salad} title="Diet" />
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {active.dietaryRestrictions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No restrictions noted.
                    </p>
                  ) : (
                    active.dietaryRestrictions.map((d) => (
                      <MiniChip key={d} tone="pink">
                        {d}
                      </MiniChip>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-[var(--radius-xl)] border border-border bg-card p-6 shadow-[var(--llp-sh-1)]">
                <SectionTitle icon={Stethoscope} title="Care & vet" />
                <p className="mt-3 text-sm font-semibold text-foreground">
                  {petArea(active) === "—"
                    ? "Set an area to find nearby vets"
                    : `Services near ${petArea(active)}`}
                </p>
                <Link
                  className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-primary"
                  href="/discovery"
                >
                  Find a vet nearby
                  <MapPin className="size-4" />
                </Link>
              </div>
            </div>

            {active.notes?.trim() ? (
              <div className="rounded-[var(--radius-xl)] border border-border bg-card p-6 shadow-[var(--llp-sh-1)]">
                <SectionTitle icon={Pencil} title="Notes" />
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                  {active.notes}
                </p>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-llp-display text-2xl">
              Edit {active.name}&apos;s profile
            </DialogTitle>
            <DialogDescription>
              We use this across the dashboard, assistant and discovery.
            </DialogDescription>
          </DialogHeader>
          <PetPhotoUploader
            name={active.name}
            petId={active.id}
            photoUrl={active.photoUrl}
            species={active.species}
          />
          <ProfilesPetForm pet={active} onSaved={() => setEditOpen(false)} />
        </DialogContent>
      </Dialog>

      {/* add dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-llp-display text-2xl">
              Add a pet
            </DialogTitle>
            <DialogDescription>
              Start with the basics — you can add vitals and notes after.
            </DialogDescription>
          </DialogHeader>
          <AddPetForm onCreated={() => setAddOpen(false)} />
        </DialogContent>
      </Dialog>
    </main>
  );
}
