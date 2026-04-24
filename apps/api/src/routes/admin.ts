import {
  adminModelsResponseSchema,
  adminModelUpsertSchema,
  adminOverviewResponseSchema,
  adminProbeCredentialCreateSchema,
  adminProbeCredentialDetailSchema,
  adminProbeCredentialMutationResponseSchema,
  adminProbeCredentialRotateSchema,
  adminProbeCredentialsResponseSchema,
  adminPriceCreateSchema,
  adminPricesResponseSchema,
  adminRefreshPublicResponseSchema,
  adminRelayUpsertSchema,
  adminRelaysResponseSchema,
  adminSubmissionReviewSchema,
  adminSubmissionsResponseSchema,
  adminSponsorUpsertSchema,
  adminSponsorsResponseSchema,
  type ProbeCompatibilityMode,
  type ProbeCredentialOwnerType,
} from "@relaynews/shared";
import type { FastifyInstance } from "fastify";
import type { Kysely, Transaction } from "kysely";

import type { Database } from "../db/types";
import { runPublicProbe } from "../lib/probe";
import {
  loadSubmissionModelPricesBySubmissionIds,
  syncRelayCatalogModelPrices,
} from "../lib/relay-catalog";
import {
  maskApiKey,
  toProbeCredentialVerification,
  toSubmissionProbeSummary,
} from "../lib/probe-credentials";
import { runRelayCredentialMonitoringById } from "../lib/relay-monitoring";
import { refreshPublicData } from "../lib/refresh-public-data";

type DbExecutor = Kysely<Database> | Transaction<Database>;

function slugifyRelayName(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

async function ensureUniqueRelaySlug(db: DbExecutor, relayName: string) {
  const baseSlug = slugifyRelayName(relayName) || `relay-${Date.now()}`;
  let candidate = baseSlug;
  let suffix = 2;

  while (true) {
    const existing = await db
      .selectFrom("relays")
      .select("id")
      .where("slug", "=", candidate)
      .executeTakeFirst();

    if (!existing) {
      return candidate;
    }

    candidate = `${baseSlug}-${suffix}`;
    suffix += 1;
  }
}

async function resolveApprovedRelay(
  db: DbExecutor,
  submission: {
    id: string;
    relayName: string;
    baseUrl: string;
    websiteUrl: string | null;
    contactInfo: string | null;
    description: string | null;
    approvedRelayId: string | null;
  },
) {
  if (submission.approvedRelayId) {
    const approvedRelay = await db
      .selectFrom("relays")
      .select(["id", "slug", "name"])
      .where("id", "=", submission.approvedRelayId)
      .executeTakeFirst();

    if (approvedRelay) {
      return approvedRelay;
    }
  }

  const existingRelay = await db
    .selectFrom("relays")
    .select(["id", "slug", "name"])
    .where("base_url", "=", submission.baseUrl)
    .executeTakeFirst();

  if (existingRelay) {
    return existingRelay;
  }

  const createdAt = new Date().toISOString();
  const slug = await ensureUniqueRelaySlug(db, submission.relayName);

  return db
    .insertInto("relays")
    .values({
      slug,
      name: submission.relayName,
      base_url: submission.baseUrl,
      provider_name: null,
      contact_info: submission.contactInfo,
      description: submission.description,
      website_url: submission.websiteUrl,
      docs_url: null,
      status: "active",
      is_featured: false,
      is_sponsored: false,
      region_label: "global",
      notes: null,
      created_at: createdAt,
      updated_at: createdAt,
    })
    .returning(["id", "slug", "name"])
    .executeTakeFirstOrThrow();
}

type ProbeCredentialRow = {
  id: string;
  submissionId: string | null;
  relayId: string | null;
  status: string;
  testModel: string;
  compatibilityMode: ProbeCompatibilityMode;
  apiKey: string;
  lastVerifiedAt: string | null;
  lastProbeOk: boolean | null;
  lastHealthStatus: string | null;
  lastHttpStatus: number | null;
  lastMessage: string | null;
  lastDetectionMode: "auto" | "manual" | null;
  lastUsedUrl: string | null;
  createdAt: string;
  updatedAt: string;
  submissionRelayName: string | null;
  submissionBaseUrl: string | null;
  relaySlug: string | null;
  relayName: string | null;
  relayBaseUrl: string | null;
};

type ProbeCredentialOwner = {
  ownerType: ProbeCredentialOwnerType;
  ownerId: string;
  ownerName: string;
  ownerSlug: string | null;
  ownerBaseUrl: string;
  submissionId: string | null;
  relayId: string | null;
};

function makeNotFoundError(message: string) {
  const error = new Error(message);
  (error as Error & { statusCode?: number }).statusCode = 404;
  return error;
}

function probeCredentialBaseQuery(db: DbExecutor) {
  return db
    .selectFrom("probe_credentials as pc")
    .leftJoin("submissions as s", "s.id", "pc.submission_id")
    .leftJoin("relays as r", "r.id", "pc.relay_id")
    .select([
      "pc.id as id",
      "pc.submission_id as submissionId",
      "pc.relay_id as relayId",
      "pc.status as status",
      "pc.test_model as testModel",
      "pc.compatibility_mode as compatibilityMode",
      "pc.api_key as apiKey",
      "pc.last_verified_at as lastVerifiedAt",
      "pc.last_probe_ok as lastProbeOk",
      "pc.last_health_status as lastHealthStatus",
      "pc.last_http_status as lastHttpStatus",
      "pc.last_message as lastMessage",
      "pc.last_detection_mode as lastDetectionMode",
      "pc.last_used_url as lastUsedUrl",
      "pc.created_at as createdAt",
      "pc.updated_at as updatedAt",
      "s.relay_name as submissionRelayName",
      "s.base_url as submissionBaseUrl",
      "r.slug as relaySlug",
      "r.name as relayName",
      "r.base_url as relayBaseUrl",
    ]);
}

function resolveProbeCredentialOwner(row: ProbeCredentialRow): ProbeCredentialOwner {
  if (row.relayId && row.relayName && row.relayBaseUrl) {
    return {
      ownerType: "relay",
      ownerId: row.relayId,
      ownerName: row.relayName,
      ownerSlug: row.relaySlug,
      ownerBaseUrl: row.relayBaseUrl,
      submissionId: null,
      relayId: row.relayId,
    };
  }

  if (row.submissionId && row.submissionRelayName && row.submissionBaseUrl) {
    return {
      ownerType: "submission",
      ownerId: row.submissionId,
      ownerName: row.submissionRelayName,
      ownerSlug: null,
      ownerBaseUrl: row.submissionBaseUrl,
      submissionId: row.submissionId,
      relayId: null,
    };
  }

  throw makeNotFoundError("Probe credential owner not found");
}

function serializeAdminProbeCredential(row: ProbeCredentialRow) {
  const owner = resolveProbeCredentialOwner(row);

  return {
    id: row.id,
    ownerType: owner.ownerType,
    ownerId: owner.ownerId,
    ownerName: owner.ownerName,
    ownerSlug: owner.ownerSlug,
    ownerBaseUrl: owner.ownerBaseUrl,
    status: row.status,
    testModel: row.testModel,
    compatibilityMode: row.compatibilityMode,
    apiKeyPreview: maskApiKey(row.apiKey),
    lastVerifiedAt: row.lastVerifiedAt,
    lastProbeOk: row.lastProbeOk,
    lastHealthStatus: row.lastHealthStatus,
    lastHttpStatus: row.lastHttpStatus,
    lastMessage: row.lastMessage,
    updatedAt: row.updatedAt,
  };
}

function serializeAdminProbeCredentialDetail(row: ProbeCredentialRow) {
  return {
    ...serializeAdminProbeCredential(row),
    apiKey: row.apiKey,
    lastDetectionMode: row.lastDetectionMode,
    lastUsedUrl: row.lastUsedUrl,
    createdAt: row.createdAt,
  };
}

async function getProbeCredentialRowById(db: DbExecutor, id: string) {
  const row = await probeCredentialBaseQuery(db)
    .where("pc.id", "=", id)
    .executeTakeFirst();

  if (!row) {
    throw makeNotFoundError("Probe credential not found");
  }

  return row as ProbeCredentialRow;
}

async function resolveProbeCredentialOwnerTarget(
  db: DbExecutor,
  ownerType: ProbeCredentialOwnerType,
  ownerId: string,
): Promise<ProbeCredentialOwner> {
  if (ownerType === "relay") {
    const relay = await db
      .selectFrom("relays")
      .select([
        "id",
        "slug",
        "name",
        "base_url as baseUrl",
      ])
      .where("id", "=", ownerId)
      .executeTakeFirst();

    if (!relay) {
      throw makeNotFoundError("Relay not found");
    }

    return {
      ownerType,
      ownerId: relay.id,
      ownerName: relay.name,
      ownerSlug: relay.slug,
      ownerBaseUrl: relay.baseUrl,
      submissionId: null,
      relayId: relay.id,
    };
  }

  const submission = await db
    .selectFrom("submissions")
    .select([
      "id",
      "relay_name as relayName",
      "base_url as baseUrl",
    ])
    .where("id", "=", ownerId)
    .executeTakeFirst();

  if (!submission) {
    throw makeNotFoundError("Submission not found");
  }

  return {
    ownerType,
    ownerId: submission.id,
    ownerName: submission.relayName,
    ownerSlug: null,
    ownerBaseUrl: submission.baseUrl,
    submissionId: submission.id,
    relayId: null,
  };
}

async function rotateActiveOwnerCredentialIfNeeded(db: DbExecutor, owner: ProbeCredentialOwner) {
  let query = db
    .selectFrom("probe_credentials")
    .select(["id"])
    .where("status", "=", "active");

  query =
    owner.ownerType === "relay"
      ? query.where("relay_id", "=", owner.ownerId)
      : query.where("submission_id", "=", owner.ownerId);

  const activeCredential = await query.executeTakeFirst();

  if (activeCredential) {
    await db
      .updateTable("probe_credentials")
      .set({ status: "rotated" })
      .where("id", "=", activeCredential.id)
      .executeTakeFirst();
  }
}

async function createProbeCredentialForOwner(
  db: DbExecutor,
  owner: ProbeCredentialOwner,
  input: {
    apiKey: string;
    testModel: string;
    compatibilityMode: ProbeCompatibilityMode;
  },
) {
  const createdAt = new Date().toISOString();
  await rotateActiveOwnerCredentialIfNeeded(db, owner);

  const row = await db
    .insertInto("probe_credentials")
    .values({
      submission_id: owner.submissionId,
      relay_id: owner.relayId,
      api_key: input.apiKey,
      test_model: input.testModel,
      compatibility_mode: input.compatibilityMode,
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

  return row.id;
}

function toAdminRelayCredentialSummary(
  row:
    | {
      id: string;
      status: string;
      testModel: string;
      compatibilityMode: string;
      apiKey: string;
      lastVerifiedAt: string | null;
      lastProbeOk: boolean | null;
      lastHealthStatus: string | null;
      lastHttpStatus: number | null;
      lastMessage: string | null;
    }
    | undefined
    | null,
) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    status: row.status,
    testModel: row.testModel,
    compatibilityMode: row.compatibilityMode,
    apiKeyPreview: maskApiKey(row.apiKey),
    lastVerifiedAt: row.lastVerifiedAt,
    lastProbeOk: row.lastProbeOk,
    lastHealthStatus: row.lastHealthStatus,
    lastHttpStatus: row.lastHttpStatus,
    lastMessage: row.lastMessage,
  };
}

async function loadLatestRelayModelPriceRows(db: DbExecutor, relayIds: string[]) {
  if (relayIds.length === 0) {
    return new Map<string, Array<{
      modelId: string | null;
      modelKey: string;
      modelName: string;
      currency: string;
      inputPricePer1M: number | null;
      outputPricePer1M: number | null;
      effectiveFrom: string | null;
    }>>();
  }

  const rows = await db
    .selectFrom("relay_prices as rp")
    .innerJoin("models as m", "m.id", "rp.model_id")
    .select([
      "rp.relay_id as relayId",
      "m.id as modelId",
      "m.key as modelKey",
      "m.name as modelName",
      "rp.currency",
      "rp.input_price_per_1m as inputPricePer1M",
      "rp.output_price_per_1m as outputPricePer1M",
      "rp.effective_from as effectiveFrom",
    ])
    .where("rp.relay_id", "in", relayIds)
    .orderBy("rp.relay_id", "asc")
    .orderBy("rp.model_id", "asc")
    .orderBy("rp.effective_from", "desc")
    .execute();

  const grouped = new Map<string, Array<{
    modelId: string | null;
    modelKey: string;
    modelName: string;
    currency: string;
    inputPricePer1M: number | null;
    outputPricePer1M: number | null;
    effectiveFrom: string | null;
  }>>();
  const seen = new Set<string>();

  for (const row of rows) {
    const key = `${row.relayId}:${row.modelId}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    const current = grouped.get(row.relayId) ?? [];
    current.push({
      modelId: row.modelId,
      modelKey: row.modelKey,
      modelName: row.modelName,
      currency: row.currency,
      inputPricePer1M: row.inputPricePer1M,
      outputPricePer1M: row.outputPricePer1M,
      effectiveFrom: row.effectiveFrom,
    });
    grouped.set(row.relayId, current);
  }

  return grouped;
}

export async function registerAdminRoutes(app: FastifyInstance) {
  app.get("/admin/overview", async () => {
    const [relays, pendingSubmissions, activeSponsors, priceRecords] = await Promise.all([
      app.db
        .selectFrom("relays")
        .select(({ fn }) => fn.count<number>("id").as("count"))
        .where("status", "<>", "archived")
        .executeTakeFirstOrThrow(),
      app.db
        .selectFrom("submissions")
        .select(({ fn }) => fn.count<number>("id").as("count"))
        .where("status", "=", "pending")
        .executeTakeFirstOrThrow(),
      app.db
        .selectFrom("sponsors")
        .select(({ fn }) => fn.count<number>("id").as("count"))
        .where("status", "=", "active")
        .executeTakeFirstOrThrow(),
      app.db
        .selectFrom("relay_prices")
        .select(({ fn }) => fn.count<number>("id").as("count"))
        .executeTakeFirstOrThrow(),
    ]);

    return adminOverviewResponseSchema.parse({
      totals: {
        relays: Number(relays.count),
        pendingSubmissions: Number(pendingSubmissions.count),
        activeSponsors: Number(activeSponsors.count),
        priceRecords: Number(priceRecords.count),
      },
      measuredAt: new Date().toISOString(),
    });
  });

  app.get("/admin/relays", async () => {
    const rows = await app.db
      .selectFrom("relays")
      .select([
        "id",
        "slug",
        "name",
        "base_url as baseUrl",
        "website_url as websiteUrl",
        "contact_info as contactInfo",
        "description",
        "status as catalogStatus",
        "updated_at as updatedAt",
      ])
      .orderBy("name", "asc")
      .execute();

    const relayIds = rows.map((row) => row.id);
    const [relayPrices, relayCredentials] = await Promise.all([
      loadLatestRelayModelPriceRows(app.db, relayIds),
      relayIds.length === 0
        ? Promise.resolve([])
        : probeCredentialBaseQuery(app.db)
            .where("pc.relay_id", "in", relayIds)
            .where("pc.status", "=", "active")
            .orderBy("pc.updated_at", "desc")
            .execute() as Promise<ProbeCredentialRow[]>,
    ]);

    const activeRelayCredentialByRelayId = new Map<string, ProbeCredentialRow>();
    for (const credential of relayCredentials) {
      if (credential.relayId && !activeRelayCredentialByRelayId.has(credential.relayId)) {
        activeRelayCredentialByRelayId.set(credential.relayId, credential);
      }
    }

    return adminRelaysResponseSchema.parse({
      rows: rows.map((row) => ({
        ...row,
        probeCredential: toAdminRelayCredentialSummary(activeRelayCredentialByRelayId.get(row.id)),
        modelPrices: relayPrices.get(row.id) ?? [],
      })),
    });
  });

  app.get("/admin/models", async () => {
    const rows = await app.db
      .selectFrom("models")
      .select([
        "id",
        "key",
        "name",
        "vendor",
        "family",
        "input_price_unit as inputPriceUnit",
        "output_price_unit as outputPriceUnit",
        "is_active as isActive",
        "updated_at as updatedAt",
      ])
      .orderBy("name", "asc")
      .execute();

    return adminModelsResponseSchema.parse({ rows });
  });

  app.post("/admin/models", async (request, reply) => {
    const body = adminModelUpsertSchema.parse(request.body ?? {});
    const row = await app.db
      .insertInto("models")
      .values({
        key: body.key,
        vendor: body.vendor,
        name: body.name,
        family: body.family,
        input_price_unit: body.inputPriceUnit ?? null,
        output_price_unit: body.outputPriceUnit ?? null,
        is_active: body.isActive,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .returning(["id"])
      .executeTakeFirstOrThrow();

    await refreshPublicData(app.db);
    reply.code(201);
    return { ok: true, id: row.id };
  });

  app.patch("/admin/models/:id", async (request) => {
    const params = request.params as { id: string };
    const body = adminModelUpsertSchema.parse(request.body ?? {});
    const updatedAt = new Date().toISOString();

    await app.db
      .updateTable("models")
      .set({
        key: body.key,
        vendor: body.vendor,
        name: body.name,
        family: body.family,
        input_price_unit: body.inputPriceUnit ?? null,
        output_price_unit: body.outputPriceUnit ?? null,
        is_active: body.isActive,
        updated_at: updatedAt,
      })
      .where("id", "=", params.id)
      .executeTakeFirst();

    await refreshPublicData(app.db);
    return { ok: true };
  });

  app.delete("/admin/models/:id", async (request) => {
    const params = request.params as { id: string };

    await app.db
      .deleteFrom("models")
      .where("id", "=", params.id)
      .executeTakeFirst();

    await refreshPublicData(app.db);
    return { ok: true };
  });

  app.post("/admin/relays", async (request, reply) => {
    const body = adminRelayUpsertSchema.parse(request.body ?? {});
    const testModel = body.modelPrices[0]?.modelKey?.trim();
    const testApiKey = body.testApiKey;

    if (!testApiKey || !testModel) {
      throw app.httpErrors.badRequest("Creating a relay requires a test API key and at least one model price row.");
    }

    const createdAt = new Date().toISOString();
    const result = await app.db.transaction().execute(async (trx) => {
      const slug = body.slug ?? await ensureUniqueRelaySlug(trx, body.name);
      const relay = await trx
        .insertInto("relays")
        .values({
          slug,
          name: body.name,
          base_url: body.baseUrl,
          provider_name: null,
          contact_info: body.contactInfo ?? null,
          description: body.description ?? null,
          website_url: body.websiteUrl ?? null,
          docs_url: null,
          status: body.catalogStatus,
          is_featured: false,
          is_sponsored: false,
          region_label: "global",
          notes: null,
          created_at: createdAt,
          updated_at: createdAt,
        })
        .returning(["id"])
        .executeTakeFirstOrThrow();

      await syncRelayCatalogModelPrices(trx, relay.id, body.modelPrices, createdAt);
      const credentialId = await createProbeCredentialForOwner(
        trx,
        {
          ownerType: "relay",
          ownerId: relay.id,
          ownerName: body.name,
          ownerSlug: slug,
          ownerBaseUrl: body.baseUrl,
          submissionId: null,
          relayId: relay.id,
        },
        {
          apiKey: testApiKey,
          testModel,
          compatibilityMode: body.compatibilityMode,
        },
      );

      return {
        relayId: relay.id,
        credentialId,
        catalogStatus: body.catalogStatus,
      };
    });

    if (result.catalogStatus === "active") {
      await runRelayCredentialMonitoringById(app.db, result.credentialId);
    } else {
      await refreshPublicData(app.db);
    }
    reply.code(201);
    return { ok: true, id: result.relayId };
  });

  app.patch("/admin/relays/:id", async (request) => {
    const params = request.params as { id: string };
    const body = adminRelayUpsertSchema.parse(request.body ?? {});
    const updatedAt = new Date().toISOString();
    const result = await app.db.transaction().execute(async (trx) => {
      const existingRelay = await trx
        .selectFrom("relays")
        .select(["id", "slug", "status"])
        .where("id", "=", params.id)
        .executeTakeFirst();

      if (!existingRelay) {
        throw app.httpErrors.notFound("Relay not found");
      }

      const nextSlug = body.slug ?? existingRelay.slug;

      await trx
        .updateTable("relays")
        .set({
          slug: nextSlug,
          name: body.name,
          base_url: body.baseUrl,
          provider_name: null,
          contact_info: body.contactInfo ?? null,
          description: body.description ?? null,
          website_url: body.websiteUrl ?? null,
          docs_url: null,
          status: body.catalogStatus,
          is_featured: false,
          is_sponsored: false,
          notes: null,
          updated_at: updatedAt,
        })
        .where("id", "=", params.id)
        .executeTakeFirst();

      await syncRelayCatalogModelPrices(trx, params.id, body.modelPrices, updatedAt);

      const activeCredential = await trx
        .selectFrom("probe_credentials")
        .select(["id"])
        .where("relay_id", "=", params.id)
        .where("status", "=", "active")
        .executeTakeFirst();

      const testModel = body.modelPrices[0]?.modelKey?.trim() ?? null;
      let credentialId = activeCredential?.id ?? null;

      if (body.testApiKey && testModel) {
        credentialId = await createProbeCredentialForOwner(
          trx,
          {
            ownerType: "relay",
            ownerId: params.id,
            ownerName: body.name,
            ownerSlug: nextSlug,
            ownerBaseUrl: body.baseUrl,
            submissionId: null,
            relayId: params.id,
          },
          {
            apiKey: body.testApiKey,
            testModel,
            compatibilityMode: body.compatibilityMode,
          },
        );
      } else if (activeCredential && testModel) {
        await trx
          .updateTable("probe_credentials")
          .set({
            test_model: testModel,
            compatibility_mode: body.compatibilityMode,
            updated_at: updatedAt,
          })
          .where("id", "=", activeCredential.id)
          .executeTakeFirst();
      }

      return {
        credentialId,
        catalogStatus: body.catalogStatus,
      };
    });

    if (result.credentialId && result.catalogStatus === "active" && body.testApiKey) {
      await runRelayCredentialMonitoringById(app.db, result.credentialId);
    } else {
      await refreshPublicData(app.db);
    }
    return { ok: true };
  });

  app.delete("/admin/relays/:id", async (request) => {
    const params = request.params as { id: string };
    const relay = await app.db
      .selectFrom("relays")
      .select(["id"])
      .where("id", "=", params.id)
      .executeTakeFirst();

    if (!relay) {
      throw app.httpErrors.notFound("Relay not found");
    }

    await app.db
      .updateTable("relays")
      .set({
        status: "archived",
        is_featured: false,
        is_sponsored: false,
        updated_at: new Date().toISOString(),
      })
      .where("id", "=", params.id)
      .executeTakeFirst();

    await refreshPublicData(app.db);
    return { ok: true };
  });

  app.get("/admin/submissions", async () => {
    const rows = await app.db
      .selectFrom("submissions")
      .select([
        "id",
        "relay_name as relayName",
        "base_url as baseUrl",
        "website_url as websiteUrl",
        "contact_info as contactInfo",
        "description",
        "notes",
        "status",
        "review_notes as reviewNotes",
        "approved_relay_id as approvedRelayId",
        "created_at as createdAt",
      ])
      .orderBy("created_at", "desc")
      .execute();

    const submissionIds = rows.map((row) => row.id);
    const approvedRelayIds = rows.flatMap((row) => (row.approvedRelayId ? [row.approvedRelayId] : []));

    const [submissionModelPrices, submissionCredentials, relayCredentials, approvedRelays] = await Promise.all([
      loadSubmissionModelPricesBySubmissionIds(app.db, submissionIds),
      submissionIds.length === 0
        ? Promise.resolve([])
        : app.db
            .selectFrom("probe_credentials")
            .select([
              "id",
              "submission_id as submissionId",
              "status",
              "test_model as testModel",
              "compatibility_mode as compatibilityMode",
              "api_key as apiKey",
              "last_verified_at as lastVerifiedAt",
              "last_probe_ok as lastProbeOk",
              "last_health_status as lastHealthStatus",
              "last_http_status as lastHttpStatus",
              "last_message as lastMessage",
              "created_at as createdAt",
            ])
            .where("submission_id", "in", submissionIds)
            .where("status", "=", "active")
            .orderBy("created_at", "desc")
            .execute(),
      approvedRelayIds.length === 0
        ? Promise.resolve([])
        : app.db
            .selectFrom("probe_credentials")
            .select([
              "id",
              "relay_id as relayId",
              "status",
              "test_model as testModel",
              "compatibility_mode as compatibilityMode",
              "api_key as apiKey",
              "last_verified_at as lastVerifiedAt",
              "last_probe_ok as lastProbeOk",
              "last_health_status as lastHealthStatus",
              "last_http_status as lastHttpStatus",
              "last_message as lastMessage",
              "created_at as createdAt",
            ])
            .where("relay_id", "in", approvedRelayIds)
            .where("status", "=", "active")
            .orderBy("created_at", "desc")
            .execute(),
      approvedRelayIds.length === 0
        ? Promise.resolve([])
        : app.db
            .selectFrom("relays")
            .select(["id", "slug", "name"])
            .where("id", "in", approvedRelayIds)
            .execute(),
    ]);

    const activeSubmissionCredentialBySubmissionId = new Map<
      string,
      (typeof submissionCredentials)[number]
    >();
    for (const credential of submissionCredentials) {
      if (credential.submissionId && !activeSubmissionCredentialBySubmissionId.has(credential.submissionId)) {
        activeSubmissionCredentialBySubmissionId.set(credential.submissionId, credential);
      }
    }

    const activeRelayCredentialByRelayId = new Map<string, (typeof relayCredentials)[number]>();
    for (const credential of relayCredentials) {
      if (credential.relayId && !activeRelayCredentialByRelayId.has(credential.relayId)) {
        activeRelayCredentialByRelayId.set(credential.relayId, credential);
      }
    }

    const approvedRelayById = new Map(approvedRelays.map((relay) => [relay.id, relay]));

    return adminSubmissionsResponseSchema.parse({
      rows: rows.map((row) => {
        const approvedRelay = row.approvedRelayId ? approvedRelayById.get(row.approvedRelayId) ?? null : null;
        const probeCredential =
          activeSubmissionCredentialBySubmissionId.get(row.id) ??
          (row.approvedRelayId ? activeRelayCredentialByRelayId.get(row.approvedRelayId) : undefined);

        return {
          id: row.id,
          relayName: row.relayName,
          baseUrl: row.baseUrl,
          websiteUrl: row.websiteUrl,
          contactInfo: row.contactInfo,
          description: row.description,
          notes: row.notes,
          modelPrices: submissionModelPrices.get(row.id) ?? [],
          status: row.status,
          reviewNotes: row.reviewNotes,
          approvedRelay: approvedRelay
            ? {
                slug: approvedRelay.slug,
                name: approvedRelay.name,
              }
            : null,
          probeCredential: toAdminRelayCredentialSummary(probeCredential),
          createdAt: row.createdAt,
        };
      }),
    });
  });

  app.get("/admin/probe-credentials", async () => {
    const rows = (await probeCredentialBaseQuery(app.db)
      .where("pc.relay_id", "is not", null)
      .orderBy("pc.updated_at", "desc")
      .execute()) as ProbeCredentialRow[];

    return adminProbeCredentialsResponseSchema.parse({
      rows: rows.map((row) => serializeAdminProbeCredential(row)),
    });
  });

  app.get("/admin/probe-credentials/:id", async (request) => {
    const params = request.params as { id: string };
    const row = await getProbeCredentialRowById(app.db, params.id);

    return adminProbeCredentialDetailSchema.parse(serializeAdminProbeCredentialDetail(row));
  });

  app.post("/admin/probe-credentials", async (request, reply) => {
    const body = adminProbeCredentialCreateSchema.parse(request.body ?? {});
    if (body.ownerType !== "relay") {
      throw app.httpErrors.badRequest("Admin-managed monitoring keys must attach to relays.");
    }
    const owner = await resolveProbeCredentialOwnerTarget(app.db, body.ownerType, body.ownerId);
    const id = await app.db.transaction().execute(async (trx) =>
      createProbeCredentialForOwner(trx, owner, {
        apiKey: body.apiKey,
        testModel: body.testModel,
        compatibilityMode: body.compatibilityMode,
      }),
    );

    const probeResult = owner.ownerType === "relay"
      ? (await runRelayCredentialMonitoringById(app.db, id)).probe
      : await runPublicProbe({
        baseUrl: owner.ownerBaseUrl,
        apiKey: body.apiKey,
        model: body.testModel,
        compatibilityMode: body.compatibilityMode,
        scanMode: "standard",
      });

    if (owner.ownerType !== "relay") {
      await app.db
        .updateTable("probe_credentials")
        .set(toProbeCredentialVerification(probeResult))
        .where("id", "=", id)
        .executeTakeFirst();
    }

    reply.code(201);
    return adminProbeCredentialMutationResponseSchema.parse({
      ok: true,
      id,
      probe: toSubmissionProbeSummary(probeResult),
    });
  });

  app.delete("/admin/probe-credentials/:id", async (request) => {
    const params = request.params as { id: string };
    const credential = await getProbeCredentialRowById(app.db, params.id);

    await app.db
      .deleteFrom("probe_credentials")
      .where("id", "=", credential.id)
      .executeTakeFirst();

    return { ok: true };
  });

  app.post("/admin/probe-credentials/:id/reprobe", async (request) => {
    const params = request.params as { id: string };
    const credential = await getProbeCredentialRowById(app.db, params.id);
    const owner = resolveProbeCredentialOwner(credential);
    const probeResult = owner.ownerType === "relay"
      ? (await runRelayCredentialMonitoringById(app.db, credential.id)).probe
      : await runPublicProbe({
        baseUrl: owner.ownerBaseUrl,
        apiKey: credential.apiKey,
        model: credential.testModel,
        compatibilityMode: credential.compatibilityMode,
        scanMode: "standard",
      });

    if (owner.ownerType !== "relay") {
      await app.db
        .updateTable("probe_credentials")
        .set(toProbeCredentialVerification(probeResult))
        .where("id", "=", credential.id)
        .executeTakeFirst();
    }

    return adminProbeCredentialMutationResponseSchema.parse({
      ok: true,
      id: credential.id,
      probe: toSubmissionProbeSummary(probeResult),
    });
  });

  app.post("/admin/probe-credentials/:id/rotate", async (request) => {
    const params = request.params as { id: string };
    const body = adminProbeCredentialRotateSchema.parse(request.body ?? {});
    const credential = await getProbeCredentialRowById(app.db, params.id);
    const owner = resolveProbeCredentialOwner(credential);
    const id = await app.db.transaction().execute(async (trx) =>
      createProbeCredentialForOwner(trx, owner, {
        apiKey: body.apiKey,
        testModel: body.testModel,
        compatibilityMode: body.compatibilityMode,
      }),
    );

    const probeResult = owner.ownerType === "relay"
      ? (await runRelayCredentialMonitoringById(app.db, id)).probe
      : await runPublicProbe({
        baseUrl: owner.ownerBaseUrl,
        apiKey: body.apiKey,
        model: body.testModel,
        compatibilityMode: body.compatibilityMode,
        scanMode: "standard",
      });

    if (owner.ownerType !== "relay") {
      await app.db
        .updateTable("probe_credentials")
        .set(toProbeCredentialVerification(probeResult))
        .where("id", "=", id)
        .executeTakeFirst();
    }

    return adminProbeCredentialMutationResponseSchema.parse({
      ok: true,
      id,
      probe: toSubmissionProbeSummary(probeResult),
    });
  });

  app.post("/admin/probe-credentials/:id/revoke", async (request) => {
    const params = request.params as { id: string };
    const credential = await getProbeCredentialRowById(app.db, params.id);

    await app.db
      .updateTable("probe_credentials")
      .set({ status: "revoked" })
      .where("id", "=", credential.id)
      .executeTakeFirst();

    return adminProbeCredentialMutationResponseSchema.parse({
      ok: true,
      id: credential.id,
      probe: null,
    });
  });

  app.post("/admin/submissions/:id/review", async (request) => {
    const params = request.params as { id: string };
    const body = adminSubmissionReviewSchema.parse(request.body ?? {});
    let approvedCredentialId: string | null = null;
    const reviewedAt = new Date().toISOString();

    await app.db.transaction().execute(async (trx) => {
      const submission = await trx
        .selectFrom("submissions")
        .select([
          "id",
          "relay_name as relayName",
          "base_url as baseUrl",
          "website_url as websiteUrl",
          "contact_info as contactInfo",
          "description",
          "approved_relay_id as approvedRelayId",
        ])
        .where("id", "=", params.id)
        .executeTakeFirst();

      if (!submission) {
        throw app.httpErrors.notFound("Submission not found");
      }

      if (body.status === "approved") {
        const submissionModelPrices = await loadSubmissionModelPricesBySubmissionIds(trx, [params.id]);
        const modelPrices = submissionModelPrices.get(params.id) ?? [];
        const defaultTestModel = modelPrices[0]?.modelKey ?? null;
        const relay = await resolveApprovedRelay(trx, submission);
        const relayUpdate: {
          status: "active";
          website_url?: string | null;
          contact_info?: string | null;
          description?: string | null;
          updated_at: string;
        } = {
          status: "active",
          updated_at: reviewedAt,
        };

        if (submission.websiteUrl) {
          relayUpdate.website_url = submission.websiteUrl;
        }

        if (submission.contactInfo) {
          relayUpdate.contact_info = submission.contactInfo;
        }

        if (submission.description) {
          relayUpdate.description = submission.description;
        }

        await trx
          .updateTable("relays")
          .set(relayUpdate)
          .where("id", "=", relay.id)
          .executeTakeFirst();

        await trx
          .updateTable("submissions")
          .set({
            status: body.status,
            review_notes: body.reviewNotes ?? null,
            approved_relay_id: relay.id,
            updated_at: reviewedAt,
          })
          .where("id", "=", params.id)
          .executeTakeFirst();

        if (modelPrices.length > 0) {
          await syncRelayCatalogModelPrices(trx, relay.id, modelPrices, reviewedAt);
        }

        const activeRelayCredential = await trx
          .selectFrom("probe_credentials")
          .select(["id"])
          .where("relay_id", "=", relay.id)
          .where("status", "=", "active")
          .executeTakeFirst();

        if (activeRelayCredential) {
          await trx
            .updateTable("probe_credentials")
            .set({ status: "rotated" })
            .where("id", "=", activeRelayCredential.id)
            .executeTakeFirst();
        }

        const activeSubmissionCredential = await trx
          .selectFrom("probe_credentials")
          .select(["id"])
          .where("submission_id", "=", params.id)
          .where("status", "=", "active")
          .executeTakeFirst();

        if (activeSubmissionCredential) {
          const credentialUpdate: {
            submission_id: null;
            relay_id: string;
            updated_at: string;
            test_model?: string;
          } = {
            submission_id: null,
            relay_id: relay.id,
            updated_at: reviewedAt,
          };

          if (defaultTestModel) {
            credentialUpdate.test_model = defaultTestModel;
          }

          await trx
            .updateTable("probe_credentials")
            .set(credentialUpdate)
            .where("id", "=", activeSubmissionCredential.id)
            .executeTakeFirst();

          approvedCredentialId = activeSubmissionCredential.id;
        }

        return;
      }

      await trx
        .updateTable("submissions")
        .set({
          status: body.status,
          review_notes: body.reviewNotes ?? null,
          updated_at: reviewedAt,
        })
        .where("id", "=", params.id)
        .executeTakeFirst();

      await trx
        .updateTable("probe_credentials")
        .set({ status: "revoked" })
        .where("submission_id", "=", params.id)
        .where("status", "=", "active")
        .execute();
    });

    if (body.status === "approved" && approvedCredentialId) {
      await runRelayCredentialMonitoringById(app.db, approvedCredentialId);
    } else if (body.status === "approved") {
      await refreshPublicData(app.db);
    }

    return { ok: true };
  });

  app.get("/admin/sponsors", async () => {
    const rows = await app.db
      .selectFrom("sponsors as s")
      .leftJoin("relays as r", "r.id", "s.relay_id")
      .select([
        "s.id",
        "s.relay_id as relayId",
        "s.name",
        "s.placement",
        "s.status",
        "s.start_at as startAt",
        "s.end_at as endAt",
        "r.slug as relaySlug",
        "r.name as relayName",
      ])
      .orderBy("s.start_at", "desc")
      .execute();

    return adminSponsorsResponseSchema.parse({
      rows: rows.map((row) => ({
        id: row.id,
        relayId: row.relayId,
        name: row.name,
        placement: row.placement,
        status: row.status,
        startAt: row.startAt,
        endAt: row.endAt,
        relay:
          row.relaySlug && row.relayName
            ? {
                slug: row.relaySlug,
                name: row.relayName,
              }
            : null,
      })),
    });
  });

  app.post("/admin/sponsors", async (request, reply) => {
    const body = adminSponsorUpsertSchema.parse(request.body ?? {});
    const row = await app.db
      .insertInto("sponsors")
      .values({
        relay_id: body.relayId ?? null,
        name: body.name,
        placement: body.placement,
        status: body.status,
        start_at: body.startAt,
        end_at: body.endAt,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .returning(["id"])
      .executeTakeFirstOrThrow();

    await refreshPublicData(app.db);
    reply.code(201);
    return { ok: true, id: row.id };
  });

  app.patch("/admin/sponsors/:id", async (request) => {
    const params = request.params as { id: string };
    const body = adminSponsorUpsertSchema.parse(request.body ?? {});
    await app.db
      .updateTable("sponsors")
      .set({
        relay_id: body.relayId ?? null,
        name: body.name,
        placement: body.placement,
        status: body.status,
        start_at: body.startAt,
        end_at: body.endAt,
      })
      .where("id", "=", params.id)
      .executeTakeFirst();

    await refreshPublicData(app.db);
    return { ok: true };
  });

  app.delete("/admin/sponsors/:id", async (request) => {
    const params = request.params as { id: string };

    await app.db
      .deleteFrom("sponsors")
      .where("id", "=", params.id)
      .executeTakeFirst();

    await refreshPublicData(app.db);
    return { ok: true };
  });

  app.get("/admin/prices", async () => {
    const rows = await app.db
      .selectFrom("relay_prices as rp")
      .innerJoin("relays as r", "r.id", "rp.relay_id")
      .innerJoin("models as m", "m.id", "rp.model_id")
      .select([
        "rp.id",
        "rp.relay_id as relayId",
        "rp.model_id as modelId",
        "r.slug",
        "r.name",
        "m.key as modelKey",
        "m.name as modelName",
        "rp.currency",
        "rp.input_price_per_1m as inputPricePer1M",
        "rp.output_price_per_1m as outputPricePer1M",
        "rp.source",
        "rp.effective_from as effectiveFrom",
      ])
      .orderBy("rp.effective_from", "desc")
      .execute();

    return adminPricesResponseSchema.parse({
      rows: rows.map((row) => ({
        id: row.id,
        relayId: row.relayId,
        modelId: row.modelId,
        relay: {
          slug: row.slug,
          name: row.name,
        },
        modelKey: row.modelKey,
        modelName: row.modelName,
        currency: row.currency,
        inputPricePer1M: row.inputPricePer1M,
        outputPricePer1M: row.outputPricePer1M,
        source: row.source,
        effectiveFrom: row.effectiveFrom,
      })),
    });
  });

  app.post("/admin/prices", async (request, reply) => {
    const body = adminPriceCreateSchema.parse(request.body ?? {});
    const row = await app.db
      .insertInto("relay_prices")
      .values({
        relay_id: body.relayId,
        model_id: body.modelId,
        currency: body.currency,
        input_price_per_1m: body.inputPricePer1M ?? null,
        output_price_per_1m: body.outputPricePer1M ?? null,
        cache_read_price_per_1m: null,
        cache_write_price_per_1m: null,
        effective_from: body.effectiveFrom,
        source: body.source,
        captured_at: new Date().toISOString(),
      })
      .returning(["id"])
      .executeTakeFirstOrThrow();

    await refreshPublicData(app.db);
    reply.code(201);
    return { ok: true, id: row.id };
  });

  app.patch("/admin/prices/:id", async (request) => {
    const params = request.params as { id: string };
    const body = adminPriceCreateSchema.parse(request.body ?? {});

    await app.db
      .updateTable("relay_prices")
      .set({
        relay_id: body.relayId,
        model_id: body.modelId,
        currency: body.currency,
        input_price_per_1m: body.inputPricePer1M ?? null,
        output_price_per_1m: body.outputPricePer1M ?? null,
        effective_from: body.effectiveFrom,
        source: body.source,
      })
      .where("id", "=", params.id)
      .executeTakeFirst();

    await refreshPublicData(app.db);
    return { ok: true };
  });

  app.delete("/admin/prices/:id", async (request) => {
    const params = request.params as { id: string };

    await app.db
      .deleteFrom("relay_prices")
      .where("id", "=", params.id)
      .executeTakeFirst();

    await refreshPublicData(app.db);
    return { ok: true };
  });

  app.post("/admin/refresh-public", async () => {
    const result = await refreshPublicData(app.db);
    return adminRefreshPublicResponseSchema.parse({
      ok: true,
      measuredAt: result.measuredAt,
    });
  });
}
