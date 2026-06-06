#!/usr/bin/env node
// Apply a .sql file to DATABASE_URL using node-postgres (no psql dependency).
// Usage: node scripts/data-pipeline/apply-sql.mjs <path/to/file.sql>

import { readFile } from "node:fs/promises";
import { describeTarget, getClient } from "./_db.mjs";

async function main() {
  const sqlFile = process.argv[2];
  if (!sqlFile) throw new Error("Usage: apply-sql.mjs <file.sql>");

  const sql = await readFile(sqlFile, "utf8");
  const client = await getClient();
  console.log(`Applying ${sqlFile} -> ${describeTarget()} ...`);
  await client.query(sql);
  console.log("OK");
  await client.end();
}

main().catch((e) => {
  console.error("apply-sql failed:", e.message);
  process.exitCode = 1;
});
