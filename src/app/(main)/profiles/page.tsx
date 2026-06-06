import { ArrowLeft, ArrowRight, Camera, Filter, PawPrint } from "lucide-react";
import Link from "next/link";
import { BrandWordmark } from "@/components/pet-care/brand-wordmark";
import { SpotlightCard } from "@/components/pet-care/primitives";
import { PetCareShell } from "@/components/pet-care/shell";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { uploadDog } from "@/lib/pet-data";

export default function ProfilesPage() {
  return (
    <PetCareShell active="profiles">
      <main className="flex min-h-0 flex-1 flex-col bg-background">
        <header className="sticky top-0 z-20 flex h-16 w-full items-center justify-between border-b border-border bg-background/80 px-5 shadow-sm backdrop-blur-md md:px-10">
          <div className="flex items-center gap-3">
            <Link aria-label="Back to dashboard" href="/">
              <ArrowLeft className="size-6 text-muted-foreground" />
            </Link>
            <BrandWordmark />
          </div>
          <span className="text-lg text-muted-foreground">Setup</span>
        </header>

        <section className="mx-auto max-w-5xl px-5 py-10">
          <div className="mb-12 text-center">
            <h2 className="text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
              Let&apos;s meet your furry friend
            </h2>
            <p className="mt-3 text-xl text-muted-foreground">
              Tell us a bit about them so we can tailor the best care in
              Singapore.
            </p>
            <div className="mx-auto mt-8 max-w-xl">
              <div className="mb-3 flex justify-between text-sm">
                <span className="font-semibold text-primary">Basic Info</span>
                <span className="text-muted-foreground">Vitals</span>
                <span className="text-muted-foreground">Health</span>
                <span className="text-muted-foreground">Location</span>
              </div>
              <Progress
                className="h-2 bg-muted [&_[data-slot=progress-indicator]]:bg-primary"
                value={25}
              />
            </div>
          </div>

          <SpotlightCard>
            <CardContent className="p-6 md:p-12">
              <div className="grid gap-8 md:grid-cols-2">
                <div className="grid gap-7">
                  <button
                    className="relative flex h-60 flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-border bg-muted/50"
                    type="button"
                  >
                    <img
                      alt="Upload pet"
                      className="absolute inset-0 size-full object-cover opacity-35"
                      src={uploadDog}
                    />
                    <div className="relative flex flex-col items-center">
                      <span className="mb-3 rounded-full bg-card p-4 text-primary shadow-sm">
                        <Camera className="size-7" />
                      </span>
                      <span className="font-semibold">Upload Photo</span>
                      <span className="text-sm text-muted-foreground">
                        Show off that cute face
                      </span>
                    </div>
                  </button>
                  <div className="grid gap-2">
                    <Label className="font-semibold" htmlFor="pet-name">
                      Pet&apos;s Name
                    </Label>
                    <Input
                      id="pet-name"
                      className="h-14 rounded-xl text-lg"
                      placeholder="e.g., Milo"
                    />
                  </div>
                </div>

                <div className="grid content-start gap-7">
                  <div>
                    <p className="mb-2 font-semibold">Species</p>
                    <div className="grid grid-cols-2 gap-4">
                      <button
                        className="rounded-2xl border-2 border-primary bg-primary/10 p-8 text-center font-semibold"
                        type="button"
                      >
                        <PawPrint className="mx-auto mb-3 size-9" />
                        Dog
                      </button>
                      <button
                        className="rounded-2xl bg-muted/70 p-8 text-center font-semibold"
                        type="button"
                      >
                        <PawPrint className="mx-auto mb-3 size-9 opacity-80" />
                        Cat
                      </button>
                    </div>
                  </div>
                  <div className="grid gap-2 font-semibold">
                    <span>Breed</span>
                    <div className="flex h-16 items-center justify-between rounded-xl border border-border bg-muted/40 px-5 text-lg">
                      Select breed...
                      <Filter className="size-5 text-muted-foreground" />
                    </div>
                    <span className="text-sm font-normal text-muted-foreground">
                      Selecting &quot;Singapore Special&quot; helps us tailor
                      local HDB guidelines.
                    </span>
                  </div>
                </div>
              </div>
              <div className="mt-12 flex justify-end border-t border-border pt-8">
                <Button className="h-12 gap-2 px-8 text-base" size="lg">
                  Next: Vitals
                  <ArrowRight className="size-5" />
                </Button>
              </div>
            </CardContent>
          </SpotlightCard>
        </section>
      </main>
    </PetCareShell>
  );
}
