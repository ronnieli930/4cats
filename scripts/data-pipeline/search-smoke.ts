// Smoke test for the pet-data search layer. Run: pnpm exec tsx scripts/data-pipeline/search-smoke.ts
import "dotenv/config";
import {
  postalToLatLng,
  searchFood,
  searchGroomers,
  searchVets,
} from "../../src/lib/pet-data/search.ts";

function money(c: number | null) {
  return c == null ? "?" : `S$${(c / 100).toFixed(2)}`;
}

async function main() {
  console.log("== searchFood: sensitive-skin dog food ==");
  const a = await searchFood({
    query: "grain-free food good for dogs with sensitive skin and allergies",
    petType: "dog",
    limit: 5,
  });
  for (const f of a) {
    console.log(
      `  [${f.similarity.toFixed(3)}] ${f.title} — ${f.brand} ${money(f.priceMinCents)} (${f.petType})`,
    );
  }

  console.log("\n== searchFood: 'Acana adult dog food' (brand filter) ==");
  const b = await searchFood({
    query: "Acana adult dog food ingredients",
    brand: "Acana",
    limit: 3,
  });
  for (const f of b) {
    console.log(`  [${f.similarity.toFixed(3)}] ${f.title} — ${money(f.priceMinCents)}`);
    console.log(`      ${f.snippet.slice(0, 140).replace(/\n/g, " ")}...`);
  }

  console.log("\n== postalToLatLng (Tampines 520xxx) ==");
  console.log(" ", postalToLatLng("520512"));

  const loc = postalToLatLng("520512") ?? { lat: 1.3496, lng: 103.943 };
  console.log("\n== searchGroomers near Tampines (empty until Places enabled) ==");
  const g = await searchGroomers({ ...loc, limit: 3 });
  console.log(`  ${g.length} groomers`);
  for (const p of g) {
    console.log(`  ${p.name} — ${p.rating}★ (${p.userRatingCount}) ${p.distanceKm.toFixed(1)}km`);
  }

  console.log("\n== searchVets near Tampines ==");
  const v = await searchVets({ ...loc, limit: 3 });
  console.log(`  ${v.length} vets`);

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
