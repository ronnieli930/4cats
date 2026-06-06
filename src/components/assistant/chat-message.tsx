import {
  ExternalLink,
  type LucideIcon,
  MapPin,
  Navigation,
  Phone,
  Scissors,
  ShoppingBag,
  Sparkles,
  Star,
  Stethoscope,
  UserRound,
} from "lucide-react";
import Image from "next/image";
import { getAssistantAgent } from "@/lib/agents/registry";
import type { ChatMessageDTO } from "@/lib/chat/types";
import type { FoodProduct, ServicePlaceCard } from "@/lib/pet-data/format";
import { Markdown } from "./markdown";

function ProductCard({ product }: { product: FoodProduct }) {
  const tags = [product.petType, product.productType].filter(Boolean);
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4 shadow-[var(--llp-sh-1)]">
      <div className="flex items-start gap-2">
        <div className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/12 text-primary">
          <ShoppingBag className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          {product.brand ? (
            <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-primary">
              {product.brand}
            </div>
          ) : null}
          <div className="font-semibold leading-snug text-foreground">
            {product.title}
          </div>
        </div>
      </div>
      {tags.length ? (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((t) => (
            <span
              className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground"
              key={t}
            >
              {t}
            </span>
          ))}
        </div>
      ) : null}
      <div className="mt-1 flex items-center justify-between gap-3">
        <span className="font-llp-display text-lg font-bold text-foreground">
          {product.priceLabel ?? "Price varies"}
        </span>
        {product.url ? (
          <a
            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground shadow-sm transition-transform hover:scale-[1.03] active:scale-95"
            href={product.url}
            rel="noopener noreferrer"
            target="_blank"
          >
            Buy
            <ExternalLink className="size-3.5" />
          </a>
        ) : null}
      </div>
    </div>
  );
}

function StoreCard({
  place,
  icon: Icon = Scissors,
}: {
  place: ServicePlaceCard;
  icon?: LucideIcon;
}) {
  const tags = place.tags.slice(0, 3);
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4 shadow-[var(--llp-sh-1)]">
      <div className="flex items-start gap-2">
        <div className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/12 text-primary">
          <Icon className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-semibold leading-snug text-foreground">
            {place.name}
          </div>
          {place.address ? (
            <div className="truncate text-xs text-muted-foreground">
              {place.address}
            </div>
          ) : null}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        {place.rating != null ? (
          <span className="inline-flex items-center gap-1 font-semibold text-foreground">
            <Star className="size-3.5 fill-amber-400 text-amber-400" />
            {place.rating.toFixed(1)}
            {place.reviewCount != null ? (
              <span className="font-normal text-muted-foreground">
                ({place.reviewCount})
              </span>
            ) : null}
          </span>
        ) : null}
        <span className="inline-flex items-center gap-1 text-muted-foreground">
          <MapPin className="size-3.5" />
          {place.distanceKm} km away
        </span>
      </div>
      {tags.length ? (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((t) => (
            <span
              className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground"
              key={t}
            >
              {t}
            </span>
          ))}
        </div>
      ) : null}
      <div className="mt-1 flex flex-wrap gap-2">
        {place.phone ? (
          <a
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
            href={`tel:${place.phone}`}
          >
            <Phone className="size-3.5" />
            Call
          </a>
        ) : null}
        {place.googleMapsUrl ? (
          <a
            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm transition-transform hover:scale-[1.03] active:scale-95"
            href={place.googleMapsUrl}
            rel="noopener noreferrer"
            target="_blank"
          >
            <Navigation className="size-3.5" />
            Directions
          </a>
        ) : null}
        {place.websiteUrl ? (
          <a
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
            href={place.websiteUrl}
            rel="noopener noreferrer"
            target="_blank"
          >
            Website
          </a>
        ) : null}
      </div>
    </div>
  );
}

function AssistantAvatar() {
  return (
    <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/20 shadow-sm ring-1 ring-primary/15">
      <Sparkles aria-hidden className="size-4 text-primary" />
    </div>
  );
}

function UserAvatar() {
  return (
    <div className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#dac0c3]/40 bg-[var(--llp-secondary-container)] shadow-sm">
      <UserRound
        aria-hidden
        className="size-4 text-[var(--llp-on-secondary-container)]"
      />
    </div>
  );
}

export function ChatMessageView({ message }: { message: ChatMessageDTO }) {
  const data = message.data ?? undefined;

  if (message.role === "user") {
    return (
      <div className="ml-auto flex max-w-[min(100%,42rem)] flex-row-reverse items-start gap-3">
        <UserAvatar />
        <div className="min-w-0 space-y-3 rounded-2xl rounded-tr-md bg-gradient-to-br from-[#ffd9dd] to-[#ffb2bd] p-4 text-base leading-relaxed text-[#400013] shadow-[0_4px_15px_rgba(156,63,83,0.15)] dark:from-primary/25 dark:to-primary/40 dark:text-primary-foreground">
          {data?.imageUrl ? (
            <Image
              alt="Your pet"
              className="max-h-64 w-full max-w-xs rounded-lg border border-white/40 object-contain"
              height={400}
              src={data.imageUrl}
              unoptimized
              width={400}
            />
          ) : null}
          {message.content ? <Markdown>{message.content}</Markdown> : null}
        </div>
      </div>
    );
  }

  const agentLabel = getAssistantAgent(message.agentId)?.label;

  return (
    <div className="flex max-w-[min(100%,46rem)] flex-col gap-3">
      <div className="flex items-start gap-3">
        <AssistantAvatar />
        <div
          className={`min-w-0 space-y-3 rounded-2xl rounded-tl-md border p-4 text-base leading-relaxed shadow-[0_4px_20px_rgba(29,53,87,0.05)] backdrop-blur-md ${
            data?.isError
              ? "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200"
              : "border-white/60 bg-white/85 text-foreground dark:border-white/10 dark:bg-card/90"
          }`}
        >
          {agentLabel ? (
            <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
              {agentLabel}
            </span>
          ) : null}
          {message.content ? <Markdown>{message.content}</Markdown> : null}
          {data?.imageUrl ? (
            <Image
              alt="Generated meme"
              className="max-h-[min(70vh,520px)] w-full max-w-md rounded-xl border border-[#dac0c3]/30 object-contain"
              height={512}
              src={data.imageUrl}
              unoptimized
              width={512}
            />
          ) : null}
        </div>
      </div>

      {data?.products && data.products.length > 0 ? (
        <div className="ml-11 grid gap-3 sm:grid-cols-2">
          {data.products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      ) : null}

      {data?.places && data.places.length > 0 ? (
        <div className="ml-11 grid gap-3 sm:grid-cols-2">
          {data.places.map((p) => (
            <StoreCard
              icon={message.agentId === "vet" ? Stethoscope : Scissors}
              key={p.id}
              place={p}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function PendingMessage({ agentLabel }: { agentLabel?: string }) {
  return (
    <div className="flex max-w-[min(100%,46rem)] items-start gap-3">
      <AssistantAvatar />
      <div className="flex items-center gap-3 rounded-2xl rounded-tl-md border border-white/60 bg-white/85 px-5 py-4 shadow-[0_4px_20px_rgba(29,53,87,0.05)] backdrop-blur-md dark:border-white/10 dark:bg-card/90">
        <div
          aria-hidden
          className="size-5 animate-spin rounded-full border-2 border-primary border-t-transparent"
        />
        {agentLabel ? (
          <span className="text-sm text-muted-foreground">
            {agentLabel} is thinking…
          </span>
        ) : null}
      </div>
    </div>
  );
}
