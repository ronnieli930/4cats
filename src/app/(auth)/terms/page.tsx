import Link from "next/link";
import { TopBar } from "@/components/layout/top-bar";
import { Button } from "@/components/ui/button";

export default function TermsPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <TopBar variant="default" />

      {/* Main Content */}
      <main className="flex flex-1 flex-col px-4 py-12">
        <div className="container mx-auto max-w-4xl">
          <h1 className="text-4xl font-bold tracking-tight mb-4">
            Terms of Service
          </h1>
          <p className="text-muted-foreground mb-8">
            Last updated: January 5, 2026
          </p>

          <div className="prose prose-neutral dark:prose-invert max-w-none space-y-6">
            <section>
              <h2 className="text-2xl font-semibold mb-3">
                1. Acceptance of Terms
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                By accessing and using DWA (the "Service"), you accept and agree
                to be bound by the terms and provision of this agreement. If you
                do not agree to these terms, please do not use the Service.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">2. Use of Service</h2>
              <p className="text-muted-foreground leading-relaxed">
                You agree to use the Service only for lawful purposes and in a
                way that does not infringe the rights of, restrict, or inhibit
                anyone else's use and enjoyment of the Service. Prohibited
                behavior includes harassing or causing distress or inconvenience
                to any other user, transmitting obscene or offensive content, or
                disrupting the normal flow of dialogue within the Service.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">3. User Accounts</h2>
              <p className="text-muted-foreground leading-relaxed">
                When you create an account with us, you must provide information
                that is accurate, complete, and current at all times. Failure to
                do so constitutes a breach of the Terms, which may result in
                immediate termination of your account on our Service. You are
                responsible for safeguarding the password that you use to access
                the Service and for any activities or actions under your
                password.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">
                4. Intellectual Property
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                The Service and its original content, features, and
                functionality are and will remain the exclusive property of DWA
                and its licensors. The Service is protected by copyright,
                trademark, and other laws of both the United States and foreign
                countries. Our trademarks and trade dress may not be used in
                connection with any product or service without the prior written
                consent of DWA.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">5. Termination</h2>
              <p className="text-muted-foreground leading-relaxed">
                We may terminate or suspend your account immediately, without
                prior notice or liability, for any reason whatsoever, including
                without limitation if you breach the Terms. Upon termination,
                your right to use the Service will immediately cease.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">
                6. Limitation of Liability
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                In no event shall DWA, nor its directors, employees, partners,
                agents, suppliers, or affiliates, be liable for any indirect,
                incidental, special, consequential, or punitive damages,
                including without limitation, loss of profits, data, use,
                goodwill, or other intangible losses, resulting from your access
                to or use of or inability to access or use the Service.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">
                7. Changes to Terms
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                We reserve the right, at our sole discretion, to modify or
                replace these Terms at any time. If a revision is material, we
                will try to provide at least 30 days' notice prior to any new
                terms taking effect. What constitutes a material change will be
                determined at our sole discretion.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">8. Contact Us</h2>
              <p className="text-muted-foreground leading-relaxed">
                If you have any questions about these Terms, please contact us
                at support@dwa.com.
              </p>
            </section>
          </div>

          <div className="mt-12 pt-8 border-t">
            <Button variant="outline" asChild>
              <Link href="/">Back to Home</Link>
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
