#!/usr/bin/env node
// Ingest Singapore groomers + vets from Google Places API (New) into
// public.service_places (+ public.place_reviews). Idempotent upserts.
//
// Requires GOOGLE_PLACES_API_KEY. Uses places:searchText with a Singapore
// location restriction and pagination (up to 60 results/query).
//
// Usage:
//   node scripts/data-pipeline/ingest-google-places.mjs                 # groomers + vets
//   node scripts/data-pipeline/ingest-google-places.mjs --kind vet
//   node scripts/data-pipeline/ingest-google-places.mjs --dry-run

import "dotenv/config";
import { describeTarget, getPool } from "./_db.mjs";

const API_KEY = process.env.GOOGLE_PLACES_API_KEY;
const SEARCH_URL = "https://places.googleapis.com/v1/places:searchText";

// Singapore bounding box (forces local results).
const SG_RECTANGLE = {
  low: { latitude: 1.16, longitude: 103.59 },
  high: { latitude: 1.48, longitude: 104.05 },
};

const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.addressComponents",
  "places.location",
  "places.rating",
  "places.userRatingCount",
  "places.types",
  "places.businessStatus",
  "places.priceLevel",
  "places.nationalPhoneNumber",
  "places.internationalPhoneNumber",
  "places.websiteUri",
  "places.googleMapsUri",
  "places.regularOpeningHours",
  "places.reviews",
  "nextPageToken",
].join(",");

// Island-wide coverage: broad queries (paginated, return SG-wide results) plus
// per-region queries for density. Vets also include exotic/avian/small-animal
// clinics so rabbit/bird/reptile/fish owners are served, not just dogs & cats.
const SG_REGIONS = [
  "Tampines", "Bedok", "Pasir Ris", "Jurong East", "Jurong West", "Clementi",
  "Woodlands", "Yishun", "Sembawang", "Ang Mo Kio", "Sengkang", "Punggol",
  "Hougang", "Serangoon", "Bishan", "Toa Payoh", "Bukit Timah", "Bukit Batok",
  "Choa Chu Kang", "Queenstown", "Bukit Merah", "Kallang", "Geylang", "Novena",
];

const QUERY_SETS = {
  groomer: {
    target: 90,
    queries: [
      "pet grooming",
      "dog grooming salon",
      "cat grooming",
      "mobile pet grooming",
      ...SG_REGIONS.map((r) => `pet grooming ${r}`),
    ],
  },
  vet: {
    target: 75,
    includedType: "veterinary_care",
    // Specialist exotic/avian/small-animal queries lead so they run before the
    // broad queries hit the target (rabbit/bird/reptile owners need these).
    queries: [
      "exotic pet vet",
      "avian vet",
      "rabbit vet",
      "reptile vet",
      "small animal veterinary clinic",
      "veterinary clinic",
      "animal hospital",
      "24 hour vet",
      ...SG_REGIONS.map((r) => `vet clinic ${r}`),
    ],
  },
};

function parseArgs(argv) {
  const args = { kind: "all", delay: 600, dryRun: false };
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    const next = argv[i + 1];
    if (a === "--kind" && next) args.kind = next, (i += 1);
    else if (a === "--delay" && next) args.delay = Number(next), (i += 1);
    else if (a === "--dry-run") args.dryRun = true;
  }
  return args;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function searchText(textQuery, includedType, pageToken) {
  const body = {
    textQuery: `${textQuery} Singapore`,
    locationRestriction: { rectangle: SG_RECTANGLE },
    pageSize: 20,
    languageCode: "en",
    regionCode: "SG",
  };
  if (includedType) body.includedType = includedType;
  if (pageToken) body.pageToken = pageToken;

  const res = await fetch(SEARCH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": API_KEY,
      "X-Goog-FieldMask": FIELD_MASK,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(`Places ${res.status}: ${json?.error?.message ?? JSON.stringify(json).slice(0, 200)}`);
  }
  return json;
}

const SG_POSTAL_RE = /\b(\d{6})\b/;

function pickAddressComponent(components, types) {
  const c = (components || []).find((comp) =>
    comp.types?.some((t) => types.includes(t)),
  );
  return c?.longText ?? c?.shortText ?? null;
}

function priceLevelToText(level) {
  if (!level) return null;
  return String(level).replace("PRICE_LEVEL_", "").toLowerCase() || null;
}

function normalize(place, kind) {
  const comps = place.addressComponents;
  const postal =
    pickAddressComponent(comps, ["postal_code"]) ||
    place.formattedAddress?.match(SG_POSTAL_RE)?.[1] ||
    null;
  const neighbourhood =
    pickAddressComponent(comps, [
      "neighborhood",
      "sublocality_level_1",
      "sublocality",
    ]) || null;

  const serviceTags = [
    ...new Set(
      [kind, ...(place.types || [])].filter(
        (t) => t && t !== "point_of_interest" && t !== "establishment",
      ),
    ),
  ];

  const reviews = (place.reviews || []).map((rv) => ({
    source_review_id: rv.name ?? null,
    rating: typeof rv.rating === "number" ? rv.rating : null,
    text: rv.text?.text ?? rv.originalText?.text ?? null,
    author_name: rv.authorAttribution?.displayName ?? null,
    author_uri: rv.authorAttribution?.uri ?? null,
    language_code: rv.text?.languageCode ?? null,
    relative_publish_time_description: rv.relativePublishTimeDescription ?? null,
    published_at: rv.publishTime ?? null,
    raw: rv,
  }));

  return {
    source: "google_places",
    source_place_id: place.id,
    kind,
    name: place.displayName?.text ?? "Unknown",
    formatted_address: place.formattedAddress ?? null,
    postal_code: postal,
    neighbourhood,
    lat: place.location?.latitude ?? null,
    lng: place.location?.longitude ?? null,
    rating: typeof place.rating === "number" ? place.rating : null,
    user_rating_count: place.userRatingCount ?? null,
    price_level: priceLevelToText(place.priceLevel),
    business_status: place.businessStatus ?? null,
    national_phone_number: place.nationalPhoneNumber ?? null,
    international_phone_number: place.internationalPhoneNumber ?? null,
    website_url: place.websiteUri ?? null,
    google_maps_url: place.googleMapsUri ?? null,
    opening_hours: place.regularOpeningHours ?? {},
    service_tags: serviceTags,
    raw: place,
    reviews,
  };
}

const PLACE_UPSERT = `
insert into public.service_places (
  source, source_place_id, kind, name, formatted_address, postal_code,
  neighbourhood, lat, lng, rating, user_rating_count, price_level,
  business_status, national_phone_number, international_phone_number,
  website_url, google_maps_url, opening_hours, service_tags, raw,
  last_fetched_at, updated_at
) values (
  $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18::jsonb,$19,$20::jsonb, now(), now()
)
on conflict (source, source_place_id) do update set
  kind = excluded.kind, name = excluded.name,
  formatted_address = excluded.formatted_address, postal_code = excluded.postal_code,
  neighbourhood = excluded.neighbourhood, lat = excluded.lat, lng = excluded.lng,
  rating = excluded.rating, user_rating_count = excluded.user_rating_count,
  price_level = excluded.price_level, business_status = excluded.business_status,
  national_phone_number = excluded.national_phone_number,
  international_phone_number = excluded.international_phone_number,
  website_url = excluded.website_url, google_maps_url = excluded.google_maps_url,
  opening_hours = excluded.opening_hours, service_tags = excluded.service_tags,
  raw = excluded.raw, last_fetched_at = now(), updated_at = now()
returning id`;

const REVIEW_UPSERT = `
insert into public.place_reviews (
  service_place_id, source, source_review_id, rating, text, author_name,
  author_uri, language_code, relative_publish_time_description, published_at, raw
) values ($1,'google_places',$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)
on conflict (service_place_id, source, source_review_id) do update set
  rating = excluded.rating, text = excluded.text, author_name = excluded.author_name,
  author_uri = excluded.author_uri, language_code = excluded.language_code,
  relative_publish_time_description = excluded.relative_publish_time_description,
  published_at = excluded.published_at, raw = excluded.raw`;

async function upsertPlace(pool, p) {
  const { rows } = await pool.query(PLACE_UPSERT, [
    p.source, p.source_place_id, p.kind, p.name, p.formatted_address,
    p.postal_code, p.neighbourhood, p.lat, p.lng, p.rating, p.user_rating_count,
    p.price_level, p.business_status, p.national_phone_number,
    p.international_phone_number, p.website_url, p.google_maps_url,
    JSON.stringify(p.opening_hours), p.service_tags, JSON.stringify(p.raw),
  ]);
  const placeId = rows[0].id;
  let reviewCount = 0;
  for (const rv of p.reviews) {
    if (!rv.source_review_id) continue;
    await pool.query(REVIEW_UPSERT, [
      placeId, rv.source_review_id, rv.rating, rv.text, rv.author_name,
      rv.author_uri, rv.language_code, rv.relative_publish_time_description,
      rv.published_at, JSON.stringify(rv.raw),
    ]);
    reviewCount += 1;
  }
  return reviewCount;
}

async function ingestKind(pool, kind, args, runId) {
  const set = QUERY_SETS[kind];
  const seen = new Set();
  let places = 0;
  let reviews = 0;

  for (const query of set.queries) {
    if (places >= set.target) break;
    let pageToken = null;
    let page = 0;
    do {
      let json;
      try {
        json = await searchText(query, set.includedType, pageToken);
      } catch (e) {
        console.warn(`  ! "${query}": ${e.message}`);
        break;
      }
      const results = json.places ?? [];
      let added = 0;
      for (const place of results) {
        if (seen.has(place.id)) continue;
        seen.add(place.id);
        const record = normalize(place, kind);
        if (pool) reviews += await upsertPlace(pool, record);
        places += 1;
        added += 1;
        if (places >= set.target) break;
      }
      console.log(`  [${kind}] "${query}" p${page + 1}: +${added} (total ${places})`);
      pageToken = json.nextPageToken ?? null;
      page += 1;
      if (pageToken && places < set.target) await sleep(args.delay + 1200);
      else await sleep(args.delay);
    } while (pageToken && places < set.target && page < 3);
  }

  if (pool) {
    await pool.query(
      `update public.ingestion_runs set status='succeeded', finished_at=now(),
       stats = stats || $2::jsonb where id=$1`,
      [runId, JSON.stringify({ [kind]: { places, reviews } })],
    );
  }
  return { places, reviews };
}

async function main() {
  if (!API_KEY) throw new Error("GOOGLE_PLACES_API_KEY missing from env");
  const args = parseArgs(process.argv);
  console.log(`Google Places ingest -> ${args.dryRun ? "DRY RUN" : describeTarget()} | kind=${args.kind}`);

  const kinds = args.kind === "all" ? ["groomer", "vet"] : args.kind.split(",");
  const pool = args.dryRun ? null : getPool();
  let runId = null;
  if (pool) {
    const { rows } = await pool.query(
      `insert into public.ingestion_runs (provider, pipeline, status, stats)
       values ('google_places','service_places','running','{}') returning id`,
    );
    runId = rows[0].id;
  }

  const totals = {};
  try {
    for (const kind of kinds) {
      if (!QUERY_SETS[kind]) {
        console.warn(`  unknown kind "${kind}" (use groomer|vet)`);
        continue;
      }
      totals[kind] = await ingestKind(pool, kind, args, runId);
    }
  } catch (e) {
    if (pool && runId) {
      await pool.query(
        `update public.ingestion_runs set status='failed', finished_at=now(), error=$2 where id=$1`,
        [runId, e.message],
      );
    }
    throw e;
  } finally {
    if (pool) await pool.end();
  }

  console.log("\nDone:", JSON.stringify(totals));
}

main().catch((e) => {
  console.error("ingest-google-places failed:", e.message);
  process.exitCode = 1;
});
