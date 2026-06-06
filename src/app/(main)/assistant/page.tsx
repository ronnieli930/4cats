import {
  Bot,
  Info,
  Map as MapIcon,
  Mic,
  SendHorizontal,
  ShoppingBag,
  Star,
  UserRound,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { groomerInterior, mochiPortrait } from "@/lib/pet-data";
import { Pill } from "@/components/pet-care/primitives";
import { PetCareShell } from "@/components/pet-care/shell";

function ChatArea() {
  return (
    <section className="relative flex min-h-[calc(100vh-4rem)] flex-col overflow-hidden bg-[radial-gradient(#dac0c3_1px,transparent_1px)] [background-size:34px_34px]">
      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-10 px-5 py-8 md:px-10">
        <div className="mx-auto rounded-full bg-[#edeeef] px-5 py-2 text-sm text-[#554244]">
          Today
        </div>

        <div className="flex items-start gap-4">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#ff8da1] text-[#782338]">
            <Bot className="size-5" />
          </div>
          <div className="max-w-2xl rounded-2xl bg-white/90 p-6 text-xl leading-8 shadow-[0_4px_20px_rgba(29,53,87,0.05)] backdrop-blur">
            Hi there! How is Mochi doing today? I'm ready to help with any
            grooming, health, or lifestyle questions you have for your Shih Tzu.
          </div>
        </div>

        <div className="ml-auto flex max-w-3xl items-center gap-4">
          <div className="rounded-2xl bg-gradient-to-br from-[#ffd9dd] to-[#ff8da1] p-6 text-xl leading-8 text-[#782338] shadow-sm">
            Best groomer near Tampines for my Shih Tzu with sensitive skin?
          </div>
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#ffd167] text-[#765900]">
            <UserRound className="size-5" />
          </div>
        </div>

        <GroomerRecommendation />
      </div>

      <div className="sticky bottom-0 bg-gradient-to-t from-[#f8f9fa] via-[#f8f9fa] p-5 md:px-10">
        <div className="mx-auto flex max-w-4xl items-center gap-4 rounded-full border border-[#dac0c3]/70 bg-white px-5 py-3 shadow-[0_12px_28px_rgba(29,53,87,0.14)]">
          <Mic className="size-5 text-[#887274]" />
          <span className="flex-1 truncate text-[#887274]">
            Ask about Mochi's health, diet, or local services...
          </span>
          <Button className="size-11 rounded-full bg-[#9c3f53]" size="icon">
            <SendHorizontal className="size-5" />
          </Button>
        </div>
      </div>
    </section>
  );
}

function GroomerRecommendation() {
  return (
    <div className="flex items-start gap-4">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#ff8da1] text-[#782338]">
        <Bot className="size-5" />
      </div>
      <div className="max-w-2xl rounded-2xl bg-white/90 p-7 text-xl leading-8 shadow-[0_4px_20px_rgba(29,53,87,0.05)] backdrop-blur">
        <p>
          Based on Mochi's profile, sensitive skin requires special care. I've
          found a highly-rated groomer in Tampines that specializes in
          dermatological needs.
        </p>
        <div className="my-5 flex gap-4 rounded-xl border border-[#dac0c3]/60 bg-[#f8f9fa] p-4 text-base leading-6">
          <img
            alt="Heartland Paws Tampines"
            className="size-20 rounded-lg object-cover"
            src={groomerInterior}
          />
          <div className="flex-1">
            <div className="flex justify-between gap-2">
              <h4 className="font-bold">Heartland Paws Tampines</h4>
              <Pill className="bg-[#ffdf9b] text-[#765900]">
                <Star className="size-3 fill-current" />
                4.8
              </Pill>
            </div>
            <p className="text-[#554244]">
              Specializes in medicated baths & hypoallergenic styling.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Pill className="bg-[#ffdf9b]/70 text-[#785a00]">
                HDB-Approved
              </Pill>
              <Pill className="bg-[#edeeef] text-[#554244]">1.2km away</Pill>
            </div>
          </div>
        </div>
        <p>
          They use an oatmeal-based medicated shampoo which is perfect for Shih
          Tzus with sensitive skin. Would you like me to check their
          availability for this weekend?
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          {["Yes, check Saturday", "Show other options", "Call them"].map(
            (action) => (
              <button
                className="rounded-full border border-[#dac0c3] bg-[#f3f4f5] px-4 py-2 text-sm font-medium text-[#9c3f53]"
                key={action}
                type="button"
              >
                {action}
              </button>
            ),
          )}
        </div>
      </div>
    </div>
  );
}

function ContextSidebar() {
  const sources = [
    {
      source: "Google Maps API",
      title: "Heartland Paws Reviews",
      detail:
        '"Absolutely wonderful with my sensitive pup. They used a special medicated shampoo that didn\'t irritate her skin at all...."',
      icon: MapIcon,
    },
    {
      source: "Pet Lovers Centre Data",
      title: "Oatmeal Medicated Shampoo",
      detail:
        "Recommended for Shih Tzus (Age 3+). Alleviates itching and environmental allergies common in humid Singaporean climates.",
      icon: ShoppingBag,
    },
  ];

  return (
    <aside className="hidden border-l border-[#dac0c3]/40 bg-white px-8 py-8 lg:block">
      <h3 className="mb-8 flex items-center gap-3 text-sm font-bold tracking-wide text-[#554244]">
        <Info className="size-5" />
        AI CONTEXT SOURCES
      </h3>
      <div className="grid gap-4">
        {sources.map(({ source, title, detail, icon: Icon }) => (
          <div
            className="rounded-2xl border border-[#dac0c3]/70 bg-[#f8f9fa] p-4"
            key={title}
          >
            <p className="mb-4 flex items-center gap-2 text-sm">
              <span className="rounded-md bg-[#d5e3ff] p-2 text-[#2c4366]">
                <Icon className="size-4" />
              </span>
              {source}
            </p>
            <h4 className="mb-2 text-xl">{title}</h4>
            <p className="text-sm leading-6 text-[#554244]">{detail}</p>
          </div>
        ))}
      </div>
    </aside>
  );
}

export default function AssistantPage() {
  return (
    <PetCareShell active="assistant">
      <main className="grid min-h-screen bg-[#f8f9fa] md:ml-64 lg:grid-cols-[1fr_320px]">
        <ChatArea />
        <ContextSidebar />
      </main>
    </PetCareShell>
  );
}
