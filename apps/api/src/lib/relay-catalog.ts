import type { SubmissionModelPrice } from "@relaynews/shared";
import { sql, type Kysely, type Transaction } from "kysely";

import type { Database } from "../db/types";
import { resolveTrackedModel } from "./relay-monitoring";

type DbExecutor = Kysely<Database> | Transaction<Database>;

export type CatalogModelPriceRow = {
  modelKey: string;
  inputPricePer1M: number | null;
  outputPricePer1M: number | null;
};

type CatalogModel = {
  id: string;
  key: string;
  vendor: string;
  family: string;
};

function slugifyModelKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function inferVendor(modelKey: string) {
  const normalized = slugifyModelKey(modelKey);
  const [vendor] = normalized.split("-");
  return vendor || "relay";
}

function inferFamily(modelKey: string) {
  const normalized = slugifyModelKey(modelKey);
  const parts = normalized.split("-");
  if (parts.length <= 1) {
    return normalized || "custom";
  }

  return parts.slice(1).join("-") || normalized;
}

async function resolveOrCreateCatalogModel(db: DbExecutor, rawModelKey: string): Promise<CatalogModel> {
  const input = rawModelKey.trim();
  const normalizedKey = slugifyModelKey(input);
  const existingModels = await db
    .selectFrom("models")
    .select(["id", "key", "vendor", "family"])
    .execute();

  const exact = existingModels.find((model) => model.key === input || model.key === normalizedKey);
  if (exact) {
    return exact;
  }

  const resolved = resolveTrackedModel(existingModels, input);
  if (resolved) {
    const matched = existingModels.find((model) => model.id === resolved.id);
    if (matched) {
      return matched;
    }
  }

  const createdAt = new Date().toISOString();
  const created = await db
    .insertInto("models")
    .values({
      key: normalizedKey || `custom-${Date.now()}`,
      vendor: inferVendor(input),
      family: inferFamily(input),
      input_price_unit: "USD / 1M tokens",
      output_price_unit: "USD / 1M tokens",
      is_active: true,
      created_at: createdAt,
      updated_at: createdAt,
    })
    .returning(["id", "key", "vendor", "family"])
    .executeTakeFirstOrThrow();

  return created;
}

export async function replaceSubmissionModelPrices(
  db: DbExecutor,
  submissionId: string,
  modelPrices: SubmissionModelPrice[],
  createdAt: string,
) {
  await db
    .deleteFrom("submission_model_prices")
    .where("submission_id", "=", submissionId)
    .execute();

  if (modelPrices.length === 0) {
    return;
  }

  await db
    .insertInto("submission_model_prices")
    .values(
      modelPrices.map((row, index) => ({
        submission_id: submissionId,
        model_key: row.modelKey,
        input_price_per_1m: row.inputPricePer1M,
        output_price_per_1m: row.outputPricePer1M,
        position: index,
        created_at: createdAt,
        updated_at: createdAt,
      })),
    )
    .execute();
}

export async function loadSubmissionModelPricesBySubmissionIds(
  db: DbExecutor,
  submissionIds: string[],
) {
  if (submissionIds.length === 0) {
    return new Map<string, CatalogModelPriceRow[]>();
  }

  const rows = await db
    .selectFrom("submission_model_prices")
    .select([
      "submission_id as submissionId",
      "model_key as modelKey",
      "input_price_per_1m as inputPricePer1M",
      "output_price_per_1m as outputPricePer1M",
      "position",
    ])
    .where("submission_id", "in", submissionIds)
    .orderBy("submission_id", "asc")
    .orderBy("position", "asc")
    .execute();

  const grouped = new Map<string, CatalogModelPriceRow[]>();
  for (const row of rows) {
    const current = grouped.get(row.submissionId) ?? [];
    current.push({
      modelKey: row.modelKey,
      inputPricePer1M: row.inputPricePer1M,
      outputPricePer1M: row.outputPricePer1M,
    });
    grouped.set(row.submissionId, current);
  }

  return grouped;
}

export async function syncRelayCatalogModelPrices(
  db: DbExecutor,
  relayId: string,
  modelPrices: CatalogModelPriceRow[],
  effectiveAt: string,
) {
  const deduped = new Map<string, CatalogModelPriceRow>();
  for (const row of modelPrices) {
    const modelKey = row.modelKey.trim();
    if (!modelKey) {
      continue;
    }

    deduped.set(modelKey.toLowerCase(), {
      modelKey,
      inputPricePer1M: row.inputPricePer1M,
      outputPricePer1M: row.outputPricePer1M,
    });
  }

  const resolvedRows = await Promise.all(
    [...deduped.values()].map(async (row) => ({
      row,
      model: await resolveOrCreateCatalogModel(db, row.modelKey),
    })),
  );

  const activeModelIds = resolvedRows.map((item) => item.model.id);

  for (const { row, model } of resolvedRows) {
    await db
      .insertInto("relay_models")
      .values({
        relay_id: relayId,
        model_id: model.id,
        remote_model_name: row.modelKey,
        supports_stream: true,
        supports_tools: false,
        supports_vision: false,
        supports_reasoning: false,
        status: "active",
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
        last_verified_at: null,
        created_at: effectiveAt,
        updated_at: effectiveAt,
      })
      .onConflict((conflict) => conflict.columns(["relay_id", "model_id"]).doUpdateSet({
        remote_model_name: row.modelKey,
        status: "active",
        updated_at: effectiveAt,
      }))
      .execute();

    const latestPrice = await sql<{
      inputPricePer1M: number | null;
      outputPricePer1M: number | null;
      currency: string;
    }>`
      select
        input_price_per_1m as "inputPricePer1M",
        output_price_per_1m as "outputPricePer1M",
        currency
      from relay_prices
      where relay_id = ${relayId}
        and model_id = ${model.id}
      order by effective_from desc
      limit 1
    `.execute(db);

    const currentPrice = latestPrice.rows[0];
    const priceChanged =
      !currentPrice
      || currentPrice.inputPricePer1M !== row.inputPricePer1M
      || currentPrice.outputPricePer1M !== row.outputPricePer1M
      || currentPrice.currency !== "USD";

    if (priceChanged) {
      await db
        .insertInto("relay_prices")
        .values({
          relay_id: relayId,
          model_id: model.id,
          currency: "USD",
          input_price_per_1m: row.inputPricePer1M,
          output_price_per_1m: row.outputPricePer1M,
          cache_read_price_per_1m: null,
          cache_write_price_per_1m: null,
          effective_from: effectiveAt,
          source: "manual",
          captured_at: effectiveAt,
        })
        .execute();
    }
  }

  if (activeModelIds.length > 0) {
    await db
      .updateTable("relay_models")
      .set({
        status: "unsupported",
        updated_at: effectiveAt,
      })
      .where("relay_id", "=", relayId)
      .where("model_id", "not in", activeModelIds)
      .where("status", "<>", "unsupported")
      .execute();
  }
}
