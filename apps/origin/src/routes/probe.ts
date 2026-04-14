import { publicProbeRequestSchema } from "@relaynews/shared";
import type { FastifyInstance } from "fastify";

import { runPublicProbe } from "../lib/probe";

export async function registerProbeRoutes(app: FastifyInstance) {
  app.post("/public/probe/check", async (request) => {
    const body = publicProbeRequestSchema.parse(request.body ?? {});
    return runPublicProbe(body);
  });
}
