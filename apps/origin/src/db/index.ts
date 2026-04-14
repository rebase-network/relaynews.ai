import pg from "pg";
import { Kysely, PostgresDialect } from "kysely";

import { config } from "../config";
import type { Database } from "./types";

const { Pool, types } = pg;

types.setTypeParser(types.builtins.INT8, (value: string) => Number(value));
types.setTypeParser(types.builtins.NUMERIC, (value: string) => Number(value));
types.setTypeParser(types.builtins.TIMESTAMPTZ, (value: string) =>
  new Date(value).toISOString(),
);
types.setTypeParser(types.builtins.TIMESTAMP, (value: string) =>
  new Date(`${value}Z`).toISOString(),
);

export function createDb() {
  const pool = new Pool({
    connectionString: config.DATABASE_URL,
    max: config.NODE_ENV === "production" ? 10 : 4,
  });

  return new Kysely<Database>({
    dialect: new PostgresDialect({ pool }),
  });
}
