-- Little Lovely Pets — data pipeline schema (CANONICAL, Prisma-independent).
--
-- These tables (products, service_places, knowledge_chunks, pgvector, RPCs) are
-- NOT modeled in prisma/schema.prisma, so `prisma migrate dev`/`db push` treats
-- them as drift and DROPS them. To avoid that:
--   * This file lives outside prisma/migrations/ so Prisma never regenerates it.
--   * It is fully idempotent (create-if-not-exists / add-column-if-not-exists /
--     create-or-replace), so re-running is always safe.
--   * Apply it with `pnpm db:apply:pipeline` after any Prisma reset.
--   * Use `prisma migrate deploy` (never `migrate dev`/`db push`/`reset`) on a DB
--     that holds these tables.
--
-- It also (re)creates Pet + CareLog with if-not-exists, so a fresh local DB is
-- fully usable from this one file alone.

create extension if not exists pgcrypto;
create extension if not exists vector;

create table if not exists public."Pet" (
  "id" text not null,
  "userId" text not null,
  "name" text not null,
  "species" text not null,
  "breed" text,
  "createdAt" timestamp(3) not null default current_timestamp,
  "updatedAt" timestamp(3) not null,
  constraint "Pet_pkey" primary key ("id")
);

alter table public."Pet"
  add column if not exists "ageYears" numeric(5, 2),
  add column if not exists "weightKg" numeric(6, 2),
  add column if not exists "medicalConditions" text[] not null default '{}',
  add column if not exists "dietaryRestrictions" text[] not null default '{}',
  add column if not exists "locationPostalCode" text,
  add column if not exists "locationLabel" text,
  add column if not exists "notes" text;

create index if not exists "Pet_userId_idx" on public."Pet"("userId");

create table if not exists public."CareLog" (
  "id" text not null default gen_random_uuid()::text,
  "petId" text not null references public."Pet"("id") on delete cascade,
  "fed" boolean,
  "mood" text check ("mood" in ('happy', 'ok', 'off', 'tired', 'anxious')),
  "weightKg" numeric(6, 2),
  "symptoms" text[] not null default '{}',
  "notes" text,
  "loggedAt" timestamp(3) not null default current_timestamp,
  "createdAt" timestamp(3) not null default current_timestamp,
  constraint "CareLog_pkey" primary key ("id")
);

create index if not exists "CareLog_petId_loggedAt_idx"
on public."CareLog"("petId", "loggedAt" desc);

create table if not exists public.ingestion_runs (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  pipeline text not null,
  query text,
  status text not null default 'running' check (status in ('running', 'succeeded', 'failed')),
  stats jsonb not null default '{}',
  error text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  source_product_id text not null,
  handle text,
  url text,
  title text not null,
  brand text,
  pet_type text,
  product_type text,
  tags text[] not null default '{}',
  price_min_cents integer,
  price_max_cents integer,
  currency text not null default 'SGD',
  available boolean,
  description text,
  ingredients text,
  nutritional_analysis text,
  suitable_for text,
  feeding_instructions text,
  country_of_origin text,
  raw jsonb not null default '{}',
  last_fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source, source_product_id)
);

create index if not exists products_source_handle_idx
on public.products(source, handle);
create index if not exists products_brand_idx on public.products(brand);
create index if not exists products_tags_gin_idx on public.products using gin(tags);
create index if not exists products_raw_gin_idx on public.products using gin(raw);

create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  source_variant_id text not null,
  title text,
  sku text,
  price_cents integer,
  compare_at_price_cents integer,
  available boolean,
  raw jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, source_variant_id)
);

create table if not exists public.service_places (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'google_places',
  source_place_id text not null,
  kind text not null check (kind in ('groomer', 'vet', 'pet_store', 'other')),
  name text not null,
  formatted_address text,
  postal_code text,
  neighbourhood text,
  lat double precision,
  lng double precision,
  rating numeric(3, 2),
  user_rating_count integer,
  price_level text,
  business_status text,
  national_phone_number text,
  international_phone_number text,
  website_url text,
  google_maps_url text,
  booking_url text,
  primary_email text,
  contact_source text,
  opening_hours jsonb not null default '{}',
  service_tags text[] not null default '{}',
  suitability_tags text[] not null default '{}',
  review_summary text,
  raw jsonb not null default '{}',
  last_fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source, source_place_id)
);

create index if not exists service_places_kind_rating_idx
on public.service_places(kind, rating desc nulls last, user_rating_count desc nulls last);
create index if not exists service_places_lat_lng_idx on public.service_places(lat, lng);
create index if not exists service_places_service_tags_gin_idx on public.service_places using gin(service_tags);
create index if not exists service_places_suitability_tags_gin_idx on public.service_places using gin(suitability_tags);
create index if not exists service_places_raw_gin_idx on public.service_places using gin(raw);

create table if not exists public.service_place_contacts (
  id uuid primary key default gen_random_uuid(),
  service_place_id uuid not null references public.service_places(id) on delete cascade,
  method text not null check (method in ('phone', 'email', 'website', 'contact_form', 'calendly', 'whatsapp', 'google_maps')),
  label text,
  value text not null,
  normalized_value text,
  is_booking_capable boolean not null default false,
  source text not null default 'google_places',
  confidence numeric(3, 2) not null default 1.0,
  raw jsonb not null default '{}',
  created_at timestamptz not null default now(),
  unique (service_place_id, method, value)
);

create index if not exists service_place_contacts_place_method_idx
on public.service_place_contacts(service_place_id, method);

create table if not exists public.place_reviews (
  id uuid primary key default gen_random_uuid(),
  service_place_id uuid not null references public.service_places(id) on delete cascade,
  source text not null default 'google_places',
  source_review_id text,
  rating integer check (rating between 1 and 5),
  text text,
  author_name text,
  author_uri text,
  language_code text,
  relative_publish_time_description text,
  published_at timestamptz,
  raw jsonb not null default '{}',
  created_at timestamptz not null default now(),
  unique (service_place_id, source, source_review_id)
);

create index if not exists place_reviews_place_rating_idx
on public.place_reviews(service_place_id, rating desc nulls last);

create table if not exists public.service_place_suitability (
  id uuid primary key default gen_random_uuid(),
  service_place_id uuid not null references public.service_places(id) on delete cascade,
  pet_species text,
  breed text,
  condition text,
  score numeric(5, 2) not null default 0,
  positive_evidence text[] not null default '{}',
  caution_evidence text[] not null default '{}',
  evidence_review_ids uuid[] not null default '{}',
  summary text,
  model text,
  raw jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (service_place_id, pet_species, breed, condition)
);

create index if not exists service_place_suitability_lookup_idx
on public.service_place_suitability(pet_species, breed, condition, score desc);

create table if not exists public.booking_requests (
  id uuid primary key default gen_random_uuid(),
  pet_id text references public."Pet"("id") on delete set null,
  service_place_id uuid references public.service_places(id) on delete set null,
  status text not null default 'draft' check (
    status in (
      'draft',
      'pending_user_confirmation',
      'email_drafted',
      'email_sent',
      'calendly_opened',
      'whatsapp_opened',
      'call_required',
      'confirmed',
      'cancelled',
      'failed'
    )
  ),
  requested_service text,
  requested_start_at timestamptz,
  requested_time_window text,
  customer_name text,
  customer_email text,
  customer_phone text,
  pet_snapshot jsonb not null default '{}',
  message text,
  outbound_channel text check (outbound_channel in ('email', 'calendly', 'whatsapp_link', 'phone', 'manual')),
  outbound_to text,
  outbound_payload jsonb not null default '{}',
  external_event_url text,
  provider_response jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists booking_requests_pet_created_at_idx
on public.booking_requests(pet_id, created_at desc);
create index if not exists booking_requests_place_created_at_idx
on public.booking_requests(service_place_id, created_at desc);

create table if not exists public.knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (
    entity_type in (
      'product',
      'product_variant',
      'service_place',
      'place_review',
      'service_place_suitability'
    )
  ),
  entity_id uuid not null,
  source text not null,
  title text,
  body text not null,
  metadata jsonb not null default '{}',
  embedding vector(1536),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists knowledge_chunks_entity_idx
on public.knowledge_chunks(entity_type, entity_id);
-- One chunk per entity (lets the embed step upsert on re-runs).
create unique index if not exists knowledge_chunks_entity_uniq
on public.knowledge_chunks(entity_type, entity_id);
create index if not exists knowledge_chunks_source_idx on public.knowledge_chunks(source);
create index if not exists knowledge_chunks_metadata_gin_idx on public.knowledge_chunks using gin(metadata);
create index if not exists knowledge_chunks_embedding_hnsw_idx
on public.knowledge_chunks using hnsw(embedding vector_cosine_ops);

create or replace function public.match_knowledge_chunks(
  query_embedding vector(1536),
  match_count integer default 8,
  filter jsonb default '{}'
)
returns table (
  id uuid,
  entity_type text,
  entity_id uuid,
  source text,
  title text,
  body text,
  metadata jsonb,
  similarity double precision
)
language sql
stable
as $$
  select
    kc.id,
    kc.entity_type,
    kc.entity_id,
    kc.source,
    kc.title,
    kc.body,
    kc.metadata,
    1 - (kc.embedding <=> query_embedding) as similarity
  from public.knowledge_chunks kc
  where kc.embedding is not null
    and (filter = '{}'::jsonb or kc.metadata @> filter)
  order by kc.embedding <=> query_embedding
  limit match_count;
$$;

create or replace function public.nearby_service_places(
  kind_filter text,
  origin_lat double precision,
  origin_lng double precision,
  radius_km double precision default 8,
  result_count integer default 10
)
returns table (
  id uuid,
  kind text,
  name text,
  formatted_address text,
  lat double precision,
  lng double precision,
  rating numeric,
  user_rating_count integer,
  national_phone_number text,
  website_url text,
  google_maps_url text,
  booking_url text,
  primary_email text,
  service_tags text[],
  suitability_tags text[],
  review_summary text,
  distance_km double precision
)
language sql
stable
as $$
  select
    sp.id,
    sp.kind,
    sp.name,
    sp.formatted_address,
    sp.lat,
    sp.lng,
    sp.rating,
    sp.user_rating_count,
    sp.national_phone_number,
    sp.website_url,
    sp.google_maps_url,
    sp.booking_url,
    sp.primary_email,
    sp.service_tags,
    sp.suitability_tags,
    sp.review_summary,
    (
      6371 * acos(
        least(
          1,
          greatest(
            -1,
            cos(radians(origin_lat))
            * cos(radians(sp.lat))
            * cos(radians(sp.lng) - radians(origin_lng))
            + sin(radians(origin_lat))
            * sin(radians(sp.lat))
          )
        )
      )
    ) as distance_km
  from public.service_places sp
  where sp.lat is not null
    and sp.lng is not null
    and (kind_filter is null or sp.kind = kind_filter)
    and (
      6371 * acos(
        least(
          1,
          greatest(
            -1,
            cos(radians(origin_lat))
            * cos(radians(sp.lat))
            * cos(radians(sp.lng) - radians(origin_lng))
            + sin(radians(origin_lat))
            * sin(radians(sp.lat))
          )
        )
      )
    ) <= radius_km
  order by distance_km asc, sp.rating desc nulls last, sp.user_rating_count desc nulls last
  limit result_count;
$$;
