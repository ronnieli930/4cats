import { ImagePlus, Loader2, SendHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ChatInput({
  input,
  busy,
  petName,
  onInputChange,
  onSubmit,
}: {
  input: string;
  busy: boolean;
  petName?: string;
  onInputChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  const placeholder = petName
    ? `Ask about ${petName}'s health, diet, or local services...`
    : "Ask about your pet's health, diet, or local services...";

  return (
    <div className="border-t border-border bg-linear-to-t from-background via-background p-5 md:px-10">
      <form
        onSubmit={onSubmit}
        className="mx-auto flex max-w-4xl items-center gap-4 rounded-full border border-border bg-card px-5 py-3 shadow-md"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          placeholder={placeholder}
          className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none"
          disabled={busy}
        />
        <Button
          type="submit"
          className="size-11 rounded-full disabled:opacity-50"
          size="icon"
          disabled={busy || !input.trim()}
        >
          {busy ? (
            <Loader2 className="size-5 animate-spin" />
          ) : (
            <SendHorizontal className="size-5" />
          )}
        </Button>
      </form>
    </div>
  );
}

export function MemeChatInput({
  input,
  busy,
  file,
  fileInputRef,
  onInputChange,
  onFileChange,
  onSubmit,
}: {
  input: string;
  busy: boolean;
  file: File | null;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onInputChange: (value: string) => void;
  onFileChange: (file: File | null) => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  return (
    <div className="border-t border-border bg-linear-to-t from-background via-background p-5 md:px-10">
      <form
        onSubmit={onSubmit}
        className="mx-auto flex max-w-4xl flex-col gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-md sm:flex-row sm:items-center"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
        />
        <Button
          type="button"
          variant="outline"
          className="shrink-0"
          onClick={() => fileInputRef.current?.click()}
          disabled={busy}
        >
          <ImagePlus className="mr-2 size-4" />
          {file ? "Change photo" : "Pet photo"}
        </Button>
        <input
          type="text"
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          placeholder="Optional: describe the meme (or leave blank for a surprise)..."
          className="min-w-0 flex-1 bg-transparent py-2 text-foreground placeholder:text-muted-foreground focus:outline-none"
          disabled={busy}
        />
        <Button
          type="submit"
          className="shrink-0 rounded-full disabled:opacity-50"
          size="icon"
          disabled={busy || !file}
        >
          {busy ? (
            <Loader2 className="size-5 animate-spin" />
          ) : (
            <SendHorizontal className="size-5" />
          )}
        </Button>
      </form>
    </div>
  );
}
