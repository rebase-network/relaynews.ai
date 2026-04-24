import { lookup } from "node:dns/promises";

import {
  publicProbeRequestSchema,
  publicProbeResponseSchema,
  type ProbeDetectionMode,
  type PublicProbeRequest,
  type PublicProbeResponse,
} from "@relaynews/shared";
import ipaddr from "ipaddr.js";

import { config } from "../config";
import {
  buildProbeAttempts,
  probeAdapterRegistry,
  probeCompatibilityModeLabels,
  type ProbeAttempt,
  type ProbeAttemptResult,
} from "./probe-registry";

const BLOCKED_CIDRS = [
  "127.0.0.0/8",
  "10.0.0.0/8",
  "172.16.0.0/12",
  "192.168.0.0/16",
  "169.254.0.0/16",
  "100.64.0.0/10",
  "0.0.0.0/8",
  "::1/128",
  "fc00::/7",
  "fe80::/10",
  "ff00::/8",
] as const;

const MAX_RESPONSE_BYTES = 256 * 1024;
const REQUEST_TIMEOUT_MS = 8_000;
const RETRIABLE_HTTP_STATUSES = new Set([400, 404, 405, 415]);

function sanitizeMessage(value: unknown) {
  if (value instanceof Error) {
    return value.message.replaceAll(/sk-[a-zA-Z0-9_-]+/g, "[redacted]");
  }

  return "Probe failed";
}

function isBlockedIp(address: string) {
  const parsed = ipaddr.parse(address);
  let normalized = parsed;
  if (parsed.kind() === "ipv6") {
    const ipv6 = parsed as ipaddr.IPv6;
    if (ipv6.isIPv4MappedAddress()) {
      normalized = ipv6.toIPv4Address();
    }
  }

  return BLOCKED_CIDRS.some((cidr) => {
    const [network, prefix] = ipaddr.parseCIDR(cidr);
    return normalized.kind() === network.kind() && normalized.match([network, prefix]);
  });
}

async function validateTarget(url: URL) {
  if (url.protocol !== "https:") {
    throw new Error("Only https targets are allowed");
  }

  if (config.PUBLIC_PROBE_ALLOW_PRIVATE_HOSTS) {
    return;
  }

  const addresses = await lookup(url.hostname, { all: true, verbatim: true });
  if (addresses.length === 0) {
    throw new Error("Unable to resolve target host");
  }

  for (const address of addresses) {
    if (isBlockedIp(address.address) || address.address === "169.254.169.254") {
      throw new Error("Target resolves to a blocked network range");
    }
  }
}

async function readLimitedText(stream: ReadableStream<Uint8Array> | null, limit: number) {
  if (!stream) {
    return "";
  }

  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    total += value.byteLength;
    if (total > limit) {
      throw new Error("Response body exceeded the allowed size");
    }

    chunks.push(value);
  }

  return new TextDecoder().decode(Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))));
}

function successHealthStatus(statusCode: number) {
  if (statusCode >= 200 && statusCode < 300) {
    return "healthy" as const;
  }

  if (statusCode >= 400 && statusCode < 500) {
    return "degraded" as const;
  }

  return "down" as const;
}

function detectionModeFromRequest(input: PublicProbeRequest): ProbeDetectionMode {
  return input.compatibilityMode === "auto" ? "auto" : "manual";
}

function uniqueAttemptedModes(attempts: ProbeAttempt[]) {
  return [...new Set(attempts.map((attempt) => attempt.mode))];
}

function buildAttemptTrace(results: ProbeAttemptResult[], matchedAttempt: ProbeAttemptResult | null = null) {
  return results.map((result) => ({
    mode: result.attempt.mode,
    label: probeCompatibilityModeLabels[result.attempt.mode],
    url: result.attempt.url.toString(),
    httpStatus: result.response.status,
    matched: matchedAttempt?.attempt.url.toString() === result.attempt.url.toString(),
  }));
}

export function getProbeFailurePriority(result: ProbeAttemptResult) {
  const status = result.response.status;

  if (status === 401 || status === 403) {
    return 100;
  }

  if (status === 429) {
    return 90;
  }

  if (status >= 500) {
    return 80;
  }

  if (status >= 200 && status < 300) {
    return 70;
  }

  if (status === 415) {
    return 60;
  }

  if (status === 400) {
    return 50;
  }

  if (status === 405) {
    return 40;
  }

  if (status === 404) {
    return 30;
  }

  if (status >= 300 && status < 400) {
    return 20;
  }

  return 10;
}

export function pickPreferredProbeFailure(current: ProbeAttemptResult | null, next: ProbeAttemptResult) {
  if (!current) {
    return next;
  }

  if (getProbeFailurePriority(next) > getProbeFailurePriority(current)) {
    return next;
  }

  return current;
}

export function shouldContinueProbeSequence(result: ProbeAttemptResult) {
  if (RETRIABLE_HTTP_STATUSES.has(result.response.status)) {
    return true;
  }

  if (!result.response.ok) {
    return false;
  }

  return true;
}

export function buildProbeFailureMessage(result: ProbeAttemptResult) {
  const label = probeCompatibilityModeLabels[result.attempt.mode];

  if (result.response.ok) {
    return `Upstream returned ${result.response.status}, but the payload did not match ${label}`;
  }

  if (result.response.status >= 300 && result.response.status < 400) {
    return `Upstream redirected with ${result.response.status} while testing ${label}`;
  }

  return `Upstream returned ${result.response.status} while testing ${label}`;
}

async function executeProbeAttempt(attempt: ProbeAttempt, apiKey: string): Promise<ProbeAttemptResult> {
  const startedAt = Date.now();
  const headers: Record<string, string> = {
    accept: "text/event-stream,application/json,text/plain;q=0.9,*/*;q=0.8",
    "content-type": "application/json",
    "user-agent": "relaynews-public-probe/0.1",
  };

  if (attempt.useBearerAuth !== false) {
    headers.authorization = `Bearer ${apiKey}`;
  }

  const requestInit: RequestInit = {
    method: attempt.method,
    body: attempt.body,
    redirect: "manual",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    headers: {
      ...headers,
      ...(attempt.headers ?? {}),
    },
  };

  const response = await fetch(attempt.url, requestInit);
  const latencyMs = Date.now() - startedAt;
  const body = await readLimitedText(response.body, MAX_RESPONSE_BYTES);
  const contentType = response.headers.get("content-type") ?? "";

  return {
    attempt,
    response,
    latencyMs,
    body,
    contentType,
  };
}

export async function runPublicProbe(input: PublicProbeRequest): Promise<PublicProbeResponse> {
  const parsed = publicProbeRequestSchema.parse(input);
  const measuredAt = new Date().toISOString();
  const targetUrl = new URL(parsed.baseUrl);
  const detectionMode = detectionModeFromRequest(parsed);
  const attempts = buildProbeAttempts(targetUrl, parsed);
  const executedResults: ProbeAttemptResult[] = [];

  try {
    await validateTarget(targetUrl);
    let bestFailure: ProbeAttemptResult | null = null;

    for (const attempt of attempts) {
      const result = await executeProbeAttempt(attempt, parsed.apiKey);
      executedResults.push(result);
      const adapter = probeAdapterRegistry[result.attempt.mode];

      if (adapter.matches(result)) {
        const attemptTrace = buildAttemptTrace(executedResults, result);
        return publicProbeResponseSchema.parse({
          ok: true,
          targetHost: targetUrl.hostname,
          model: parsed.model,
          connectivity: {
            ok: true,
            latencyMs: result.latencyMs,
          },
          protocol: {
            ok: true,
            healthStatus: successHealthStatus(result.response.status),
            httpStatus: result.response.status,
          },
          compatibilityMode: result.attempt.mode,
          detectionMode,
          usedUrl: result.attempt.url.toString(),
          attemptedModes: uniqueAttemptedModes(executedResults.map((entry) => entry.attempt)),
          attemptTrace,
          message: null,
          measuredAt,
        });
      }

      bestFailure = pickPreferredProbeFailure(bestFailure, result);

      if (!shouldContinueProbeSequence(result)) {
        break;
      }
    }

    if (!bestFailure) {
      throw new Error("Probe request did not produce a response");
    }

    return publicProbeResponseSchema.parse({
      ok: false,
      targetHost: targetUrl.hostname,
      model: parsed.model,
      connectivity: {
        ok: true,
        latencyMs: bestFailure.latencyMs,
      },
      protocol: {
        ok: false,
        healthStatus: successHealthStatus(bestFailure.response.status),
        httpStatus: bestFailure.response.status,
      },
      compatibilityMode: bestFailure.attempt.mode,
      detectionMode,
      usedUrl: bestFailure.attempt.url.toString(),
      attemptedModes: uniqueAttemptedModes(executedResults.map((entry) => entry.attempt)),
      attemptTrace: buildAttemptTrace(executedResults),
      message: buildProbeFailureMessage(bestFailure),
      measuredAt,
    });
  } catch (error) {
    return publicProbeResponseSchema.parse({
      ok: false,
      targetHost: targetUrl.hostname,
      model: parsed.model,
      connectivity: {
        ok: false,
        latencyMs: null,
      },
      protocol: {
        ok: false,
        healthStatus: "unknown",
      },
      compatibilityMode: null,
      detectionMode,
      usedUrl: null,
      attemptedModes: uniqueAttemptedModes(executedResults.map((entry) => entry.attempt)),
      attemptTrace: buildAttemptTrace(executedResults),
      message: sanitizeMessage(error),
      measuredAt,
    });
  }
}
