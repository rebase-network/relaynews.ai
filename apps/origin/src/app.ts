import fastify from "fastify";
import cors from "@fastify/cors";
import sensible from "@fastify/sensible";
import type { FastifyInstance } from "fastify";
import cron from "node-cron";
import type { Kysely } from "kysely";

import { config } from "./config";
import { createDb } from "./db";
import type { Database } from "./db/types";
import { refreshPublicData } from "./lib/refresh-public-data";
import { registerAdminRoutes } from "./routes/admin";
import { registerProbeRoutes } from "./routes/probe";
import { registerPublicRoutes } from "./routes/public";

declare module "fastify" {
  interface FastifyInstance {
    db: Kysely<Database>;
  }
}

export async function buildApp() {
  const app = fastify({
    logger: config.NODE_ENV === "development",
  });

  const db = createDb();
  app.decorate("db", db);

  await app.register(cors, {
    origin: true,
  });
  await app.register(sensible);

  const healthHandler = async () => ({ ok: true });
  app.get("/health", healthHandler);
  if (config.API_BASE_PATH) {
    app.get(`${config.API_BASE_PATH}/health`, healthHandler);
  }

  const registerApiRoutes = async (target: FastifyInstance) => {
    await registerPublicRoutes(target);
    await registerProbeRoutes(target);
    await registerAdminRoutes(target);
  };

  if (config.API_BASE_PATH) {
    await app.register(async (scopedApp) => {
      await registerApiRoutes(scopedApp);
    }, {
      prefix: config.API_BASE_PATH,
    });
  } else {
    await registerApiRoutes(app);
  }

  if (config.ENABLE_SCHEDULER) {
    cron.schedule("*/5 * * * *", async () => {
      try {
        await refreshPublicData(db);
        app.log.info("Refreshed public data snapshots");
      } catch (error) {
        app.log.error(error, "Failed to refresh public data snapshots");
      }
    });
  }

  app.addHook("onClose", async () => {
    await db.destroy();
  });

  return app;
}
