import process from "node:process";

import type { Insertable, Kysely } from "kysely";
import { sql } from "kysely";

import { createDb } from "./index";
import type { Database } from "./types";
import { refreshPublicData } from "../lib/refresh-public-data";

const RELAY_IDS = {
  aurora: "11111111-1111-1111-1111-111111111111",
  ember: "22222222-2222-2222-2222-222222222222",
  solstice: "33333333-3333-3333-3333-333333333333",
} as const;

const MODEL_IDS = {
  gpt41: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  gpt41mini: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
  claudeSonnet4: "cccccccc-cccc-cccc-cccc-cccccccccccc",
  gpt54: "dddddddd-dddd-dddd-dddd-dddddddddddd",
  gemini31: "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee",
  claudeSonnet46: "ffffffff-ffff-ffff-ffff-ffffffffffff",
  claudeOpus46: "abababab-abab-abab-abab-abababababab",
} as const;

const SUBMISSION_IDS = {
  northwind: "44444444-4444-4444-4444-444444444444",
  tidal: "55555555-5555-5555-5555-555555555555",
} as const;

function isoFrom(base: Date, hoursAgo: number) {
  return new Date(base.getTime() - hoursAgo * 60 * 60 * 1000).toISOString();
}

function buildStatusSeries({
  now,
  relayId,
  modelId,
  baseAvailability,
  baseLatency,
  volatility,
}: {
  now: Date;
  relayId: string;
  modelId: string | null;
  baseAvailability: number;
  baseLatency: number;
  volatility: number;
}) {
  const statusRows: Insertable<Database["relay_status_5m"]>[] = [];
  const latencyRows: Insertable<Database["relay_latency_5m"]>[] = [];

  for (let step = 120; step >= 0; step -= 1) {
    const hoursAgo = step * 6;
    const angle = step / 6;
    const availability = Math.max(
      0.8,
      Math.min(0.999, baseAvailability + Math.sin(angle) * volatility),
    );
    const latencyP50 = Math.max(200, Math.round(baseLatency + Math.cos(angle) * 90));
    const latencyP95 = latencyP50 + 520;
    const sampleCount = 60;
    const successCount = Math.round(sampleCount * availability);
    const failureCount = sampleCount - successCount;
    const bucketStart = isoFrom(now, hoursAgo);

    statusRows.push({
      bucket_start: bucketStart,
      relay_id: relayId,
      model_id: modelId,
      probe_region: "global",
      sample_count: sampleCount,
      success_count: successCount,
      failure_count: failureCount,
      availability_ratio: Number(availability.toFixed(5)),
      error_rate_ratio: Number((failureCount / sampleCount).toFixed(5)),
      last_success_at: bucketStart,
      last_failure_at: failureCount > 0 ? bucketStart : null,
    });

    latencyRows.push({
      bucket_start: bucketStart,
      relay_id: relayId,
      model_id: modelId,
      probe_region: "global",
      sample_count: sampleCount,
      latency_p50_ms: latencyP50,
      latency_p95_ms: latencyP95,
      latency_p99_ms: latencyP95 + 120,
      ttfb_p50_ms: Math.max(80, latencyP50 - 220),
      ttfb_p95_ms: Math.max(120, latencyP95 - 240),
    });
  }

  return { statusRows, latencyRows };
}

async function seedCoreCatalog(db: Kysely<Database>, now: Date) {
  await sql`
    TRUNCATE TABLE
      home_summary_snapshots,
      relay_overview_snapshots,
      leaderboard_snapshots,
      relay_score_hourly,
      relay_latency_5m,
      relay_status_5m,
      relay_credibility_checks,
      incident_events,
      probe_results_raw,
      sponsors,
      probe_credentials,
      submission_model_prices,
      submissions,
      relay_prices,
      relay_models,
      models,
      relays
    RESTART IDENTITY CASCADE
  `.execute(db);

  await db
    .insertInto("relays")
    .values([
      {
        id: RELAY_IDS.aurora,
        slug: "aurora-relay",
        name: "Aurora Relay",
        base_url: "https://aurora.relaynew.ai/v1",
        provider_name: "Aurora Labs",
        contact_info: "Telegram：@aurora_ops",
        description: "Balanced relay focused on low latency and stable uptime.",
        website_url: "https://aurora.relaynew.ai",
        docs_url: "https://aurora.relaynew.ai/docs",
        status: "active",
        is_featured: true,
        is_sponsored: false,
        region_label: "global",
        notes: "Primary low-latency pick.",
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      },
      {
        id: RELAY_IDS.ember,
        slug: "ember-gateway",
        name: "Ember Gateway",
        base_url: "https://ember.relaynew.ai/v1",
        provider_name: "Ember Cloud",
        contact_info: "邮箱：support@ember.relaynew.ai",
        description: "Value-oriented relay with broad model coverage.",
        website_url: "https://ember.relaynew.ai",
        docs_url: "https://ember.relaynew.ai/docs",
        status: "active",
        is_featured: true,
        is_sponsored: true,
        region_label: "global",
        notes: "Good value and broad support.",
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      },
      {
        id: RELAY_IDS.solstice,
        slug: "solstice-router",
        name: "Solstice Router",
        base_url: "https://solstice.relaynew.ai/v1",
        provider_name: "Solstice Networks",
        contact_info: "微信群：Solstice Relay Ops",
        description: "Throughput-first relay currently under observation.",
        website_url: "https://solstice.relaynew.ai",
        docs_url: "https://solstice.relaynew.ai/docs",
        status: "active",
        is_featured: false,
        is_sponsored: false,
        region_label: "global",
        notes: "Has intermittent latency spikes.",
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      },
    ])
    .execute();

  await db
    .insertInto("models")
    .values([
      {
        id: MODEL_IDS.gpt41,
        key: "openai-gpt-4.1",
        vendor: "openai",
        family: "gpt-4.1",
        input_price_unit: "USD / 1M tokens",
        output_price_unit: "USD / 1M tokens",
        is_active: true,
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      },
      {
        id: MODEL_IDS.gpt41mini,
        key: "openai-gpt-4.1-mini",
        vendor: "openai",
        family: "gpt-4.1",
        input_price_unit: "USD / 1M tokens",
        output_price_unit: "USD / 1M tokens",
        is_active: true,
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      },
      {
        id: MODEL_IDS.claudeSonnet4,
        key: "anthropic-claude-sonnet-4",
        vendor: "anthropic",
        family: "claude-4",
        input_price_unit: "USD / 1M tokens",
        output_price_unit: "USD / 1M tokens",
        is_active: true,
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      },
      {
        id: MODEL_IDS.gpt54,
        key: "openai-gpt-5.4",
        vendor: "openai",
        family: "gpt-5",
        input_price_unit: "USD / 1M tokens",
        output_price_unit: "USD / 1M tokens",
        is_active: true,
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      },
      {
        id: MODEL_IDS.gemini31,
        key: "google-gemini-3.1",
        vendor: "google",
        family: "gemini-3",
        input_price_unit: "USD / 1M tokens",
        output_price_unit: "USD / 1M tokens",
        is_active: true,
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      },
      {
        id: MODEL_IDS.claudeSonnet46,
        key: "anthropic-claude-sonnet-4.6",
        vendor: "anthropic",
        family: "claude-4.6",
        input_price_unit: "USD / 1M tokens",
        output_price_unit: "USD / 1M tokens",
        is_active: true,
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      },
      {
        id: MODEL_IDS.claudeOpus46,
        key: "anthropic-claude-opus-4.6",
        vendor: "anthropic",
        family: "claude-4.6",
        input_price_unit: "USD / 1M tokens",
        output_price_unit: "USD / 1M tokens",
        is_active: true,
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      },
    ])
    .execute();

  await db
    .insertInto("relay_models")
    .values([
      {
        relay_id: RELAY_IDS.aurora,
        model_id: MODEL_IDS.gpt41,
        remote_model_name: "gpt-4.1",
        supports_stream: true,
        supports_tools: true,
        supports_vision: false,
        supports_reasoning: true,
        status: "active",
        last_verified_at: now.toISOString(),
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      },
      {
        relay_id: RELAY_IDS.aurora,
        model_id: MODEL_IDS.gpt41mini,
        remote_model_name: "gpt-4.1-mini",
        supports_stream: true,
        supports_tools: true,
        supports_vision: false,
        supports_reasoning: true,
        status: "active",
        last_verified_at: now.toISOString(),
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      },
      {
        relay_id: RELAY_IDS.aurora,
        model_id: MODEL_IDS.claudeSonnet4,
        remote_model_name: "claude-sonnet-4",
        supports_stream: true,
        supports_tools: false,
        supports_vision: false,
        supports_reasoning: true,
        status: "degraded",
        last_verified_at: now.toISOString(),
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      },
      {
        relay_id: RELAY_IDS.aurora,
        model_id: MODEL_IDS.gpt54,
        remote_model_name: "gpt-5.4",
        supports_stream: true,
        supports_tools: true,
        supports_vision: false,
        supports_reasoning: true,
        status: "active",
        last_verified_at: now.toISOString(),
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      },
      {
        relay_id: RELAY_IDS.aurora,
        model_id: MODEL_IDS.gemini31,
        remote_model_name: "gemini-3.1",
        supports_stream: true,
        supports_tools: true,
        supports_vision: true,
        supports_reasoning: true,
        status: "active",
        last_verified_at: now.toISOString(),
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      },
      {
        relay_id: RELAY_IDS.aurora,
        model_id: MODEL_IDS.claudeSonnet46,
        remote_model_name: "claude-sonnet-4.6",
        supports_stream: true,
        supports_tools: true,
        supports_vision: false,
        supports_reasoning: true,
        status: "active",
        last_verified_at: now.toISOString(),
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      },
      {
        relay_id: RELAY_IDS.aurora,
        model_id: MODEL_IDS.claudeOpus46,
        remote_model_name: "claude-opus-4.6",
        supports_stream: true,
        supports_tools: true,
        supports_vision: false,
        supports_reasoning: true,
        status: "active",
        last_verified_at: now.toISOString(),
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      },
      {
        relay_id: RELAY_IDS.ember,
        model_id: MODEL_IDS.gpt41,
        remote_model_name: "gpt-4.1",
        supports_stream: true,
        supports_tools: true,
        supports_vision: false,
        supports_reasoning: true,
        status: "active",
        last_verified_at: now.toISOString(),
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      },
      {
        relay_id: RELAY_IDS.ember,
        model_id: MODEL_IDS.gpt41mini,
        remote_model_name: "gpt-4.1-mini",
        supports_stream: true,
        supports_tools: true,
        supports_vision: false,
        supports_reasoning: true,
        status: "active",
        last_verified_at: now.toISOString(),
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      },
      {
        relay_id: RELAY_IDS.ember,
        model_id: MODEL_IDS.gpt54,
        remote_model_name: "gpt-5.4",
        supports_stream: true,
        supports_tools: true,
        supports_vision: false,
        supports_reasoning: true,
        status: "active",
        last_verified_at: now.toISOString(),
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      },
      {
        relay_id: RELAY_IDS.ember,
        model_id: MODEL_IDS.gemini31,
        remote_model_name: "gemini-3.1",
        supports_stream: true,
        supports_tools: true,
        supports_vision: true,
        supports_reasoning: true,
        status: "active",
        last_verified_at: now.toISOString(),
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      },
      {
        relay_id: RELAY_IDS.ember,
        model_id: MODEL_IDS.claudeSonnet46,
        remote_model_name: "claude-sonnet-4.6",
        supports_stream: true,
        supports_tools: true,
        supports_vision: false,
        supports_reasoning: true,
        status: "active",
        last_verified_at: now.toISOString(),
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      },
      {
        relay_id: RELAY_IDS.ember,
        model_id: MODEL_IDS.claudeOpus46,
        remote_model_name: "claude-opus-4.6",
        supports_stream: true,
        supports_tools: true,
        supports_vision: false,
        supports_reasoning: true,
        status: "degraded",
        last_verified_at: now.toISOString(),
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      },
      {
        relay_id: RELAY_IDS.solstice,
        model_id: MODEL_IDS.gpt41,
        remote_model_name: "gpt-4.1",
        supports_stream: true,
        supports_tools: false,
        supports_vision: false,
        supports_reasoning: false,
        status: "degraded",
        last_verified_at: now.toISOString(),
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      },
      {
        relay_id: RELAY_IDS.solstice,
        model_id: MODEL_IDS.claudeSonnet4,
        remote_model_name: "claude-sonnet-4",
        supports_stream: true,
        supports_tools: false,
        supports_vision: false,
        supports_reasoning: true,
        status: "active",
        last_verified_at: now.toISOString(),
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      },
      {
        relay_id: RELAY_IDS.solstice,
        model_id: MODEL_IDS.gpt54,
        remote_model_name: "gpt-5.4",
        supports_stream: true,
        supports_tools: false,
        supports_vision: false,
        supports_reasoning: true,
        status: "degraded",
        last_verified_at: now.toISOString(),
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      },
      {
        relay_id: RELAY_IDS.solstice,
        model_id: MODEL_IDS.gemini31,
        remote_model_name: "gemini-3.1",
        supports_stream: true,
        supports_tools: true,
        supports_vision: true,
        supports_reasoning: true,
        status: "active",
        last_verified_at: now.toISOString(),
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      },
      {
        relay_id: RELAY_IDS.solstice,
        model_id: MODEL_IDS.claudeSonnet46,
        remote_model_name: "claude-sonnet-4.6",
        supports_stream: true,
        supports_tools: false,
        supports_vision: false,
        supports_reasoning: true,
        status: "active",
        last_verified_at: now.toISOString(),
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      },
      {
        relay_id: RELAY_IDS.solstice,
        model_id: MODEL_IDS.claudeOpus46,
        remote_model_name: "claude-opus-4.6",
        supports_stream: true,
        supports_tools: false,
        supports_vision: false,
        supports_reasoning: true,
        status: "degraded",
        last_verified_at: now.toISOString(),
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      },
    ].map((row) => ({
      monitoring_enabled: true,
      monitoring_priority: 100,
      compatibility_mode_override: null,
      last_compatibility_mode: null,
      last_probe_ok: null,
      last_health_status: null,
      last_http_status: null,
      last_message: null,
      last_detection_mode: null,
      last_used_url: null,
      consecutive_failure_count: 0,
      ...row,
    })))
    .execute();

  await db
    .insertInto("relay_prices")
    .values([
      {
        relay_id: RELAY_IDS.aurora,
        model_id: MODEL_IDS.gpt41,
        currency: "USD",
        input_price_per_1m: 0.8,
        output_price_per_1m: 3.2,
        cache_read_price_per_1m: null,
        cache_write_price_per_1m: null,
        effective_from: new Date(now.getTime() - 14 * 86400000).toISOString(),
        source: "manual",
        captured_at: now.toISOString(),
      },
      {
        relay_id: RELAY_IDS.aurora,
        model_id: MODEL_IDS.gpt41mini,
        currency: "USD",
        input_price_per_1m: 0.25,
        output_price_per_1m: 0.9,
        cache_read_price_per_1m: null,
        cache_write_price_per_1m: null,
        effective_from: new Date(now.getTime() - 14 * 86400000).toISOString(),
        source: "manual",
        captured_at: now.toISOString(),
      },
      {
        relay_id: RELAY_IDS.ember,
        model_id: MODEL_IDS.gpt41,
        currency: "USD",
        input_price_per_1m: 0.72,
        output_price_per_1m: 2.95,
        cache_read_price_per_1m: null,
        cache_write_price_per_1m: null,
        effective_from: new Date(now.getTime() - 21 * 86400000).toISOString(),
        source: "scraped",
        captured_at: now.toISOString(),
      },
      {
        relay_id: RELAY_IDS.ember,
        model_id: MODEL_IDS.gpt41mini,
        currency: "USD",
        input_price_per_1m: 0.19,
        output_price_per_1m: 0.72,
        cache_read_price_per_1m: null,
        cache_write_price_per_1m: null,
        effective_from: new Date(now.getTime() - 7 * 86400000).toISOString(),
        source: "scraped",
        captured_at: now.toISOString(),
      },
      {
        relay_id: RELAY_IDS.solstice,
        model_id: MODEL_IDS.gpt41,
        currency: "USD",
        input_price_per_1m: 0.61,
        output_price_per_1m: 2.64,
        cache_read_price_per_1m: null,
        cache_write_price_per_1m: null,
        effective_from: new Date(now.getTime() - 9 * 86400000).toISOString(),
        source: "detected",
        captured_at: now.toISOString(),
      },
      {
        relay_id: RELAY_IDS.solstice,
        model_id: MODEL_IDS.claudeSonnet4,
        currency: "USD",
        input_price_per_1m: 0.92,
        output_price_per_1m: 4.4,
        cache_read_price_per_1m: null,
        cache_write_price_per_1m: null,
        effective_from: new Date(now.getTime() - 18 * 86400000).toISOString(),
        source: "manual",
        captured_at: now.toISOString(),
      },
      {
        relay_id: RELAY_IDS.aurora,
        model_id: MODEL_IDS.gpt54,
        currency: "USD",
        input_price_per_1m: 1.35,
        output_price_per_1m: 6.2,
        cache_read_price_per_1m: null,
        cache_write_price_per_1m: null,
        effective_from: new Date(now.getTime() - 10 * 86400000).toISOString(),
        source: "manual",
        captured_at: now.toISOString(),
      },
      {
        relay_id: RELAY_IDS.aurora,
        model_id: MODEL_IDS.gemini31,
        currency: "USD",
        input_price_per_1m: 0.95,
        output_price_per_1m: 4.1,
        cache_read_price_per_1m: null,
        cache_write_price_per_1m: null,
        effective_from: new Date(now.getTime() - 10 * 86400000).toISOString(),
        source: "manual",
        captured_at: now.toISOString(),
      },
      {
        relay_id: RELAY_IDS.aurora,
        model_id: MODEL_IDS.claudeSonnet46,
        currency: "USD",
        input_price_per_1m: 2.6,
        output_price_per_1m: 12.8,
        cache_read_price_per_1m: null,
        cache_write_price_per_1m: null,
        effective_from: new Date(now.getTime() - 10 * 86400000).toISOString(),
        source: "manual",
        captured_at: now.toISOString(),
      },
      {
        relay_id: RELAY_IDS.aurora,
        model_id: MODEL_IDS.claudeOpus46,
        currency: "USD",
        input_price_per_1m: 10.5,
        output_price_per_1m: 55,
        cache_read_price_per_1m: null,
        cache_write_price_per_1m: null,
        effective_from: new Date(now.getTime() - 10 * 86400000).toISOString(),
        source: "manual",
        captured_at: now.toISOString(),
      },
      {
        relay_id: RELAY_IDS.ember,
        model_id: MODEL_IDS.gpt54,
        currency: "USD",
        input_price_per_1m: 1.22,
        output_price_per_1m: 5.7,
        cache_read_price_per_1m: null,
        cache_write_price_per_1m: null,
        effective_from: new Date(now.getTime() - 8 * 86400000).toISOString(),
        source: "scraped",
        captured_at: now.toISOString(),
      },
      {
        relay_id: RELAY_IDS.ember,
        model_id: MODEL_IDS.gemini31,
        currency: "USD",
        input_price_per_1m: 0.88,
        output_price_per_1m: 3.9,
        cache_read_price_per_1m: null,
        cache_write_price_per_1m: null,
        effective_from: new Date(now.getTime() - 8 * 86400000).toISOString(),
        source: "scraped",
        captured_at: now.toISOString(),
      },
      {
        relay_id: RELAY_IDS.ember,
        model_id: MODEL_IDS.claudeSonnet46,
        currency: "USD",
        input_price_per_1m: 2.4,
        output_price_per_1m: 11.9,
        cache_read_price_per_1m: null,
        cache_write_price_per_1m: null,
        effective_from: new Date(now.getTime() - 8 * 86400000).toISOString(),
        source: "scraped",
        captured_at: now.toISOString(),
      },
      {
        relay_id: RELAY_IDS.ember,
        model_id: MODEL_IDS.claudeOpus46,
        currency: "USD",
        input_price_per_1m: 9.8,
        output_price_per_1m: 51,
        cache_read_price_per_1m: null,
        cache_write_price_per_1m: null,
        effective_from: new Date(now.getTime() - 8 * 86400000).toISOString(),
        source: "scraped",
        captured_at: now.toISOString(),
      },
      {
        relay_id: RELAY_IDS.solstice,
        model_id: MODEL_IDS.gpt54,
        currency: "USD",
        input_price_per_1m: 1.18,
        output_price_per_1m: 5.5,
        cache_read_price_per_1m: null,
        cache_write_price_per_1m: null,
        effective_from: new Date(now.getTime() - 6 * 86400000).toISOString(),
        source: "detected",
        captured_at: now.toISOString(),
      },
      {
        relay_id: RELAY_IDS.solstice,
        model_id: MODEL_IDS.gemini31,
        currency: "USD",
        input_price_per_1m: 0.82,
        output_price_per_1m: 3.7,
        cache_read_price_per_1m: null,
        cache_write_price_per_1m: null,
        effective_from: new Date(now.getTime() - 6 * 86400000).toISOString(),
        source: "detected",
        captured_at: now.toISOString(),
      },
      {
        relay_id: RELAY_IDS.solstice,
        model_id: MODEL_IDS.claudeSonnet46,
        currency: "USD",
        input_price_per_1m: 2.3,
        output_price_per_1m: 11.2,
        cache_read_price_per_1m: null,
        cache_write_price_per_1m: null,
        effective_from: new Date(now.getTime() - 6 * 86400000).toISOString(),
        source: "detected",
        captured_at: now.toISOString(),
      },
      {
        relay_id: RELAY_IDS.solstice,
        model_id: MODEL_IDS.claudeOpus46,
        currency: "USD",
        input_price_per_1m: 9.4,
        output_price_per_1m: 49,
        cache_read_price_per_1m: null,
        cache_write_price_per_1m: null,
        effective_from: new Date(now.getTime() - 6 * 86400000).toISOString(),
        source: "detected",
        captured_at: now.toISOString(),
      },
    ])
    .execute();

  await db
    .insertInto("submissions")
    .values([
      {
        id: SUBMISSION_IDS.northwind,
        submitter_name: "Lena",
        submitter_email: "lena@example.com",
        relay_name: "Northwind Relay",
        base_url: "https://northwind.example.ai/v1",
        website_url: "https://northwind.example.ai",
        contact_info: "Telegram：@northwind_ops",
        description: "Northwind 自营站点，主打 OpenAI 兼容模型与稳定供应。",
        notes: "Supports GPT-4.1 and Claude Sonnet 4.",
        status: "pending",
        review_notes: null,
        approved_relay_id: null,
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      },
      {
        id: SUBMISSION_IDS.tidal,
        submitter_name: "Marco",
        submitter_email: "marco@example.com",
        relay_name: "Tidal Proxy",
        base_url: "https://tidal.example.ai/v1",
        website_url: "https://tidal.example.ai",
        contact_info: "邮箱：marco@example.com",
        description: "Tidal Proxy 覆盖多模型线路，近期希望加入榜单观察。",
        notes: "Interested in sponsor placement as well.",
        status: "approved",
        review_notes: "Waiting for verification pass.",
        approved_relay_id: RELAY_IDS.ember,
        created_at: new Date(now.getTime() - 3 * 86400000).toISOString(),
        updated_at: now.toISOString(),
      },
    ])
    .execute();

  await db
    .insertInto("submission_model_prices")
    .values([
      {
        submission_id: SUBMISSION_IDS.northwind,
        model_key: "openai-gpt-4.1",
        input_price_per_1m: 3.2,
        output_price_per_1m: 11.5,
        position: 0,
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      },
      {
        submission_id: SUBMISSION_IDS.northwind,
        model_key: "anthropic-claude-sonnet-4",
        input_price_per_1m: 3.8,
        output_price_per_1m: 13.2,
        position: 1,
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      },
      {
        submission_id: SUBMISSION_IDS.tidal,
        model_key: "openai-gpt-5.4",
        input_price_per_1m: 4.6,
        output_price_per_1m: 15.8,
        position: 0,
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      },
    ])
    .execute();

  await db
    .insertInto("sponsors")
    .values([
      {
        relay_id: RELAY_IDS.ember,
        name: "Ember Gateway",
        placement: "homepage-spotlight",
        start_at: new Date(now.getTime() - 2 * 86400000).toISOString(),
        end_at: new Date(now.getTime() + 28 * 86400000).toISOString(),
        status: "active",
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      },
    ])
    .execute();

  await db
    .insertInto("incident_events")
    .values([
      {
        relay_id: RELAY_IDS.solstice,
        model_id: MODEL_IDS.gpt41,
        probe_region: "global",
        severity: "degraded",
        title: "Elevated latency",
        summary: "Latency exceeded the degradation threshold for multiple probe windows.",
        started_at: new Date(now.getTime() - 5 * 3600000).toISOString(),
        ended_at: null,
        detected_from_bucket: new Date(now.getTime() - 5 * 3600000).toISOString(),
        resolved_from_bucket: null,
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      },
      {
        relay_id: RELAY_IDS.ember,
        model_id: MODEL_IDS.gpt41mini,
        probe_region: "global",
        severity: "degraded",
        title: "Brief error spike",
        summary: "A short burst of upstream 5xx responses was observed and recovered quickly.",
        started_at: new Date(now.getTime() - 40 * 3600000).toISOString(),
        ended_at: new Date(now.getTime() - 38 * 3600000).toISOString(),
        detected_from_bucket: new Date(now.getTime() - 40 * 3600000).toISOString(),
        resolved_from_bucket: new Date(now.getTime() - 38 * 3600000).toISOString(),
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      },
    ])
    .execute();
}

async function seedMonitoring(db: Kysely<Database>, now: Date) {
  const seriesConfigs = [
    { relayId: RELAY_IDS.aurora, modelId: null, baseAvailability: 0.998, baseLatency: 820, volatility: 0.002 },
    { relayId: RELAY_IDS.ember, modelId: null, baseAvailability: 0.992, baseLatency: 930, volatility: 0.004 },
    { relayId: RELAY_IDS.solstice, modelId: null, baseAvailability: 0.965, baseLatency: 1360, volatility: 0.01 },
    { relayId: RELAY_IDS.aurora, modelId: MODEL_IDS.gpt41, baseAvailability: 0.998, baseLatency: 820, volatility: 0.002 },
    { relayId: RELAY_IDS.aurora, modelId: MODEL_IDS.gpt41mini, baseAvailability: 0.997, baseLatency: 690, volatility: 0.002 },
    { relayId: RELAY_IDS.aurora, modelId: MODEL_IDS.claudeSonnet4, baseAvailability: 0.986, baseLatency: 1100, volatility: 0.004 },
    { relayId: RELAY_IDS.ember, modelId: MODEL_IDS.gpt41, baseAvailability: 0.993, baseLatency: 890, volatility: 0.003 },
    { relayId: RELAY_IDS.ember, modelId: MODEL_IDS.gpt41mini, baseAvailability: 0.995, baseLatency: 720, volatility: 0.003 },
    { relayId: RELAY_IDS.solstice, modelId: MODEL_IDS.gpt41, baseAvailability: 0.964, baseLatency: 1420, volatility: 0.011 },
    { relayId: RELAY_IDS.solstice, modelId: MODEL_IDS.claudeSonnet4, baseAvailability: 0.981, baseLatency: 980, volatility: 0.006 },
    { relayId: RELAY_IDS.aurora, modelId: MODEL_IDS.gpt54, baseAvailability: 0.997, baseLatency: 760, volatility: 0.002 },
    { relayId: RELAY_IDS.ember, modelId: MODEL_IDS.gpt54, baseAvailability: 0.994, baseLatency: 820, volatility: 0.003 },
    { relayId: RELAY_IDS.solstice, modelId: MODEL_IDS.gpt54, baseAvailability: 0.968, baseLatency: 1300, volatility: 0.009 },
    { relayId: RELAY_IDS.aurora, modelId: MODEL_IDS.gemini31, baseAvailability: 0.996, baseLatency: 880, volatility: 0.003 },
    { relayId: RELAY_IDS.ember, modelId: MODEL_IDS.gemini31, baseAvailability: 0.994, baseLatency: 910, volatility: 0.004 },
    { relayId: RELAY_IDS.solstice, modelId: MODEL_IDS.gemini31, baseAvailability: 0.978, baseLatency: 1080, volatility: 0.006 },
    { relayId: RELAY_IDS.aurora, modelId: MODEL_IDS.claudeSonnet46, baseAvailability: 0.989, baseLatency: 1020, volatility: 0.004 },
    { relayId: RELAY_IDS.ember, modelId: MODEL_IDS.claudeSonnet46, baseAvailability: 0.987, baseLatency: 1090, volatility: 0.005 },
    { relayId: RELAY_IDS.solstice, modelId: MODEL_IDS.claudeSonnet46, baseAvailability: 0.982, baseLatency: 1180, volatility: 0.007 },
    { relayId: RELAY_IDS.aurora, modelId: MODEL_IDS.claudeOpus46, baseAvailability: 0.985, baseLatency: 1450, volatility: 0.005 },
    { relayId: RELAY_IDS.ember, modelId: MODEL_IDS.claudeOpus46, baseAvailability: 0.979, baseLatency: 1540, volatility: 0.006 },
    { relayId: RELAY_IDS.solstice, modelId: MODEL_IDS.claudeOpus46, baseAvailability: 0.972, baseLatency: 1630, volatility: 0.008 },
  ];

  for (const config of seriesConfigs) {
    const { statusRows, latencyRows } = buildStatusSeries({ now, ...config });
    await db.insertInto("relay_status_5m").values(statusRows).execute();
    await db.insertInto("relay_latency_5m").values(latencyRows).execute();
  }

  const scoreTemplates = [
    { relayId: RELAY_IDS.aurora, modelId: null, availabilityScore: 98.4, latencyScore: 92.1, consistencyScore: 96, valueScore: 88.3, stabilityScore: 94.6, totalScore: 94.1, sampleCount: 1440, statusLabel: "healthy" },
    { relayId: RELAY_IDS.ember, modelId: null, availabilityScore: 97.2, latencyScore: 89.5, consistencyScore: 91.4, valueScore: 93.1, stabilityScore: 90.7, totalScore: 91.2, sampleCount: 1440, statusLabel: "healthy" },
    { relayId: RELAY_IDS.solstice, modelId: null, availabilityScore: 91.8, latencyScore: 72.8, consistencyScore: 84.1, valueScore: 90.2, stabilityScore: 79.1, totalScore: 83.7, sampleCount: 1440, statusLabel: "degraded" },
    { relayId: RELAY_IDS.aurora, modelId: MODEL_IDS.gpt41, availabilityScore: 98.9, latencyScore: 93.4, consistencyScore: 96.4, valueScore: 91.1, stabilityScore: 95.3, totalScore: 96.2, sampleCount: 1440, statusLabel: "healthy" },
    { relayId: RELAY_IDS.ember, modelId: MODEL_IDS.gpt41, availabilityScore: 97.6, latencyScore: 90.1, consistencyScore: 92.3, valueScore: 94.2, stabilityScore: 91.1, totalScore: 91.8, sampleCount: 1440, statusLabel: "healthy" },
    { relayId: RELAY_IDS.solstice, modelId: MODEL_IDS.gpt41, availabilityScore: 91.1, latencyScore: 70.6, consistencyScore: 83.8, valueScore: 91.5, stabilityScore: 77.4, totalScore: 83.5, sampleCount: 1440, statusLabel: "degraded" },
    { relayId: RELAY_IDS.ember, modelId: MODEL_IDS.gpt41mini, availabilityScore: 98.2, latencyScore: 94.2, consistencyScore: 93.6, valueScore: 96.9, stabilityScore: 91.5, totalScore: 94.4, sampleCount: 1440, statusLabel: "healthy" },
    { relayId: RELAY_IDS.aurora, modelId: MODEL_IDS.gpt41mini, availabilityScore: 98.5, latencyScore: 93.7, consistencyScore: 95.8, valueScore: 92.2, stabilityScore: 92.8, totalScore: 92.1, sampleCount: 1440, statusLabel: "healthy" },
    { relayId: RELAY_IDS.aurora, modelId: MODEL_IDS.claudeSonnet4, availabilityScore: 96.2, latencyScore: 83.4, consistencyScore: 90.1, valueScore: 84.5, stabilityScore: 88.7, totalScore: 88.8, sampleCount: 1200, statusLabel: "healthy" },
    { relayId: RELAY_IDS.solstice, modelId: MODEL_IDS.claudeSonnet4, availabilityScore: 97.1, latencyScore: 85.1, consistencyScore: 89.6, valueScore: 90.9, stabilityScore: 87.8, totalScore: 90.1, sampleCount: 1260, statusLabel: "healthy" },
    { relayId: RELAY_IDS.aurora, modelId: MODEL_IDS.gpt54, availabilityScore: 99.1, latencyScore: 95.2, consistencyScore: 96.8, valueScore: 90.4, stabilityScore: 95.6, totalScore: 95.8, sampleCount: 1440, statusLabel: "healthy" },
    { relayId: RELAY_IDS.ember, modelId: MODEL_IDS.gpt54, availabilityScore: 98.2, latencyScore: 91.3, consistencyScore: 93.2, valueScore: 93.6, stabilityScore: 92.1, totalScore: 93.3, sampleCount: 1440, statusLabel: "healthy" },
    { relayId: RELAY_IDS.solstice, modelId: MODEL_IDS.gpt54, availabilityScore: 92.8, latencyScore: 76.4, consistencyScore: 85.1, valueScore: 92.4, stabilityScore: 82.3, totalScore: 84.6, sampleCount: 1440, statusLabel: "degraded" },
    { relayId: RELAY_IDS.aurora, modelId: MODEL_IDS.gemini31, availabilityScore: 98.6, latencyScore: 89.8, consistencyScore: 94.7, valueScore: 92.7, stabilityScore: 92.9, totalScore: 93.8, sampleCount: 1440, statusLabel: "healthy" },
    { relayId: RELAY_IDS.ember, modelId: MODEL_IDS.gemini31, availabilityScore: 98.1, latencyScore: 88.6, consistencyScore: 92.8, valueScore: 94.1, stabilityScore: 91.2, totalScore: 92.4, sampleCount: 1440, statusLabel: "healthy" },
    { relayId: RELAY_IDS.solstice, modelId: MODEL_IDS.gemini31, availabilityScore: 96.9, latencyScore: 84.2, consistencyScore: 89.6, valueScore: 91.8, stabilityScore: 87.3, totalScore: 88.9, sampleCount: 1320, statusLabel: "healthy" },
    { relayId: RELAY_IDS.aurora, modelId: MODEL_IDS.claudeSonnet46, availabilityScore: 98.4, latencyScore: 87.5, consistencyScore: 95.1, valueScore: 91.6, stabilityScore: 93.2, totalScore: 94.1, sampleCount: 1380, statusLabel: "healthy" },
    { relayId: RELAY_IDS.ember, modelId: MODEL_IDS.claudeSonnet46, availabilityScore: 97.8, latencyScore: 85.6, consistencyScore: 93.4, valueScore: 93.2, stabilityScore: 91.4, totalScore: 92.8, sampleCount: 1380, statusLabel: "healthy" },
    { relayId: RELAY_IDS.solstice, modelId: MODEL_IDS.claudeSonnet46, availabilityScore: 96.7, latencyScore: 81.2, consistencyScore: 90.1, valueScore: 91.7, stabilityScore: 88.5, totalScore: 89.7, sampleCount: 1320, statusLabel: "healthy" },
    { relayId: RELAY_IDS.aurora, modelId: MODEL_IDS.claudeOpus46, availabilityScore: 97.5, latencyScore: 78.9, consistencyScore: 93.8, valueScore: 88.2, stabilityScore: 90.5, totalScore: 91.6, sampleCount: 1260, statusLabel: "healthy" },
    { relayId: RELAY_IDS.ember, modelId: MODEL_IDS.claudeOpus46, availabilityScore: 96.1, latencyScore: 74.6, consistencyScore: 90.3, valueScore: 90.7, stabilityScore: 87.4, totalScore: 89.3, sampleCount: 1200, statusLabel: "degraded" },
    { relayId: RELAY_IDS.solstice, modelId: MODEL_IDS.claudeOpus46, availabilityScore: 94.4, latencyScore: 69.2, consistencyScore: 86.4, valueScore: 89.8, stabilityScore: 83.7, totalScore: 85.8, sampleCount: 1180, statusLabel: "degraded" }
  ] as const;

  const scoreRows: Insertable<Database["relay_score_hourly"]>[] = [];
  for (let hour = 24; hour >= 0; hour -= 1) {
    for (const template of scoreTemplates) {
      scoreRows.push({
        bucket_start: isoFrom(now, hour),
        relay_id: template.relayId,
        model_id: template.modelId,
        probe_region: "global",
        availability_score: Math.max(0, template.availabilityScore - hour * 0.03),
        latency_score: Math.max(0, template.latencyScore - hour * 0.02),
        consistency_score: Math.max(0, template.consistencyScore - hour * 0.02),
        value_score: template.valueScore,
        stability_score: Math.max(0, template.stabilityScore - hour * 0.02),
        total_score: Math.max(0, template.totalScore - hour * 0.02),
        sample_count: template.sampleCount,
        status_label: template.statusLabel,
      });
    }
  }
  await db.insertInto("relay_score_hourly").values(scoreRows).execute();
}

async function main() {
  const db = createDb();
  const now = new Date();

  try {
    await seedCoreCatalog(db, now);
    await seedMonitoring(db, now);
    const refresh = await refreshPublicData(db);
    console.log(`Seeded demo data and refreshed snapshots at ${refresh.measuredAt}`);
  } finally {
    await db.destroy();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
