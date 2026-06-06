import {
  Cross,
  Heart,
  MapPin,
  Scissors,
  Search,
  SlidersHorizontal,
  Sparkles,
  Star,
  Tag,
} from "lucide-react";
import { Pill, SpotlightCard } from "@/components/pet-care/primitives";
import { PetCareShell } from "@/components/pet-care/shell";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  discoveryFilters,
  groomerInterior,
  mochiPortrait,
} from "@/lib/pet-data";
import { cn } from "@/lib/utils";

const listings = [
  {
    name: "Fluffy Paws Spa",
    location: "Tampines Hub • 1.2km",
    tag: "Sensitive Skin Expert",
    rating: "4.9",
    selected: true,
  },
  {
    name: "Urban Tails Grooming",
    location: "Bedok Mall • 3.5km",
    tag: "Organic Shampoos",
    rating: "4.7",
    selected: false,
  },
];

function ListPanel() {
  return (
    <section className="z-10 flex min-h-0 w-full flex-col border-r border-border bg-card shadow-sm md:h-full md:w-[500px] md:shrink-0">
      <div className="border-b border-border p-5 md:p-8">
        <h2 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
          Local discovery
        </h2>
        <p className="mt-1 text-lg text-muted-foreground">
          Find trusted services in Singapore.
        </p>
        <div className="relative mt-5">
          <Search className="absolute top-1/2 left-4 size-6 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-12 rounded-xl pl-12 pr-14 text-base"
            placeholder="Find services near Tampines…"
          />
          <button
            className="absolute top-1/2 right-3 -translate-y-1/2 rounded-lg bg-muted p-2 text-muted-foreground transition-colors hover:bg-muted/80"
            type="button"
          >
            <SlidersHorizontal className="size-5" />
          </button>
        </div>
        <MochiFilterBar />
        <FilterChips />
      </div>

      <div className="grid gap-4 overflow-y-auto p-5 md:p-8">
        {listings.map((listing) => (
          <ListingCard key={listing.name} {...listing} />
        ))}
        <SpecialOfferBanner />
      </div>
    </section>
  );
}

function MochiFilterBar() {
  return (
    <div className="mt-4 flex items-center gap-3 rounded-xl border border-primary/25 bg-gradient-to-r from-primary/10 to-card p-2">
      <Avatar className="size-9">
        <AvatarImage alt="Mochi" src={mochiPortrait} />
        <AvatarFallback>M</AvatarFallback>
      </Avatar>
      <div>
        <p className="text-sm font-semibold text-foreground">
          Top picks for Mochi
        </p>
        <p className="text-xs text-muted-foreground">
          Filtered for sensitive skin expertise
        </p>
      </div>
      <button
        className="ml-auto px-2 text-sm font-semibold text-primary"
        type="button"
      >
        Edit
      </button>
    </div>
  );
}

function FilterChips() {
  return (
    <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
      {discoveryFilters.map(({ label, icon: Icon, active }) => (
        <button
          className={cn(
            "flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
            active
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-muted/60 text-foreground hover:bg-muted",
          )}
          key={label}
          type="button"
        >
          <Icon className="size-4" />
          {label}
        </button>
      ))}
    </div>
  );
}

function ListingCard({
  name,
  location,
  tag,
  rating,
  selected,
}: (typeof listings)[number]) {
  return (
    <SpotlightCard
      className={cn(selected && "bg-gradient-to-r from-card to-primary/5")}
    >
      <CardContent className="flex gap-5 p-4">
        <div className="relative">
          <img
            alt={name}
            className="size-28 rounded-lg object-cover"
            src={groomerInterior}
          />
          <Pill className="absolute top-1 left-1 border-0 bg-card text-amber-700 shadow dark:text-amber-400">
            <Star className="size-3 fill-current" />
            {rating}
          </Pill>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex justify-between gap-4">
            <h3 className="text-xl font-semibold tracking-tight">{name}</h3>
            <Heart className="size-6 shrink-0 text-muted-foreground" />
          </div>
          <p className="mt-2 flex items-center gap-2 text-muted-foreground">
            <MapPin className="size-4" />
            {location}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Pill className="rounded-md border border-amber-500/30 bg-amber-500/15 text-amber-800 dark:text-amber-300">
              {tag}
            </Pill>
            <Pill className="rounded-md bg-muted text-muted-foreground">
              HDB-approved
            </Pill>
          </div>
          <div className="mt-4 flex items-center justify-between">
            <span className="font-medium text-muted-foreground">$$$</span>
            <Button className="rounded-full" size="sm" variant="secondary">
              Book now
            </Button>
          </div>
        </div>
      </CardContent>
    </SpotlightCard>
  );
}

function SpecialOfferBanner() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-chart-2/30 to-chart-3/25 p-6 text-foreground dark:from-chart-2/20 dark:to-chart-3/15">
      <Pill className="mb-4 rounded-md border-0 bg-foreground text-background">
        Special offer
      </Pill>
      <h3 className="text-2xl font-semibold">First grooming 20% off</h3>
      <p className="mt-2 text-muted-foreground">
        Available at selected partners near Tampines.
      </p>
      <Button className="mt-5 rounded-full" variant="default">
        Claim offer
      </Button>
      <Tag className="pointer-events-none absolute -right-2 bottom-0 size-32 text-foreground/10" />
    </div>
  );
}

function MapPanel() {
  return (
    <section className="relative h-[520px] min-h-0 flex-1 overflow-hidden bg-gradient-to-br from-chart-3/40 via-chart-2/30 to-primary/20 md:h-full dark:from-chart-3/20 dark:via-chart-2/15 dark:to-primary/10">
      <div className="absolute inset-0 opacity-40 [background-image:linear-gradient(35deg,transparent_49%,color-mix(in_oklch,var(--card),transparent_60%)_50%,transparent_51%),linear-gradient(118deg,transparent_49%,color-mix(in_oklch,var(--card),transparent_60%)_50%,transparent_51%),linear-gradient(90deg,transparent_49%,color-mix(in_oklch,var(--card),transparent_60%)_50%,transparent_51%)] [background-size:140px_110px,190px_160px,86px_86px]" />
      <Button
        className="absolute top-8 left-1/2 z-10 -translate-x-1/2 rounded-full shadow-lg"
        variant="secondary"
      >
        <Search className="size-4" />
        Search this area
      </Button>
      <div className="absolute top-6 right-5 z-10 grid gap-3">
        <Button
          className="size-12 rounded-full shadow-md"
          size="icon"
          variant="secondary"
        >
          <Cross className="size-6" />
        </Button>
        <div className="grid overflow-hidden rounded-full border border-border bg-card shadow-md">
          <button className="px-4 py-3 text-2xl" type="button">
            +
          </button>
          <button className="px-4 py-3 text-2xl" type="button">
            −
          </button>
        </div>
      </div>
      <div className="absolute top-[40%] left-[42%] z-10 flex items-center gap-3 rounded-xl border border-border bg-card/90 p-3 shadow-md backdrop-blur">
        <div className="flex size-12 items-center justify-center rounded-lg bg-foreground text-background">
          <Sparkles className="size-5 fill-current" />
        </div>
        <div>
          <p className="font-semibold">Fluffy Paws Spa</p>
          <p className="text-sm font-medium text-primary">☆ 4.9 (120)</p>
        </div>
      </div>
      <div className="absolute top-[50%] left-[45%] z-10 flex size-12 items-center justify-center rounded-full border-4 border-background bg-primary text-primary-foreground shadow-md">
        <Scissors className="size-6" />
      </div>
      <div className="absolute top-[29%] left-[68%] z-10 flex size-7 items-center justify-center rounded-full border-2 border-background bg-amber-700 text-white shadow-md dark:bg-amber-600">
        <Cross className="size-4" />
      </div>
      <div className="absolute top-[62%] left-[62%] z-10 flex size-10 items-center justify-center rounded-full border-2 border-background bg-card text-foreground shadow-md">
        <Scissors className="size-5" />
      </div>
    </section>
  );
}

export default function DiscoveryPage() {
  return (
    <PetCareShell active="discovery">
      <main className="flex min-h-0 flex-1 flex-col bg-background md:flex-row">
        <ListPanel />
        <MapPanel />
      </main>
    </PetCareShell>
  );
}
