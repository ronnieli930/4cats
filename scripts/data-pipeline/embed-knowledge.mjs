#!/usr/bin/env node
// Embed pipeline rows into public.knowledge_chunks (pgvector) for RAG.
// Covers products, service_places, and place_reviews. Idempotent: upserts one
// chunk per entity (unique on entity_type, entity_id).
//
// Requires OPENAI_API_KEY. Uses text-embedding-3-small (1536 dims -> vector(1536)).
//
// Usage:
//   node scripts/data-pipeline/embed-knowledge.mjs              # all entity types
//   node scripts/data-pipeline/embed-knowledge.mjs --entity products
//   node scripts/data-pipeline/embed-knowledge.mjs --limit 50

import "dotenv/config";
import OpenAI from "openai";
import { describeTarget, getPool } from "./_db.mjs";

const MODEL = "text-embedding-3-small";
const BATCH = 96;
const openai = new OpenAI();

function parseArgs(argv) {
  const args = { entity: "all", limit: 0 };
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    const next = argv[i + 1];
    if (a === "--entity" && next) args.entity = next, (i += 1);
    else if (a === "--limit" && next) args.limit = Number(next), (i += 1);
  }
  return args;
}

function sgd(cents) {
  return typeof cents === "number" ? `S$${(cents / 100).toFixed(2)}` : null;
}

const SOURCES = {
  // entity_type -> { sql, toChunk(row) -> { entity_id, source, title, body, metadata } }
  product: {
    label: "products",
    sql: `select id, source, handle, url, title, brand, pet_type, product_type,
                 tags, price_min_cents, price_max_cents, available, description,
                 ingredients, nutritional_analysis, suitable_for, feeding_instructions
          from public.products order by created_at`,
    toChunk(r) {
      const price = r.price_min_cents
        ? `${sgd(r.price_min_cents)}${r.price_max_cents && r.price_max_cents !== r.price_min_cents ? `–${sgd(r.price_max_cents)}` : ""}`
        : "unknown";
      const body = [
        r.title,
        `Brand: ${r.brand ?? "unknown"}. For: ${r.pet_type ?? "pets"}. Type: ${r.product_type ?? "food"}. Price: ${price}. ${r.available ? "In stock." : "Out of stock."}`,
        r.ingredients && `Ingredients: ${r.ingredients}`,
        r.nutritional_analysis && `Nutritional analysis: ${r.nutritional_analysis}`,
        r.suitable_for && `Suitable for: ${r.suitable_for}`,
        r.feeding_instructions && `Feeding: ${r.feeding_instructions}`,
        r.description,
      ]
        .filter(Boolean)
        .join("\n")
        .slice(0, 6000);
      return {
        entity_id: r.id,
        source: r.source,
        title: r.title,
        body,
        metadata: {
          kind: "product",
          source: r.source,
          brand: r.brand,
          pet_type: r.pet_type,
          product_type: r.product_type,
          handle: r.handle,
          url: r.url,
          price_min_cents: r.price_min_cents,
          price_max_cents: r.price_max_cents,
          available: r.available,
          tags: r.tags,
        },
      };
    },
  },
  service_place: {
    label: "service_places",
    sql: `select id, source, kind, name, neighbourhood, postal_code, formatted_address,
                 lat, lng, rating, user_rating_count, service_tags, suitability_tags,
                 review_summary
          from public.service_places order by created_at`,
    toChunk(r) {
      const body = [
        `${r.name} — ${r.kind} in ${r.neighbourhood ?? "Singapore"}.`,
        r.formatted_address,
        r.rating && `Rating ${r.rating} (${r.user_rating_count ?? 0} reviews).`,
        r.service_tags?.length && `Services: ${r.service_tags.join(", ")}.`,
        r.suitability_tags?.length && `Good for: ${r.suitability_tags.join(", ")}.`,
        r.review_summary && `Reviews: ${r.review_summary}`,
      ]
        .filter(Boolean)
        .join("\n")
        .slice(0, 6000);
      return {
        entity_id: r.id,
        source: r.source,
        title: r.name,
        body,
        metadata: {
          kind: "service_place",
          service_kind: r.kind,
          neighbourhood: r.neighbourhood,
          postal_code: r.postal_code,
          lat: r.lat,
          lng: r.lng,
          rating: r.rating,
        },
      };
    },
  },
  place_review: {
    label: "place_reviews",
    sql: `select pr.id, pr.source, pr.text, pr.rating, pr.service_place_id,
                 sp.name place_name, sp.kind service_kind, sp.neighbourhood
          from public.place_reviews pr
          join public.service_places sp on sp.id = pr.service_place_id
          where pr.text is not null and length(pr.text) > 0
          order by pr.created_at`,
    toChunk(r) {
      const body = [
        `Review of ${r.place_name} (${r.service_kind}${r.neighbourhood ? `, ${r.neighbourhood}` : ""})${r.rating ? `, ${r.rating}/5` : ""}:`,
        r.text,
      ]
        .filter(Boolean)
        .join("\n")
        .slice(0, 6000);
      return {
        entity_id: r.id,
        source: r.source,
        title: `Review: ${r.place_name}`,
        body,
        metadata: {
          kind: "place_review",
          service_place_id: r.service_place_id,
          service_kind: r.service_kind,
          rating: r.rating,
        },
      };
    },
  },
};

const UPSERT = `
insert into public.knowledge_chunks
  (entity_type, entity_id, source, title, body, metadata, embedding, updated_at)
values ($1,$2,$3,$4,$5,$6::jsonb,$7::vector, now())
on conflict (entity_type, entity_id) do update set
  source = excluded.source, title = excluded.title, body = excluded.body,
  metadata = excluded.metadata, embedding = excluded.embedding, updated_at = now()`;

async function embedEntity(pool, entityType, def, limit) {
  const { rows } = await pool.query(def.sql + (limit ? ` limit ${limit}` : ""));
  if (!rows.length) {
    console.log(`  ${def.label}: 0 rows, skipping`);
    return 0;
  }
  const chunks = rows.map((r) => def.toChunk(r));
  let done = 0;
  for (let i = 0; i < chunks.length; i += BATCH) {
    const batch = chunks.slice(i, i + BATCH);
    const res = await openai.embeddings.create({
      model: MODEL,
      input: batch.map((c) => c.body),
    });
    for (let j = 0; j < batch.length; j += 1) {
      const c = batch[j];
      const vec = `[${res.data[j].embedding.join(",")}]`;
      await pool.query(UPSERT, [
        entityType, c.entity_id, c.source, c.title, c.body,
        JSON.stringify(c.metadata), vec,
      ]);
    }
    done += batch.length;
    console.log(`  ${def.label}: embedded ${done}/${chunks.length}`);
  }
  return done;
}

async function main() {
  const args = parseArgs(process.argv);
  console.log(`Embed -> ${describeTarget()} | entity=${args.entity} model=${MODEL}`);
  const pool = getPool();
  const types =
    args.entity === "all" ? Object.keys(SOURCES) : args.entity.split(",");
  let total = 0;
  try {
    for (const t of types) {
      const def = SOURCES[t === "products" ? "product" : t];
      if (!def) {
        console.warn(`  unknown entity "${t}" (use product|service_place|place_review)`);
        continue;
      }
      total += await embedEntity(pool, t === "products" ? "product" : t, def, args.limit);
    }
  } finally {
    await pool.end();
  }
  console.log(`\nDone. embedded ${total} chunks.`);
}

main().catch((e) => {
  console.error("embed-knowledge failed:", e.message);
  process.exitCode = 1;
});
