import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

/**
 * Chat-friendly Markdown renderer. Inherits the bubble's text color and keeps
 * spacing compact. Links open in a new tab.
 */
export function Markdown({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "space-y-3 text-base leading-relaxed break-words",
        "[&_p]:m-0",
        "[&_a]:font-medium [&_a]:underline [&_a]:underline-offset-2",
        "[&_ul]:m-0 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5",
        "[&_ol]:m-0 [&_ol]:list-decimal [&_ol]:space-y-1 [&_ol]:pl-5",
        "[&_li]:marker:text-current/60",
        "[&_h1]:mt-1 [&_h1]:mb-1 [&_h1]:text-lg [&_h1]:font-bold",
        "[&_h2]:mt-1 [&_h2]:mb-1 [&_h2]:text-base [&_h2]:font-bold",
        "[&_h3]:mt-1 [&_h3]:mb-1 [&_h3]:text-base [&_h3]:font-semibold",
        "[&_strong]:font-semibold",
        "[&_code]:rounded [&_code]:bg-black/8 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.85em] dark:[&_code]:bg-white/10",
        "[&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-black/8 [&_pre]:p-3 dark:[&_pre]:bg-white/10",
        "[&_pre_code]:bg-transparent [&_pre_code]:p-0",
        "[&_blockquote]:border-l-2 [&_blockquote]:border-current/30 [&_blockquote]:pl-3 [&_blockquote]:italic",
        "[&_table]:block [&_table]:w-full [&_table]:overflow-x-auto [&_table]:text-sm",
        "[&_th]:border [&_th]:border-current/20 [&_th]:px-2 [&_th]:py-1 [&_th]:text-left",
        "[&_td]:border [&_td]:border-current/20 [&_td]:px-2 [&_td]:py-1",
        "[&_hr]:my-3 [&_hr]:border-current/20",
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ node: _node, ...props }) => (
            <a {...props} rel="noopener noreferrer" target="_blank" />
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
