import {
  Bot,
  Check,
  ClipboardList,
  Cross,
  Heart,
  MapPin,
  ShoppingBag,
  Sparkles,
  Utensils,
} from "lucide-react";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import {
  AnimatedList,
  FadeContent,
  Pill,
  ShinyText,
  SpotlightCard,
} from "@/components/pet-care/primitives";
import { PetCareShell } from "@/components/pet-care/shell";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { getNearbyTop, type PlaceDTO } from "@/lib/discovery-queries";
import { petPlaceholderImage } from "@/lib/pet-data";
import {
  ALERT_ICON,
  ALERT_ICON_TONE,
  type CareAlert,
  topCareAlert,
} from "@/lib/pet-data/care-alerts";
import type { PetCareLogDTO, PetDTO } from "@/lib/pet-queries";
import { getPetCareContext } from "@/lib/pet-queries";
import { cn } from "@/lib/utils";
import { DailyCareLogForm } from "./daily-care-log-form";

function timeGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function formatSpecies(species: string) {
  const s = species.toLowerCase();
  if (s === "dog") return "Dog";
  if (s === "cat") return "Cat";
  return species;
}

function careLogPresentation(log: PetCareLogDTO) {
  const time = new Date(log.loggedAt).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  const title =
    log.notes?.trim().split("\n")[0]?.slice(0, 72) || "Care check-in";
  const parts = [
    log.fed === true ? "Fed" : log.fed === false ? "Not fed" : null,
    log.mood?.trim() || null,
    log.weightKg ? `${log.weightKg} kg` : null,
    log.symptoms.length > 0 ? log.symptoms.join(", ") : null,
  ].filter(Boolean);
  const subtitle =
    parts.join(" · ") ||
    (log.notes?.includes("\n")
      ? log.notes.trim().split("\n").slice(1).join(" ").slice(0, 120)
      : "Logged from your care journal");

  const Icon =
    log.fed === true ? Check : log.fed === false ? Utensils : ClipboardList;
  const tone =
    log.fed === true
      ? "bg-secondary text-secondary-foreground"
      : "bg-muted text-muted-foreground ring-1 ring-border";

  return { time, title, subtitle, Icon, tone };
}

function Dashboard({
  userDisplayName,
  pet,
  nearbyVets,
}: {
  userDisplayName: string;
  pet: PetDTO;
  nearbyVets: PlaceDTO[];
}) {
  const avatarSrc = petPlaceholderImage(pet.species);
  const ageLabel = pet.ageYears != null ? `${Number(pet.ageYears)} yrs` : "—";
  const weightLabel = pet.weightKg != null ? `${Number(pet.weightKg)} kg` : "—";
  const healthSummary =
    pet.medicalConditions.length > 0
      ? pet.medicalConditions.slice(0, 2).join(", ")
      : "No conditions on file";
  const healthDetail =
    pet.medicalConditions.length > 0
      ? "Review care with your vet if symptoms change."
      : "Great — keep up regular checkups.";

  const nearLabel =
    pet.locationLabel?.trim() ||
    (pet.locationPostalCode?.trim()
      ? `Near ${pet.locationPostalCode}`
      : "Singapore");

  return (
    <main className="min-h-0 flex-1 bg-background px-5 pt-8 pb-12 md:px-12">
      <section className="mx-auto max-w-6xl">
        <FadeContent className="mb-10">
          <h2 className="text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
            <ShinyText>
              {timeGreeting()}, {userDisplayName}
            </ShinyText>
          </h2>
          <p className="mt-2 text-lg text-muted-foreground">
            Here&apos;s {pet.name}&apos;s care summary for today.
          </p>
        </FadeContent>

        <div className="grid gap-6 lg:grid-cols-[0.95fr_1.25fr]">
          <PetCard
            pet={pet}
            avatarSrc={avatarSrc}
            ageLabel={ageLabel}
            weightLabel={weightLabel}
          />
          <div className="grid gap-6">
            <AiCareAlert alert={topCareAlert(pet)} />
            <DailyCareLog logs={pet.careLogs} pet={pet} />
          </div>
          <KibbleReminder
            petName={pet.name}
            dietary={pet.dietaryRestrictions}
          />
          <NearbyCard
            nearLabel={nearLabel}
            vets={nearbyVets}
            healthSummary={healthSummary}
            healthDetail={healthDetail}
          />
        </div>
      </section>
    </main>
  );
}

function PetCard({
  pet,
  avatarSrc,
  ageLabel,
  weightLabel,
}: {
  pet: PetDTO;
  avatarSrc: string;
  ageLabel: string;
  weightLabel: string;
}) {
  return (
    <SpotlightCard className="overflow-hidden border-0">
      <div className="flex items-center gap-5 bg-gradient-to-br from-primary/15 via-accent/40 to-primary/10 p-8 dark:from-primary/20 dark:via-accent/10 dark:to-primary/5">
        <Avatar className="size-24 border-4 border-background shadow-sm">
          <AvatarImage
            alt={`${pet.name} profile`}
            className="object-cover"
            src={avatarSrc}
          />
          <AvatarFallback>{pet.name.slice(0, 1).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div>
          <h3 className="text-2xl font-semibold tracking-tight md:text-3xl">
            {pet.name}
          </h3>
          <Pill className="mt-2 bg-secondary text-secondary-foreground">
            <Sparkles className="size-3" />
            {pet.species.toLowerCase() === "dog"
              ? "Dog profile"
              : `${formatSpecies(pet.species)} profile`}
          </Pill>
        </div>
      </div>
      <CardContent className="grid min-h-[430px] content-between p-8">
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-xl border border-border bg-muted/40 p-5">
            <p className="text-xs font-medium tracking-widest text-muted-foreground">
              Weight
            </p>
            <p className="mt-3 text-xl font-medium tabular-nums">
              {weightLabel}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-muted/40 p-5">
            <p className="text-xs font-medium tracking-widest text-muted-foreground">
              Age
            </p>
            <p className="mt-3 text-xl font-medium tabular-nums">{ageLabel}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex size-12 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
            <Heart className="size-6" />
          </div>
          <div>
            <p className="font-medium">Health notes</p>
            <p className="text-sm text-muted-foreground">
              {pet.medicalConditions.length === 0
                ? "No conditions recorded"
                : pet.medicalConditions.join(", ")}
            </p>
            {pet.breed ? (
              <p className="text-sm text-muted-foreground">{pet.breed}</p>
            ) : null}
          </div>
        </div>
      </CardContent>
    </SpotlightCard>
  );
}

function AiCareAlert({ alert }: { alert: CareAlert }) {
  const Icon = ALERT_ICON[alert.level];
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-primary/20 via-accent/30 to-primary/10 p-8 shadow-sm dark:from-primary/25 dark:via-primary/10 dark:to-card">
      <div className="flex gap-6">
        <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-background/60 dark:bg-background/40">
          <Icon className={cn("size-7", ALERT_ICON_TONE[alert.level])} />
        </div>
        <div>
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <h3 className="font-semibold">AI care alert</h3>
            <Pill className="border-0 bg-background/70 text-primary dark:bg-background/50">
              {alert.label}
            </Pill>
          </div>
          <p className="max-w-3xl text-base leading-relaxed text-muted-foreground md:text-lg">
            {alert.message}
          </p>
          {alert.cta ? (
            <Button className="mt-3 px-0" variant="link" asChild>
              <a href={alert.cta.href}>{alert.cta.text} →</a>
            </Button>
          ) : null}
        </div>
      </div>
      <Bot className="pointer-events-none absolute -right-4 top-2 size-28 text-primary/10" />
    </div>
  );
}

function DailyCareLog({ logs, pet }: { logs: PetCareLogDTO[]; pet: PetDTO }) {
  return (
    <SpotlightCard className="border-0">
      <CardContent className="p-8">
        <div className="mb-7 flex items-center justify-between">
          <h3 className="text-2xl font-semibold tracking-tight">
            Daily care log
          </h3>
          <Pill className="bg-muted text-muted-foreground">Today</Pill>
        </div>
        <DailyCareLogForm petId={pet.id} petName={pet.name} />
        <div className="mt-8 border-t border-border pt-7">
          <div className="mb-5 flex items-center justify-between gap-4">
            <p className="text-sm font-semibold text-muted-foreground">
              Recent history
            </p>
            <Button className="text-primary" size="sm" variant="ghost" asChild>
              <a href="/assistant">Ask assistant</a>
            </Button>
          </div>
          {logs.length === 0 ? (
            <p className="text-muted-foreground">
              No care logs yet. Save today&apos;s first check-in.
            </p>
          ) : (
            <AnimatedList className="grid gap-6">
              {logs.map((log) => {
                const row = careLogPresentation(log);
                const Icon = row.Icon;
                return (
                  <div className="flex items-center gap-5" key={log.id}>
                    <div
                      className={cn(
                        "flex size-10 shrink-0 items-center justify-center rounded-full",
                        row.tone,
                      )}
                    >
                      <Icon className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={cn("font-medium")}>{row.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {row.subtitle}
                      </p>
                    </div>
                    <span className="text-sm tabular-nums text-muted-foreground">
                      {row.time}
                    </span>
                  </div>
                );
              })}
            </AnimatedList>
          )}
        </div>
      </CardContent>
    </SpotlightCard>
  );
}

function KibbleReminder({
  petName,
  dietary,
}: {
  petName: string;
  dietary: string[];
}) {
  const dietHint =
    dietary.length > 0
      ? `Diet notes on file: ${dietary.join(", ")}.`
      : `Restock ${petName}'s usual food before you run low.`;

  return (
    <SpotlightCard>
      <CardContent className="flex min-h-60 items-center gap-8 p-8">
        <div className="flex size-20 items-center justify-center rounded-xl bg-muted text-muted-foreground">
          <ShoppingBag className="size-9" />
        </div>
        <div>
          <h3 className="font-semibold">Food & supplies</h3>
          <p className="mt-2 max-w-md text-muted-foreground">{dietHint}</p>
          <Button className="mt-3 px-0" variant="link" asChild>
            <a href="/discovery">Browse local partners →</a>
          </Button>
        </div>
      </CardContent>
    </SpotlightCard>
  );
}

function NearbyCard({
  nearLabel,
  vets,
  healthSummary,
  healthDetail,
}: {
  nearLabel: string;
  vets: PlaceDTO[];
  healthSummary: string;
  healthDetail: string;
}) {
  return (
    <SpotlightCard className="border-0">
      <CardContent className="p-8">
        <div className="mb-5 flex items-center justify-between gap-3">
          <span className="flex items-center gap-3 font-medium">
            <MapPin className="size-6 text-primary" />
            Nearby vets — {nearLabel}
          </span>
          <Button className="text-primary" size="sm" variant="ghost" asChild>
            <a href="/discovery">See all</a>
          </Button>
        </div>
        {vets.length === 0 ? (
          <div className="flex h-28 items-center justify-center rounded-lg border border-dashed border-border bg-muted/50 px-4 text-center text-sm text-muted-foreground">
            Add your postal code in Pet Profiles to see clinics near you.
          </div>
        ) : (
          <div className="grid gap-3">
            {vets.slice(0, 3).map((vet) => (
              <a
                key={vet.id}
                href={vet.googleMapsUrl ?? "/discovery"}
                target={vet.googleMapsUrl ? "_blank" : undefined}
                rel={vet.googleMapsUrl ? "noreferrer" : undefined}
                className="flex items-center gap-4 rounded-xl border border-border bg-muted/30 p-4 transition-colors hover:bg-muted/60"
              >
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                  <Cross className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{vet.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {vet.rating != null ? `★ ${vet.rating.toFixed(1)}` : "New"}
                    {vet.userRatingCount ? ` (${vet.userRatingCount})` : ""}
                    {vet.distanceKm != null
                      ? ` · ${vet.distanceKm.toFixed(1)} km`
                      : vet.neighbourhood
                        ? ` · ${vet.neighbourhood}`
                        : ""}
                  </p>
                </div>
              </a>
            ))}
          </div>
        )}
        <div className="mt-5 flex justify-between text-sm font-medium">
          <span>{healthSummary}</span>
          <span className="max-w-[55%] text-right text-muted-foreground">
            {healthDetail}
          </span>
        </div>
      </CardContent>
    </SpotlightCard>
  );
}

function DashboardSkeleton() {
  return (
    <main className="min-h-0 flex-1 bg-background px-5 pt-8 pb-12 md:px-12">
      <section className="mx-auto max-w-6xl animate-pulse">
        <div className="mb-10">
          <div className="h-12 w-72 rounded-lg bg-muted" />
          <div className="mt-3 h-5 w-56 rounded bg-muted" />
        </div>
        <div className="grid gap-6 lg:grid-cols-[0.95fr_1.25fr]">
          <div className="h-[560px] rounded-2xl border border-border bg-card" />
          <div className="grid gap-6">
            <div className="h-48 rounded-2xl border border-border bg-card" />
            <div className="h-80 rounded-2xl border border-border bg-card" />
          </div>
          <div className="h-60 rounded-2xl border border-border bg-card" />
          <div className="h-80 rounded-2xl border border-border bg-card" />
        </div>
      </section>
    </main>
  );
}

async function DashboardContent() {
  const { userDisplayName, pet } = await getPetCareContext();
  if (!pet) redirect("/onboarding");

  const { places: nearbyVets } = await getNearbyTop(pet, "vet", 3);

  return (
    <Dashboard
      userDisplayName={userDisplayName}
      pet={pet}
      nearbyVets={nearbyVets}
    />
  );
}

export default function Home() {
  return (
    <PetCareShell active="dashboard">
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent />
      </Suspense>
    </PetCareShell>
  );
}
