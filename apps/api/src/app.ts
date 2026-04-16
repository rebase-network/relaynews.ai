import fastify from "fastify";
import cors from "@fastify/cors";
import sensible from "@fastify/sensible";
import type { FastifyInstance } from "fastify";
import cron from "node-cron";
import type { Kysely } from "kysely";
import { ZodError } from "zod";

import { config } from "./config";
import { createDb } from "./db";
import type { Database } from "./db/types";
import { requireAdminAuthorization } from "./lib/admin-auth";
import { runRelayMonitoringCycle } from "./lib/relay-monitoring";
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
    methods: ["GET", "HEAD", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  });
  await app.register(sensible);

  app.addHook("onRequest", async (request, reply) => {
    if (request.method === "OPTIONS") {
      return;
    }

    const path = request.url.split("?")[0] ?? request.url;
    const adminPrefix = config.API_BASE_PATH ? `${config.API_BASE_PATH}/admin` : "/admin";

    if (path !== adminPrefix && !path.startsWith(`${adminPrefix}/`)) {
      return;
    }

    return requireAdminAuthorization(request, reply);
  });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
      reply.status(400).send({
        statusCode: 400,
        error: "Bad Request",
        message: error.issues
          .map((issue) => `${issue.path.join(".") || "request"}: ${issue.message}`)
          .join("; "),
        issues: error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      });
      return;
    }

    const statusCode = (error as Error & { statusCode?: number }).statusCode;
    const normalizedError = error as Error;

    if (statusCode && statusCode < 500) {
      reply.status(statusCode).send({
        statusCode,
        error: statusCode === 404 ? "Not Found" : normalizedError.name || "Bad Request",
        message: normalizedError.message,
      });
      return;
    }

    request.log.error(error);
    reply.status(500).send({
      statusCode: 500,
      error: "Internal Server Error",
      message: "Internal Server Error",
    });
  });

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
    let schedulerBusy = false;

    cron.schedule("*/5 * * * *", async () => {
      if (schedulerBusy) {
        app.log.warn("Skipped monitoring tick because the previous scheduler run is still active");
        return;
      }

      schedulerBusy = true;
      try {
        const result = await runRelayMonitoringCycle(db);
        app.log.info({
          total: result.total,
          succeeded: result.succeeded,
          failed: result.failed,
        }, "Completed relay monitoring cycle");
      } catch (error) {
        app.log.error(error, "Failed to execute relay monitoring cycle");
        try {
          await refreshPublicData(db);
          app.log.info("Recovered by refreshing public data snapshots only");
        } catch (refreshError) {
          app.log.error(refreshError, "Failed to refresh public data snapshots after monitoring error");
        }
      } finally {
        schedulerBusy = false;
      }
    });
  }

  app.addHook("onClose", async () => {
    await db.destroy();
  });

  return app;
}
