#!/usr/bin/env node
// Populate public.service_place_contacts (the structured contact/booking surface).
//
// Base pass: phone / website / google_maps contacts from existing service_places
//   columns (free, no network).
// Enrich pass (default on): fetch each place's website (+ a /contact page) and
//   extract email / WhatsApp / Calendly / contact-form links; set
//   service_places.primary_email + booking_url + contact_source.
//
// Usage:
//   node scripts/data-pipeline/backfill-contacts.mjs            # base + enrich
//   node scripts/data-pipeline/backfill-contacts.mjs --base-only
//   node scripts/data-pipeline/backfill-contacts.mjs --concurrency 6

import { describeTarget, getPool } from "./_db.mjs";
import { decodeHtmlEntities } from "./lib/parse.mjs";

const HEADERS = {
  accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
  "accept-language": "en-SG,en;q=0.9",
  "user-agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
};

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const EMAIL_JUNK =
  /(sentry|wixpress|wix\.com|mysite\.com|example\.(com|org)|your-?email|email@|name@|user@|test@|@email\.com|@domain|\.png|\.jpg|\.jpeg|\.gif|\.webp|@sentry|@2x|domain\.com|yourdomain|u003e|placeholder|godaddy|squarespace)/i;

function parseArgs(argv) {
  const args = { enrich: true, concurrency: 6, timeout: 15000 };
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    const next = argv[i + 1];
    if (a === "--base-only") args.enrich = false;
    else if (a === "--concurrency" && next) args.concurrency = Number(next), (i += 1);
    else if (a === "--timeout" && next) args.timeout = Number(next), (i += 1);
  }
  return args;
}

function normalizePhone(value) {
  return value ? value.replace(/[^\d+]/g, "") : null;
}

async function fetchHtml(url, timeout) {
  const res = await fetch(url, {
    headers: HEADERS,
    redirect: "follow",
    signal: AbortSignal.timeout(timeout),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const ct = res.headers.get("content-type") ?? "";
  if (!ct.includes("html") && !ct.includes("text")) throw new Error(`non-html ${ct}`);
  return await res.text();
}

function extractHrefs(html, baseUrl) {
  const out = [];
  for (const m of html.matchAll(/href\s*=\s*["']([^"']+)["']/gi)) {
    out.push(decodeHtmlEntities(m[1]));
  }
  return out;
}

function extractContacts(html, baseUrl) {
  const hrefs = extractHrefs(html, baseUrl);
  const emails = new Set();
  const whatsapp = new Set();
  const calendly = new Set();
  const contactForms = new Set();

  for (const href of hrefs) {
    const lower = href.toLowerCase();
    if (lower.startsWith("mailto:")) {
      const e = href.slice(7).split("?")[0].trim().toLowerCase();
      if (e && !EMAIL_JUNK.test(e)) emails.add(e);
    } else if (/wa\.me\/|api\.whatsapp\.com|whatsapp:\/\//.test(lower)) {
      try {
        whatsapp.add(new URL(href, baseUrl).toString());
      } catch {}
    } else if (lower.includes("calendly.com")) {
      try {
        calendly.add(new URL(href, baseUrl).toString());
      } catch {}
    } else if (/\/(contact|book|booking|appointment|enquir)/.test(lower)) {
      try {
        contactForms.add(new URL(href, baseUrl).toString());
      } catch {}
    }
  }

  // Plain-text emails (footers etc.) not behind mailto:.
  for (const m of html.matchAll(EMAIL_RE)) {
    const e = m[0].toLowerCase();
    if (!EMAIL_JUNK.test(e)) emails.add(e);
  }

  return {
    emails: [...emails].slice(0, 5),
    whatsapp: [...whatsapp].slice(0, 2),
    calendly: [...calendly].slice(0, 2),
    contactForms: [...contactForms].slice(0, 3),
  };
}

const CONTACT_UPSERT = `
insert into public.service_place_contacts
  (service_place_id, method, label, value, normalized_value, is_booking_capable, source, confidence, raw)
values ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)
on conflict (service_place_id, method, value) do update set
  label = excluded.label, normalized_value = excluded.normalized_value,
  is_booking_capable = excluded.is_booking_capable,
  confidence = greatest(public.service_place_contacts.confidence, excluded.confidence)`;

async function addContact(pool, placeId, c) {
  await pool.query(CONTACT_UPSERT, [
    placeId,
    c.method,
    c.label ?? null,
    c.value,
    c.normalized_value ?? null,
    c.is_booking_capable ?? false,
    c.source ?? "google_places",
    c.confidence ?? 1.0,
    JSON.stringify(c.raw ?? {}),
  ]);
}

// Minimal concurrency pool.
async function pmap(items, concurrency, worker) {
  let i = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      await worker(items[idx], idx);
    }
  });
  await Promise.all(runners);
}

async function main() {
  const args = parseArgs(process.argv);
  console.log(`Backfill contacts -> ${describeTarget()} | enrich=${args.enrich}`);
  const pool = getPool();

  const { rows: places } = await pool.query(
    `select id, name, national_phone_number, website_url, google_maps_url
       from public.service_places order by created_at`,
  );
  console.log(`${places.length} places`);

  // --- base pass (no network) ---
  let baseContacts = 0;
  for (const p of places) {
    if (p.national_phone_number) {
      await addContact(pool, p.id, {
        method: "phone",
        value: p.national_phone_number,
        normalized_value: normalizePhone(p.national_phone_number),
        is_booking_capable: true,
        source: "google_places",
      });
      baseContacts++;
    }
    if (p.website_url) {
      await addContact(pool, p.id, {
        method: "website",
        value: p.website_url,
        source: "google_places",
      });
      baseContacts++;
    }
    if (p.google_maps_url) {
      await addContact(pool, p.id, {
        method: "google_maps",
        value: p.google_maps_url,
        is_booking_capable: true,
        source: "google_places",
      });
      baseContacts++;
    }
  }
  console.log(`base pass: ${baseContacts} contacts`);

  if (!args.enrich) {
    await pool.end();
    console.log("done (base only)");
    return;
  }

  // --- enrich pass (visit websites) ---
  const withSites = places.filter((p) => p.website_url);
  console.log(`enriching ${withSites.length} websites (concurrency ${args.concurrency})...`);
  const stats = { emails: 0, whatsapp: 0, calendly: 0, forms: 0, failed: 0 };

  await pmap(withSites, args.concurrency, async (p) => {
    const base = p.website_url;
    let found = { emails: [], whatsapp: [], calendly: [], contactForms: [] };
    try {
      const html = await fetchHtml(base, args.timeout);
      found = extractContacts(html, base);
      // If no email on homepage, try a contact page.
      if (!found.emails.length && found.contactForms.length) {
        try {
          const html2 = await fetchHtml(found.contactForms[0], args.timeout);
          const c2 = extractContacts(html2, found.contactForms[0]);
          found.emails = c2.emails;
          found.whatsapp = [...new Set([...found.whatsapp, ...c2.whatsapp])];
          found.calendly = [...new Set([...found.calendly, ...c2.calendly])];
        } catch {}
      }
    } catch (e) {
      stats.failed++;
      return;
    }

    for (const e of found.emails) {
      await addContact(pool, p.id, {
        method: "email", value: e, normalized_value: e,
        is_booking_capable: true, source: "website", confidence: 0.7,
      });
      stats.emails++;
    }
    for (const w of found.whatsapp) {
      await addContact(pool, p.id, {
        method: "whatsapp", value: w, is_booking_capable: true,
        source: "website", confidence: 0.8,
      });
      stats.whatsapp++;
    }
    for (const c of found.calendly) {
      await addContact(pool, p.id, {
        method: "calendly", value: c, is_booking_capable: true,
        source: "website", confidence: 0.9,
      });
      stats.calendly++;
    }
    for (const f of found.contactForms) {
      await addContact(pool, p.id, {
        method: "contact_form", value: f, is_booking_capable: true,
        source: "website", confidence: 0.6,
      });
      stats.forms++;
    }

    // Promote best contact to the place row for quick agent access.
    const email = found.emails[0] ?? null;
    const bookingUrl =
      found.calendly[0] ?? found.contactForms[0] ?? found.whatsapp[0] ?? null;
    if (email || bookingUrl) {
      await pool.query(
        `update public.service_places
           set primary_email = coalesce($2, primary_email),
               booking_url = coalesce(booking_url, $3),
               contact_source = 'website', updated_at = now()
         where id = $1`,
        [p.id, email, bookingUrl],
      );
    }
  });

  await pool.end();
  console.log("\nenrich:", JSON.stringify(stats));
}

main().catch((e) => {
  console.error("backfill-contacts failed:", e.message);
  process.exitCode = 1;
});
