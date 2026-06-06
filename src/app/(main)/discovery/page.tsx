import { redirect } from "next/navigation";
import { Suspense } from "react";
import { PetCareShell } from "@/components/pet-care/shell";
import { getDiscoveryData } from "@/lib/discovery-queries";
import { getPetCareContext } from "@/lib/pet-queries";
import { DiscoveryView } from "./discovery-view";

function DiscoverySkeleton() {
  return (
    <main className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background md:flex-row">
      <section className="flex min-h-0 w-full animate-pulse flex-col border-r border-border bg-card md:w-[460px] md:shrink-0">
        <div className="shrink-0 border-b border-border p-5 md:p-7">
          <div className="h-8 w-48 rounded-lg bg-muted" />
          <div className="mt-2 h-5 w-36 rounded bg-muted" />
          <div className="mt-4 h-11 rounded-xl bg-muted" />
          <div className="mt-4 flex gap-2">
            <div className="h-10 w-28 rounded-full bg-muted" />
            <div className="h-10 w-20 rounded-full bg-muted" />
            <div className="h-10 w-20 rounded-full bg-muted" />
          </div>
        </div>
        <div className="flex-1 space-y-3 p-5 md:p-7">
          <div className="h-24 rounded-2xl border border-border bg-muted/30" />
          <div className="h-24 rounded-2xl border border-border bg-muted/30" />
          <div className="h-24 rounded-2xl border border-border bg-muted/30" />
          <div className="h-24 rounded-2xl border border-border bg-muted/30" />
        </div>
      </section>
      <section className="relative min-h-0 flex-1 bg-muted/20" />
    </main>
  );
}

async function DiscoveryContent() {
  const { pet } = await getPetCareContext();
  if (!pet) redirect("/onboarding");

  const data = await getDiscoveryData(pet);

  return (
    <DiscoveryView
      data={data}
      pet={{
        name: pet.name,
        species: pet.species,
        medicalConditions: pet.medicalConditions,
      }}
    />
  );
}

export default function DiscoveryPage() {
  return (
    <PetCareShell active="discovery">
      <Suspense fallback={<DiscoverySkeleton />}>
        <DiscoveryContent />
      </Suspense>
    </PetCareShell>
  );
}
