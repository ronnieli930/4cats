#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const PROVIDERS = {
  kohe: {
    baseUrl: "https://www.kohepets.com.sg",
    searchPath: "/search",
  },
  plc: {
    baseUrl: "https://www.petloverscentre.com",
    searchPath: "/search",
  },
};

const DEFAULT_HEADERS = {
  accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,application/json;q=0.8,*/*;q=0.7",
  "accept-language": "en-SG,en;q=0.9",
  "user-agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
};

function parseArgs(argv) {
  const args = {
    provider: "all",
    query: "orchard hay",
    pages: 1,
    detailLimit: 3,
    outDir: path.join("/tmp", "fourcats-provider-probes"),
    plcHtml: "",
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];

    if (arg === "--provider" && next) {
      args.provider = next;
      i += 1;
    } else if (arg === "--query" && next) {
      args.query = next;
      i += 1;
    } else if (arg === "--pages" && next) {
      args.pages = Number(next);
      i += 1;
    } else if (arg === "--detail-limit" && next) {
      args.detailLimit = Number(next);
      i += 1;
    } else if (arg === "--out" && next) {
      args.outDir = next;
      i += 1;
    } else if (arg === "--plc-html" && next) {
      args.plcHtml = next;
      i += 1;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
  }

  return args;
}

function printHelp() {
  console.log(`Usage:
  pnpm probe:products -- --provider all --query "orchard hay"
  pnpm probe:products -- --provider kohe --query "acana dog" --detail-limit 5
  pnpm probe:products -- --provider plc --query "rabbit food" --pages 3

Options:
  --provider       all | kohe | plc
  --query          Search phrase to probe
  --pages          Search result pages to fetch for HTML endpoints
  --detail-limit   Product detail pages to fetch where handles are discoverable
  --out            Directory for raw response samples
  --plc-html       Optional local PLC search HTML file to parse instead of fetching PLC
`);
}

function plusQuery(value) {
  return encodeURIComponent(value).replaceAll("%20", "+");
}

function stripHtml(html) {
  return htmlToText(html).replaceAll(/\s+/g, " ").trim();
}

function htmlToText(html) {
  return decodeHtmlEntities(
    html
      .replaceAll(/<script[\s\S]*?<\/script>/gi, " ")
      .replaceAll(/<style[\s\S]*?<\/style>/gi, " ")
      .replaceAll(/<(br|hr)\s*\/?>/gi, "\n")
      .replaceAll(/<\/(p|div|li|ul|ol|h[1-6]|table|tr)>/gi, "\n")
      .replaceAll(/<[^>]+>/g, " ")
      .replaceAll(/[ \t]+/g, " ")
      .replaceAll(/\n\s+/g, "\n")
      .replaceAll(/\n{3,}/g, "\n\n")
      .trim(),
  );
}

function decodeHtmlEntities(value) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&apos;", "'")
    .replaceAll("&nbsp;", " ")
    .replaceAll(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replaceAll(/&#x([0-9a-f]+);/gi, (_, n) =>
      String.fromCodePoint(Number.parseInt(n, 16)),
    );
}

function truncate(value, maxLength = 220) {
  if (!value) {
    return "";
  }

  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}

async function fetchText(url, accept = DEFAULT_HEADERS.accept) {
  const startedAt = Date.now();
  const response = await fetch(url, {
    headers: {
      ...DEFAULT_HEADERS,
      accept,
    },
    redirect: "follow",
    signal: AbortSignal.timeout(30_000),
  });
  const text = await response.text();

  return {
    url,
    status: response.status,
    ok: response.ok,
    contentType: response.headers.get("content-type") ?? "",
    bytes: Buffer.byteLength(text),
    elapsedMs: Date.now() - startedAt,
    text,
  };
}

async function fetchJson(url) {
  const result = await fetchText(
    url,
    "application/json,text/plain;q=0.8,*/*;q=0.5",
  );
  let json = null;
  let jsonError = null;

  try {
    json = JSON.parse(result.text);
  } catch (error) {
    jsonError = error instanceof Error ? error.message : String(error);
  }

  return { ...result, json, jsonError };
}

async function writeRaw(outDir, provider, filename, content) {
  const providerDir = path.join(outDir, provider);
  await mkdir(providerDir, { recursive: true });
  const filePath = path.join(providerDir, filename);
  await writeFile(filePath, content);
  return filePath;
}

function extractHrefs(html, baseUrl) {
  const hrefs = new Set();

  for (const match of html.matchAll(/href\s*=\s*["']([^"']+)["']/gi)) {
    const rawHref = decodeHtmlEntities(match[1]);

    try {
      hrefs.add(new URL(rawHref, baseUrl).toString());
    } catch {
      // Ignore malformed hrefs from scripts/templates.
    }
  }

  return [...hrefs];
}

function extractShopifyProductHandles(html) {
  const handles = new Set();

  for (const match of html.matchAll(
    /href\s*=\s*["'][^"']*\/products\/([^"'/?#]+)[^"']*["']/gi,
  )) {
    handles.add(decodeURIComponent(match[1]));
  }

  return [...handles];
}

function extractJsonLdProducts(html) {
  const records = [];

  for (const match of html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    const body = decodeHtmlEntities(match[1].trim());

    try {
      const parsed = JSON.parse(body);
      const items = Array.isArray(parsed) ? parsed : [parsed];

      for (const item of items) {
        if (item?.["@type"] === "Product") {
          records.push(item);
        }

        if (Array.isArray(item?.itemListElement)) {
          for (const element of item.itemListElement) {
            if (element?.item?.["@type"] === "Product") {
              records.push(element.item);
            }
          }
        }
      }
    } catch {
      // Some themes emit invalid or analytics-flavored JSON-LD. Keep probing.
    }
  }

  return records;
}

function summarizeShopifyProduct(product) {
  const variants = Array.isArray(product?.variants) ? product.variants : [];
  const prices = variants
    .map((variant) => Number(variant.price))
    .filter((price) => Number.isFinite(price));
  const descriptionHtml = product?.description ?? product?.body_html ?? "";
  const descriptionText = stripHtml(descriptionHtml);
  const sections = extractProductSections(descriptionHtml);

  return {
    id: product?.id,
    title: product?.title,
    handle: product?.handle,
    vendor: product?.vendor,
    type: product?.type,
    tags: product?.tags,
    available: product?.available,
    variantCount: variants.length,
    priceMin: prices.length ? Math.min(...prices) : null,
    priceMax: prices.length ? Math.max(...prices) : null,
    firstVariant: variants[0]
      ? {
          id: variants[0].id,
          title: variants[0].title,
          sku: variants[0].sku,
          available: variants[0].available,
          price: variants[0].price,
        }
      : null,
    descriptionPreview: truncate(descriptionText),
    ingredientsPreview: truncate(sections.ingredients),
    nutritionalAnalysisPreview: truncate(sections.nutritionalAnalysis),
    suitableForPreview: truncate(sections.suitableFor),
    feedingInstructionsPreview: truncate(sections.feedingInstructions),
  };
}

const PRODUCT_SECTION_HEADINGS = [
  ["ingredients", /^ingredients?:?$/i],
  ["composition", /^composition:?$/i],
  [
    "nutritionalAnalysis",
    /^(nutritional analysis|guaranteed analysis|analytical constituents?):?$/i,
  ],
  ["nutritionalAdditives", /^nutritional additives?:?$/i],
  ["calorieContent", /^calorie content:?$/i],
  ["suitableFor", /^suitable for:?$/i],
  [
    "feedingInstructions",
    /^(feeding instructions|feeding guide|directions):?$/i,
  ],
  ["countryOfOrigin", /^country of origin:?$/i],
  ["storage", /^storage:?$/i],
];

function extractProductSections(html) {
  const lines = htmlToText(html)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const sections = {};
  let currentKey = null;

  for (const line of lines) {
    const heading = PRODUCT_SECTION_HEADINGS.find(([, pattern]) =>
      pattern.test(line),
    );

    if (heading) {
      currentKey = heading[0];
      sections[currentKey] ??= "";
      continue;
    }

    if (currentKey) {
      sections[currentKey] = `${sections[currentKey]} ${line}`.trim();
    }
  }

  return sections;
}

function parsePetLoversItems(html) {
  const items = [];

  for (const blockMatch of html.matchAll(
    /items\.push\(\s*\{([\s\S]*?)\}\s*\)/g,
  )) {
    const block = blockMatch[1];
    const item = {};

    for (const fieldMatch of block.matchAll(
      /'([^']+)'\s*:\s*(?:"((?:\\"|[^"])*)"|'((?:\\'|[^'])*)'|(-?\d+(?:\.\d+)?))/g,
    )) {
      const [, key, doubleQuoted, singleQuoted, numeric] = fieldMatch;

      if (numeric !== undefined) {
        item[key] = Number(numeric);
      } else {
        item[key] = (doubleQuoted ?? singleQuoted ?? "")
          .replaceAll('\\"', '"')
          .replaceAll("\\'", "'");
      }
    }

    if (item.item_id) {
      items.push(item);
    }
  }

  return items;
}

function summarizePetLoversItem(item) {
  return {
    externalId: item.item_id,
    name: item.item_name,
    brand: item.item_brand,
    petType: item.item_category,
    category: item.item_category2,
    subcategory: item.item_category3,
    flavour: item.item_variant1,
    size: item.item_variant3,
    price: item.price,
    discount: item.discount,
    currency: item.currency,
  };
}

function summarizeHtmlProbe(result) {
  const text = result.text;

  return {
    url: result.url,
    status: result.status,
    contentType: result.contentType,
    bytes: result.bytes,
    elapsedMs: result.elapsedMs,
    title: text.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? null,
    cloudflareLike:
      text.includes("_cf_chl_opt") ||
      text.includes("Just a moment") ||
      text.includes("challenge-platform"),
  };
}

async function probeKohepets(args) {
  const provider = "kohe";
  const { baseUrl } = PROVIDERS.kohe;
  const searchUrl = `${baseUrl}/search?type=product&q=${plusQuery(args.query)}`;
  const suggestUrl = `${baseUrl}/search/suggest.json?q=${encodeURIComponent(
    args.query,
  )}&resources[type]=product&resources[limit]=10&resources[options][unavailable_products]=last`;
  const summary = {
    provider,
    query: args.query,
    probes: {},
    products: [],
    rawFiles: [],
  };

  const suggest = await fetchJson(suggestUrl);
  summary.probes.suggest = {
    url: suggest.url,
    status: suggest.status,
    contentType: suggest.contentType,
    bytes: suggest.bytes,
    elapsedMs: suggest.elapsedMs,
    jsonError: suggest.jsonError,
    productCount: suggest.json?.resources?.results?.products?.length ?? 0,
  };
  summary.rawFiles.push(
    await writeRaw(
      args.outDir,
      provider,
      "search-suggest.json",
      JSON.stringify(suggest.json ?? suggest.text.slice(0, 5000), null, 2),
    ),
  );

  const htmlResult = await fetchText(searchUrl);
  summary.probes.searchHtml = summarizeHtmlProbe(htmlResult);
  summary.rawFiles.push(
    await writeRaw(args.outDir, provider, "search.html", htmlResult.text),
  );

  const handles = extractShopifyProductHandles(htmlResult.text);
  const jsonLdProducts = extractJsonLdProducts(htmlResult.text);
  summary.probes.searchHtml.productHandles = handles.slice(0, 12);
  summary.probes.searchHtml.productHandleCount = handles.length;
  summary.probes.searchHtml.jsonLdProductCount = jsonLdProducts.length;
  summary.probes.searchHtml.jsonLdProducts = jsonLdProducts
    .slice(0, 3)
    .map((item) => ({
      name: item.name,
      brand: item.brand?.name ?? item.brand,
      sku: item.sku,
      url: item.url,
      offers: item.offers,
    }));

  const suggestProducts = suggest.json?.resources?.results?.products ?? [];
  summary.probes.suggest.products = suggestProducts.slice(0, 5).map((item) => ({
    title: item.title,
    url: item.url,
    vendor: item.vendor,
    price: item.price,
  }));

  const handlesToFetch = [
    ...new Set([
      ...handles,
      ...suggestProducts
        .map((item) => item.url?.match(/\/products\/([^/?#]+)/)?.[1])
        .filter(Boolean),
    ]),
  ].slice(0, args.detailLimit);

  for (const handle of handlesToFetch) {
    const detailUrl = `${baseUrl}/products/${handle}.js`;
    const detail = await fetchJson(detailUrl);
    summary.rawFiles.push(
      await writeRaw(
        args.outDir,
        provider,
        `product-${handle}.json`,
        JSON.stringify(detail.json ?? detail.text.slice(0, 5000), null, 2),
      ),
    );
    summary.products.push({
      handle,
      probe: {
        url: detail.url,
        status: detail.status,
        contentType: detail.contentType,
        bytes: detail.bytes,
        elapsedMs: detail.elapsedMs,
        jsonError: detail.jsonError,
      },
      product: detail.json ? summarizeShopifyProduct(detail.json) : null,
    });
  }

  return summary;
}

async function probePetLoversCentre(args) {
  const provider = "plc";
  const { baseUrl } = PROVIDERS.plc;
  const summary = {
    provider,
    query: args.query,
    pages: [],
    products: [],
    rawFiles: [],
  };
  const seenIds = new Set();

  if (args.plcHtml) {
    const html = await readFile(args.plcHtml, "utf8");
    await addPetLoversPageSummary({
      summary,
      args,
      htmlResult: {
        url: args.plcHtml,
        status: 200,
        ok: true,
        contentType: "text/html; local-file",
        bytes: Buffer.byteLength(html),
        elapsedMs: 0,
        text: html,
      },
      page: 0,
      baseUrl,
      seenIds,
    });
  } else {
    for (let page = 1; page <= args.pages; page += 1) {
      const searchUrl = `${baseUrl}/search?GroupID=&PageNum=${page}&searchsuggest=${plusQuery(
        args.query,
      )}`;
      const htmlResult = await fetchText(searchUrl);
      await addPetLoversPageSummary({
        summary,
        args,
        htmlResult,
        page,
        baseUrl,
        seenIds,
      });
    }
  }

  await writeRaw(
    args.outDir,
    provider,
    "parsed-products.json",
    JSON.stringify(summary.products, null, 2),
  );

  return summary;
}

async function addPetLoversPageSummary({
  summary,
  args,
  htmlResult,
  page,
  baseUrl,
  seenIds,
}) {
  const provider = "plc";
  const rawFile = await writeRaw(
    args.outDir,
    provider,
    `search-page-${page}.html`,
    htmlResult.text,
  );
  const items = parsePetLoversItems(htmlResult.text);
  const hrefs = extractHrefs(htmlResult.text, baseUrl);
  const internalHrefs = hrefs.filter((href) => href.startsWith(baseUrl));
  const productishHrefs = internalHrefs.filter(
    (href) =>
      /\/products?\//i.test(href) ||
      /product/i.test(href) ||
      /ProductID|ProductId|VariantID|VariantId/.test(href),
  );

  summary.rawFiles.push(rawFile);
  summary.pages.push({
    ...summarizeHtmlProbe(htmlResult),
    page,
    inlineItemCount: items.length,
    hrefCount: hrefs.length,
    internalHrefSamples: internalHrefs.slice(0, 8),
    productishHrefSamples: productishHrefs.slice(0, 8),
    pageTotal:
      htmlResult.text.match(/>\s*(\d+)\s*(?:&nbsp;|\s)+items in list/i)?.[1] ??
      null,
  });

  for (const item of items) {
    if (seenIds.has(item.item_id)) {
      continue;
    }

    seenIds.add(item.item_id);
    summary.products.push(summarizePetLoversItem(item));
  }
}

async function main() {
  const args = parseArgs(process.argv);
  const providers =
    args.provider === "all" ? ["kohe", "plc"] : args.provider.split(",");
  const summaries = [];

  for (const provider of providers) {
    if (!["kohe", "plc"].includes(provider)) {
      throw new Error(`Unknown provider "${provider}". Use all, kohe, or plc.`);
    }

    console.log(`\n=== ${provider} :: ${args.query} ===`);
    const summary =
      provider === "kohe"
        ? await probeKohepets(args)
        : await probePetLoversCentre(args);

    summaries.push(summary);
    console.log(JSON.stringify(summary, null, 2));
  }

  await mkdir(args.outDir, { recursive: true });
  const summaryPath = path.join(args.outDir, "summary.json");
  await writeFile(summaryPath, JSON.stringify(summaries, null, 2));
  console.log(`\nWrote probe summary to ${summaryPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
