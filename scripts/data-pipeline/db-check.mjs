#!/usr/bin/env node
// Read-only DB introspection: lists pipeline tables, row counts, extensions,
// RPC functions, and the _prisma_migrations ledger. Safe to run anytime.

import { describeTarget, getClient } from "./_db.mjs";

const EXPECTED_TABLES = [
  "Pet",
  "CareLog",
  "ingestion_runs",
  "products",
  "product_variants",
  "service_places",
  "service_place_contacts",
  "place_reviews",
  "service_place_suitability",
  "booking_requests",
  "knowledge_chunks",
];

async function main() {
  const client = await getClient();
  console.log(`Target: ${describeTarget()}`);

  const { rows: tables } = await client.query(
    `select table_name from information_schema.tables
     where table_schema = 'public' order by table_name`,
  );
  const present = new Set(tables.map((t) => t.table_name));

  console.log("\n=== public tables ===");
  for (const name of EXPECTED_TABLES) {
    const ok = present.has(name);
    let count = "";
    if (ok) {
      try {
        const r = await client.query(`select count(*)::int as n from public."${name}"`);
        count = `  rows=${r.rows[0].n}`;
      } catch (e) {
        count = `  (count failed: ${e.message})`;
      }
    }
    console.log(`${ok ? "✓" : "✗"} ${name}${count}`);
  }

  const extras = [...present].filter((t) => !EXPECTED_TABLES.includes(t) && t !== "_prisma_migrations");
  if (extras.length) console.log("\nother public tables:", extras.join(", "));

  const { rows: exts } = await client.query(
    `select extname from pg_extension where extname in ('vector','pgcrypto') order by extname`,
  );
  console.log("\n=== extensions ===");
  console.log(exts.map((e) => e.extname).join(", ") || "(none of vector/pgcrypto)");

  const { rows: fns } = await client.query(
    `select proname from pg_proc where proname in ('match_knowledge_chunks','nearby_service_places') order by proname`,
  );
  console.log("\n=== rpc functions ===");
  console.log(fns.map((f) => f.proname).join(", ") || "(none)");

  if (present.has("_prisma_migrations")) {
    const { rows: migs } = await client.query(
      `select migration_name, finished_at, rolled_back_at
       from public._prisma_migrations order by started_at`,
    );
    console.log("\n=== _prisma_migrations ledger ===");
    for (const m of migs) {
      const state = m.rolled_back_at ? "ROLLED BACK" : m.finished_at ? "applied" : "PENDING";
      console.log(`- ${m.migration_name} [${state}]`);
    }
  } else {
    console.log("\n=== _prisma_migrations ledger ===\n(no _prisma_migrations table)");
  }

  await client.end();
}

main().catch((e) => {
  console.error("DB check failed:", e.message);
  process.exitCode = 1;
});
