import process from "node:process";

import { buildApp } from "./app";
import { config } from "./config";

async function main() {
  const app = await buildApp();
  await app.listen({
    host: config.HOST,
    port: config.PORT,
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
