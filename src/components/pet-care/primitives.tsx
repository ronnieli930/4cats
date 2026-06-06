import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function Pill({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Badge
      variant="secondary"
      className={cn(
        "inline-flex items-center gap-1 rounded-full border-0 px-3 py-1 text-xs font-medium",
        className,
      )}
    >
      {children}
    </Badge>
  );
}

export function FadeContent({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <div
      className={cn("rb-fade-content", className)}
      style={{ animationDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

export function AnimatedList({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("rb-animated-list", className)}>{children}</div>;
}

export function SpotlightCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card
      className={cn(
        "llp-card-in rb-spotlight-card rounded-2xl border-border/80 bg-card py-0 shadow-sm",
        className,
      )}
    >
      {children}
    </Card>
  );
}

export function ShinyText({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <span className={cn("rb-shiny-text", className)}>{children}</span>;
}
