"use client";

import { Bell } from "lucide-react";
import Link from "next/link";
import { usePetCare } from "@/components/pet-care/pet-care-provider";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  ALERT_ICON,
  ALERT_ICON_TONE,
  buildCareAlerts,
  hasActiveCareAlerts,
} from "@/lib/pet-data/care-alerts";
import { cn } from "@/lib/utils";

export function NotificationsBell() {
  const { pet } = usePetCare();
  const alerts = pet ? buildCareAlerts(pet) : [];
  const hasActive = hasActiveCareAlerts(alerts);

  return (
    <Popover>
      <PopoverTrigger
        aria-label="Notifications"
        className="relative grid size-10 place-items-center rounded-full bg-muted/80 text-muted-foreground transition-colors hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <Bell className="size-[21px]" />
        {hasActive ? (
          <span className="absolute top-1.5 right-1.5 size-2 rounded-full border-2 border-background bg-primary" />
        ) : null}
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[min(360px,calc(100vw-2rem))] p-0"
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <p className="text-sm font-semibold">AI alerts</p>
          {pet ? (
            <span className="text-xs text-muted-foreground">{pet.name}</span>
          ) : null}
        </div>

        {!pet ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">
            Add a pet profile to start getting personalised AI care alerts.
          </p>
        ) : (
          <ul className="max-h-[min(420px,60vh)] divide-y divide-border overflow-y-auto">
            {alerts.map((alert) => {
              const Icon = ALERT_ICON[alert.level];
              return (
                <li key={alert.id} className="flex gap-3 px-4 py-3">
                  <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-muted">
                    <Icon
                      className={cn("size-4", ALERT_ICON_TONE[alert.level])}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{alert.label}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {alert.message}
                    </p>
                    {alert.cta ? (
                      <Link
                        href={alert.cta.href}
                        className="mt-1.5 inline-block text-sm font-medium text-primary hover:underline"
                      >
                        {alert.cta.text} →
                      </Link>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
