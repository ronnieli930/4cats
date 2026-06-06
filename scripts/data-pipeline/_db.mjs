// Shared Postgres connection for pipeline scripts.
// SSL is enabled only for remote hosts; local Docker Postgres has no SSL.
import "dotenv/config";
import pg from "pg";

const { Client, Pool } = pg;

function isLocal(connectionString) {
  return /@(localhost|127\.0\.0\.1|0\.0\.0\.0)[:/]/.test(connectionString);
}

function config() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL missing from env");
  return {
    connectionString,
    ssl: isLocal(connectionString) ? false : { rejectUnauthorized: false },
    connectionTimeoutMillis: 8000,
  };
}

export function describeTarget() {
  const cs = process.env.DATABASE_URL ?? "";
  const host = cs.match(/@([^:/?#]+)/)?.[1] ?? "?";
  return `${isLocal(cs) ? "LOCAL" : "REMOTE"} (${host})`;
}

export async function getClient() {
  const client = new Client(config());
  await client.connect();
  return client;
}

export function getPool() {
  return new Pool({ ...config(), max: 4 });
}
