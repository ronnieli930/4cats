import { ExternalLink, ShoppingBag } from "lucide-react";
import type { FoodProduct } from "@/lib/pet-data/format";
import { ChatBubble, LoadingBubble } from "./chat-bubble";

export type FoodMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  imageUrl?: string;
  products?: FoodProduct[];
};

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
          {product.available === false ? (
            <span className="rounded-full bg-[var(--llp-secondary-container)] px-2.5 py-0.5 text-xs font-medium text-[var(--llp-on-secondary-container)]">
              Out of stock
            </span>
          ) : null}
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

function FoodAssistantMessage({ message }: { message: FoodMessage }) {
  return (
    <div className="flex flex-col gap-3">
      <ChatBubble speaker="assistant" content={message.text} />
      {message.products && message.products.length > 0 ? (
        <div className="ml-11 grid gap-3 sm:grid-cols-2">
          {message.products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function FoodChat({
  messages,
  busy,
  error,
  welcomeText,
}: {
  messages: FoodMessage[];
  busy: boolean;
  error: string | null;
  welcomeText: string;
}) {
  return (
    <div className="flex flex-col gap-6">
      <ChatBubble speaker="assistant" content={welcomeText} />
      {messages.map((msg) =>
        msg.role === "assistant" ? (
          <FoodAssistantMessage key={msg.id} message={msg} />
        ) : (
          <ChatBubble
            content={msg.text}
            imageUrl={msg.imageUrl}
            key={msg.id}
            speaker="user"
          />
        ),
      )}
      {busy && <LoadingBubble />}
      {error && !busy && (
        <div className="mx-auto max-w-2xl rounded-xl border border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          {error}
        </div>
      )}
    </div>
  );
}
