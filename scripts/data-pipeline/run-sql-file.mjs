#!/usr/bin/env node

import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";

const SUPABASE_POOLER_REGIONS = [
  "ap-southeast-1",
  "ap-southeast-2",
  "ap-northeast-1",
  "ap-south-1",
  "us-east-1",
  "us-west-1",
  "us-west-2",
  "eu-central-1",
  "eu-west-1",
  "ca-central-1",
  "sa-east-1",
];

function parseArgs(argv) {
  const args = {
    sqlFile: "",
    discoverPooler: false,
    projectRef: "",
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];

    if (arg === "--discover-pooler") {
      args.discoverPooler = true;
    } else if (arg === "--project-ref" && next) {
      args.projectRef = next;
      i += 1;
    } else if (!args.sqlFile) {
      args.sqlFile = arg;
    }
  }

  return args;
}

function parseEnv(content) {
  const env = {};

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separator = trimmed.indexOf("=");

    if (separator === -1) {
      continue;
    }

    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    env[key] = value;
  }

  return env;
}

function parsePostgresUrl(connectionString) {
  const match = connectionString.match(
    /^postgres(?:ql)?:\/\/([^:]+):(.*)@([^:/?#]+)(?::(\d+))?\/([^?]+)(?:\?.*)?$/,
  );

  if (!match) {
    throw new Error("Could not parse DATABASE_URL from .env");
  }

  return {
    user: decodeURIComponent(match[1]),
    password: decodeURIComponent(match[2]),
    host: match[3],
    port: match[4] ?? "5432",
    database: decodeURIComponent(match[5]),
  };
}

function runPsql({ connection, sqlFile, command, silent = false }) {
  return new Promise((resolve, reject) => {
    const args = [
      "--set",
      "ON_ERROR_STOP=1",
      "--host",
      connection.host,
      "--port",
      connection.port,
      "--username",
      connection.user,
      "--dbname",
      connection.database,
    ];

    if (command) {
      args.push("--command", command);
    } else {
      args.push("--file", sqlFile);
    }

    const child = spawn("psql", args, {
      env: {
        ...process.env,
        PGCONNECT_TIMEOUT: "6",
        PGPASSWORD: connection.password,
      },
      stdio: silent ? "pipe" : "inherit",
    });

    let stderr = "";

    if (silent) {
      child.stderr?.on("data", (chunk) => {
        stderr += chunk.toString();
      });
    }

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve({ ok: true, stderr });
      } else {
        resolve({ ok: false, code, stderr });
      }
    });
  });
}

async function discoverPoolerConnection(baseConnection, projectRef) {
  if (!projectRef) {
    throw new Error("--project-ref is required with --discover-pooler");
  }

  for (const region of SUPABASE_POOLER_REGIONS) {
    const connection = {
      ...baseConnection,
      host: `aws-0-${region}.pooler.supabase.com`,
      port: "6543",
      user: `postgres.${projectRef}`,
    };
    const result = await runPsql({
      connection,
      command: "select current_database();",
      silent: true,
    });

    if (result.ok) {
      console.log(`Using Supabase pooler region: ${region}`);
      return connection;
    }

    const firstLine = result.stderr.split("\n").find(Boolean);
    console.log(
      `No pooler match in ${region}${firstLine ? `: ${firstLine}` : ""}`,
    );
  }

  throw new Error("Could not find a working Supabase pooler region");
}

async function main() {
  const args = parseArgs(process.argv);

  if (!args.sqlFile) {
    throw new Error(
      "Usage: node scripts/data-pipeline/run-sql-file.mjs <file.sql> [--discover-pooler --project-ref <ref>]",
    );
  }

  const env = parseEnv(await readFile(".env", "utf8"));
  const databaseUrl = env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is missing from .env");
  }

  const directConnection = parsePostgresUrl(databaseUrl);
  const connection = args.discoverPooler
    ? await discoverPoolerConnection(directConnection, args.projectRef)
    : directConnection;
  const result = await runPsql({ connection, sqlFile: args.sqlFile });

  if (!result.ok) {
    throw new Error(`psql exited with code ${result.code}`);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
