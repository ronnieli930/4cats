# Data pipeline — Little Lovely Pets

Pre-scrapes SG pet data into Postgres + pgvector so the AI agent can answer
profile-aware questions grounded in real local data (RAG-first, live-search
fallback). Owned by the data team.

## Local DB (develop here first)

We develop against a **local** Postgres so Prisma re-aligns don't clobber the
remote Supabase tables. The schema runs on `pgvector/pgvector` (Postgres +
pgvector preinstalled).

```bash
# one-time: start the local DB
docker run -d --name fourcats-pg -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=postgres -p 5432:5432 pgvector/pgvector:pg17
# later: docker start fourcats-pg

# .env points DATABASE_URL at it:
#   DATABASE_URL="postgresql://postgres:postgres@localhost:5432/postgres"

pnpm db:apply:pipeline   # create tables + pgvector + RPC functions
pnpm db:check            # show tables, row counts, extensions, RPCs
```

## ⚠️ Prisma / schema ownership (the "tables keep getting overridden" gotcha)

The data-pipeline tables (`products`, `service_places`, `knowledge_chunks`, …)
are **not** modeled in `prisma/schema.prisma`. Prisma only manages `Pet` +
`CareLog`. So `prisma migrate dev` / `prisma db push` see the pipeline tables as
drift and **drop them**.

Rules:

- The canonical pipeline schema lives in
  [`sql/pipeline-schema.sql`](./sql/pipeline-schema.sql) — **outside**
  `prisma/migrations/` so Prisma never regenerates or deletes it. It's
  idempotent; re-run `pnpm db:apply:pipeline` anytime (e.g. after a Prisma reset).
- Use `prisma migrate deploy` (additive), **never** `migrate dev` / `db push` /
  `reset` against a DB holding pipeline tables.

## Run the pipeline

```bash
# 1. Products (Kohepets / Shopify — no API key needed)
node scripts/data-pipeline/ingest-kohepets.mjs --limit 200 --per-collection 8
#    --dry-run to preview parsing without writing

# 2. Service places (Google Places API New — needs GOOGLE_PLACES_API_KEY)
node scripts/data-pipeline/ingest-google-places.mjs --kind all
#    --kind groomer|vet ; --dry-run

# 3. Contacts: phone/website/maps + enrich websites for email/WhatsApp/booking
node scripts/data-pipeline/backfill-contacts.mjs
#    --base-only to skip website fetching ; sets service_places.primary_email + booking_url

# 4. Embeddings -> knowledge_chunks (needs OPENAI_API_KEY, text-embedding-3-small)
node scripts/data-pipeline/embed-knowledge.mjs            # all entity types
#    --entity products|service_place|place_review
```

Re-running any step is safe (idempotent upserts). `ingestion_runs` records each run.

## Search layer (handoff to the agent)

The agent's tools should call [`src/lib/pet-data/search.ts`](../../src/lib/pet-data/search.ts):

- `searchFood({ query, petType?, brand?, limit? })` — semantic product search
  (filters by pet_type / brand). For "is Acana safe for my shih tzu?".
- `searchGroomers({ lat, lng, radiusKm?, limit?, withReviews? })` — geo search
  via `nearby_service_places`, with top reviews attached.
- `searchVets({ ... })` — same, for vets.
- `postalToLatLng(postalCode)` — approx SG lat/lng from a postal code (no
  Geocoding API needed) to seed the geo search from a pet's profile.

Smoke test: `pnpm exec tsx scripts/data-pipeline/search-smoke.ts`

## Live-search fallback (not built — agent team)

When RAG misses, wrap Kohepets `/search/suggest.json` + Google Places live and
upsert results into the same tables. The probe in
[`probe-product-providers.mjs`](./probe-product-providers.mjs) shows the Kohepets
endpoints.

## Files

| File | Purpose |
|---|---|
| `sql/pipeline-schema.sql` | Canonical schema (tables, pgvector, RPCs) |
| `apply-sql.mjs` / `_db.mjs` | Apply SQL; shared pg connection (local/remote SSL) |
| `db-check.mjs` | Read-only state check |
| `ingest-kohepets.mjs` | Products from Kohepets |
| `ingest-google-places.mjs` | Groomers + vets from Google Places |
| `backfill-contacts.mjs` | Structured contacts + website email/WhatsApp/booking enrichment |
| `embed-knowledge.mjs` | Embed rows into knowledge_chunks |
| `lib/parse.mjs` | Shared HTML / product-section parsing |
| `probe-product-providers.mjs` | Endpoint probe (exploration only) |
