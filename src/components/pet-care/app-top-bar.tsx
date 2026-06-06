"use client";

import { Bell, Search, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { mochiPortrait } from "@/lib/pet-data";
import { cn } from "@/lib/utils";

const ROUTE_META: Record<string, { title: string; sub?: string }> = {
  "/": { title: "Dashboard", sub: "Care summary & reminders" },
  "/assistant": {
    title: "AI Assistant",
    sub: "Profile-aware · grounded in SG data",
  },
  "/discovery": { title: "Local Discovery", sub: "Services near you" },
  "/profiles": { title: "Pet Profiles", sub: "Your lovely pets" },
};

export function AppTopBar() {
  const pathname = usePathname() ?? "/";
  const meta = ROUTE_META[pathname] ?? {
    title: "Little Lovely Pets",
    sub: "Singapore AI care",
  };

  return (
    <header
      className={cn(
        "sticky top-0 z-20 hidden h-[66px] shrink-0 items-center gap-4 border-b border-border px-7 backdrop-blur-[10px] md:flex",
        "bg-background/80",
      )}
    >
      <div className="min-w-0 flex-1 overflow-hidden">
        <h1 className="font-llp-display text-lg font-bold tracking-tight text-foreground truncate">
          {meta.title}
        </h1>
        {meta.sub ? (
          <p className="truncate text-[12.5px] text-muted-foreground">
            {meta.sub}
          </p>
        ) : null}
      </div>
      <div
        className={cn(
          "hidden items-center gap-2 rounded-[999px] border border-border bg-muted/60 py-1.5 pr-3 pl-1.5 lg:flex",
        )}
      >
        <Avatar className="size-7 border border-border/60">
          <AvatarImage
            alt="Active pet"
            className="object-cover"
            src={mochiPortrait}
          />
          <AvatarFallback>M</AvatarFallback>
        </Avatar>
        <span className="text-[13px] font-semibold text-foreground">Mochi</span>
        <span className="hidden text-[12px] text-muted-foreground xl:inline">
          · Shih Tzu
        </span>
      </div>
      <div className="flex flex-1 justify-end gap-2">
        <Link
          className="hidden size-10 place-items-center rounded-full bg-muted/80 text-muted-foreground transition-colors hover:bg-muted lg:grid"
          href="/discovery"
          aria-label="Search"
        >
          <Search className="size-[21px]" />
        </Link>
        <button
          type="button"
          className="relative grid size-10 place-items-center rounded-full bg-muted/80 text-muted-foreground transition-colors hover:bg-muted"
          aria-label="Notifications"
        >
          <Bell className="size-[21px]" />
          <span className="absolute top-1.5 right-1.5 size-2 rounded-full border-2 border-background bg-primary" />
        </button>
        <button
          type="button"
          className="grid size-10 place-items-center rounded-full bg-secondary text-secondary-foreground transition-colors hover:opacity-90"
          aria-label="Account"
        >
          <UserRound className="size-5" />
        </button>
      </div>
    </header>
  );
}
