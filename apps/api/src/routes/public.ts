import {
  healthStatusSchema,
  homeSummaryResponseSchema,
  incidentSeveritySchema,
  leaderboardDirectoryResponseSchema,
  leaderboardQuerySchema,
  leaderboardResponseSchema,
  methodologyResponseSchema,
  relayHistoryQuerySchema,
  relayHistoryResponseSchema,
  relayIncidentsQuerySchema,
  relayIncidentsResponseSchema,
  relayModelsResponseSchema,
  relayOverviewResponseSchema,
  relayPricingHistoryQuerySchema,
  relayPricingHistoryResponseSchema,
} from "@relaynews/shared";
import type { FastifyInstance } from "fastify";

import { orderLeaderboardModels } from "../lib/leaderboard-order";
import { getMethodologyPayload } from "../lib/methodology";

function assertRelayFound(relay: { id: string; slug: string; name: string } | undefined) {
  if (!relay) {
    const error = new Error("Relay not found");
    (error as Error & { statusCode?: number }).statusCode = 404;
    throw error;
  }

  return relay;
}

export async function registerPublicRoutes(app: FastifyInstance) {
  app.get("/public/home-summary", async () => {
    const row = await app.db
      .selectFrom("home_summary_snapshots")
      .select(["payload_json as payloadJson"])
      .where("summary_key", "=", "home:full-page")
      .executeTakeFirstOrThrow();

    return homeSummaryResponseSchema.parse(row.payloadJson);
  });

  app.get("/public/leaderboard-directory", async () => {
    const models = orderLeaderboardModels(
      await app.db
        .selectFrom("models")
        .select(["id", "key", "name", "vendor"])
        .where("is_active", "=", true)
        .orderBy("name", "asc")
        .execute(),
    );

    const boards = (
      await Promise.all(
        models.map(async (model) => {
          const rows = await app.db
            .selectFrom("leaderboard_snapshots as ls")
            .innerJoin("relays as r", "r.id", "ls.relay_id")
            .select([
              "ls.rank",
              "ls.total_score as score",
              "ls.availability_24h as availability24h",
              "ls.latency_p50_ms as latencyP50Ms",
              "ls.latency_p95_ms as latencyP95Ms",
              "ls.status_label as statusLabel",
              "ls.badges_json as badgesJson",
              "ls.measured_at as measuredAt",
              "r.slug",
              "r.name",
            ])
            .where("ls.snapshot_key", "=", `leaderboard:${model.key}:global`)
            .orderBy("ls.rank", "asc")
            .limit(5)
            .execute();

          if (rows.length === 0) {
            return null;
          }

          return {
            modelKey: model.key,
            modelName: model.name,
            measuredAt: rows[0]?.measuredAt ?? new Date().toISOString(),
            rows: rows.map((row) => ({
              rank: row.rank,
              relay: {
                slug: row.slug,
                name: row.name,
              },
              score: row.score,
              availability24h: row.availability24h,
              latencyP50Ms: row.latencyP50Ms,
              latencyP95Ms: row.latencyP95Ms,
              healthStatus: healthStatusSchema.catch("unknown").parse(row.statusLabel),
              badges: Array.isArray(row.badgesJson) ? row.badgesJson : [],
            })),
          };
        }),
      )
    ).filter((board): board is NonNullable<typeof board> => board !== null);

    return leaderboardDirectoryResponseSchema.parse({
      boards,
      measuredAt: boards[0]?.measuredAt ?? new Date().toISOString(),
    });
  });

  app.get("/public/leaderboard/:modelKey", async (request) => {
    const params = request.params as { modelKey: string };
    const query = leaderboardQuerySchema.parse(request.query ?? {});
    const model = await app.db
      .selectFrom("models")
      .select(["id", "key", "name", "vendor"])
      .where("key", "=", params.modelKey)
      .executeTakeFirst();

    if (!model) {
      throw app.httpErrors.notFound("Model not found");
    }

    const snapshotKey = `leaderboard:${model.key}:${query.region}`;
    const rows = await app.db
      .selectFrom("leaderboard_snapshots as ls")
      .innerJoin("relays as r", "r.id", "ls.relay_id")
      .select([
        "ls.rank",
        "ls.total_score as score",
        "ls.availability_24h as availability24h",
        "ls.latency_p50_ms as latencyP50Ms",
        "ls.latency_p95_ms as latencyP95Ms",
        "ls.input_price_per_1m as inputPricePer1M",
        "ls.output_price_per_1m as outputPricePer1M",
        "ls.sample_count_24h as sampleCount24h",
        "ls.status_label as statusLabel",
        "ls.badges_json as badgesJson",
        "ls.measured_at as measuredAt",
        "r.slug",
        "r.name",
      ])
      .where("ls.snapshot_key", "=", snapshotKey)
      .orderBy("ls.rank", "asc")
      .limit(query.limit)
      .execute();

    return leaderboardResponseSchema.parse({
      model: {
        key: model.key,
        name: model.name,
        vendor: model.vendor,
      },
      region: query.region,
      measuredAt: rows[0]?.measuredAt ?? new Date().toISOString(),
      rows: rows.map((row) => ({
        rank: row.rank,
        relay: {
          slug: row.slug,
          name: row.name,
        },
        score: row.score,
        availability24h: row.availability24h,
        latencyP50Ms: row.latencyP50Ms,
        latencyP95Ms: row.latencyP95Ms,
        inputPricePer1M: row.inputPricePer1M,
        outputPricePer1M: row.outputPricePer1M,
        sampleCount24h: row.sampleCount24h,
        healthStatus: row.statusLabel,
        badges: Array.isArray(row.badgesJson) ? row.badgesJson : [],
      })),
    });
  });

  app.get("/public/relay/:slug/overview", async (request) => {
    const params = request.params as { slug: string };
    const row = await app.db
      .selectFrom("relays as r")
      .innerJoin("relay_overview_snapshots as ros", "ros.relay_id", "r.id")
      .select([
        "r.slug",
        "r.name",
        "r.base_url as baseUrl",
        "r.website_url as websiteUrl",
        "ros.status_label as healthStatus",
        "ros.availability_24h as availability24h",
        "ros.latency_p50_ms as latencyP50Ms",
        "ros.latency_p95_ms as latencyP95Ms",
        "ros.incidents_7d as incidents7d",
        "ros.supported_models_count as supportedModelsCount",
        "ros.starting_input_price_per_1m as startingInputPricePer1M",
        "ros.starting_output_price_per_1m as startingOutputPricePer1M",
        "ros.score_summary_json as scoreSummary",
        "ros.badges_json as badges",
        "ros.measured_at as measuredAt",
      ])
      .where("r.slug", "=", params.slug)
      .where("r.status", "<>", "archived")
      .executeTakeFirst();

    if (!row) {
      throw app.httpErrors.notFound("Relay not found");
    }

    return relayOverviewResponseSchema.parse({
      relay: {
        slug: row.slug,
        name: row.name,
        baseUrl: row.baseUrl,
        websiteUrl: row.websiteUrl,
      },
      healthStatus: row.healthStatus,
      availability24h: row.availability24h,
      latencyP50Ms: row.latencyP50Ms,
      latencyP95Ms: row.latencyP95Ms,
      incidents7d: row.incidents7d,
      supportedModelsCount: row.supportedModelsCount,
      startingInputPricePer1M: row.startingInputPricePer1M,
      startingOutputPricePer1M: row.startingOutputPricePer1M,
      scoreSummary: row.scoreSummary,
      badges: Array.isArray(row.badges) ? row.badges : [],
      measuredAt: row.measuredAt,
    });
  });

  app.get("/public/relay/:slug/history", async (request) => {
    const params = request.params as { slug: string };
    const query = relayHistoryQuerySchema.parse(request.query ?? {});
    const relay = assertRelayFound(
      await app.db
        .selectFrom("relays")
        .select(["id", "slug", "name"])
        .where("slug", "=", params.slug)
        .where("status", "<>", "archived")
        .executeTakeFirst(),
    );

    const model = query.model
      ? await app.db
          .selectFrom("models")
          .select(["id", "key"])
          .where("key", "=", query.model)
          .executeTakeFirst()
      : null;

    const windowHours = query.window === "24h" ? 24 : query.window === "7d" ? 24 * 7 : 24 * 30;
    const start = new Date(Date.now() - windowHours * 3600000).toISOString();
    let statusBuilder = app.db
      .selectFrom("relay_status_5m")
      .select([
        "bucket_start as bucketStart",
        "availability_ratio as availability",
      ])
      .where("relay_id", "=", relay.id)
      .where("probe_region", "=", query.region)
      .where("bucket_start", ">=", start);

    let latencyBuilder = app.db
      .selectFrom("relay_latency_5m")
      .select([
        "bucket_start as bucketStart",
        "latency_p50_ms as latencyP50Ms",
        "latency_p95_ms as latencyP95Ms",
      ])
      .where("relay_id", "=", relay.id)
      .where("probe_region", "=", query.region)
      .where("bucket_start", ">=", start);

    if (model) {
      statusBuilder = statusBuilder.where("model_id", "=", model.id);
      latencyBuilder = latencyBuilder.where("model_id", "=", model.id);
    } else {
      statusBuilder = statusBuilder.where("model_id", "is", null);
      latencyBuilder = latencyBuilder.where("model_id", "is", null);
    }

    const statusRows = await statusBuilder.orderBy("bucket_start", "asc").execute();
    const latencyRows = await latencyBuilder.orderBy("bucket_start", "asc").execute();

    const latencyByBucket = new Map(latencyRows.map((row) => [row.bucketStart, row]));
    const rawPoints = statusRows.map((row) => ({
      bucketStart: row.bucketStart,
      availability: row.availability,
      latencyP50Ms: latencyByBucket.get(row.bucketStart)?.latencyP50Ms ?? null,
      latencyP95Ms: latencyByBucket.get(row.bucketStart)?.latencyP95Ms ?? null,
    }));
    const stride = query.window === "24h" ? 2 : query.window === "7d" ? 4 : 8;
    const points = rawPoints.filter((_, index) => index % stride === 0);

    return relayHistoryResponseSchema.parse({
      window: query.window,
      region: query.region,
      modelKey: model?.key ?? null,
      points,
      measuredAt: points[points.length - 1]?.bucketStart ?? new Date().toISOString(),
    });
  });

  app.get("/public/relay/:slug/models", async (request) => {
    const params = request.params as { slug: string };
    const relay = assertRelayFound(
      await app.db
        .selectFrom("relays")
        .select(["id", "slug", "name"])
        .where("slug", "=", params.slug)
        .where("status", "<>", "archived")
        .executeTakeFirst(),
    );

    const rows = await app.db
      .selectFrom("relay_models as rm")
      .innerJoin("models as m", "m.id", "rm.model_id")
      .select([
        "m.key as modelKey",
        "m.name as modelName",
        "m.vendor",
        "rm.status as supportStatus",
        "rm.supports_stream as supportsStream",
        "rm.supports_tools as supportsTools",
        "rm.supports_vision as supportsVision",
        "rm.supports_reasoning as supportsReasoning",
        "rm.last_verified_at as lastVerifiedAt",
      ])
      .where("rm.relay_id", "=", relay.id)
      .orderBy("m.name", "asc")
      .execute();

    return relayModelsResponseSchema.parse({
      relay: {
        slug: relay.slug,
        name: relay.name,
      },
      rows,
      measuredAt: rows[0]?.lastVerifiedAt ?? new Date().toISOString(),
    });
  });

  app.get("/public/relay/:slug/pricing-history", async (request) => {
    const params = request.params as { slug: string };
    const query = relayPricingHistoryQuerySchema.parse(request.query ?? {});
    const relay = assertRelayFound(
      await app.db
        .selectFrom("relays")
        .select(["id", "slug", "name"])
        .where("slug", "=", params.slug)
        .where("status", "<>", "archived")
        .executeTakeFirst(),
    );

    let modelId: string | undefined;
    if (query.model) {
      modelId = (
        await app.db
          .selectFrom("models")
          .select(["id"])
          .where("key", "=", query.model)
          .executeTakeFirst()
      )?.id;
    }

    let builder = app.db
      .selectFrom("relay_prices as rp")
      .innerJoin("models as m", "m.id", "rp.model_id")
      .select([
        "m.key as modelKey",
        "rp.currency",
        "rp.input_price_per_1m as inputPricePer1M",
        "rp.output_price_per_1m as outputPricePer1M",
        "rp.effective_from as effectiveFrom",
        "rp.source",
      ])
      .where("rp.relay_id", "=", relay.id)
      .orderBy("rp.effective_from", "desc");

    if (modelId) {
      builder = builder.where("rp.model_id", "=", modelId);
    }

    const rows = await builder.execute();
    return relayPricingHistoryResponseSchema.parse({
      relay: { slug: relay.slug, name: relay.name },
      rows,
      measuredAt: rows[0]?.effectiveFrom ?? new Date().toISOString(),
    });
  });

  app.get("/public/relay/:slug/incidents", async (request) => {
    const params = request.params as { slug: string };
    const query = relayIncidentsQuerySchema.parse(request.query ?? {});
    const relay = assertRelayFound(
      await app.db
        .selectFrom("relays")
        .select(["id", "slug", "name"])
        .where("slug", "=", params.slug)
        .where("status", "<>", "archived")
        .executeTakeFirst(),
    );

    const windowHours = query.window === "24h" ? 24 : query.window === "7d" ? 24 * 7 : 24 * 30;
    const start = new Date(Date.now() - windowHours * 3600000).toISOString();
    const rows = await app.db
      .selectFrom("incident_events")
      .select([
        "id",
        "started_at as startedAt",
        "ended_at as endedAt",
        "severity",
        "title",
        "summary",
      ])
      .where("relay_id", "=", relay.id)
      .where("started_at", ">=", start)
      .orderBy("started_at", "desc")
      .execute();

    return relayIncidentsResponseSchema.parse({
      relay: {
        slug: relay.slug,
        name: relay.name,
      },
      rows: rows.map((row) => ({
        id: row.id,
        startedAt: row.startedAt,
        endedAt: row.endedAt,
        severity: incidentSeveritySchema.parse(row.severity),
        title: row.title,
        summary: row.summary,
      })),
      measuredAt: rows[0]?.startedAt ?? new Date().toISOString(),
    });
  });

  app.get("/public/methodology", async () => {
    const row = await app.db
      .selectFrom("home_summary_snapshots")
      .select(["measured_at as measuredAt"])
      .where("summary_key", "=", "home:full-page")
      .executeTakeFirst();

    return methodologyResponseSchema.parse(
      getMethodologyPayload(row?.measuredAt ?? new Date().toISOString()),
    );
  });
}
