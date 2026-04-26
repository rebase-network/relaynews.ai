import type { ProbeCompatibilityMode } from "@relaynews/shared";
import type { Kysely } from "kysely";

import type { Database } from "../db/types";
import { runMatchedModeCredibilityProbe, runPublicProbe } from "./probe";
import { refreshPublicData } from "./refresh-public-data";
import { resolveTrackedModel } from "./relay-monitoring";

type RelayCredibilityCredential = {
  id: string;
  relayId: string;
  relaySlug: string;
  relayName: string;
  baseUrl: string;
  apiKey: string;
  testModel: string;
  compatibilityMode: ProbeCompatibilityMode;
};

type TrackedModel = {
  id: string;
  key: string;
  family: string;
};

async function loadActiveModels(db: Kysely<Database>) {
  return db
    .selectFrom("models")
    .select(["id", "key", "family"])
    .where("is_active", "=", true)
    .execute() as Promise<TrackedModel[]>;
}

async function insertRelayCredibilityCheck(
  db: Kysely<Database>,
  credential: RelayCredibilityCredential,
  modelId: string | null,
  usedUrl: string,
  compatibilityMode: string,
  credibility: Awaited<ReturnType<typeof runMatchedModeCredibilityProbe>>["credibility"],
  measuredAt: string,
) {
  await db
    .insertInto("relay_credibility_checks")
    .values({
      relay_id: credential.relayId,
      model_id: modelId,
      probe_region: "global",
      compatibility_mode: compatibilityMode,
      requested_model: credential.testModel,
      used_url: usedUrl,
      response_reported_model: credibility.responseReportedModel,
      response_reported_version: credibility.responseReportedVersion,
      self_reported_provider: credibility.selfReportedProvider,
      self_reported_model: credibility.selfReportedModel,
      self_reported_version: null,
      identity_confidence: credibility.identityConfidence,
      identity_probe_ok: credibility.identityProbeOk,
      message: credibility.message,
      measured_at: measuredAt,
      created_at: measuredAt,
    })
    .execute();
}

export async function runRelayCredibilityCycle(db: Kysely<Database>) {
  const models = await loadActiveModels(db);
  const credentials = (await db
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
    .where("pc.status", "=", "active")
    .where("pc.last_probe_ok", "=", true)
    .where("pc.last_health_status", "in", ["healthy", "degraded"])
    .where("r.status", "=", "active")
    .orderBy("r.updated_at", "desc")
    .execute()) as RelayCredibilityCredential[];

  let succeeded = 0;
  let skipped = 0;
  let failed = 0;

  for (const credential of credentials) {
    try {
      const probe = await runPublicProbe({
        baseUrl: credential.baseUrl,
        apiKey: credential.apiKey,
        model: credential.testModel,
        compatibilityMode: credential.compatibilityMode,
        scanMode: "standard",
      });

      if (!probe.ok || !probe.compatibilityMode || !probe.usedUrl) {
        skipped += 1;
        continue;
      }

      const resolvedModel = resolveTrackedModel(models, credential.testModel);
      const { credibility } = await runMatchedModeCredibilityProbe({
        baseUrl: credential.baseUrl,
        apiKey: credential.apiKey,
        model: credential.testModel,
        mode: probe.compatibilityMode,
        usedUrl: probe.usedUrl,
      });

      await insertRelayCredibilityCheck(
        db,
        credential,
        resolvedModel?.id ?? null,
        probe.usedUrl,
        probe.compatibilityMode,
        credibility,
        new Date().toISOString(),
      );
      succeeded += 1;
    } catch {
      failed += 1;
    }
  }

  if (succeeded > 0) {
    await refreshPublicData(db);
  }

  return {
    total: credentials.length,
    succeeded,
    skipped,
    failed,
  };
}
