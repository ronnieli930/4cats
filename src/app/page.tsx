import { ArrowRight, Workflow } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function StudioCard({
  title,
  description,
  content,
  href,
}: {
  title: string;
  description: string;
  content: string;
  href: string;
}) {
  return (
    <Card className="relative overflow-hidden border-2 hover:border-primary transition-colors">
      <CardHeader>
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-primary/10">
            <Workflow className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">{title}</CardTitle>
        </div>
        <CardDescription className="text-base">{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 flex flex-col h-full justify-between">
        <p className="text-sm text-muted-foreground">{content}</p>
        <Button className="w-full" size="lg" asChild>
          <Link href={href}>
            Open {title}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Main Content */}
      <main className="flex flex-1 items-center justify-center px-4">
        <div className="mx-auto max-w-5xl w-full">
          <div className="text-center mb-12">
            <h2 className="text-5xl font-bold tracking-tight sm:text-6xl">
              Welcome to 4 Cats
            </h2>
          </div>
        </div>
      </main>
    </div>
  );
}
