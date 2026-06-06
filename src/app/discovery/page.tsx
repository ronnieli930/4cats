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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  discoveryFilters,
  groomerInterior,
  mochiPortrait,
} from "@/lib/pet-data";
import { Pill, SpotlightCard } from "@/components/pet-care/primitives";
import { PetCareShell } from "@/components/pet-care/shell";

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
    <section className="z-10 flex w-full flex-col border-r border-[#dac0c3]/30 bg-white shadow-[4px_0_24px_rgba(29,53,87,0.08)] md:h-screen md:w-[500px]">
      <div className="border-b border-[#dac0c3]/30 p-5 md:p-8">
        <h2 className="font-[family-name:var(--font-brand)] text-4xl font-bold md:text-5xl">
          Local Discovery
        </h2>
        <p className="mt-1 text-lg text-[#554244]">
          Find trusted services in Singapore.
        </p>
        <div className="relative mt-5">
          <Search className="absolute left-4 top-1/2 size-6 -translate-y-1/2 text-[#887274]" />
          <Input
            className="h-14 rounded-xl border-[#dac0c3]/70 bg-[#f8f9fa] pl-12 pr-14 text-lg"
            placeholder="Find services near Tampines..."
          />
          <button
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg bg-[#edeeef] p-2 text-[#554244]"
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
    <div className="mt-4 flex items-center gap-3 rounded-xl border border-[#ffd167] bg-gradient-to-r from-[#ffdf9b]/50 to-white p-2">
      <Avatar className="size-9">
        <AvatarImage alt="Mochi" src={mochiPortrait} />
        <AvatarFallback>M</AvatarFallback>
      </Avatar>
      <div>
        <p className="text-sm font-bold text-[#785a00]">Top picks for Mochi</p>
        <p className="text-xs text-[#554244]">
          Filtered for sensitive skin expertise
        </p>
      </div>
      <button
        className="ml-auto px-2 text-sm font-bold text-[#9c3f53]"
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
            "flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold",
            active
              ? "border-[#9c3f53] bg-[#9c3f53] text-white"
              : "border-[#dac0c3] bg-[#edeeef] text-[#191c1d]",
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
      className={cn(
        selected && "bg-gradient-to-r from-white to-[#ffdf9b]/20",
      )}
    >
      <CardContent className="flex gap-5 p-4">
        <div className="relative">
          <img
            alt={name}
            className="size-28 rounded-lg object-cover"
            src={groomerInterior}
          />
          <Pill className="absolute left-1 top-1 bg-white text-[#785a00] shadow">
            <Star className="size-3 fill-current" />
            {rating}
          </Pill>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex justify-between gap-4">
            <h3 className="font-[family-name:var(--font-brand)] text-2xl font-bold">
              {name}
            </h3>
            <Heart className="size-6 text-[#887274]" />
          </div>
          <p className="mt-2 flex items-center gap-2 text-[#554244]">
            <MapPin className="size-4" />
            {location}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Pill className="rounded-md border border-[#ffd167] bg-[#ffdf9b]/70 text-[#d48700]">
              {tag}
            </Pill>
            <Pill className="rounded-md bg-[#edeeef] text-[#554244]">
              HDB-Approved
            </Pill>
          </div>
          <div className="mt-4 flex items-center justify-between">
            <span className="font-semibold text-[#9c3f53]">$$$</span>
            <Button className="rounded-full bg-[#ffd9dd] text-[#9c3f53] hover:bg-[#ffb2bd]">
              Book Now
            </Button>
          </div>
        </div>
      </CardContent>
    </SpotlightCard>
  );
}

function SpecialOfferBanner() {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-[#b0c7f1] p-6 text-[#18365f]">
      <Pill className="mb-4 rounded-md bg-[#1d3557] text-white">
        SPECIAL OFFER
      </Pill>
      <h3 className="text-2xl font-bold">First Grooming 20% Off</h3>
      <p className="mt-2">Available at selected partners near Tampines.</p>
      <Button className="mt-5 rounded-full bg-[#1d3557]">Claim Offer</Button>
      <Tag className="absolute -right-2 bottom-0 size-32 text-[#1d3557]/20" />
    </div>
  );
}

function MapPanel() {
  return (
    <section className="relative h-[520px] flex-1 overflow-hidden bg-[#8fc4bd] md:h-screen">
      <div className="absolute inset-0 opacity-45 [background-image:linear-gradient(35deg,transparent_49%,white_50%,transparent_51%),linear-gradient(118deg,transparent_49%,white_50%,transparent_51%),linear-gradient(90deg,transparent_49%,white_50%,transparent_51%)] [background-size:140px_110px,190px_160px,86px_86px]" />
      <Button className="absolute left-1/2 top-8 z-10 -translate-x-1/2 rounded-full bg-white text-[#9c3f53] shadow-lg hover:bg-white">
        <Search className="size-4" />
        Search this area
      </Button>
      <div className="absolute right-5 top-6 z-10 grid gap-3">
        <Button
          className="size-12 rounded-full bg-white text-black shadow-md hover:bg-white"
          size="icon"
        >
          <Cross className="size-6" />
        </Button>
        <div className="grid overflow-hidden rounded-full bg-white shadow-md">
          <button className="px-4 py-3 text-2xl" type="button">
            +
          </button>
          <button className="px-4 py-3 text-2xl" type="button">
            −
          </button>
        </div>
      </div>
      <div className="absolute left-[42%] top-[40%] z-10 flex items-center gap-3 rounded-xl bg-white/85 p-3 shadow-md backdrop-blur">
        <div className="flex size-12 items-center justify-center rounded-lg bg-[#20333c] text-cyan-300">
          <Sparkles className="size-5 fill-current" />
        </div>
        <div>
          <p className="font-semibold">Fluffy Paws Spa</p>
          <p className="text-sm font-semibold text-[#9c3f53]">☆ 4.9 (120)</p>
        </div>
      </div>
      <div className="absolute left-[45%] top-[50%] z-10 flex size-12 items-center justify-center rounded-full border-4 border-white bg-[#9c3f53] text-white shadow-md">
        <Scissors className="size-6" />
      </div>
      <div className="absolute left-[68%] top-[29%] z-10 flex size-7 items-center justify-center rounded-full border-2 border-white bg-[#785a00] text-white shadow-md">
        <Cross className="size-4" />
      </div>
      <div className="absolute left-[62%] top-[62%] z-10 flex size-10 items-center justify-center rounded-full border-2 border-white bg-[#f8f9fa] text-[#554244] shadow-md">
        <Scissors className="size-5" />
      </div>
    </section>
  );
}

export default function DiscoveryPage() {
  return (
    <PetCareShell active="discovery">
      <main className="flex min-h-screen flex-col bg-white md:ml-64 md:flex-row">
        <ListPanel />
        <MapPanel />
      </main>
    </PetCareShell>
  );
}
