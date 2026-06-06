import { ForgotPasswordCard } from "@/components/auth/forgot-password-card";
import { TopBar } from "@/components/layout/top-bar";

export default function ForgotPasswordPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <TopBar variant="signin" />

      {/* Main Content */}
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <ForgotPasswordCard />
      </main>
    </div>
  );
}
