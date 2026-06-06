import { PawPrint } from "lucide-react";
import { cn } from "@/lib/utils";

export function BrandWordmark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      {compact ? (
        <PawPrint className="size-7 shrink-0 text-primary" aria-hidden />
      ) : null}
      <span
        className={cn(
          "font-llp-display font-bold tracking-tight text-foreground",
          compact ? "text-2xl" : "text-3xl md:text-4xl",
        )}
      >
        Little Lovely Pets
        {compact ? (
          <>
            <br />
            <span className="text-muted-foreground text-lg font-semibold">
              Singapore AI care
            </span>
          </>
        ) : (
          <span className="text-muted-foreground font-semibold">
            {" "}
            · Singapore AI care
          </span>
        )}
      </span>
    </div>
  );
}
