import {
  badgeSchema,
  healthStatusSchema,
  homeSummaryResponseSchema,
  incidentSeveritySchema,
  type HomeSummaryResponse,
  type ScoreSummary,
} from "@relaynews/shared";
import { sql, type Kysely } from "kysely";

import { orderLeaderboardModels } from "./leaderboard-order";
import { BADGE_ORDER, METHODOLOGY_WEIGHTS, getMethodologyPayload } from "./methodology";
import { subtractDays } from "./time";
import type { Database } from "../db/types";

type LatestModelScore = {
  relayId: string;
  modelId: string;
  totalScore: number;
  availabilityScore: number;
  latencyScore: number;
  consistencyScore: number;
  valueScore: number;
  stabilityScore: number;
  credibilityScore: number;
  sampleCount: number;
  statusLabel: string;
};

type LatestRelayAggregate = {
  relayId: string;
  totalScore: number;
  availabilityScore: number;
  latencyScore: number;
  consistencyScore: number;
  valueScore: number;
  stabilityScore: number;
  credibilityScore: number;
  sampleCount: number;
  statusLabel: string;
};

function asCredibilityScore(level: string | null | undefined) {
  switch (level) {
    case "high":
      return 100;
    case "medium":
      return 75;
    case "low":
      return 40;
    default:
      return 60;
  }
}

function withCredibilityScore<T extends LatestRelayAggregate | LatestModelScore>(source: Omit<T, "credibilityScore" | "totalScore"> & { totalScore: number }, credibilityScore: number): T {
  const totalScore = Number((
    source.availabilityScore * (METHODOLOGY_WEIGHTS.availability / 100) +
    source.latencyScore * (METHODOLOGY_WEIGHTS.latency / 100) +
    source.consistencyScore * (METHODOLOGY_WEIGHTS.consistency / 100) +
    source.valueScore * (METHODOLOGY_WEIGHTS.value / 100) +
    source.stabilityScore * (METHODOLOGY_WEIGHTS.stability / 100) +
    credibilityScore * (METHODOLOGY_WEIGHTS.credibility / 100)
  ).toFixed(4));

  return {
    ...source,
    credibilityScore,
    totalScore,
  } as T;
}

const HOME_LEADERBOARD_LIMIT = 4;

function normalizeBadges(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => badgeSchema.safeParse(entry))
    .filter((entry) => entry.success)
    .map((entry) => entry.data);
}

function computeBadges({
  totalScore,
  latencyP50Ms,
  sampleCount24h,
  availability24h,
}: {
  totalScore: number;
  latencyP50Ms: number | null;
  sampleCount24h: number;
  availability24h: number;
}) {
  const badges = new Set<string>();

  if (latencyP50Ms !== null && latencyP50Ms <= 900) {
    badges.add("low-latency");
  }

  if (totalScore >= 92 || availability24h >= 0.995) {
    badges.add("high-stability");
  }

  if (totalScore >= 88) {
    badges.add("high-value");
  }

  if (sampleCount24h < 200) {
    badges.add("sample-size-low");
  }

  if (availability24h < 0.96) {
    badges.add("under-observation");
  }

  return BADGE_ORDER.filter((badge) => badges.has(badge));
}

function asScoreSummary(source: LatestRelayAggregate | LatestModelScore): ScoreSummary {
  return {
    availability: source.availabilityScore,
    latency: source.latencyScore,
    consistency: source.consistencyScore,
    value: source.valueScore,
    stability: source.stabilityScore,
    credibility: source.credibilityScore,
    total: source.totalScore,
  };
}

function snapshotKeyForModel(modelKey: string, region = "global") {
  return `leaderboard:${modelKey}:${region}`;
}

function asHealthStatus(statusLabel: string) {
  return healthStatusSchema.catch("unknown").parse(statusLabel);
}

function selectHomeLeaderboardModels(
  models: Array<{ id: string; key: string; vendor: string }>,
  latestModelScores: LatestModelScore[],
) {
  const availableModelIds = new Set(latestModelScores.map((row) => row.modelId));
  return orderLeaderboardModels(
    models.filter((model) => availableModelIds.has(model.id)),
  ).slice(0, HOME_LEADERBOARD_LIMIT);
}

export async function refreshPublicData(db: Kysely<Database>) {
  const measuredAt = new Date().toISOString();
  const incidentsSince = subtractDays(new Date(), 7).toISOString();

  const activeRelays = await db
    .selectFrom("relays")
    .select([
      "id",
      "slug",
      "name",
      "base_url",
      "website_url",
      "is_featured",
      "status",
    ])
    .where("status", "=", "active")
    .orderBy("name", "asc")
    .execute();

  const activeSponsorRelays = await db
    .selectFrom("sponsors as s")
    .innerJoin("relays as r", "r.id", "s.relay_id")
    .select([
      "r.id",
      "r.slug",
      "r.name",
    ])
    .where("s.status", "=", "active")
    .where("r.status", "=", "active")
    .where("s.start_at", "<=", measuredAt)
    .where("s.end_at", ">=", measuredAt)
    .orderBy("s.start_at", "desc")
    .execute();

  const models = await db
    .selectFrom("models")
    .select(["id", "key", "vendor"])
    .where("is_active", "=", true)
    .orderBy("key", "asc")
    .execute();

  const latestRelayScoresRaw = await sql<LatestRelayAggregate>`
    select distinct on (relay_id)
      relay_id as "relayId",
      total_score as "totalScore",
      availability_score as "availabilityScore",
      latency_score as "latencyScore",
      consistency_score as "consistencyScore",
      value_score as "valueScore",
      stability_score as "stabilityScore",
      sample_count as "sampleCount",
      status_label as "statusLabel"
    from relay_score_hourly
    where model_id is null
    order by relay_id, bucket_start desc
  `.execute(db);
  const latestRelayScores = new Map(
    latestRelayScoresRaw.rows.map((row) => [row.relayId, row]),
  );

  const latestModelScoresRaw = await sql<LatestModelScore>`
    select distinct on (relay_id, model_id)
      relay_id as "relayId",
      model_id as "modelId",
      total_score as "totalScore",
      availability_score as "availabilityScore",
      latency_score as "latencyScore",
      consistency_score as "consistencyScore",
      value_score as "valueScore",
      stability_score as "stabilityScore",
      sample_count as "sampleCount",
      status_label as "statusLabel"
    from relay_score_hourly
    where model_id is not null
    order by relay_id, model_id, bucket_start desc
  `.execute(db);

  const latestStatusRows = await sql<{
    relayId: string;
    modelId: string | null;
    availability24h: number;
    sampleCount24h: number;
  }>`
    select distinct on (relay_id, coalesce(model_id, '00000000-0000-0000-0000-000000000000'::uuid))
      relay_id as "relayId",
      model_id as "modelId",
      availability_ratio as "availability24h",
      sample_count as "sampleCount24h"
    from relay_status_5m
    where probe_region = 'global'
    order by relay_id, coalesce(model_id, '00000000-0000-0000-0000-000000000000'::uuid), bucket_start desc
  `.execute(db);

  const latestLatencyRows = await sql<{
    relayId: string;
    modelId: string | null;
    latencyP50Ms: number | null;
    latencyP95Ms: number | null;
  }>`
    select distinct on (relay_id, coalesce(model_id, '00000000-0000-0000-0000-000000000000'::uuid))
      relay_id as "relayId",
      model_id as "modelId",
      latency_p50_ms as "latencyP50Ms",
      latency_p95_ms as "latencyP95Ms"
    from relay_latency_5m
    where probe_region = 'global'
    order by relay_id, coalesce(model_id, '00000000-0000-0000-0000-000000000000'::uuid), bucket_start desc
  `.execute(db);

  const latestPriceRows = await sql<{
    relayId: string;
    modelId: string;
    inputPricePer1M: number | null;
    outputPricePer1M: number | null;
  }>`
    select distinct on (relay_id, model_id)
      relay_id as "relayId",
      model_id as "modelId",
      input_price_per_1m as "inputPricePer1M",
      output_price_per_1m as "outputPricePer1M"
    from relay_prices
    order by relay_id, model_id, effective_from desc
  `.execute(db);

  const supportedModelCounts = await db
    .selectFrom("relay_models")
    .select(({ fn }) => [
      "relay_id as relayId",
      fn.count<number>("id").as("count"),
    ])
    .where("status", "in", ["active", "degraded"])
    .groupBy("relay_id")
    .execute();

  const incidents7dCounts = await db
    .selectFrom("incident_events")
    .select(({ fn }) => [
      "relay_id as relayId",
      fn.count<number>("id").as("count"),
    ])
    .where("started_at", ">=", incidentsSince)
    .groupBy("relay_id")
    .execute();

  const latestRelayCredibilityRows = await sql<{
    relayId: string;
    identityConfidence: string;
  }>`
    select distinct on (relay_id)
      relay_id as "relayId",
      identity_confidence as "identityConfidence"
    from relay_credibility_checks
    where probe_region = 'global'
    order by relay_id, measured_at desc
  `.execute(db);

  const latestModelCredibilityRows = await sql<{
    relayId: string;
    modelId: string;
    identityConfidence: string;
  }>`
    select distinct on (relay_id, model_id)
      relay_id as "relayId",
      model_id as "modelId",
      identity_confidence as "identityConfidence"
    from relay_credibility_checks
    where probe_region = 'global'
      and model_id is not null
    order by relay_id, model_id, measured_at desc
  `.execute(db);

  const incidentRows = await db
    .selectFrom("incident_events as ie")
    .innerJoin("relays as r", "r.id", "ie.relay_id")
    .select([
      "ie.id",
      "ie.started_at as startedAt",
      "ie.ended_at as endedAt",
      "ie.severity",
      "ie.title",
      "ie.summary",
      "r.slug as relaySlug",
      "r.name as relayName",
    ])
    .orderBy("ie.started_at", "desc")
    .limit(6)
    .execute();

  const priceLookup = new Map(
    latestPriceRows.rows.map((row) => [`${row.relayId}:${row.modelId}`, row]),
  );
  const relayStatusLookup = new Map(
    latestStatusRows.rows.map((row) => [`${row.relayId}:${row.modelId ?? "relay"}`, row]),
  );
  const relayLatencyLookup = new Map(
    latestLatencyRows.rows.map((row) => [`${row.relayId}:${row.modelId ?? "relay"}`, row]),
  );
  const supportedCountLookup = new Map(
    supportedModelCounts.map((row) => [row.relayId, Number(row.count)]),
  );
  const incidentsCountLookup = new Map(
    incidents7dCounts.map((row) => [row.relayId, Number(row.count)]),
  );
  const relayCredibilityLookup = new Map(
    latestRelayCredibilityRows.rows.map((row) => [row.relayId, asCredibilityScore(row.identityConfidence)]),
  );
  const modelCredibilityLookup = new Map(
    latestModelCredibilityRows.rows.map((row) => [`${row.relayId}:${row.modelId}`, asCredibilityScore(row.identityConfidence)]),
  );

  await db.deleteFrom("leaderboard_snapshots").execute();

  for (const model of models) {
    const rows = latestModelScoresRaw.rows
      .filter((row) => row.modelId === model.id)
      .map((scoreRow) => {
        const relay = activeRelays.find((item) => item.id === scoreRow.relayId);
        if (!relay) {
          return null;
        }

        const enhancedScoreRow = withCredibilityScore(
          scoreRow,
          modelCredibilityLookup.get(`${scoreRow.relayId}:${model.id}`) ?? relayCredibilityLookup.get(scoreRow.relayId) ?? 60,
        );

        const statusRow = relayStatusLookup.get(`${scoreRow.relayId}:${model.id}`);
        const latencyRow = relayLatencyLookup.get(`${scoreRow.relayId}:${model.id}`);
        const priceRow = priceLookup.get(`${scoreRow.relayId}:${model.id}`);
        const availability24h = statusRow?.availability24h ?? 0;
        const sampleCount24h = statusRow?.sampleCount24h ?? scoreRow.sampleCount;
        const badges = computeBadges({
          totalScore: enhancedScoreRow.totalScore,
          latencyP50Ms: latencyRow?.latencyP50Ms ?? null,
          sampleCount24h,
          availability24h,
        });

        return {
          relay,
          scoreRow: enhancedScoreRow,
          availability24h,
          sampleCount24h,
          latencyRow,
          priceRow,
          badges,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null)
      .sort((left, right) => right.scoreRow.totalScore - left.scoreRow.totalScore)
      .slice(0, 20);

    if (rows.length === 0) {
      continue;
    }

    await db
      .insertInto("leaderboard_snapshots")
      .values(
        rows.map((row, index) => ({
          snapshot_key: snapshotKeyForModel(model.key),
          model_id: model.id,
          probe_region: "global",
          relay_id: row.relay.id,
          rank: index + 1,
          total_score: row.scoreRow.totalScore,
          availability_24h: row.availability24h,
          latency_p50_ms: row.latencyRow?.latencyP50Ms ?? null,
          latency_p95_ms: row.latencyRow?.latencyP95Ms ?? null,
          input_price_per_1m: row.priceRow?.inputPricePer1M ?? null,
          output_price_per_1m: row.priceRow?.outputPricePer1M ?? null,
          sample_count_24h: row.sampleCount24h,
          status_label: row.scoreRow.statusLabel,
          badges_json: JSON.stringify(row.badges),
          measured_at: measuredAt,
        })),
      )
      .execute();
  }

  for (const relay of activeRelays) {
    const relayScore = latestRelayScores.get(relay.id);
    const enhancedRelayScore = relayScore
      ? withCredibilityScore(
        relayScore,
        relayCredibilityLookup.get(relay.id) ?? 60,
      )
      : null;
    const statusRow = relayStatusLookup.get(`${relay.id}:relay`);
    const latencyRow = relayLatencyLookup.get(`${relay.id}:relay`);
    const supportedModelsCount = supportedCountLookup.get(relay.id) ?? 0;
    const incidents7d = incidentsCountLookup.get(relay.id) ?? 0;
    const prices = latestPriceRows.rows.filter((row) => row.relayId === relay.id);
    const startingInputPricePer1M = prices
      .map((row) => row.inputPricePer1M)
      .filter((value): value is number => value !== null)
      .sort((left, right) => left - right)[0] ?? null;
    const startingOutputPricePer1M = prices
      .map((row) => row.outputPricePer1M)
      .filter((value): value is number => value !== null)
      .sort((left, right) => left - right)[0] ?? null;
    const scoreSummary = enhancedRelayScore ? asScoreSummary(enhancedRelayScore) : {
      availability: 0,
      latency: 0,
      consistency: 0,
      value: 0,
      stability: 0,
      credibility: 0,
      total: 0,
    };
    const badges = computeBadges({
      totalScore: scoreSummary.total,
      latencyP50Ms: latencyRow?.latencyP50Ms ?? null,
      sampleCount24h: statusRow?.sampleCount24h ?? 0,
      availability24h: statusRow?.availability24h ?? 0,
    });

    await db
      .insertInto("relay_overview_snapshots")
      .values({
        relay_id: relay.id,
        status_label: enhancedRelayScore?.statusLabel ?? "unknown",
        availability_24h: statusRow?.availability24h ?? 0,
        latency_p50_ms: latencyRow?.latencyP50Ms ?? null,
        latency_p95_ms: latencyRow?.latencyP95Ms ?? null,
        incidents_7d: incidents7d,
        supported_models_count: supportedModelsCount,
        starting_input_price_per_1m: startingInputPricePer1M,
        starting_output_price_per_1m: startingOutputPricePer1M,
        score_summary_json: JSON.stringify(scoreSummary),
        badges_json: JSON.stringify(badges),
        measured_at: measuredAt,
      })
      .onConflict((conflict) =>
        conflict.column("relay_id").doUpdateSet({
          status_label: enhancedRelayScore?.statusLabel ?? "unknown",
          availability_24h: statusRow?.availability24h ?? 0,
          latency_p50_ms: latencyRow?.latencyP50Ms ?? null,
          latency_p95_ms: latencyRow?.latencyP95Ms ?? null,
          incidents_7d: incidents7d,
          supported_models_count: supportedModelsCount,
          starting_input_price_per_1m: startingInputPricePer1M,
          starting_output_price_per_1m: startingOutputPricePer1M,
          score_summary_json: JSON.stringify(scoreSummary),
          badges_json: JSON.stringify(badges),
          measured_at: measuredAt,
        }),
      )
      .execute();
  }

  const leaderboardPreviewModels = selectHomeLeaderboardModels(models, latestModelScoresRaw.rows);
  const previewRows = await Promise.all(
    leaderboardPreviewModels.map(async (model) => {
      const snapshotRows = await db
        .selectFrom("leaderboard_snapshots as ls")
        .innerJoin("relays as r", "r.id", "ls.relay_id")
        .select([
          "ls.rank",
          "ls.total_score as totalScore",
          "ls.availability_24h as availability24h",
          "ls.latency_p50_ms as latencyP50Ms",
          "ls.latency_p95_ms as latencyP95Ms",
          "ls.status_label as statusLabel",
          "ls.badges_json as badgesJson",
          "r.slug",
          "r.name",
        ])
        .where("ls.snapshot_key", "=", snapshotKeyForModel(model.key))
        .orderBy("ls.rank", "asc")
        .limit(5)
        .execute();

      return {
        modelKey: model.key,
        measuredAt,
        rows: snapshotRows.map((row) => ({
          rank: row.rank,
          relay: {
            slug: row.slug,
            name: row.name,
          },
          score: row.totalScore,
          availability24h: row.availability24h,
          latencyP50Ms: row.latencyP50Ms,
          latencyP95Ms: row.latencyP95Ms,
          healthStatus: asHealthStatus(row.statusLabel),
          badges: normalizeBadges(row.badgesJson),
        })),
      };
    }),
  );

  const homePayload: HomeSummaryResponse = {
    hero: {
      totalRelays: activeRelays.length,
      healthyRelays: activeRelays.filter(
        (relay) => latestRelayScores.get(relay.id)?.statusLabel === "healthy",
      ).length,
      degradedRelays: activeRelays.filter(
        (relay) => latestRelayScores.get(relay.id)?.statusLabel === "degraded",
      ).length,
      downRelays: activeRelays.filter(
        (relay) => latestRelayScores.get(relay.id)?.statusLabel === "down",
      ).length,
      measuredAt,
    },
    leaderboards: previewRows,
    highlights: Array.from(
      new Map(activeSponsorRelays.map((relay) => [relay.id, relay])).values(),
    )
      .slice(0, 4)
      .map((relay) => {
        const score = latestRelayScores.get(relay.id);
        return {
          slug: relay.slug,
          name: relay.name,
          healthStatus: asHealthStatus(score?.statusLabel ?? "unknown"),
          badge: computeBadges({
            totalScore: score?.totalScore ?? 0,
            latencyP50Ms: relayLatencyLookup.get(`${relay.id}:relay`)?.latencyP50Ms ?? null,
            sampleCount24h: relayStatusLookup.get(`${relay.id}:relay`)?.sampleCount24h ?? 0,
            availability24h: relayStatusLookup.get(`${relay.id}:relay`)?.availability24h ?? 0,
          })[0] ?? "under-observation",
        };
      }),
    latestIncidents: incidentRows.map((incident) => ({
      id: incident.id,
      relay: {
        slug: incident.relaySlug,
        name: incident.relayName,
      },
      startedAt: incident.startedAt,
      endedAt: incident.endedAt,
      severity: incidentSeveritySchema.parse(incident.severity),
      title: incident.title,
      summary: incident.summary,
    })),
    measuredAt,
  };

  homeSummaryResponseSchema.parse(homePayload);

  await db
    .insertInto("home_summary_snapshots")
    .values({
      summary_key: "home:full-page",
      payload_json: JSON.stringify(homePayload),
      measured_at: measuredAt,
    })
    .onConflict((conflict) =>
      conflict.column("summary_key").doUpdateSet({
        payload_json: JSON.stringify(homePayload),
        measured_at: measuredAt,
      }),
    )
    .execute();

  return {
    measuredAt,
    methodology: getMethodologyPayload(measuredAt),
  };
}
