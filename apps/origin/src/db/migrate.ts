import { access, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import pg from "pg";

import { config } from "../config";

async function main() {
  const candidates = [
    path.resolve(process.cwd(), "db/migrations"),
    path.resolve(process.cwd(), "apps/origin/db/migrations"),
  ];
  const migrationsDir = (
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

  if (!migrationsDir) {
    throw new Error("Could not find the migrations directory");
  }

  const migrationFiles = (await readdir(migrationsDir))
    .filter((fileName) => fileName.endsWith(".sql"))
    .sort();

  if (migrationFiles.length === 0) {
    throw new Error(`No SQL migrations found in ${migrationsDir}`);
  }

  const client = new pg.Client({ connectionString: config.DATABASE_URL });

  await client.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        migration_name text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    for (const fileName of migrationFiles) {
      const { rows } = await client.query<{ exists: boolean }>(
        "SELECT EXISTS (SELECT 1 FROM schema_migrations WHERE migration_name = $1) AS exists",
        [fileName],
      );

      if (rows[0]?.exists) {
        console.log(`Skipping migration already tracked: ${fileName}`);
        continue;
      }

      // The initial schema shipped before schema_migrations existed, so adopt it
      // instead of failing redeploys when the base tables are already present.
      if (fileName === "0001_initial.sql") {
        const { rows: adoptionRows } = await client.query<{ relation: string | null }>(
          "SELECT to_regclass($1) AS relation",
          ["public.relays"],
        );

        if (adoptionRows[0]?.relation) {
          await client.query(
            "INSERT INTO schema_migrations (migration_name) VALUES ($1) ON CONFLICT DO NOTHING",
            [fileName],
          );
          console.log(`Adopted existing migration state: ${fileName}`);
          continue;
        }
      }

      const sqlPath = path.join(migrationsDir, fileName);
      const migrationSql = await readFile(sqlPath, "utf8");

      await client.query("BEGIN");
      try {
        await client.query(migrationSql);
        await client.query("INSERT INTO schema_migrations (migration_name) VALUES ($1)", [fileName]);
        await client.query("COMMIT");
        console.log(`Applied migration: ${sqlPath}`);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
