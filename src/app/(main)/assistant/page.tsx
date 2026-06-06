"use client";

import { ImagePlus, MapPin, Send, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AgentMultiSelect } from "@/components/assistant/agent-multi-select";
import {
  ChatMessageView,
  PendingMessage,
} from "@/components/assistant/chat-message";
import { ContextSidebar } from "@/components/assistant/context-sidebar";
import { SessionsSidebar } from "@/components/assistant/sessions-sidebar";
import { usePetCare } from "@/components/pet-care/pet-care-provider";
import { PetCareShell } from "@/components/pet-care/shell";
import {
  type AssistantAgentId,
  getAssistantAgent,
} from "@/lib/agents/registry";
import type {
  ChatMessageData,
  ChatMessageDTO,
  ChatSessionSummary,
} from "@/lib/chat/types";
import type { FoodProduct, ServicePlaceCard } from "@/lib/pet-data/format";
import { cn } from "@/lib/utils";
import {
  appendChatMessages,
  createChatSession,
  deleteChatSession,
  listChatSessions,
  loadChatSession,
} from "./session-actions";

type RunResult = { content: string; data?: ChatMessageData | null };

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () =>
      reject(reader.error ?? new Error("Failed to read image"));
    reader.readAsDataURL(file);
  });
}

async function runAgent(
  agentId: AssistantAgentId,
  args: {
    text: string;
    file: File | null;
    coords: { lat: number; lng: number } | null;
    history: { role: "user" | "assistant"; content: string }[];
  },
): Promise<RunResult> {
  const { text, file, coords, history } = args;
  try {
    if (agentId === "meme") {
      if (!file) {
        return {
          content: "I need a pet photo to make a meme — attach one and resend.",
          data: { isError: true },
        };
      }
      const fd = new FormData();
      fd.set("image", file);
      fd.set("message", text || "Create a funny, shareable meme of my pet.");
      const res = await fetch("/api/agents/meme", { method: "POST", body: fd });
      const data = (await res.json()) as {
        assistantText?: string;
        memeImageDataUrl?: string;
        toolError?: string;
        error?: string;
      };
      if (!res.ok)
        throw new Error(data.error || `Request failed (${res.status})`);
      return {
        content:
          data.assistantText ||
          (data.memeImageDataUrl
            ? "Here's your meme! 🐾"
            : data.toolError || "No image returned."),
        data: { imageUrl: data.memeImageDataUrl },
      };
    }

    if (agentId === "food") {
      const fd = new FormData();
      fd.set(
        "message",
        text ||
          "Suggest the best food for my pet, with prices and where to buy.",
      );
      if (file) fd.set("image", file);
      const res = await fetch("/api/agents/food", { method: "POST", body: fd });
      const data = (await res.json()) as {
        assistantText?: string;
        products?: FoodProduct[];
        toolError?: string;
        error?: string;
      };
      if (!res.ok)
        throw new Error(data.error || `Request failed (${res.status})`);
      return {
        content:
          data.assistantText ||
          data.toolError ||
          "I couldn't find a good match just now — add a bit more detail.",
        data: { products: data.products },
      };
    }

    if (agentId === "vet") {
      const fd = new FormData();
      fd.set(
        "message",
        text ||
          "My pet isn't feeling well — assess the symptoms and suggest what to do and which vet to see.",
      );
      if (file) fd.set("image", file);
      if (coords) {
        fd.set("lat", String(coords.lat));
        fd.set("lng", String(coords.lng));
      }
      const res = await fetch("/api/agents/vet", { method: "POST", body: fd });
      const data = (await res.json()) as {
        assistantText?: string;
        places?: ServicePlaceCard[];
        toolError?: string;
        error?: string;
      };
      if (!res.ok)
        throw new Error(data.error || `Request failed (${res.status})`);
      return {
        content:
          data.assistantText ||
          data.toolError ||
          "I couldn't assess that just now — try describing the symptoms in a bit more detail.",
        data: { places: data.places },
      };
    }

    if (agentId === "grooming") {
      const res = await fetch("/api/agents/grooming", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          message:
            text || "Suggest the best grooming stores near me for my pet.",
          lat: coords?.lat,
          lng: coords?.lng,
        }),
      });
      const data = (await res.json()) as {
        assistantText?: string;
        places?: ServicePlaceCard[];
        toolError?: string;
        error?: string;
      };
      if (!res.ok)
        throw new Error(data.error || `Request failed (${res.status})`);
      return {
        content:
          data.assistantText ||
          data.toolError ||
          "I couldn't find a good match just now — try sharing your location.",
        data: { places: data.places },
      };
    }

    // general
    const res = await fetch("/api/agents/general", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        message: text || "Share a helpful care tip for my pet today.",
        history,
      }),
    });
    const data = (await res.json()) as {
      assistantText?: string;
      error?: string;
    };
    if (!res.ok)
      throw new Error(data.error || `Request failed (${res.status})`);
    return {
      content: data.assistantText || "I'm not sure how to help with that yet.",
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Something went wrong.";
    return { content: `Sorry — ${msg}`, data: { isError: true } };
  }
}

export default function AssistantPage() {
  const { pet } = usePetCare();

  const [sessions, setSessions] = useState<ChatSessionSummary[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessageDTO[]>([]);
  const [loadingSession, setLoadingSession] = useState(false);
  const [creating, setCreating] = useState(false);

  const [selectedAgents, setSelectedAgents] = useState<AssistantAgentId[]>([
    "general",
  ]);
  const [input, setInput] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    null,
  );
  const [locating, setLocating] = useState(false);
  const [pendingAgents, setPendingAgents] = useState<AssistantAgentId[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load session list on mount and open the most recent one.
  useEffect(() => {
    let active = true;
    (async () => {
      const list = await listChatSessions();
      if (!active) return;
      setSessions(list);
      if (list.length > 0) {
        setLoadingSession(true);
        setSessionId(list[0].id);
        const msgs = await loadChatSession(list[0].id);
        if (active) {
          setMessages(msgs ?? []);
          setLoadingSession(false);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const scrollKey = `${messages.length}-${pendingAgents.length}-${sessionId}`;
  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll when transcript changes
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [scrollKey]);

  async function openSession(id: string) {
    if (id === sessionId || busy) return;
    setLoadingSession(true);
    setSessionId(id);
    setError(null);
    const msgs = await loadChatSession(id);
    setMessages(msgs ?? []);
    setLoadingSession(false);
  }

  async function handleNewChat() {
    if (busy) return;
    setCreating(true);
    const s = await createChatSession();
    setCreating(false);
    if (!s) {
      setError("Couldn't start a new chat. Please sign in again.");
      return;
    }
    setSessions((prev) => [s, ...prev]);
    setSessionId(s.id);
    setMessages([]);
    setError(null);
  }

  async function handleDeleteSession(id: string) {
    const ok = await deleteChatSession(id);
    if (!ok) return;
    setSessions((prev) => prev.filter((s) => s.id !== id));
    if (id === sessionId) {
      setSessionId(null);
      setMessages([]);
    }
  }

  function toggleAgent(id: AssistantAgentId) {
    setSelectedAgents((prev) => {
      if (prev.includes(id)) {
        return prev.length > 1 ? prev.filter((a) => a !== id) : prev;
      }
      return [...prev, id];
    });
  }

  function handleUseLocation() {
    if (!("geolocation" in navigator)) {
      setError("Location isn't available in this browser.");
      return;
    }
    setError(null);
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
      },
      () => {
        setLocating(false);
        setError(
          "Couldn't get your location — I'll use your pet's saved area instead.",
        );
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const text = input.trim();
    const attached = file;
    if (!text && !attached) return;
    if (
      selectedAgents.includes("meme") &&
      !attached &&
      selectedAgents.length === 1
    ) {
      setError("The Meme agent needs a pet photo — attach one to continue.");
      return;
    }

    setError(null);

    // Ensure a session exists.
    let sid = sessionId;
    if (!sid) {
      const s = await createChatSession();
      if (!s) {
        setError("Couldn't start a chat. Please sign in again.");
        return;
      }
      setSessions((prev) => [s, ...prev]);
      setSessionId(s.id);
      sid = s.id;
    }

    let previewDataUrl: string | undefined;
    if (attached) {
      try {
        previewDataUrl = await readAsDataUrl(attached);
      } catch {
        previewDataUrl = undefined;
      }
    }

    const now = Date.now();
    const userMsg: ChatMessageDTO = {
      id: `u-${now}`,
      role: "user",
      agentId: "user",
      content: text,
      data: previewDataUrl ? { imageUrl: previewDataUrl } : null,
      createdAt: new Date(now).toISOString(),
    };

    const history = messages
      .filter((m) => m.content.trim())
      .map((m) => ({
        role: m.role,
        content: m.content,
      }));

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";

    const agents = [...selectedAgents];
    setBusy(true);
    setPendingAgents(agents);

    const collected: ChatMessageDTO[] = [];
    await Promise.all(
      agents.map(async (agentId) => {
        const result = await runAgent(agentId, {
          text,
          file: attached,
          coords,
          history,
        });
        const assistantMsg: ChatMessageDTO = {
          id: `a-${agentId}-${Date.now()}`,
          role: "assistant",
          agentId,
          content: result.content,
          data: result.data ?? null,
          createdAt: new Date().toISOString(),
        };
        collected.push(assistantMsg);
        setMessages((prev) => [...prev, assistantMsg]);
        setPendingAgents((prev) => prev.filter((a) => a !== agentId));
      }),
    );

    setBusy(false);
    setPendingAgents([]);

    // Persist the exchange, then refresh the session list (title + ordering).
    try {
      await appendChatMessages(sid, [
        {
          role: "user",
          agentId: "user",
          content: text,
          data: userMsg.data,
        },
        ...collected.map((m) => ({
          role: m.role,
          agentId: m.agentId,
          content: m.content,
          data: m.data,
        })),
      ]);
      const list = await listChatSessions();
      setSessions(list);
    } catch {
      /* persistence is best-effort; live transcript already shown */
    }
  }

  const showsPhoto =
    selectedAgents.includes("food") ||
    selectedAgents.includes("meme") ||
    selectedAgents.includes("vet");
  const showsLocation =
    selectedAgents.includes("grooming") || selectedAgents.includes("vet");
  const isEmpty = messages.length === 0 && pendingAgents.length === 0;
  const activeAgentId = selectedAgents[0] ?? "general";

  return (
    <PetCareShell active="assistant" lockViewport>
      <main className="flex min-h-0 flex-1 overflow-hidden bg-background">
        <SessionsSidebar
          activeId={sessionId}
          creating={creating}
          onDelete={handleDeleteSession}
          onNew={handleNewChat}
          onSelect={openSession}
          sessions={sessions}
        />

        <section className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-[radial-gradient(var(--color-border)_1px,transparent_1px)] bg-size-[34px_34px]">
          <div
            className="flex flex-1 flex-col gap-6 overflow-y-auto px-5 py-8 pb-4 md:px-10"
            ref={scrollRef}
          >
            <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6">
              {loadingSession ? (
                <p className="m-auto text-sm text-muted-foreground">
                  Loading conversation…
                </p>
              ) : isEmpty ? (
                <div className="m-auto max-w-md text-center">
                  <h2 className="font-llp-display text-2xl font-bold text-foreground">
                    {pet
                      ? `How can I help ${pet.name} today?`
                      : "How can I help?"}
                  </h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Pick one or more agents below, then ask away. Choose several
                    to delegate the same request to each of them.
                  </p>
                </div>
              ) : (
                <>
                  {messages.map((m) => (
                    <ChatMessageView key={m.id} message={m} />
                  ))}
                  {pendingAgents.map((a) => (
                    <PendingMessage
                      agentLabel={getAssistantAgent(a)?.label}
                      key={`pending-${a}`}
                    />
                  ))}
                </>
              )}
            </div>
          </div>

          <div className="border-t border-border/60 bg-background/80 backdrop-blur-md">
            <form
              className="mx-auto flex w-full max-w-4xl flex-col gap-3 px-4 py-4 md:px-6"
              onSubmit={handleSend}
            >
              <AgentMultiSelect
                onToggle={toggleAgent}
                selected={selectedAgents}
              />

              {error ? (
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
                  {error}
                </p>
              ) : null}

              {file ? (
                <div className="flex items-center gap-2 self-start rounded-full border border-border bg-card px-3 py-1.5 text-sm">
                  <ImagePlus className="size-4 text-primary" />
                  <span className="max-w-[16rem] truncate">{file.name}</span>
                  <button
                    aria-label="Remove photo"
                    className="rounded-full p-0.5 text-muted-foreground hover:text-destructive"
                    onClick={() => {
                      setFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                    type="button"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ) : null}

              <div className="flex items-end gap-2 rounded-3xl border border-border bg-card/90 p-2 shadow-[var(--llp-sh-1)] backdrop-blur-md">
                {showsPhoto ? (
                  <label
                    className={cn(
                      "grid size-10 shrink-0 cursor-pointer place-items-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:bg-muted",
                      file && "border-primary text-primary",
                    )}
                    title="Attach a pet photo"
                  >
                    <ImagePlus className="size-5" />
                    <input
                      accept="image/png,image/jpeg,image/webp"
                      className="sr-only"
                      onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                      ref={fileInputRef}
                      type="file"
                    />
                  </label>
                ) : null}

                {showsLocation ? (
                  <button
                    className={cn(
                      "inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-border bg-card px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted",
                      coords && "border-primary text-primary",
                    )}
                    disabled={locating}
                    onClick={handleUseLocation}
                    type="button"
                  >
                    {locating ? (
                      <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    ) : (
                      <MapPin className="size-4" />
                    )}
                    {coords ? "Location set" : "Use my location"}
                  </button>
                ) : null}

                <textarea
                  className="max-h-40 min-h-10 flex-1 resize-none bg-transparent px-3 py-2 text-base outline-none placeholder:text-muted-foreground"
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void handleSend(e);
                    }
                  }}
                  placeholder={
                    pet
                      ? `Message your agents about ${pet.name}…`
                      : "Message your agents…"
                  }
                  rows={1}
                  value={input}
                />

                <button
                  aria-label="Send"
                  className="grid size-10 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground shadow-sm transition-transform hover:scale-105 active:scale-95 disabled:opacity-50"
                  disabled={busy || (!input.trim() && !file)}
                  type="submit"
                >
                  <Send className="size-5" />
                </button>
              </div>
            </form>
          </div>
        </section>

        <ContextSidebar activeAgentId={activeAgentId} />
      </main>
    </PetCareShell>
  );
}
