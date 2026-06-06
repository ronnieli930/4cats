import { ChatBubble, LoadingBubble } from "./chat-bubble";

export function GeneralChat({
  messages,
  busy,
  error,
}: {
  messages: {
    id: string;
    role: string;
    content: string;
    parts?: { type: string; text: string }[];
  }[];
  busy: boolean;
  error: Error | undefined;
}) {
  return (
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
      {busy && messages.at(-1)?.role !== "assistant" && <LoadingBubble />}
      {error && (
        <div className="mx-auto max-w-2xl rounded-xl border border-destructive/30 bg-destructive/10 px-5 py-3 text-sm text-destructive">
          {error.message || "Something went wrong. Please try again."}
        </div>
      )}
    </div>
  );
}
