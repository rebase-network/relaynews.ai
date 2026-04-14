import "dotenv/config";

import { z } from "zod";

const configSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  HOST: z.string().default("127.0.0.1"),
  PORT: z.coerce.number().int().positive().default(8787),
  DATABASE_URL: z.string().min(1).default("postgres://postgres:postgres@127.0.0.1:54329/relaynews"),
  ENABLE_SCHEDULER: z
    .string()
    .optional()
    .transform((value) => value === "true"),
  PUBLIC_PROBE_ALLOW_PRIVATE_HOSTS: z
    .string()
    .optional()
    .transform((value) => value === "true"),
});

export type AppConfig = z.infer<typeof configSchema>;

export const config = configSchema.parse(process.env);
