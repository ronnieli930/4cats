import { SignUpCard } from "@/components/auth/signup-card";
import { TopBar } from "@/components/layout/top-bar";

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <TopBar variant="signup" />

      {/* Main Content */}
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <SignUpCard />
      </main>
    </div>
  );
}
