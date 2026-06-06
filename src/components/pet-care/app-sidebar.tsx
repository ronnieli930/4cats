"use client";

import { CalendarDays, HelpCircle, Settings } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { ModeToggle } from "@/components/mode-toggle";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  beaglePortrait,
  navItems,
  petPortrait,
  type Section,
} from "@/lib/pet-data";
import { cn } from "@/lib/utils";
import { BrandMascot } from "./mascot";
import { SignOutButton } from "./sign-out-button";

function SidebarGrip({
  onMouseDown,
}: {
  onMouseDown: (e: React.MouseEvent) => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      aria-label="Resize sidebar"
      onMouseDown={onMouseDown}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="absolute top-0 right-[-5px] z-30 flex h-full w-2.5 cursor-col-resize items-center justify-center border-0 bg-transparent p-0"
    >
      <span
        className={cn(
          "block h-11 w-1 rounded-full transition-all",
          hover ? "bg-primary opacity-100" : "bg-border opacity-70",
        )}
      />
    </button>
  );
}

export function SidebarContent({
  active,
  onNavigate,
  variant = "rail",
}: {
  active: Section;
  onNavigate?: () => void;
  variant?: "rail" | "drawer";
}) {
  return (
    <>
      <div
        className={cn(
          "flex flex-col border-b border-sidebar-border px-1 py-6",
          variant === "drawer" ? "items-center text-center" : "items-stretch",
        )}
      >
        <div className="flex items-center gap-3 px-1 pb-3">
          <BrandMascot size={42} />
          <div className="min-w-0 text-left">
            <p className="font-llp-display text-base font-bold tracking-tight text-primary leading-tight">
              Little Lovely Pets
            </p>
            <p className="text-[11px] font-medium text-muted-foreground">
              Singapore AI care
            </p>
          </div>
        </div>

        <div className="mt-1 flex items-center gap-3 rounded-xl border border-border/60 bg-muted/30 px-2 py-2">
          <Avatar className="size-10 border-2 border-primary/25">
            <AvatarImage
              alt="Active pet"
              className="object-cover"
              src={
                active === "discovery" || active === "profiles"
                  ? beaglePortrait
                  : petPortrait
              }
            />
            <AvatarFallback>P</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1 text-left">
            <p className="truncate text-sm font-bold text-foreground">Mochi</p>
            <p className="truncate text-xs text-muted-foreground">
              Shih Tzu · Singapore
            </p>
          </div>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-2 py-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          const selected = active === item.id;
          return (
            <Link
              className={cn(
                "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-semibold transition-all",
                selected
                  ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-[0_8px_18px_rgba(120,35,56,0.2)]"
                  : "text-sidebar-foreground/90 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                selected && "translate-x-0.5",
              )}
              href={item.href}
              key={item.id}
              onClick={onNavigate}
            >
              <Icon className={cn("size-5", selected && "opacity-95")} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto space-y-3 border-t border-sidebar-border p-3">
        <Button
          className="h-10 w-full rounded-2xl bg-[var(--llp-tertiary)] font-semibold text-white shadow-md hover:bg-[var(--llp-tertiary)]/90 dark:bg-secondary dark:text-secondary-foreground dark:hover:bg-secondary/90"
          size="sm"
          asChild
        >
          <Link href="/discovery" onClick={onNavigate}>
            <CalendarDays className="size-4" />
            Book vet
          </Link>
        </Button>
        <div className="flex items-center justify-between rounded-xl border border-border/60 bg-card/50 px-2 py-1">
          <span className="px-2 text-xs font-medium text-muted-foreground">
            Theme
          </span>
          <ModeToggle />
        </div>
        <div className="grid gap-0.5">
          <button
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            type="button"
          >
            <Settings className="size-4" />
            Settings
          </button>
          <button
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            type="button"
          >
            <HelpCircle className="size-4" />
            Support
          </button>
          <SignOutButton onSignOut={onNavigate} />
        </div>
      </div>
    </>
  );
}

export function AppSidebar({
  active,
  sidebarWidth,
  onGripMouseDown,
}: {
  active: Section;
  sidebarWidth: number;
  onGripMouseDown: (e: React.MouseEvent) => void;
}) {
  return (
    <aside
      className="fixed top-0 left-0 z-30 hidden h-screen flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex"
      style={{
        width: sidebarWidth,
        boxShadow: "var(--llp-sh-1)",
      }}
    >
      <div className="relative flex h-full min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden px-3.5 pb-3.5 pt-[18px]">
        <SidebarContent active={active} variant="rail" />
        <SidebarGrip onMouseDown={onGripMouseDown} />
      </div>
    </aside>
  );
}
