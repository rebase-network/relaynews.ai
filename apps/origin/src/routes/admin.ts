import {
  adminOverviewResponseSchema,
  adminPriceCreateSchema,
  adminPricesResponseSchema,
  adminRelayUpsertSchema,
  adminRelaysResponseSchema,
  adminSubmissionReviewSchema,
  adminSubmissionsResponseSchema,
  adminSponsorUpsertSchema,
  adminSponsorsResponseSchema,
  publicSubmissionRequestSchema,
  publicSubmissionResponseSchema,
} from "@relaynews/shared";
import type { FastifyInstance } from "fastify";

import { refreshPublicData } from "../lib/refresh-public-data";

export async function registerAdminRoutes(app: FastifyInstance) {
  app.get("/admin/overview", async () => {
    const [relays, pendingSubmissions, activeSponsors, priceRecords] = await Promise.all([
      app.db.selectFrom("relays").select(({ fn }) => fn.count<number>("id").as("count")).executeTakeFirstOrThrow(),
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
        "provider_name as providerName",
        "website_url as websiteUrl",
        "status as catalogStatus",
        "is_featured as isFeatured",
        "is_sponsored as isSponsored",
        "updated_at as updatedAt",
      ])
      .orderBy("name", "asc")
      .execute();

    return adminRelaysResponseSchema.parse({ rows });
  });

  app.get("/admin/models", async () => {
    const rows = await app.db
      .selectFrom("models")
      .select(["id", "key", "name", "vendor"])
      .where("is_active", "=", true)
      .orderBy("name", "asc")
      .execute();

    return { rows };
  });

  app.post("/admin/relays", async (request, reply) => {
    const body = adminRelayUpsertSchema.parse(request.body ?? {});
    const row = await app.db
      .insertInto("relays")
      .values({
        slug: body.slug,
        name: body.name,
        base_url: body.baseUrl,
        provider_name: body.providerName ?? null,
        description: body.description ?? null,
        website_url: body.websiteUrl ?? null,
        docs_url: body.docsUrl ?? null,
        status: body.catalogStatus,
        is_featured: body.isFeatured,
        is_sponsored: body.isSponsored,
        region_label: "global",
        notes: body.notes ?? null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .returning(["id"])
      .executeTakeFirstOrThrow();

    await refreshPublicData(app.db);
    reply.code(201);
    return { ok: true, id: row.id };
  });

  app.patch("/admin/relays/:id", async (request) => {
    const params = request.params as { id: string };
    const body = adminRelayUpsertSchema.parse(request.body ?? {});
    await app.db
      .updateTable("relays")
      .set({
        slug: body.slug,
        name: body.name,
        base_url: body.baseUrl,
        provider_name: body.providerName ?? null,
        description: body.description ?? null,
        website_url: body.websiteUrl ?? null,
        docs_url: body.docsUrl ?? null,
        status: body.catalogStatus,
        is_featured: body.isFeatured,
        is_sponsored: body.isSponsored,
        notes: body.notes ?? null,
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
        "submitter_name as submitterName",
        "submitter_email as submitterEmail",
        "notes",
        "status",
        "review_notes as reviewNotes",
        "created_at as createdAt",
      ])
      .orderBy("created_at", "desc")
      .execute();

    return adminSubmissionsResponseSchema.parse({ rows });
  });

  app.post("/public/submissions", async (request, reply) => {
    const body = publicSubmissionRequestSchema.parse(request.body ?? {});
    const row = await app.db
      .insertInto("submissions")
      .values({
        relay_name: body.relayName,
        base_url: body.baseUrl,
        website_url: body.websiteUrl ?? null,
        submitter_name: body.submitterName ?? null,
        submitter_email: body.submitterEmail ?? null,
        notes: body.notes ?? null,
        status: "pending",
        review_notes: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .returning(["id", "status"])
      .executeTakeFirstOrThrow();

    reply.code(201);
    return publicSubmissionResponseSchema.parse({
      ok: true,
      id: row.id,
      status: row.status,
    });
  });

  app.post("/admin/submissions/:id/review", async (request) => {
    const params = request.params as { id: string };
    const body = adminSubmissionReviewSchema.parse(request.body ?? {});
    await app.db
      .updateTable("submissions")
      .set({
        status: body.status,
        review_notes: body.reviewNotes ?? null,
      })
      .where("id", "=", params.id)
      .executeTakeFirst();

    return { ok: true };
  });

  app.get("/admin/sponsors", async () => {
    const rows = await app.db
      .selectFrom("sponsors as s")
      .leftJoin("relays as r", "r.id", "s.relay_id")
      .select([
        "s.id",
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

  app.get("/admin/prices", async () => {
    const rows = await app.db
      .selectFrom("relay_prices as rp")
      .innerJoin("relays as r", "r.id", "rp.relay_id")
      .innerJoin("models as m", "m.id", "rp.model_id")
      .select([
        "rp.id",
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

  app.post("/admin/refresh-public", async () => {
    const result = await refreshPublicData(app.db);
    return { ok: true, measuredAt: result.measuredAt };
  });
}
