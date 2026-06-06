import { ChatBubble, LoadingBubble } from "./chat-bubble";

export type MemeMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  imageUrl?: string;
};

export function MemeChat({
  messages,
  busy,
  error,
  welcomeText,
}: {
  messages: MemeMessage[];
  busy: boolean;
  error: string | null;
  welcomeText: string;
}) {
  return (
    <div className="flex flex-col gap-6">
      <ChatBubble speaker="assistant" content={welcomeText} />
      {messages.map((msg) => (
        <ChatBubble
          key={msg.id}
          speaker={msg.role}
          content={msg.text}
          imageUrl={msg.imageUrl}
        />
      ))}
      {busy && <LoadingBubble />}
      {error && !busy && (
        <div className="mx-auto max-w-2xl rounded-xl border border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          {error}
        </div>
      )}
    </div>
  );
}
