#!/usr/bin/env node
// Ingest Kohepets (Shopify) food products into public.products + product_variants.
//
// Strategy: Kohepets exposes its full catalog as Shopify JSON. We walk the
// food-related COLLECTIONS (clean dog/cat typing + high food precision) rather
// than guessing from sparse product tags, then upsert each product.
//
// Usage:
//   node scripts/data-pipeline/ingest-kohepets.mjs            # ingest (default limit 200)
//   node scripts/data-pipeline/ingest-kohepets.mjs --limit 100
//   node scripts/data-pipeline/ingest-kohepets.mjs --dry-run  # parse + report, no DB writes
//
// Flags: --limit N | --collections-limit N | --delay MS | --dry-run

import { describeTarget, getPool } from "./_db.mjs";
import { extractProductSections, stripHtml } from "./lib/parse.mjs";

const BASE = "https://www.kohepets.com.sg";
const SOURCE = "kohepets";
const HEADERS = {
  accept: "application/json,text/plain;q=0.8,*/*;q=0.5",
  "accept-language": "en-SG,en;q=0.9",
  "user-agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
};

const FOOD_RE =
  /(food|treat|kibble|canned|wet|dry|freeze|air-dried|raw|broth|stew|pate|topper|snack|dental|chew)/i;
const NON_FOOD_RE =
  /(bowl|storage|feeder|mat|scoop|container|dispenser|fountain|placemat|apparel|toy|leash|collar|harness|carrier|litter|shampoo|grooming|wipes|cologne|cleaner|deodor|supplement|vitamin|accessor)/i;

function parseArgs(argv) {
  const args = {
    limit: 320,
    collectionsLimit: 300,
    perCollection: 8,
    delay: 150,
    dryRun: false,
  };
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    const next = argv[i + 1];
    if (a === "--limit" && next) args.limit = Number(next), (i += 1);
    else if (a === "--collections-limit" && next)
      args.collectionsLimit = Number(next), (i += 1);
    else if (a === "--per-collection" && next)
      args.perCollection = Number(next), (i += 1);
    else if (a === "--delay" && next) args.delay = Number(next), (i += 1);
    else if (a === "--dry-run") args.dryRun = true;
  }
  return args;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchJson(url, attempts = 3) {
  let lastErr;
  for (let i = 0; i < attempts; i += 1) {
    try {
      const res = await fetch(url, {
        headers: HEADERS,
        redirect: "follow",
        signal: AbortSignal.timeout(30_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      lastErr = e;
      await sleep(400 * (i + 1));
    }
  }
  throw new Error(`fetch failed ${url}: ${lastErr?.message}`);
}

function isFoodCollection(handle) {
  return FOOD_RE.test(handle) && !NON_FOOD_RE.test(handle);
}

// Broad SG pet taxonomy. Order matters: check dog/cat first (most common), then
// the more specific exotics so e.g. "rabbit" wins over a generic "small pet".
function petTypeFrom(text) {
  const t = (text || "").toLowerCase();
  if (/\bcat\b|kitten|feline|\bcat-/.test(t)) return "cat";
  if (/\bdog\b|puppy|canine|\bdog-/.test(t)) return "dog";
  if (/rabbit|bunny|\bhay\b|timothy|alfalfa/.test(t)) return "rabbit";
  if (/\bbird\b|avian|parrot|cockatiel|budgie|canary|parakeet|finch/.test(t))
    return "bird";
  if (/\bfish\b|aquarium|aquatic|betta|goldfish|\bkoi\b|guppy|cichlid/.test(t))
    return "fish";
  if (/turtle|tortoise|terrapin|reptile|lizard|snake|gecko|amphibian/.test(t))
    return "reptile";
  if (/hamster|guinea|chinchilla|ferret|hedgehog|gerbil|rodent|small-?animal|small-?pet/.test(t))
    return "small_pet";
  return null;
}

function foodCategory(handle) {
  if (/treat|chew|snack|dental/i.test(handle)) return "treat";
  if (/canned|wet|broth|stew|pate/i.test(handle)) return "wet_food";
  if (/dry|kibble/i.test(handle)) return "dry_food";
  if (/freeze|air-dried|raw/i.test(handle)) return "raw_dried";
  return "food";
}

function brandOf(product) {
  if (product.vendor) return product.vendor;
  const tag = (product.tags || []).find((x) => /^brand\s*-\s*/i.test(x));
  return tag ? tag.replace(/^brand\s*-\s*/i, "").trim() : null;
}

function priceCents(value) {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

async function fetchFoodCollections(limit) {
  const out = [];
  for (let page = 1; page <= 6; page += 1) {
    const json = await fetchJson(`${BASE}/collections.json?limit=250&page=${page}`);
    const cols = json?.collections ?? [];
    for (const c of cols) {
      if (isFoodCollection(c.handle)) out.push(c.handle);
    }
    if (cols.length < 250) break;
  }
  return [...new Set(out)].slice(0, limit);
}

// Reorder collection handles so pet types interleave (round-robin across type
// buckets). Guarantees dog/cat/rabbit/bird/fish/reptile/small_pet coverage even
// under a product cap, instead of exhausting the alphabet head (all "a..." cats).
function interleaveByType(handles) {
  const buckets = new Map();
  for (const h of handles) {
    const key = petTypeFrom(h) ?? "other";
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(h);
  }
  const lists = [...buckets.values()];
  const ordered = [];
  for (let i = 0; ordered.length < handles.length; i += 1) {
    for (const list of lists) if (list[i]) ordered.push(list[i]);
  }
  return ordered;
}

// Build the normalized product record from a Shopify product object.
function normalize(product, petTypeHint, handleForCategory) {
  const variants = Array.isArray(product.variants) ? product.variants : [];
  const prices = variants
    .map((v) => Number.parseFloat(v.price))
    .filter(Number.isFinite);
  const sections = extractProductSections(product.body_html);
  // Prefer per-product signal (title/tags) over the collection hint so e.g. a
  // turtle food in a mixed "bird-fish-reptile" collection types correctly.
  const petType =
    petTypeFrom(`${product.title} ${(product.tags || []).join(" ")}`) || petTypeHint;
  const category = product.product_type?.trim() || foodCategory(handleForCategory);

  const tags = [
    ...new Set(
      [...(product.tags || []), petType, category].filter(Boolean).map(String),
    ),
  ];

  return {
    source: SOURCE,
    source_product_id: String(product.id),
    handle: product.handle,
    url: `${BASE}/products/${product.handle}`,
    title: product.title,
    brand: brandOf(product),
    pet_type: petType,
    product_type: category,
    tags,
    price_min_cents: prices.length ? Math.round(Math.min(...prices) * 100) : null,
    price_max_cents: prices.length ? Math.round(Math.max(...prices) * 100) : null,
    available: variants.some((v) => v.available),
    description: stripHtml(product.body_html).slice(0, 8000) || null,
    ingredients: sections.ingredients || sections.composition || null,
    nutritional_analysis: sections.nutritionalAnalysis || null,
    suitable_for: sections.suitableFor || null,
    feeding_instructions: sections.feedingInstructions || null,
    country_of_origin: sections.countryOfOrigin || null,
    raw: product,
    variants: variants.map((v) => ({
      source_variant_id: String(v.id),
      title: v.title,
      sku: v.sku || null,
      price_cents: priceCents(v.price),
      compare_at_price_cents: priceCents(v.compare_at_price),
      available: Boolean(v.available),
      raw: v,
    })),
  };
}

const PRODUCT_UPSERT = `
insert into public.products (
  source, source_product_id, handle, url, title, brand, pet_type, product_type,
  tags, price_min_cents, price_max_cents, available, description, ingredients,
  nutritional_analysis, suitable_for, feeding_instructions, country_of_origin,
  raw, last_fetched_at, updated_at
) values (
  $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19::jsonb, now(), now()
)
on conflict (source, source_product_id) do update set
  handle = excluded.handle, url = excluded.url, title = excluded.title,
  brand = excluded.brand, pet_type = excluded.pet_type,
  product_type = excluded.product_type, tags = excluded.tags,
  price_min_cents = excluded.price_min_cents, price_max_cents = excluded.price_max_cents,
  available = excluded.available, description = excluded.description,
  ingredients = excluded.ingredients, nutritional_analysis = excluded.nutritional_analysis,
  suitable_for = excluded.suitable_for, feeding_instructions = excluded.feeding_instructions,
  country_of_origin = excluded.country_of_origin, raw = excluded.raw,
  last_fetched_at = now(), updated_at = now()
returning id`;

const VARIANT_UPSERT = `
insert into public.product_variants (
  product_id, source_variant_id, title, sku, price_cents,
  compare_at_price_cents, available, raw, updated_at
) values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb, now())
on conflict (product_id, source_variant_id) do update set
  title = excluded.title, sku = excluded.sku, price_cents = excluded.price_cents,
  compare_at_price_cents = excluded.compare_at_price_cents,
  available = excluded.available, raw = excluded.raw, updated_at = now()`;

async function upsertProduct(pool, p) {
  const { rows } = await pool.query(PRODUCT_UPSERT, [
    p.source, p.source_product_id, p.handle, p.url, p.title, p.brand,
    p.pet_type, p.product_type, p.tags, p.price_min_cents, p.price_max_cents,
    p.available, p.description, p.ingredients, p.nutritional_analysis,
    p.suitable_for, p.feeding_instructions, p.country_of_origin,
    JSON.stringify(p.raw),
  ]);
  const productId = rows[0].id;
  for (const v of p.variants) {
    await pool.query(VARIANT_UPSERT, [
      productId, v.source_variant_id, v.title, v.sku, v.price_cents,
      v.compare_at_price_cents, v.available, JSON.stringify(v.raw),
    ]);
  }
  return productId;
}

async function main() {
  const args = parseArgs(process.argv);
  console.log(
    `Kohepets ingest -> ${args.dryRun ? "DRY RUN" : describeTarget()} | limit=${args.limit}`,
  );

  const handles = interleaveByType(await fetchFoodCollections(args.collectionsLimit));
  console.log(`Found ${handles.length} food collections`);

  const pool = args.dryRun ? null : getPool();
  let runId = null;
  if (pool) {
    const { rows } = await pool.query(
      `insert into public.ingestion_runs (provider, pipeline, status)
       values ($1,'products','running') returning id`,
      [SOURCE],
    );
    runId = rows[0].id;
  }

  const seen = new Set();
  const sampleByType = {};
  let productCount = 0;
  let variantCount = 0;
  let withIngredients = 0;

  try {
    for (const handle of handles) {
      if (productCount >= args.limit) break;
      const petTypeHint = petTypeFrom(handle);
      let json;
      try {
        json = await fetchJson(`${BASE}/collections/${handle}/products.json?limit=250`);
      } catch (e) {
        console.warn(`  ! ${handle}: ${e.message}`);
        continue;
      }
      const products = json?.products ?? [];
      let added = 0;
      for (const product of products) {
        if (productCount >= args.limit) break;
        if (added >= args.perCollection) break;
        const key = String(product.id);
        if (seen.has(key)) continue;
        seen.add(key);

        const record = normalize(product, petTypeHint, handle);
        if (!pool) {
          // dry run: just tally
        } else {
          await upsertProduct(pool, record);
        }
        productCount += 1;
        variantCount += record.variants.length;
        if (record.ingredients) withIngredients += 1;
        const tk = record.pet_type ?? "null";
        sampleByType[tk] = (sampleByType[tk] ?? 0) + 1;
        added += 1;
      }
      if (added) {
        console.log(`  + ${handle} (${petTypeHint ?? "?"}): +${added} [total ${productCount}]`);
      }
      await sleep(args.delay);
    }

    if (pool) {
      await pool.query(
        `update public.ingestion_runs
         set status='succeeded', finished_at=now(), stats=$2::jsonb where id=$1`,
        [
          runId,
          JSON.stringify({ products: productCount, variants: variantCount, withIngredients }),
        ],
      );
    }
  } catch (e) {
    if (pool) {
      await pool.query(
        `update public.ingestion_runs set status='failed', finished_at=now(), error=$2 where id=$1`,
        [runId, e.message],
      );
    }
    throw e;
  } finally {
    if (pool) await pool.end();
  }

  console.log(
    `\nDone. products=${productCount} variants=${variantCount} withIngredients=${withIngredients}`,
  );
  console.log(`pet_type breakdown:`, sampleByType);
}

main().catch((e) => {
  console.error("ingest-kohepets failed:", e.message);
  process.exitCode = 1;
});
