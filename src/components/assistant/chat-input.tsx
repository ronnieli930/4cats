import { ImagePlus, Loader2, Mic, SendHorizontal } from "lucide-react";
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
    <div className="border-t border-[#dac0c3]/30 bg-linear-to-t from-background via-background to-transparent p-5 md:px-10">
      <form
        onSubmit={onSubmit}
        className="mx-auto flex max-w-3xl items-center gap-2 rounded-full border border-[#dac0c3]/50 bg-white/70 px-3 py-1.5 shadow-lg backdrop-blur-md transition-colors focus-within:border-primary dark:bg-card/70"
      >
        <span className="pl-1 text-muted-foreground/50" aria-hidden>
          <Mic className="size-5" />
        </span>
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
          className="size-10 shrink-0 rounded-full bg-primary text-primary-foreground shadow-md transition-transform hover:scale-105 active:scale-95 disabled:opacity-50"
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

export function FoodChatInput({
  input,
  busy,
  file,
  fileInputRef,
  petName,
  onInputChange,
  onFileChange,
  onSubmit,
}: {
  input: string;
  busy: boolean;
  file: File | null;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  petName?: string;
  onInputChange: (value: string) => void;
  onFileChange: (file: File | null) => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  const placeholder = petName
    ? `Ask for ${petName}'s food picks — or just hit send to use their profile...`
    : "Ask for food picks — or add a photo of your pet...";

  return (
    <div className="border-t border-[#dac0c3]/30 bg-gradient-to-t from-background via-background to-transparent p-5 md:px-10">
      <form
        onSubmit={onSubmit}
        className="mx-auto flex max-w-3xl flex-col gap-3 rounded-2xl border border-[#dac0c3]/50 bg-white/70 px-4 py-3 shadow-lg backdrop-blur-md sm:flex-row sm:items-center dark:bg-card/70"
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
          className="shrink-0 border-[#dac0c3]/80"
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
          placeholder={placeholder}
          className="min-w-0 flex-1 bg-transparent py-2 text-foreground placeholder:text-muted-foreground focus:outline-none"
          disabled={busy}
        />
        <Button
          type="submit"
          className="size-10 shrink-0 rounded-full bg-primary text-primary-foreground shadow-md transition-transform hover:scale-105 active:scale-95 disabled:opacity-50"
          size="icon"
          disabled={busy}
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
    <div className="border-t border-[#dac0c3]/30 bg-gradient-to-t from-background via-background to-transparent p-5 md:px-10">
      <form
        onSubmit={onSubmit}
        className="mx-auto flex max-w-4xl flex-col gap-3 rounded-2xl border border-[#dac0c3]/50 bg-white/70 px-4 py-3 shadow-lg backdrop-blur-md sm:flex-row sm:items-center dark:bg-card/70"
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
          className="shrink-0 border-[#dac0c3]/80"
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
          className="shrink-0 rounded-full bg-primary text-primary-foreground shadow-md disabled:opacity-50"
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
