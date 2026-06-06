"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export function SignOutButton({
  onSignOut,
  className,
}: {
  onSignOut?: () => void;
  className?: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleSignOut() {
    setPending(true);
    onSignOut?.();
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
    setPending(false);
  }

  return (
    <button
      className={cn(
        "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground disabled:opacity-50",
        className,
      )}
      disabled={pending}
      onClick={handleSignOut}
      type="button"
    >
      <LogOut className="size-5 shrink-0" />
      <span>{pending ? "Signing out…" : "Sign out"}</span>
    </button>
  );
}
