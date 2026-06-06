import { redirect } from "next/navigation";
import { Suspense } from "react";
import { PetCareShell } from "@/components/pet-care/shell";
import { getPetCareContext, getUserPets } from "@/lib/pet-queries";
import { ProfilesScreen } from "./profiles-screen";

function ProfilesSkeleton() {
  return (
    <main className="min-h-0 flex-1 bg-background px-5 pt-8 pb-12 md:px-12">
      <section className="mx-auto max-w-4xl animate-pulse">
        <div className="h-10 w-48 rounded-lg bg-muted" />
        <div className="mt-2 h-5 w-64 rounded bg-muted" />
        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          <div className="h-64 rounded-2xl border border-border bg-card" />
          <div className="h-64 rounded-2xl border border-border bg-card" />
        </div>
      </section>
    </main>
  );
}

async function ProfilesContent() {
  const [pets, ctx] = await Promise.all([getUserPets(), getPetCareContext()]);
  if (pets.length === 0) redirect("/onboarding");

  return <ProfilesScreen pets={pets} activePetId={ctx.pet?.id ?? null} />;
}

export default function ProfilesPage() {
  return (
    <PetCareShell active="profiles">
      <Suspense fallback={<ProfilesSkeleton />}>
        <ProfilesContent />
      </Suspense>
    </PetCareShell>
  );
}
