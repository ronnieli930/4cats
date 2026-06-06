/**
 * Agent catalog for the AI Assistant tab. Metadata only — safe to import from client components.
 * Server-side agent definitions live next to this file (e.g. `meme-agent.ts`).
 */
export const ASSISTANT_AGENTS = [
  {
    id: "general",
    label: "Pet assistant",
    description: "Health, grooming, and lifestyle Q&A for your pet.",
    kind: "chat" as const,
  },
  {
    id: "food",
    label: "Food finder",
    description:
      "Grounded food picks for your pet — with prices and where to buy.",
    kind: "food" as const,
  },
  {
    id: "grooming",
    label: "Grooming finder",
    description: "Find grooming stores near you, matched to your pet.",
    kind: "grooming" as const,
  },
  {
    id: "vet",
    label: "Vet finder",
    description:
      "Describe symptoms or add a photo — get triage advice and nearby vets.",
    kind: "vet" as const,
  },
  {
    id: "meme",
    label: "Meme agent",
    description: "Upload a pet photo and get a generated meme image.",
    kind: "meme" as const,
  },
] as const;

export type AssistantAgentId = (typeof ASSISTANT_AGENTS)[number]["id"];
export type AssistantAgentKind = (typeof ASSISTANT_AGENTS)[number]["kind"];

export function getAssistantAgent(id: string) {
  return ASSISTANT_AGENTS.find((a) => a.id === id);
}
