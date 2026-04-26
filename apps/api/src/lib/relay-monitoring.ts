import type {
  ProbeCompatibilityMode,
  ProbeResolvedCompatibilityMode,
  PublicProbeResponse,
} from "@relaynews/shared";
import { sql, type Kysely, type Transaction } from "kysely";

import { config } from "../config";
import type { Database } from "../db/types";
import { runPublicProbe } from "./probe";
import { toProbeCredentialVerification } from "./probe-credentials";
import { refreshPublicData } from "./refresh-public-data";

type DbExecutor = Kysely<Database> | Transaction<Database>;

type TrackedModel = {
  id: string;
  key: string;
  name: string;
  family: string;
};

type MonitoringWindowAggregate = {
  sampleCount: number;
  successCount: number;
  failureCount: number;
  availabilityRatio: number;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  latencyP50Ms: number | null;
  latencyP95Ms: number | null;
  latencyP99Ms: number | null;
  protocolConsistency: number | null;
};

export type RelayMonitoringCredential = {
  id: string;
  relayId: string;
  relaySlug: string;
  relayName: string;
  baseUrl: string;
  apiKey: string;
  testModel: string;
  compatibilityMode: ProbeCompatibilityMode;
};

export type RelayMonitoringRunResult = {
  credentialId: string;
  relayId: string;
  relaySlug: string;
  relayName: string;
  modelId: string | null;
  modelKey: string;
  requestedModel: string;
  probe: PublicProbeResponse;
  resolvedModelId: string | null;
};

export type RelayMonitoringTarget = {
  credentialId: string;
  relayId: string;
  relaySlug: string;
  relayName: string;
  baseUrl: string;
  apiKey: string;
  credentialTestModel: string;
  credentialCompatibilityMode: ProbeCompatibilityMode;
  modelId: string;
  modelKey: string;
  modelName: string;
  remoteModelName: string | null;
  supportStatus: string;
  monitoringPriority: number;
  compatibilityModeOverride: ProbeCompatibilityMode | null;
  lastCompatibilityMode: ProbeResolvedCompatibilityMode | null;
  lastVerifiedAt: string | null;
  lastProbeOk: boolean | null;
  consecutiveFailureCount: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function roundScore(value: number) {
  return Number(value.toFixed(4));
}

function normalizeModelHandle(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function buildModelAliases(model: TrackedModel) {
  const aliases = new Set<string>();
  const keyParts = model.key.split("-");

  aliases.add(normalizeModelHandle(model.key));
  aliases.add(normalizeModelHandle(model.name));
  aliases.add(normalizeModelHandle(model.family));

  if (keyParts.length > 1) {
    aliases.add(normalizeModelHandle(keyParts.slice(1).join("-")));
  }

  return [...aliases].filter(Boolean);
}

function scoreAliasMatch(input: string, alias: string) {
  if (input === alias) {
    return 1_000;
  }

  if (alias.endsWith(input)) {
    return 800 - (alias.length - input.length);
  }

  if (alias.includes(input)) {
    return 600 - (alias.length - input.length);
  }

  if (input.endsWith(alias)) {
    return 500 - (input.length - alias.length);
  }

  return -1;
}

export function resolveTrackedModel(models: TrackedModel[], input: string) {
  const normalizedInput = normalizeModelHandle(input);
  if (!normalizedInput) {
    return null;
  }

  let bestMatch: { model: TrackedModel; score: number } | null = null;

  for (const model of models) {
    for (const alias of buildModelAliases(model)) {
      const score = scoreAliasMatch(normalizedInput, alias);
      if (score < 0) {
        continue;
      }

      if (!bestMatch || score > bestMatch.score) {
        bestMatch = { model, score };
      }
    }
  }

  return bestMatch?.model ?? null;
}

async function loadActiveModels(db: DbExecutor) {
  return db
    .selectFrom("models")
    .select(["id", "key", "name", "family"])
    .where("is_active", "=", true)
    .execute();
}

function getMonitoringStatusRank(status: string) {
  return status === "active"
    ? 0
    : status === "degraded"
      ? 1
      : status === "pending"
        ? 2
        : 3;
}

export function resolveMonitoringCompatibilityMode(target: RelayMonitoringTarget): ProbeCompatibilityMode {
  if (target.compatibilityModeOverride) {
    return target.compatibilityModeOverride;
  }

  if (target.lastCompatibilityMode) {
    return target.lastCompatibilityMode;
  }

  return target.credentialCompatibilityMode;
}

export function shouldBackoffMonitoringTarget(target: RelayMonitoringTarget, now: Date) {
  if (target.lastProbeOk !== false) {
    return false;
  }

  if (target.consecutiveFailureCount < config.MONITORING_FAILURE_BACKOFF_THRESHOLD) {
    return false;
  }

  if (!target.lastVerifiedAt) {
    return false;
  }

  const lastVerifiedAt = new Date(target.lastVerifiedAt);
  if (Number.isNaN(lastVerifiedAt.getTime())) {
    return false;
  }

  const backoffWindowMs = config.MONITORING_FAILURE_BACKOFF_MINUTES * 60 * 1_000;
  return now.getTime() - lastVerifiedAt.getTime() < backoffWindowMs;
}

export function getRequestedModelForTarget(target: RelayMonitoringTarget) {
  return target.remoteModelName?.trim() || target.modelKey || target.credentialTestModel;
}

export function selectRelayMonitoringTargets(targets: RelayMonitoringTarget[], now: Date) {
  const grouped = new Map<string, RelayMonitoringTarget[]>();

  for (const target of targets) {
    const current = grouped.get(target.relayId) ?? [];
    current.push(target);
    grouped.set(target.relayId, current);
  }

  const selected: RelayMonitoringTarget[] = [];
  const skippedBackoff: RelayMonitoringTarget[] = [];

  for (const relayTargets of grouped.values()) {
    const eligible = relayTargets.filter((target) => {
      const backoff = shouldBackoffMonitoringTarget(target, now);
      if (backoff) {
        skippedBackoff.push(target);
      }
      return !backoff;
    });

    eligible.sort((left, right) =>
      left.monitoringPriority - right.monitoringPriority
      || getMonitoringStatusRank(left.supportStatus) - getMonitoringStatusRank(right.supportStatus)
      || (left.lastVerifiedAt ?? "").localeCompare(right.lastVerifiedAt ?? "")
      || left.modelName.localeCompare(right.modelName),
    );

    selected.push(...eligible.slice(0, config.MONITORING_MAX_MODELS_PER_RELAY));
  }

  return {
    selected,
    skippedBackoff,
  };
}

async function loadRelayMonitoringTargets(db: Kysely<Database>) {
  const rows = await db
    .selectFrom("probe_credentials as pc")
    .innerJoin("relays as r", "r.id", "pc.relay_id")
    .innerJoin("relay_models as rm", "rm.relay_id", "r.id")
    .innerJoin("models as m", "m.id", "rm.model_id")
    .select([
      "pc.id as credentialId",
      "pc.api_key as apiKey",
      "pc.test_model as credentialTestModel",
      "pc.compatibility_mode as credentialCompatibilityMode",
      "r.id as relayId",
      "r.slug as relaySlug",
      "r.name as relayName",
      "r.base_url as baseUrl",
      "rm.model_id as modelId",
      "m.key as modelKey",
      "m.name as modelName",
      "rm.remote_model_name as remoteModelName",
      "rm.status as supportStatus",
      "rm.monitoring_priority as monitoringPriority",
      "rm.compatibility_mode_override as compatibilityModeOverride",
      "rm.last_compatibility_mode as lastCompatibilityMode",
      "rm.last_verified_at as lastVerifiedAt",
      "rm.last_probe_ok as lastProbeOk",
      "rm.consecutive_failure_count as consecutiveFailureCount",
    ])
    .where("pc.status", "=", "active")
    .where("r.status", "=", "active")
    .where("m.is_active", "=", true)
    .where("rm.monitoring_enabled", "=", true)
    .where("rm.status", "in", ["active", "degraded", "pending"])
    .execute();

  return rows as RelayMonitoringTarget[];
}

function floorToFiveMinuteBucket(value: Date) {
  const bucket = new Date(value);
  bucket.setUTCSeconds(0, 0);
  bucket.setUTCMinutes(Math.floor(bucket.getUTCMinutes() / 5) * 5);
  return bucket.toISOString();
}

function floorToHourBucket(value: Date) {
  const bucket = new Date(value);
  bucket.setUTCMinutes(0, 0, 0);
  return bucket.toISOString();
}

function subtractHours(value: Date, hours: number) {
  return new Date(value.getTime() - hours * 60 * 60 * 1_000).toISOString();
}

function computeLatencyScore(latencyP50Ms: number | null) {
  if (latencyP50Ms === null) {
    return 0;
  }

  return roundScore(clamp(100 - Math.max(0, latencyP50Ms - 250) / 30, 0, 100));
}

function computeConsistencyScore(availabilityRatio: number, protocolConsistency: number | null, sampleCount: number) {
  const protocolScore = protocolConsistency ?? availabilityRatio * 100;
  const sampleFactor = clamp(sampleCount / 6, 0.4, 1);
  return roundScore(clamp(protocolScore * 0.75 + sampleFactor * 25, 0, 100));
}

function computeValueScore() {
  return 75;
}

function computeStabilityScore(availabilityRatio: number, sampleCount: number) {
  const sampleFactor = clamp(sampleCount / 12, 0.25, 1);
  return roundScore(clamp(availabilityRatio * 70 + sampleFactor * 30, 0, 100));
}

function computeStatusLabel(availabilityRatio: number, sampleCount: number) {
  if (sampleCount === 0) {
    return "unknown";
  }

  if (availabilityRatio >= 0.98) {
    return "healthy";
  }

  if (availabilityRatio > 0) {
    return "degraded";
  }

  return "down";
}

async function queryMonitoringWindow(
  db: DbExecutor,
  input: {
    relayId: string;
    modelId?: string;
    startAt: string;
    endAt: string;
  },
) {
  const modelClause = input.modelId
    ? sql`and model_id = ${input.modelId}`
    : sql``;

  const result = await sql<MonitoringWindowAggregate>`
    select
      count(*)::int as "sampleCount",
      coalesce(sum(case when success then 1 else 0 end), 0)::int as "successCount",
      coalesce(sum(case when success then 0 else 1 end), 0)::int as "failureCount",
      coalesce(avg(case when success then 1 else 0 end), 0)::numeric as "availabilityRatio",
      max(case when success then probed_at end) as "lastSuccessAt",
      max(case when not success then probed_at end) as "lastFailureAt",
      percentile_cont(0.5) within group (order by latency_ms)
        filter (where latency_ms is not null) as "latencyP50Ms",
      percentile_cont(0.95) within group (order by latency_ms)
        filter (where latency_ms is not null) as "latencyP95Ms",
      percentile_cont(0.99) within group (order by latency_ms)
        filter (where latency_ms is not null) as "latencyP99Ms",
      avg(coalesce(protocol_consistency_score, case when success then 100 else 0 end)) as "protocolConsistency"
    from probe_results_raw
    where relay_id = ${input.relayId}
      and probe_region = 'global'
      and probed_at >= ${input.startAt}
      and probed_at < ${input.endAt}
      ${modelClause}
  `.execute(db);

  return result.rows[0] ?? {
    sampleCount: 0,
    successCount: 0,
    failureCount: 0,
    availabilityRatio: 0,
    lastSuccessAt: null,
    lastFailureAt: null,
    latencyP50Ms: null,
    latencyP95Ms: null,
    latencyP99Ms: null,
    protocolConsistency: null,
  };
}

async function upsertRelayModel(
  db: DbExecutor,
  input: {
    relayId: string;
    modelId: string;
    remoteModelName: string;
    probe: PublicProbeResponse;
  },
) {
  const status = input.probe.ok ? "active" : "degraded";
  const verifiedAt = input.probe.measuredAt;
  const compatibilityMode = input.probe.compatibilityMode;
  const consecutiveFailureCount = input.probe.ok ? 0 : 1;

  await db
    .insertInto("relay_models")
    .values({
      relay_id: input.relayId,
      model_id: input.modelId,
      remote_model_name: input.remoteModelName,
      supports_stream: Boolean(input.probe.compatibilityMode),
      supports_tools: false,
      supports_vision: false,
      supports_reasoning: false,
      status,
      monitoring_enabled: true,
      monitoring_priority: 100,
      compatibility_mode_override: null,
      last_compatibility_mode: compatibilityMode,
      last_probe_ok: input.probe.ok,
      last_health_status: input.probe.protocol.healthStatus,
      last_http_status: input.probe.protocol.httpStatus ?? null,
      last_message: input.probe.message,
      last_detection_mode: input.probe.detectionMode ?? null,
      last_used_url: input.probe.usedUrl ?? null,
      consecutive_failure_count: consecutiveFailureCount,
      last_verified_at: verifiedAt,
      created_at: verifiedAt,
      updated_at: verifiedAt,
    })
    .onConflict((conflict) =>
      conflict.columns(["relay_id", "model_id"]).doUpdateSet({
        remote_model_name: input.remoteModelName,
        supports_stream: Boolean(input.probe.compatibilityMode),
        status,
        last_compatibility_mode: compatibilityMode,
        last_probe_ok: input.probe.ok,
        last_health_status: input.probe.protocol.healthStatus,
        last_http_status: input.probe.protocol.httpStatus ?? null,
        last_message: input.probe.message,
        last_detection_mode: input.probe.detectionMode ?? null,
        last_used_url: input.probe.usedUrl ?? null,
        consecutive_failure_count: consecutiveFailureCount,
        last_verified_at: verifiedAt,
        updated_at: verifiedAt,
      }),
    )
    .execute();
}

async function updateRelayModelMonitoringState(
  db: DbExecutor,
  input: {
    relayId: string;
    modelId: string;
    remoteModelName: string;
    probe: PublicProbeResponse;
    previousConsecutiveFailureCount: number;
  },
) {
  const nextConsecutiveFailureCount = input.probe.ok
    ? 0
    : input.previousConsecutiveFailureCount + 1;

  await db
    .updateTable("relay_models")
    .set({
      remote_model_name: input.remoteModelName,
      status: input.probe.ok ? "active" : "degraded",
      supports_stream: Boolean(input.probe.compatibilityMode),
      last_compatibility_mode: input.probe.compatibilityMode,
      last_probe_ok: input.probe.ok,
      last_health_status: input.probe.protocol.healthStatus,
      last_http_status: input.probe.protocol.httpStatus ?? null,
      last_message: input.probe.message,
      last_detection_mode: input.probe.detectionMode ?? null,
      last_used_url: input.probe.usedUrl ?? null,
      consecutive_failure_count: nextConsecutiveFailureCount,
      last_verified_at: input.probe.measuredAt,
      updated_at: input.probe.measuredAt,
    })
    .where("relay_id", "=", input.relayId)
    .where("model_id", "=", input.modelId)
    .executeTakeFirst();
}

async function upsertRelayStatusBucket(
  db: DbExecutor,
  input: {
    bucketStart: string;
    relayId: string;
    modelId: string | null;
    aggregate: MonitoringWindowAggregate;
  },
) {
  let query = db
    .selectFrom("relay_status_5m")
    .select("id")
    .where("bucket_start", "=", input.bucketStart)
    .where("relay_id", "=", input.relayId)
    .where("probe_region", "=", "global");

  query = input.modelId
    ? query.where("model_id", "=", input.modelId)
    : query.where("model_id", "is", null);

  const values = {
    bucket_start: input.bucketStart,
    relay_id: input.relayId,
    model_id: input.modelId,
    probe_region: "global" as const,
    sample_count: input.aggregate.sampleCount,
    success_count: input.aggregate.successCount,
    failure_count: input.aggregate.failureCount,
    availability_ratio: roundScore(input.aggregate.availabilityRatio),
    error_rate_ratio: roundScore(input.aggregate.sampleCount === 0 ? 0 : input.aggregate.failureCount / input.aggregate.sampleCount),
    last_success_at: input.aggregate.lastSuccessAt,
    last_failure_at: input.aggregate.lastFailureAt,
  };

  const existing = await query.executeTakeFirst();
  if (existing) {
    await db
      .updateTable("relay_status_5m")
      .set(values)
      .where("id", "=", existing.id)
      .executeTakeFirst();
    return;
  }

  await db.insertInto("relay_status_5m").values(values).execute();
}

async function upsertRelayLatencyBucket(
  db: DbExecutor,
  input: {
    bucketStart: string;
    relayId: string;
    modelId: string | null;
    aggregate: MonitoringWindowAggregate;
  },
) {
  let query = db
    .selectFrom("relay_latency_5m")
    .select("id")
    .where("bucket_start", "=", input.bucketStart)
    .where("relay_id", "=", input.relayId)
    .where("probe_region", "=", "global");

  query = input.modelId
    ? query.where("model_id", "=", input.modelId)
    : query.where("model_id", "is", null);

  const values = {
    bucket_start: input.bucketStart,
    relay_id: input.relayId,
    model_id: input.modelId,
    probe_region: "global" as const,
    sample_count: input.aggregate.sampleCount,
    latency_p50_ms: input.aggregate.latencyP50Ms === null ? null : Math.round(input.aggregate.latencyP50Ms),
    latency_p95_ms: input.aggregate.latencyP95Ms === null ? null : Math.round(input.aggregate.latencyP95Ms),
    latency_p99_ms: input.aggregate.latencyP99Ms === null ? null : Math.round(input.aggregate.latencyP99Ms),
    ttfb_p50_ms: null,
    ttfb_p95_ms: null,
  };

  const existing = await query.executeTakeFirst();
  if (existing) {
    await db
      .updateTable("relay_latency_5m")
      .set(values)
      .where("id", "=", existing.id)
      .executeTakeFirst();
    return;
  }

  await db.insertInto("relay_latency_5m").values(values).execute();
}

async function upsertRelayScoreBucket(
  db: DbExecutor,
  input: {
    bucketStart: string;
    relayId: string;
    modelId: string | null;
    aggregate: MonitoringWindowAggregate;
  },
) {
  let query = db
    .selectFrom("relay_score_hourly")
    .select("id")
    .where("bucket_start", "=", input.bucketStart)
    .where("relay_id", "=", input.relayId)
    .where("probe_region", "=", "global");

  query = input.modelId
    ? query.where("model_id", "=", input.modelId)
    : query.where("model_id", "is", null);

  const availabilityScore = roundScore(input.aggregate.availabilityRatio * 100);
  const latencyScore = computeLatencyScore(input.aggregate.latencyP50Ms);
  const consistencyScore = computeConsistencyScore(
    input.aggregate.availabilityRatio,
    input.aggregate.protocolConsistency,
    input.aggregate.sampleCount,
  );
  const valueScore = computeValueScore();
  const stabilityScore = computeStabilityScore(input.aggregate.availabilityRatio, input.aggregate.sampleCount);
  const totalScore = roundScore(
    availabilityScore * 0.35 +
      latencyScore * 0.25 +
      consistencyScore * 0.15 +
      valueScore * 0.1 +
      stabilityScore * 0.15,
  );

  const values = {
    bucket_start: input.bucketStart,
    relay_id: input.relayId,
    model_id: input.modelId,
    probe_region: "global" as const,
    availability_score: availabilityScore,
    latency_score: latencyScore,
    consistency_score: consistencyScore,
    value_score: valueScore,
    stability_score: stabilityScore,
    total_score: totalScore,
    sample_count: input.aggregate.sampleCount,
    status_label: computeStatusLabel(input.aggregate.availabilityRatio, input.aggregate.sampleCount),
  };

  const existing = await query.executeTakeFirst();
  if (existing) {
    await db
      .updateTable("relay_score_hourly")
      .set(values)
      .where("id", "=", existing.id)
      .executeTakeFirst();
    return;
  }

  await db.insertInto("relay_score_hourly").values(values).execute();
}

async function refreshScopeAggregates(
  db: DbExecutor,
  input: {
    relayId: string;
    modelId: string | null;
    measuredAt: string;
  },
) {
  const measuredDate = new Date(input.measuredAt);
  const bucketStart5m = floorToFiveMinuteBucket(measuredDate);
  const bucketStartHour = floorToHourBucket(measuredDate);
  const currentBucketAggregate = await queryMonitoringWindow(db, {
    relayId: input.relayId,
    startAt: bucketStart5m,
    endAt: new Date(new Date(bucketStart5m).getTime() + 5 * 60 * 1_000).toISOString(),
    ...(input.modelId ? { modelId: input.modelId } : {}),
  });
  const trailingAggregate = await queryMonitoringWindow(db, {
    relayId: input.relayId,
    startAt: subtractHours(measuredDate, 24),
    endAt: input.measuredAt,
    ...(input.modelId ? { modelId: input.modelId } : {}),
  });

  await upsertRelayStatusBucket(db, {
    bucketStart: bucketStart5m,
    relayId: input.relayId,
    modelId: input.modelId,
    aggregate: currentBucketAggregate,
  });
  await upsertRelayLatencyBucket(db, {
    bucketStart: bucketStart5m,
    relayId: input.relayId,
    modelId: input.modelId,
    aggregate: currentBucketAggregate,
  });
  await upsertRelayScoreBucket(db, {
    bucketStart: bucketStartHour,
    relayId: input.relayId,
    modelId: input.modelId,
    aggregate: trailingAggregate,
  });
}

async function persistRelayMonitoringProbe(
  db: DbExecutor,
  credential: RelayMonitoringCredential,
  probe: PublicProbeResponse,
  resolvedModel: TrackedModel | null,
) {
  await db.transaction().execute(async (trx) => {
    await trx
      .updateTable("probe_credentials")
      .set(toProbeCredentialVerification(probe))
      .where("id", "=", credential.id)
      .executeTakeFirst();

    await trx
      .insertInto("probe_results_raw")
      .values({
        probed_at: probe.measuredAt,
        relay_id: credential.relayId,
        model_id: resolvedModel?.id ?? null,
        probe_kind: "relay-monitor",
        probe_region: "global",
        target_host: probe.targetHost,
        success: probe.ok,
        http_status: probe.protocol.httpStatus ?? null,
        latency_ms: probe.connectivity.latencyMs,
        ttfb_ms: probe.connectivity.ttfbMs ?? probe.connectivity.latencyMs,
        first_token_ms: probe.connectivity.firstTokenMs ?? null,
        dns_ms: null,
        tls_ms: null,
        request_tokens: null,
        response_tokens: null,
        error_code: probe.ok ? null : "probe_failed",
        error_message: probe.message,
        protocol_consistency_score: probe.ok ? 100 : 0,
        response_model_name: credential.testModel,
        sample_key: credential.id,
        created_at: probe.measuredAt,
      })
      .execute();

    if (resolvedModel) {
      await upsertRelayModel(trx, {
        relayId: credential.relayId,
        modelId: resolvedModel.id,
        remoteModelName: credential.testModel,
        probe,
      });
    }

    await refreshScopeAggregates(trx, {
      relayId: credential.relayId,
      modelId: null,
      measuredAt: probe.measuredAt,
    });

    if (resolvedModel) {
      await refreshScopeAggregates(trx, {
        relayId: credential.relayId,
        modelId: resolvedModel.id,
        measuredAt: probe.measuredAt,
      });
    }
  });
}

async function persistRelayMonitoringTargetProbe(
  db: DbExecutor,
  target: RelayMonitoringTarget,
  requestedModel: string,
  compatibilityMode: ProbeCompatibilityMode,
  probe: PublicProbeResponse,
) {
  await db.transaction().execute(async (trx) => {
    await trx
      .updateTable("probe_credentials")
      .set(toProbeCredentialVerification(probe))
      .where("id", "=", target.credentialId)
      .executeTakeFirst();

    await trx
      .insertInto("probe_results_raw")
      .values({
        probed_at: probe.measuredAt,
        relay_id: target.relayId,
        model_id: target.modelId,
        probe_kind: "relay-monitor",
        probe_region: "global",
        target_host: probe.targetHost,
        success: probe.ok,
        http_status: probe.protocol.httpStatus ?? null,
        latency_ms: probe.connectivity.latencyMs,
        ttfb_ms: probe.connectivity.ttfbMs ?? probe.connectivity.latencyMs,
        first_token_ms: probe.connectivity.firstTokenMs ?? null,
        dns_ms: null,
        tls_ms: null,
        request_tokens: null,
        response_tokens: null,
        error_code: probe.ok ? null : "probe_failed",
        error_message: probe.message,
        protocol_consistency_score: probe.ok ? 100 : 0,
        response_model_name: requestedModel,
        sample_key: `${target.credentialId}:${target.modelId}`,
        created_at: probe.measuredAt,
      })
      .execute();

    await updateRelayModelMonitoringState(trx, {
      relayId: target.relayId,
      modelId: target.modelId,
      remoteModelName: requestedModel,
      probe: {
        ...probe,
        compatibilityMode: probe.compatibilityMode ?? (compatibilityMode === "auto" ? null : compatibilityMode),
      },
      previousConsecutiveFailureCount: target.consecutiveFailureCount,
    });

    await refreshScopeAggregates(trx, {
      relayId: target.relayId,
      modelId: target.modelId,
      measuredAt: probe.measuredAt,
    });
    await refreshScopeAggregates(trx, {
      relayId: target.relayId,
      modelId: null,
      measuredAt: probe.measuredAt,
    });
  });
}

export async function runRelayCredentialMonitoring(
  db: Kysely<Database>,
  credential: RelayMonitoringCredential,
  options: { refreshPublicSnapshots?: boolean } = {},
): Promise<RelayMonitoringRunResult> {
  const probe = await runPublicProbe({
    baseUrl: credential.baseUrl,
    apiKey: credential.apiKey,
    model: credential.testModel,
    compatibilityMode: credential.compatibilityMode,
    scanMode: "standard",
  });
  const models = await loadActiveModels(db);
  const resolvedModel = resolveTrackedModel(models, credential.testModel);

  await persistRelayMonitoringProbe(db, credential, probe, resolvedModel);

  if (options.refreshPublicSnapshots !== false) {
    await refreshPublicData(db);
  }

  return {
    credentialId: credential.id,
    relayId: credential.relayId,
    relaySlug: credential.relaySlug,
    relayName: credential.relayName,
    modelId: resolvedModel?.id ?? null,
    modelKey: resolvedModel?.key ?? credential.testModel,
    requestedModel: credential.testModel,
    probe,
    resolvedModelId: resolvedModel?.id ?? null,
  };
}

export async function runRelayCredentialMonitoringById(
  db: Kysely<Database>,
  credentialId: string,
  options: { refreshPublicSnapshots?: boolean } = {},
) {
  const credential = await db
    .selectFrom("probe_credentials as pc")
    .innerJoin("relays as r", "r.id", "pc.relay_id")
    .select([
      "pc.id as id",
      "pc.api_key as apiKey",
      "pc.test_model as testModel",
      "pc.compatibility_mode as compatibilityMode",
      "r.id as relayId",
      "r.slug as relaySlug",
      "r.name as relayName",
      "r.base_url as baseUrl",
    ])
    .where("pc.id", "=", credentialId)
    .executeTakeFirst();

  if (!credential) {
    const error = new Error("Relay probe credential not found");
    (error as Error & { statusCode?: number }).statusCode = 404;
    throw error;
  }

  return runRelayCredentialMonitoring(db, credential as RelayMonitoringCredential, options);
}

async function runRelayModelMonitoring(
  db: Kysely<Database>,
  target: RelayMonitoringTarget,
): Promise<RelayMonitoringRunResult> {
  const compatibilityMode = resolveMonitoringCompatibilityMode(target);
  const requestedModel = getRequestedModelForTarget(target);
  const probe = await runPublicProbe({
    baseUrl: target.baseUrl,
    apiKey: target.apiKey,
    model: requestedModel,
    compatibilityMode,
    scanMode: "standard",
  });

  await persistRelayMonitoringTargetProbe(db, target, requestedModel, compatibilityMode, probe);

  return {
    credentialId: target.credentialId,
    relayId: target.relayId,
    relaySlug: target.relaySlug,
    relayName: target.relayName,
    modelId: target.modelId,
    modelKey: target.modelKey,
    requestedModel,
    probe,
    resolvedModelId: target.modelId,
  };
}

export async function runRelayMonitoringCycle(db: Kysely<Database>) {
  const loadedTargets = await loadRelayMonitoringTargets(db);
  const { selected, skippedBackoff } = selectRelayMonitoringTargets(loadedTargets, new Date());

  const results: RelayMonitoringRunResult[] = [];
  const errors: Array<{ credentialId: string; relaySlug: string; modelKey: string; message: string }> = [];

  for (const target of selected) {
    try {
      const result = await runRelayModelMonitoring(db, target);
      results.push(result);
    } catch (error) {
      errors.push({
        credentialId: target.credentialId,
        relaySlug: target.relaySlug,
        modelKey: target.modelKey,
        message: error instanceof Error ? error.message : "Unknown monitoring error",
      });
    }
  }

  await refreshPublicData(db);

  return {
    total: selected.length,
    succeeded: results.length,
    failed: errors.length,
    skipped: skippedBackoff.length,
    skippedTargets: skippedBackoff.map((target) => ({
      relaySlug: target.relaySlug,
      modelKey: target.modelKey,
      consecutiveFailureCount: target.consecutiveFailureCount,
      lastVerifiedAt: target.lastVerifiedAt,
    })),
    measuredAt: new Date().toISOString(),
    results,
    errors,
  };
}
