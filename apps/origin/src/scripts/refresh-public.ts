import process from "node:process";

import { createDb } from "../db";
import { refreshPublicData } from "../lib/refresh-public-data";

async function main() {
  const db = createDb();
  try {
    const result = await refreshPublicData(db);
    console.log(`Refreshed public snapshots at ${result.measuredAt}`);
  } finally {
    await db.destroy();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
