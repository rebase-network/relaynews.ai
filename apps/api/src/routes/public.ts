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
  relayModelHealthQuerySchema,
  relayModelHealthResponseSchema,
  relayIncidentsQuerySchema,
  relayIncidentsResponseSchema,
  relayModelsResponseSchema,
  relayOverviewResponseSchema,
  relayPricingHistoryQuerySchema,
  relayPricingHistoryResponseSchema,
  publicSubmissionRequestSchema,
  publicSubmissionResponseSchema,
} from "@relaynews/shared";
import type { FastifyInstance } from "fastify";
import { sql } from "kysely";

import { orderLeaderboardModels } from "../lib/leaderboard-order";
import { getMethodologyPayload } from "../lib/methodology";
import { runPublicProbe } from "../lib/probe";
import {
  buildRelayModelStatusTrend7d,
  computeHealthStatusFromAvailability,
} from "../lib/relay-model-health";
import { replaceSubmissionModelPrices } from "../lib/relay-catalog";
import {
  toProbeCredentialVerification,
  toSubmissionProbeSummary,
} from "../lib/probe-credentials";

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
        .select(["id", "key", "vendor"])
        .where("is_active", "=", true)
        .orderBy("key", "asc")
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
      .select(["id", "key", "vendor"])
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
      .where("r.status", "=", "active")
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

  app.get("/public/relay/:slug/model-health", async (request) => {
    const params = request.params as { slug: string };
    const query = relayModelHealthQuerySchema.parse(request.query ?? {});
    const relay = assertRelayFound(
      await app.db
        .selectFrom("relays")
        .select(["id", "slug", "name"])
        .where("slug", "=", params.slug)
        .where("status", "=", "active")
        .executeTakeFirst(),
    );

    const modelRows = await app.db
      .selectFrom("relay_models as rm")
      .innerJoin("models as m", "m.id", "rm.model_id")
      .select([
        "m.id as modelId",
        "m.key as modelKey",
        "m.vendor",
        "rm.status as supportStatus",
        "rm.last_verified_at as lastVerifiedAt",
      ])
      .where("rm.relay_id", "=", relay.id)
      .where("rm.status", "<>", "unsupported")
      .orderBy("m.key", "asc")
      .execute();

    if (modelRows.length === 0) {
      return relayModelHealthResponseSchema.parse({
        relay: {
          slug: relay.slug,
          name: relay.name,
        },
        window: query.window,
        rows: [],
        measuredAt: new Date().toISOString(),
      });
    }

    const modelIds = modelRows.map((row) => row.modelId);
    const modelIdList = sql.join(modelIds.map((modelId) => sql`${modelId}`));
    const trendStart = new Date();
    trendStart.setUTCHours(0, 0, 0, 0);
    trendStart.setUTCDate(trendStart.getUTCDate() - 6);
    const trendStartIso = trendStart.toISOString();

    const latestStatusRows = await sql<{
      modelId: string;
      bucketStart: string;
      availability: number;
      sampleCount: number;
    }>`
      select distinct on (model_id)
        model_id as "modelId",
        bucket_start as "bucketStart",
        availability_ratio as "availability",
        sample_count as "sampleCount"
      from relay_status_5m
      where relay_id = ${relay.id}
        and probe_region = ${query.region}
        and model_id in (${modelIdList})
      order by model_id, bucket_start desc
    `.execute(app.db);

    const availability7dRows = await sql<{
      modelId: string;
      successCount: number;
      sampleCount: number;
    }>`
      select
        model_id as "modelId",
        sum(success_count) as "successCount",
        sum(sample_count) as "sampleCount"
      from relay_status_5m
      where relay_id = ${relay.id}
        and probe_region = ${query.region}
        and model_id in (${modelIdList})
        and bucket_start >= ${trendStartIso}
      group by model_id
    `.execute(app.db);

    const trendRows = await sql<{
      modelId: string;
      dateKey: string;
      successCount: number;
      sampleCount: number;
    }>`
      select
        model_id as "modelId",
        to_char(bucket_start at time zone 'UTC', 'YYYY-MM-DD') as "dateKey",
        sum(success_count) as "successCount",
        sum(sample_count) as "sampleCount"
      from relay_status_5m
      where relay_id = ${relay.id}
        and probe_region = ${query.region}
        and model_id in (${modelIdList})
        and bucket_start >= ${trendStartIso}
      group by model_id, to_char(bucket_start at time zone 'UTC', 'YYYY-MM-DD')
      order by model_id, "dateKey" asc
    `.execute(app.db);

    const latestLatencyRows = await sql<{
      modelId: string;
      bucketStart: string;
      latencyP50Ms: number | null;
    }>`
      select distinct on (model_id)
        model_id as "modelId",
        bucket_start as "bucketStart",
        latency_p50_ms as "latencyP50Ms"
      from relay_latency_5m
      where relay_id = ${relay.id}
        and probe_region = ${query.region}
        and model_id in (${modelIdList})
      order by model_id, bucket_start desc
    `.execute(app.db);

    const latestPriceRows = await sql<{
      modelId: string;
      currency: string;
      inputPricePer1M: number | null;
      outputPricePer1M: number | null;
    }>`
      select distinct on (model_id)
        model_id as "modelId",
        currency,
        input_price_per_1m as "inputPricePer1M",
        output_price_per_1m as "outputPricePer1M"
      from relay_prices
      where relay_id = ${relay.id}
        and model_id in (${modelIdList})
      order by model_id, effective_from desc
    `.execute(app.db);

    const latestStatusByModelId = new Map(latestStatusRows.rows.map((row) => [row.modelId, row]));
    const availability7dByModelId = new Map(
      availability7dRows.rows.map((row) => [
        row.modelId,
        row.sampleCount > 0 ? row.successCount / row.sampleCount : null,
      ]),
    );
    const trendByModelId = new Map<string, Array<{ dateKey: string; availability: number | null; sampleCount: number }>>();
    for (const row of trendRows.rows) {
      const availability = row.sampleCount > 0 ? row.successCount / row.sampleCount : null;
      const current = trendByModelId.get(row.modelId) ?? [];
      current.push({
        dateKey: row.dateKey,
        availability,
        sampleCount: row.sampleCount,
      });
      trendByModelId.set(row.modelId, current);
    }
    const latestLatencyByModelId = new Map(latestLatencyRows.rows.map((row) => [row.modelId, row]));
    const latestPriceByModelId = new Map(latestPriceRows.rows.map((row) => [row.modelId, row]));

    const measuredAtCandidates = [
      ...latestStatusRows.rows.map((row) => row.bucketStart),
      ...latestLatencyRows.rows.map((row) => row.bucketStart),
      ...modelRows.map((row) => row.lastVerifiedAt).filter((value): value is string => Boolean(value)),
    ].sort();
    const measuredAt = measuredAtCandidates.at(-1) ?? new Date().toISOString();

    return relayModelHealthResponseSchema.parse({
      relay: {
        slug: relay.slug,
        name: relay.name,
      },
      window: query.window,
      rows: modelRows.map((row) => {
        const latestStatus = latestStatusByModelId.get(row.modelId);
        const latestLatency = latestLatencyByModelId.get(row.modelId);
        const latestPrice = latestPriceByModelId.get(row.modelId);

        return {
          modelKey: row.modelKey,
          vendor: row.vendor,
          supportStatus: row.supportStatus,
          currentStatus: computeHealthStatusFromAvailability(
            latestStatus?.availability ?? null,
            latestStatus?.sampleCount ?? 0,
          ),
          availability7d: availability7dByModelId.get(row.modelId) ?? null,
          latestLatencyP50Ms: latestLatency?.latencyP50Ms ?? null,
          statusTrend7d: buildRelayModelStatusTrend7d({
            measuredAt,
            rows: trendByModelId.get(row.modelId) ?? [],
          }),
          currentPrice: latestPrice ? {
            currency: latestPrice.currency,
            inputPricePer1M: latestPrice.inputPricePer1M,
            outputPricePer1M: latestPrice.outputPricePer1M,
          } : null,
          lastVerifiedAt: row.lastVerifiedAt,
        };
      }),
      measuredAt,
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
        .where("status", "=", "active")
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
        .where("status", "=", "active")
        .executeTakeFirst(),
    );

    const rows = await app.db
      .selectFrom("relay_models as rm")
      .innerJoin("models as m", "m.id", "rm.model_id")
      .select([
        "m.key as modelKey",
        "m.vendor",
        "rm.status as supportStatus",
        "rm.supports_stream as supportsStream",
        "rm.supports_tools as supportsTools",
        "rm.supports_vision as supportsVision",
        "rm.supports_reasoning as supportsReasoning",
        "rm.last_verified_at as lastVerifiedAt",
      ])
      .where("rm.relay_id", "=", relay.id)
      .where("rm.status", "<>", "unsupported")
      .orderBy("m.key", "asc")
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
        .where("status", "=", "active")
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
      .innerJoin("relay_models as rm", (join) => join
        .onRef("rm.relay_id", "=", "rp.relay_id")
        .onRef("rm.model_id", "=", "rp.model_id"))
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
      .where("rm.status", "<>", "unsupported")
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
        .where("status", "=", "active")
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

  app.post("/public/submissions", async (request, reply) => {
    const body = publicSubmissionRequestSchema.parse(request.body ?? {});
    const createdAt = new Date().toISOString();
    const derivedTestModel = body.testModel ?? body.modelPrices[0]?.modelKey;

    if (!derivedTestModel) {
      throw app.httpErrors.badRequest("At least one supported model is required for the initial test.");
    }

    const row = await app.db.transaction().execute(async (trx) => {
      const submission = await trx
        .insertInto("submissions")
        .values({
          relay_name: body.relayName,
          base_url: body.baseUrl,
          website_url: body.websiteUrl ?? null,
          contact_info: body.contactInfo,
          description: body.description,
          submitter_name: null,
          submitter_email: null,
          notes: body.notes ?? null,
          status: "pending",
          review_notes: null,
          approved_relay_id: null,
          created_at: createdAt,
          updated_at: createdAt,
        })
        .returning(["id", "status"])
        .executeTakeFirstOrThrow();

      await replaceSubmissionModelPrices(trx, submission.id, body.modelPrices, createdAt);

      const credential = await trx
        .insertInto("probe_credentials")
        .values({
          submission_id: submission.id,
          relay_id: null,
          api_key: body.testApiKey,
          test_model: derivedTestModel,
          compatibility_mode: body.compatibilityMode,
          status: "active",
          last_verified_at: null,
          last_probe_ok: null,
          last_health_status: null,
          last_http_status: null,
          last_message: null,
          last_detection_mode: null,
          last_used_url: null,
          created_at: createdAt,
          updated_at: createdAt,
        })
        .returning(["id"])
        .executeTakeFirstOrThrow();

      return {
        id: submission.id,
        status: submission.status,
        credentialId: credential.id,
      };
    });

    const probeResult = await runPublicProbe({
      baseUrl: body.baseUrl,
      apiKey: body.testApiKey,
      model: derivedTestModel,
      compatibilityMode: body.compatibilityMode,
      scanMode: "standard",
    });

    await app.db
      .updateTable("probe_credentials")
      .set(toProbeCredentialVerification(probeResult))
      .where("id", "=", row.credentialId)
      .executeTakeFirst();

    reply.code(201);
    return publicSubmissionResponseSchema.parse({
      ok: true,
      id: row.id,
      status: row.status,
      probe: toSubmissionProbeSummary(probeResult),
    });
  });
}
