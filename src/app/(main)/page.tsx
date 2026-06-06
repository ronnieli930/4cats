import { Bot, Heart, MapPin, ShoppingBag, Sparkles, Sun } from "lucide-react";
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
import { careLogItems, mochiPortrait } from "@/lib/pet-data";
import { cn } from "@/lib/utils";

function Dashboard() {
  return (
    <main className="min-h-0 flex-1 bg-background px-5 pt-8 pb-12 md:px-12">
      <section className="mx-auto max-w-6xl">
        <FadeContent className="mb-10">
          <h2 className="text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
            <ShinyText>Good morning, Sarah</ShinyText>
          </h2>
          <p className="mt-2 text-lg text-muted-foreground">
            Here&apos;s Mochi&apos;s care summary for today.
          </p>
        </FadeContent>

        <div className="grid gap-6 lg:grid-cols-[0.95fr_1.25fr]">
          <PetCard />
          <div className="grid gap-6">
            <AiCareAlert />
            <DailyCareLog />
          </div>
          <KibbleReminder />
          <NearbyCard />
        </div>
      </section>
    </main>
  );
}

function PetCard() {
  return (
    <SpotlightCard className="overflow-hidden border-0">
      <div className="flex items-center gap-5 bg-gradient-to-br from-primary/15 via-accent/40 to-primary/10 p-8 dark:from-primary/20 dark:via-accent/10 dark:to-primary/5">
        <Avatar className="size-24 border-4 border-background shadow-sm">
          <AvatarImage
            alt="Mochi profile"
            className="object-cover"
            src={mochiPortrait}
          />
          <AvatarFallback>M</AvatarFallback>
        </Avatar>
        <div>
          <h3 className="text-2xl font-semibold tracking-tight md:text-3xl">
            Mochi
          </h3>
          <Pill className="mt-2 bg-secondary text-secondary-foreground">
            <Sparkles className="size-3" />
            HDB-approved
          </Pill>
        </div>
      </div>
      <CardContent className="grid min-h-[430px] content-between p-8">
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-xl border border-border bg-muted/40 p-5">
            <p className="text-xs font-medium tracking-widest text-muted-foreground">
              Weight
            </p>
            <p className="mt-3 text-xl font-medium tabular-nums">6.2 kg</p>
          </div>
          <div className="rounded-xl border border-border bg-muted/40 p-5">
            <p className="text-xs font-medium tracking-widest text-muted-foreground">
              Age
            </p>
            <p className="mt-3 text-xl font-medium tabular-nums">3 yrs</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex size-12 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
            <Heart className="size-6" />
          </div>
          <div>
            <p className="font-medium">Health status</p>
            <p className="text-sm text-muted-foreground">All good</p>
            <p className="text-sm text-muted-foreground">
              Next checkup in 4 months
            </p>
          </div>
        </div>
      </CardContent>
    </SpotlightCard>
  );
}

function AiCareAlert() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-primary/20 via-accent/30 to-primary/10 p-8 shadow-sm dark:from-primary/25 dark:via-primary/10 dark:to-card">
      <div className="flex gap-6">
        <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-background/60 dark:bg-background/40">
          <Sun className="size-7 text-amber-500" />
        </div>
        <div>
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <h3 className="font-semibold">AI care alert</h3>
            <Pill className="border-0 bg-background/70 text-primary dark:bg-background/50">
              High priority
            </Pill>
          </div>
          <p className="max-w-3xl text-base leading-relaxed text-muted-foreground md:text-lg">
            Hot day in SG — highs near 32°C. Keep Mochi hydrated on walks and
            avoid hot pavement between 12pm and 4pm.
          </p>
        </div>
      </div>
      <Bot className="pointer-events-none absolute -right-4 top-2 size-28 text-primary/10" />
    </div>
  );
}

function DailyCareLog() {
  return (
    <SpotlightCard className="border-0">
      <CardContent className="p-8">
        <div className="mb-7 flex items-center justify-between">
          <h3 className="text-2xl font-semibold tracking-tight">
            Daily care log
          </h3>
          <Button className="text-primary" size="sm" variant="ghost">
            View all
          </Button>
        </div>
        <AnimatedList className="grid gap-7">
          {careLogItems.map(
            ({ title, subtitle, time, icon: Icon, tone, done }) => (
              <div className="flex items-center gap-5" key={title}>
                <div
                  className={cn(
                    "flex size-10 shrink-0 items-center justify-center rounded-full",
                    tone,
                  )}
                >
                  <Icon className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      "font-medium",
                      done && "text-muted-foreground line-through",
                    )}
                  >
                    {title}
                  </p>
                  <p className="text-sm text-muted-foreground">{subtitle}</p>
                </div>
                {time ? (
                  <span className="text-sm tabular-nums text-muted-foreground">
                    {time}
                  </span>
                ) : (
                  <Button className="rounded-full" size="sm">
                    Mark done
                  </Button>
                )}
              </div>
            ),
          )}
        </AnimatedList>
      </CardContent>
    </SpotlightCard>
  );
}

function KibbleReminder() {
  return (
    <SpotlightCard>
      <CardContent className="flex min-h-60 items-center gap-8 p-8">
        <div className="flex size-20 items-center justify-center rounded-xl bg-muted text-muted-foreground">
          <ShoppingBag className="size-9" />
        </div>
        <div>
          <h3 className="font-semibold">Low on kibble?</h3>
          <p className="mt-2 max-w-md text-muted-foreground">
            Time for Mochi&apos;s hypo-allergenic order from your usual store.
          </p>
          <Button className="mt-3 px-0" variant="link">
            Order now →
          </Button>
        </div>
      </CardContent>
    </SpotlightCard>
  );
}

function NearbyCard() {
  return (
    <SpotlightCard className="border-0">
      <CardContent className="p-8">
        <div className="mb-5 flex items-center gap-3 font-medium">
          <MapPin className="size-6 text-primary" />
          Nearby in Tampines
        </div>
        <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-border bg-muted/50 text-muted-foreground">
          Map preview
        </div>
        <div className="mt-5 flex justify-between text-sm font-medium">
          <span>The Animal Clinic</span>
          <span className="text-muted-foreground">1.2 km</span>
        </div>
      </CardContent>
    </SpotlightCard>
  );
}

export default function Home() {
  return (
    <PetCareShell active="dashboard">
      <Dashboard />
    </PetCareShell>
  );
}
