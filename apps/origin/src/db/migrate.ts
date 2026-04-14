import { access, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import pg from "pg";

import { config } from "../config";

async function main() {
  const candidates = [
    path.resolve(process.cwd(), "db/migrations/0001_initial.sql"),
    path.resolve(process.cwd(), "apps/origin/db/migrations/0001_initial.sql"),
  ];
  const sqlPath = (
    await Promise.all(
      candidates.map(async (candidate) => {
        try {
          await access(candidate);
          return candidate;
        } catch {
          return null;
        }
      }),
    )
  ).find((candidate): candidate is string => candidate !== null);

  if (!sqlPath) {
    throw new Error("Could not find 0001_initial.sql migration file");
  }

  const migrationSql = await readFile(sqlPath, "utf8");
  const client = new pg.Client({ connectionString: config.DATABASE_URL });

  await client.connect();
  try {
    await client.query(migrationSql);
    console.log(`Applied migration: ${sqlPath}`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
