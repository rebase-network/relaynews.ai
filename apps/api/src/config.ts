import "dotenv/config";

import { z } from "zod";

function normalizeBasePath(value: string | undefined) {
  if (!value) {
    return "";
  }

  const trimmed = value.trim();
  if (!trimmed || trimmed === "/") {
    return "";
  }

  const withoutSlashes = trimmed.replace(/^\/+|\/+$/g, "");
  return withoutSlashes ? `/${withoutSlashes}` : "";
}

function normalizeOptionalEnvString(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

const configSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  HOST: z.string().default("127.0.0.1"),
  PORT: z.coerce.number().int().positive().default(8787),
  DATABASE_URL: z.string().min(1).default("postgres://postgres:postgres@127.0.0.1:54329/relaynews"),
  API_BASE_PATH: z
    .string()
    .optional()
    .transform((value) => normalizeBasePath(value)),
  ENABLE_SCHEDULER: z
    .string()
    .optional()
    .transform((value) => value === "true"),
  PRIMARY_PROBE_CRON: z.string().default("*/15 * * * *"),
  CREDIBILITY_PROBE_CRON: z.string().default("17 4 * * *"),
  SCHEDULER_TIMEZONE: z.string().default("Asia/Shanghai"),
  PUBLIC_PROBE_ALLOW_PRIVATE_HOSTS: z
    .string()
    .optional()
    .transform((value) => value === "true"),
  ADMIN_AUTH_USERNAME: z
    .string()
    .optional()
    .transform((value) => normalizeOptionalEnvString(value)),
  ADMIN_AUTH_PASSWORD: z
    .string()
    .optional()
    .transform((value) => normalizeOptionalEnvString(value)),
}).superRefine((value, context) => {
  const hasUsername = Boolean(value.ADMIN_AUTH_USERNAME);
  const hasPassword = Boolean(value.ADMIN_AUTH_PASSWORD);

  if (hasUsername === hasPassword) {
    return;
  }

  context.addIssue({
    code: "custom",
    path: hasUsername ? ["ADMIN_AUTH_PASSWORD"] : ["ADMIN_AUTH_USERNAME"],
    message: "ADMIN_AUTH_USERNAME and ADMIN_AUTH_PASSWORD must both be set together",
  });
});

export type AppConfig = z.infer<typeof configSchema>;

export const config = configSchema.parse(process.env);
