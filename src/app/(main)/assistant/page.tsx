"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import {
  Bot,
  ChevronDown,
  ImagePlus,
  Info,
  Loader2,
  Map as MapIcon,
  SendHorizontal,
  ShoppingBag,
  UserRound,
} from "lucide-react";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { PetCareShell } from "@/components/pet-care/shell";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ASSISTANT_AGENTS, type AssistantAgentId } from "@/lib/agents/registry";
import { mochiPortrait } from "@/lib/pet-data";

const WELCOME_TEXT =
  "Hi there! How is Mochi doing today? I'm ready to help with any grooming, health, or lifestyle questions you have for your Shih Tzu.";

const MEME_WELCOME =
  "I'm the Meme agent. Upload a photo of your pet, add an optional caption or vibe, and I'll generate a meme image using OpenAI image editing.";

type MemeMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  imageUrl?: string;
};

export default function AssistantPage() {
  const [agentId, setAgentId] = useState<AssistantAgentId>("general");
  const [input, setInput] = useState("");
  const [memeMessages, setMemeMessages] = useState<MemeMessage[]>([]);
  const [memeInput, setMemeInput] = useState("");
  const [memeFile, setMemeFile] = useState<File | null>(null);
  const [memeBusy, setMemeBusy] = useState(false);
  const [memeError, setMemeError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const transport = useMemo(
    () => new DefaultChatTransport({ api: "/api/chat" }),
    [],
  );

  const { messages, sendMessage, status, error } = useChat({
    transport,
    messages: [
      {
        id: "welcome",
        role: "assistant",
        content: WELCOME_TEXT,
        parts: [{ type: "text" as const, text: WELCOME_TEXT }],
      },
    ],
  });

  const busy = status === "streaming" || status === "submitted";
  const scrollRef = useRef<HTMLDivElement>(null);

  const lastScrollKey =
    agentId === "general"
      ? messages.at(-1)?.id
      : (memeMessages.at(-1)?.id ?? memeBusy);
  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll when messages change
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [lastScrollKey]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    sendMessage({ text });
  }

  async function handleMemeSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (memeBusy) return;
    if (!memeFile) {
      setMemeError("Please choose a pet photo (PNG, JPEG, or WebP).");
      return;
    }
    setMemeError(null);
    setMemeBusy(true);

    const text =
      memeInput.trim() || "Create a funny, shareable meme featuring my pet.";
    const previewDataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () =>
        reject(reader.error ?? new Error("Failed to read image"));
      reader.readAsDataURL(memeFile);
    });
    const userId = `u-${Date.now()}`;
    setMemeMessages((prev) => [
      ...prev,
      { id: userId, role: "user", text, imageUrl: previewDataUrl },
    ]);

    try {
      const fd = new FormData();
      fd.set("image", memeFile);
      fd.set("message", text);
      const res = await fetch(`/api/agents/meme`, { method: "POST", body: fd });
      const data = (await res.json()) as {
        assistantText?: string;
        memeImageDataUrl?: string;
        toolError?: string;
        error?: string;
      };

      if (!res.ok) {
        throw new Error(data.error || `Request failed (${res.status})`);
      }

      const assistantText =
        data.assistantText ||
        (data.memeImageDataUrl
          ? "Here is your meme."
          : data.toolError || "No image returned.");

      setMemeMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: "assistant",
          text: assistantText,
          imageUrl: data.memeImageDataUrl,
        },
      ]);
      setMemeInput("");
      setMemeFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong.";
      setMemeError(msg);
      setMemeMessages((prev) => [
        ...prev,
        { id: `a-${Date.now()}`, role: "assistant", text: `Sorry — ${msg}` },
      ]);
    } finally {
      setMemeBusy(false);
    }
  }

  return (
    <PetCareShell active="assistant">
      <main className="grid min-h-screen bg-[#f8f9fa] md:ml-64 lg:grid-cols-[1fr_320px]">
        <section className="relative flex h-screen flex-col overflow-hidden bg-[radial-gradient(#dac0c3_1px,transparent_1px)] [background-size:34px_34px]">
          <div className="mx-auto mt-4 flex w-full max-w-4xl flex-col items-center gap-3 px-4 sm:flex-row sm:justify-center">
            <AgentSelector agentId={agentId} onAgentChange={setAgentId} />
          </div>

          <div
            ref={scrollRef}
            className="flex flex-1 flex-col gap-6 overflow-y-auto px-5 py-8 pb-4 md:px-10"
          >
            <div className="mx-auto w-full max-w-4xl">
              <div className="mb-6 text-center">
                <span className="rounded-full bg-[#edeeef] px-5 py-2 text-sm text-[#554244]">
                  Today
                </span>
              </div>

              {agentId === "general" ? (
                <div className="flex flex-col gap-6">
                  {messages.map((msg) => (
                    <ChatBubble
                      key={msg.id}
                      speaker={msg.role}
                      content={
                        msg.parts
                          ?.filter((p) => p.type === "text")
                          .map((p) => p.text)
                          .join("") || msg.content
                      }
                    />
                  ))}

                  {busy && messages.at(-1)?.role !== "assistant" && (
                    <div className="flex items-start gap-4">
                      <BotAvatar />
                      <div className="rounded-2xl bg-white/90 px-6 py-4 shadow-[0_4px_20px_rgba(29,53,87,0.05)] backdrop-blur">
                        <Loader2 className="size-5 animate-spin text-[#9c3f53]" />
                      </div>
                    </div>
                  )}

                  {error && (
                    <div className="mx-auto max-w-2xl rounded-xl border border-red-200 bg-red-50 px-5 py-3 text-sm text-red-700">
                      {error.message ||
                        "Something went wrong. Please try again."}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-6">
                  <ChatBubble speaker="assistant" content={MEME_WELCOME} />
                  {memeMessages.map((msg) => (
                    <ChatBubble
                      key={msg.id}
                      speaker={msg.role}
                      content={msg.text}
                      imageUrl={msg.imageUrl}
                    />
                  ))}
                  {memeBusy && (
                    <div className="flex items-start gap-4">
                      <BotAvatar />
                      <div className="rounded-2xl bg-white/90 px-6 py-4 shadow-[0_4px_20px_rgba(29,53,87,0.05)] backdrop-blur">
                        <Loader2 className="size-5 animate-spin text-[#9c3f53]" />
                      </div>
                    </div>
                  )}
                  {memeError && !memeBusy && (
                    <div className="mx-auto max-w-2xl rounded-xl border border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-900">
                      {memeError}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {agentId === "general" ? (
            <ChatInput
              input={input}
              busy={busy}
              onInputChange={setInput}
              onSubmit={handleSubmit}
            />
          ) : (
            <MemeChatInput
              input={memeInput}
              busy={memeBusy}
              file={memeFile}
              fileInputRef={fileInputRef}
              onInputChange={setMemeInput}
              onFileChange={setMemeFile}
              onSubmit={handleMemeSubmit}
            />
          )}
        </section>

        <ContextSidebar activeAgentId={agentId} />
      </main>
    </PetCareShell>
  );
}

function AgentSelector({
  agentId,
  onAgentChange,
}: {
  agentId: AssistantAgentId;
  onAgentChange: (id: AssistantAgentId) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = ASSISTANT_AGENTS.find((a) => a.id === agentId);

  return (
    <div className="relative w-fit">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-full border border-[#dac0c3]/70 bg-white/80 px-4 py-1.5 text-sm text-[#554244] shadow-sm backdrop-blur transition-colors hover:bg-white"
      >
        Agent: {current?.label ?? agentId}
        <ChevronDown className="size-3.5" />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 w-72 rounded-xl border border-[#dac0c3]/60 bg-white p-1 shadow-lg sm:left-1/2 sm:-translate-x-1/2">
          {ASSISTANT_AGENTS.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => {
                onAgentChange(a.id);
                setOpen(false);
              }}
              className={`w-full rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
                a.id === agentId
                  ? "bg-[#ff8da1]/20 font-medium text-[#782338]"
                  : "text-[#554244] hover:bg-[#f3f4f5]"
              }`}
            >
              <span className="block font-medium">{a.label}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {a.description}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function BotAvatar() {
  return (
    <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#ff8da1] text-[#782338]">
      <Bot className="size-5" />
    </div>
  );
}

function ChatBubble({
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
      <div className="flex items-start gap-4">
        <BotAvatar />
        <div className="max-w-2xl space-y-4 whitespace-pre-wrap rounded-2xl bg-white/90 p-6 text-lg leading-8 shadow-[0_4px_20px_rgba(29,53,87,0.05)] backdrop-blur">
          {content}
          {imageUrl ? (
            <Image
              alt="Generated meme"
              src={imageUrl}
              width={512}
              height={512}
              unoptimized
              className="max-h-[min(70vh,520px)] w-full max-w-md rounded-xl border border-[#dac0c3]/40 object-contain"
            />
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="ml-auto flex max-w-3xl flex-row-reverse items-start gap-4">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#ffd167] text-[#765900]">
        <UserRound className="size-5" />
      </div>
      <div className="space-y-3 rounded-2xl bg-gradient-to-br from-[#ffd9dd] to-[#ff8da1] p-6 text-lg leading-8 text-[#782338] shadow-sm">
        {imageUrl ? (
          <Image
            alt="Your pet"
            src={imageUrl}
            width={400}
            height={400}
            unoptimized
            className="max-h-64 w-full max-w-xs rounded-lg border border-[#782338]/20 object-contain"
          />
        ) : null}
        <p className="whitespace-pre-wrap">{content}</p>
      </div>
    </div>
  );
}

function ChatInput({
  input,
  busy,
  onInputChange,
  onSubmit,
}: {
  input: string;
  busy: boolean;
  onInputChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  return (
    <div className="border-t border-[#dac0c3]/30 bg-gradient-to-t from-[#f8f9fa] via-[#f8f9fa] p-5 md:px-10">
      <form
        onSubmit={onSubmit}
        className="mx-auto flex max-w-4xl items-center gap-4 rounded-full border border-[#dac0c3]/70 bg-white px-5 py-3 shadow-[0_12px_28px_rgba(29,53,87,0.14)]"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          placeholder="Ask about Mochi's health, diet, or local services..."
          className="flex-1 bg-transparent text-[#191c1d] placeholder:text-[#887274] focus:outline-none"
          disabled={busy}
        />
        <Button
          type="submit"
          className="size-11 rounded-full bg-[#9c3f53] disabled:opacity-50"
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

function MemeChatInput({
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
    <div className="border-t border-[#dac0c3]/30 bg-gradient-to-t from-[#f8f9fa] via-[#f8f9fa] p-5 md:px-10">
      <form
        onSubmit={onSubmit}
        className="mx-auto flex max-w-4xl flex-col gap-3 rounded-2xl border border-[#dac0c3]/70 bg-white px-4 py-3 shadow-[0_12px_28px_rgba(29,53,87,0.14)] sm:flex-row sm:items-center"
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
          className="min-w-0 flex-1 bg-transparent py-2 text-[#191c1d] placeholder:text-[#887274] focus:outline-none"
          disabled={busy}
        />
        <Button
          type="submit"
          className="shrink-0 rounded-full bg-[#9c3f53] disabled:opacity-50"
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

function ContextSidebar({
  activeAgentId,
}: {
  activeAgentId: AssistantAgentId;
}) {
  const sources = [
    {
      source: "Google Maps API",
      title: "Heartland Paws Reviews",
      detail:
        '"Absolutely wonderful with my sensitive pup. They used a special medicated shampoo that didn\'t irritate her skin at all...."',
      icon: MapIcon,
    },
    {
      source: "Pet Lovers Centre Data",
      title: "Oatmeal Medicated Shampoo",
      detail:
        "Recommended for Shih Tzus (Age 3+). Alleviates itching and environmental allergies common in humid Singaporean climates.",
      icon: ShoppingBag,
    },
  ];

  const agent = ASSISTANT_AGENTS.find((a) => a.id === activeAgentId);

  return (
    <aside className="hidden border-l border-[#dac0c3]/40 bg-white px-8 py-8 lg:block">
      <h3 className="mb-4 flex items-center gap-3 text-sm font-bold tracking-wide text-[#554244]">
        <Info className="size-5" />
        {activeAgentId === "meme" ? "Meme agent" : "AI context sources"}
      </h3>
      {agent && (
        <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
          <span className="font-medium text-foreground">{agent.label}.</span>{" "}
          {agent.description}
        </p>
      )}
      <div className="mb-6 flex items-center gap-3 rounded-xl border border-[#ffd167] bg-gradient-to-r from-[#ffdf9b]/50 to-white p-3">
        <Avatar className="size-9">
          <AvatarImage alt="Mochi" src={mochiPortrait} />
          <AvatarFallback>M</AvatarFallback>
        </Avatar>
        <div>
          <p className="text-sm font-bold text-[#785a00]">Mochi</p>
          <p className="text-xs text-[#554244]">
            Shih Tzu • 4yo • Sensitive Skin
          </p>
        </div>
      </div>
      {activeAgentId === "meme" ? (
        <div className="rounded-2xl border border-border bg-muted/30 p-4 text-sm leading-relaxed text-muted-foreground">
          <p className="mb-2 font-medium text-foreground">Tips</p>
          <ul className="list-inside list-disc space-y-1">
            <li>Use a clear, well-lit face or body shot of your pet.</li>
            <li>
              Memes are generated with OpenAI image editing (gpt-image-1).
            </li>
            <li>Requires OPENAI_API_KEY on the server.</li>
          </ul>
        </div>
      ) : (
        <div className="grid gap-4">
          {sources.map(({ source, title, detail, icon: Icon }) => (
            <div
              className="rounded-2xl border border-border bg-muted/30 p-4"
              key={title}
            >
              <p className="mb-4 flex items-center gap-2 text-sm">
                <span className="rounded-md bg-primary/15 p-2 text-primary">
                  <Icon className="size-4" />
                </span>
                {source}
              </p>
              <h4 className="mb-2 text-lg font-semibold">{title}</h4>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {detail}
              </p>
            </div>
          ))}
        </div>
      )}
    </aside>
  );
}
