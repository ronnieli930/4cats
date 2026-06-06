// Shared HTML / product-description parsing helpers for the data pipeline.
// Logic mirrors probe-product-providers.mjs (proven against Kohepets Shopify).

export function decodeHtmlEntities(value) {
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

export function htmlToText(html) {
  if (!html) return "";
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

export function stripHtml(html) {
  return htmlToText(html).replaceAll(/\s+/g, " ").trim();
}

export function truncate(value, maxLength = 220) {
  if (!value) return "";
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
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
  ["feedingInstructions", /^(feeding instructions|feeding guide|directions):?$/i],
  ["countryOfOrigin", /^country of origin:?$/i],
  ["storage", /^storage:?$/i],
];

// Walks the text line by line; when a line is exactly a known heading, the lines
// that follow accumulate into that section until the next heading.
export function extractProductSections(html) {
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
