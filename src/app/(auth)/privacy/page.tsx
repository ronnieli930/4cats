import Link from "next/link";
import { TopBar } from "@/components/layout/top-bar";
import { Button } from "@/components/ui/button";

export default function PrivacyPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <TopBar variant="default" />

      {/* Main Content */}
      <main className="flex flex-1 flex-col px-4 py-12">
        <div className="container mx-auto max-w-4xl">
          <h1 className="text-4xl font-bold tracking-tight mb-4">
            Privacy Policy
          </h1>
          <p className="text-muted-foreground mb-8">
            Last updated: January 5, 2026
          </p>

          <div className="prose prose-neutral dark:prose-invert max-w-none space-y-6">
            <section>
              <h2 className="text-2xl font-semibold mb-3">1. Introduction</h2>
              <p className="text-muted-foreground leading-relaxed">
                Welcome to DWA. We respect your privacy and are committed to
                protecting your personal data. This privacy policy will inform
                you about how we look after your personal data when you visit
                our website and tell you about your privacy rights and how the
                law protects you.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">
                2. Information We Collect
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-3">
                We may collect, use, store, and transfer different kinds of
                personal data about you which we have grouped together as
                follows:
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>
                  Identity Data: includes first name, last name, username, or
                  similar identifier
                </li>
                <li>
                  Contact Data: includes email address and telephone numbers
                </li>
                <li>
                  Technical Data: includes internet protocol (IP) address, your
                  login data, browser type and version, time zone setting and
                  location
                </li>
                <li>
                  Usage Data: includes information about how you use our website
                  and services
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">
                3. How We Use Your Information
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-3">
                We will only use your personal data when the law allows us to.
                Most commonly, we will use your personal data in the following
                circumstances:
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>To register you as a new customer</li>
                <li>To process and deliver your service requests</li>
                <li>To manage our relationship with you</li>
                <li>
                  To improve our website, products/services, marketing, or
                  customer relationships
                </li>
                <li>
                  To make recommendations to you about goods or services that
                  may be of interest to you
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">4. Data Security</h2>
              <p className="text-muted-foreground leading-relaxed">
                We have put in place appropriate security measures to prevent
                your personal data from being accidentally lost, used, or
                accessed in an unauthorized way, altered, or disclosed. In
                addition, we limit access to your personal data to those
                employees, agents, contractors, and other third parties who have
                a business need to know.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">5. Data Retention</h2>
              <p className="text-muted-foreground leading-relaxed">
                We will only retain your personal data for as long as reasonably
                necessary to fulfill the purposes we collected it for, including
                for the purposes of satisfying any legal, regulatory, tax,
                accounting, or reporting requirements. We may retain your
                personal data for a longer period in the event of a complaint or
                if we reasonably believe there is a prospect of litigation in
                respect to our relationship with you.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">6. Your Rights</h2>
              <p className="text-muted-foreground leading-relaxed mb-3">
                Under certain circumstances, you have rights under data
                protection laws in relation to your personal data, including the
                right to:
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>Request access to your personal data</li>
                <li>Request correction of your personal data</li>
                <li>Request erasure of your personal data</li>
                <li>Object to processing of your personal data</li>
                <li>Request restriction of processing your personal data</li>
                <li>Request transfer of your personal data</li>
                <li>Right to withdraw consent</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">7. Cookies</h2>
              <p className="text-muted-foreground leading-relaxed">
                We use cookies and similar tracking technologies to track the
                activity on our Service and store certain information. Cookies
                are files with small amount of data which may include an
                anonymous unique identifier. You can instruct your browser to
                refuse all cookies or to indicate when a cookie is being sent.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">
                8. Third-Party Links
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                Our website may include links to third-party websites, plug-ins,
                and applications. Clicking on those links or enabling those
                connections may allow third parties to collect or share data
                about you. We do not control these third-party websites and are
                not responsible for their privacy statements.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">
                9. Changes to This Privacy Policy
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                We may update our Privacy Policy from time to time. We will
                notify you of any changes by posting the new Privacy Policy on
                this page and updating the "Last updated" date at the top of
                this Privacy Policy.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">10. Contact Us</h2>
              <p className="text-muted-foreground leading-relaxed">
                If you have any questions about this Privacy Policy, please
                contact us at privacy@dwa.com.
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
