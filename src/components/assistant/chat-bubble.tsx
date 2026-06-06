import { Sparkles, UserRound } from "lucide-react";
import Image from "next/image";
import { Markdown } from "./markdown";

function AssistantAvatar() {
  return (
    <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/20 shadow-sm ring-1 ring-primary/15">
      <Sparkles className="size-4 text-primary" aria-hidden />
    </div>
  );
}

function UserAvatar() {
  return (
    <div className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#dac0c3]/40 bg-[var(--llp-secondary-container)] shadow-sm">
      <UserRound
        className="size-4 text-[var(--llp-on-secondary-container)]"
        aria-hidden
      />
    </div>
  );
}

export function ChatBubble({
  speaker,
  content,
  imageUrl,
}: {
  speaker: string;
  content: string;
  imageUrl?: string;
}) {
  if (speaker === "assistant") {
    return (
      <div className="flex max-w-[min(100%,42rem)] items-start gap-3">
        <AssistantAvatar />
        <div className="min-w-0 space-y-4 rounded-2xl rounded-tl-md border border-white/60 bg-white/85 p-4 text-base leading-relaxed text-foreground shadow-[0_4px_20px_rgba(29,53,87,0.05)] backdrop-blur-md dark:border-white/10 dark:bg-card/90">
          {content ? <Markdown>{content}</Markdown> : null}
          {imageUrl ? (
            <Image
              alt="Generated meme"
              src={imageUrl}
              width={512}
              height={512}
              unoptimized
              className="max-h-[min(70vh,520px)] w-full max-w-md rounded-xl border border-[#dac0c3]/30 object-contain"
            />
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="ml-auto flex max-w-[min(100%,42rem)] flex-row-reverse items-start gap-3">
      <UserAvatar />
      <div className="min-w-0 space-y-3 rounded-2xl rounded-tr-md bg-gradient-to-br from-[#ffd9dd] to-[#ffb2bd] p-4 text-base leading-relaxed text-[#400013] shadow-[0_4px_15px_rgba(156,63,83,0.15)] dark:from-primary/25 dark:to-primary/40 dark:text-primary-foreground">
        {imageUrl ? (
          <Image
            alt="Your pet"
            src={imageUrl}
            width={400}
            height={400}
            unoptimized
            className="max-h-64 w-full max-w-xs rounded-lg border border-white/40 object-contain"
          />
        ) : null}
        {content ? <Markdown>{content}</Markdown> : null}
      </div>
    </div>
  );
}

export function LoadingBubble() {
  return (
    <div className="flex max-w-[min(100%,42rem)] items-start gap-3">
      <AssistantAvatar />
      <div className="rounded-2xl rounded-tl-md border border-white/60 bg-white/85 px-5 py-4 shadow-[0_4px_20px_rgba(29,53,87,0.05)] backdrop-blur-md dark:border-white/10 dark:bg-card/90">
        <div
          className="size-5 animate-spin rounded-full border-2 border-primary border-t-transparent"
          aria-hidden
        />
      </div>
    </div>
  );
}
