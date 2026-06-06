"use client";

import { Check, ChevronsUpDown } from "lucide-react";
import { useTransition } from "react";
import { setActivePet } from "@/app/(main)/active-pet-actions";
import { usePetCare } from "@/components/pet-care/pet-care-provider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { petPlaceholderImage } from "@/lib/pet-data";
import type { PetDTO } from "@/lib/pet-queries";
import { cn } from "@/lib/utils";

function kindLabel(pet: PetDTO): string {
  if (pet.breed?.trim()) return pet.breed.trim();
  const s = pet.species.toLowerCase();
  if (s === "dog") return "Dog";
  if (s === "cat") return "Cat";
  return "Small pet";
}

function activeSubtitle(pet: PetDTO): string {
  const place =
    pet.locationLabel?.trim() || pet.locationPostalCode?.trim() || "Singapore";
  return `${kindLabel(pet)} · ${place}`;
}

const SIDEBAR_CARD =
  "flex items-center gap-3 rounded-xl border border-border/60 bg-muted/30 px-2 py-2";
const TOPBAR_PILL =
  "flex items-center gap-2 rounded-[999px] border border-border bg-muted/60 py-1.5 pr-3 pl-1.5";

export function PetSwitcher({
  variant = "sidebar",
}: {
  variant?: "sidebar" | "topbar";
}) {
  const { pet, pets } = usePetCare();
  const [pending, startTransition] = useTransition();

  const name = pet?.name ?? "Pet";
  const avatarSrc =
    pet?.photoUrl || (pet ? petPlaceholderImage(pet.species) : undefined);
  const canSwitch = pets.length > 1;

  const sidebarInner = (
    <>
      <Avatar className="size-10 border-2 border-primary/25">
        <AvatarImage alt={name} className="object-cover" src={avatarSrc} />
        <AvatarFallback>{name.slice(0, 1).toUpperCase()}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1 text-left">
        <p className="truncate text-sm font-bold text-foreground">{name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {pet ? activeSubtitle(pet) : "Add a profile in onboarding"}
        </p>
      </div>
      {canSwitch ? (
        <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
      ) : null}
    </>
  );

  const topbarInner = (
    <>
      <Avatar className="size-7 border border-border/60">
        <AvatarImage alt={name} className="object-cover" src={avatarSrc} />
        <AvatarFallback>{name.slice(0, 1).toUpperCase()}</AvatarFallback>
      </Avatar>
      <span className="text-[13px] font-semibold text-foreground">{name}</span>
      {pet ? (
        <span className="hidden text-[12px] text-muted-foreground xl:inline">
          · {kindLabel(pet)}
        </span>
      ) : null}
      {canSwitch ? (
        <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
      ) : null}
    </>
  );

  const inner = variant === "topbar" ? topbarInner : sidebarInner;
  const cardClass = variant === "topbar" ? TOPBAR_PILL : SIDEBAR_CARD;

  if (!canSwitch) {
    return <div className={cardClass}>{inner}</div>;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={pending}
          className={cn(
            cardClass,
            "cursor-pointer transition-colors hover:bg-muted disabled:opacity-60",
            variant === "sidebar" && "w-full",
          )}
        >
          {inner}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={variant === "topbar" ? "end" : "start"}
        className="min-w-56"
      >
        <DropdownMenuLabel>Switch pet</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {pets.map((p) => (
          <DropdownMenuItem
            key={p.id}
            className="gap-2"
            onSelect={() => {
              if (p.id === pet?.id) return;
              startTransition(() => {
                void setActivePet(p.id);
              });
            }}
          >
            <Avatar className="size-6">
              <AvatarImage
                alt={p.name}
                className="object-cover"
                src={p.photoUrl || petPlaceholderImage(p.species)}
              />
              <AvatarFallback>
                {p.name.slice(0, 1).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="min-w-0 flex-1 truncate">{p.name}</span>
            {p.id === pet?.id ? (
              <Check className="size-4 shrink-0 text-primary" />
            ) : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
