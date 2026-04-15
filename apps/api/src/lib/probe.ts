import { lookup } from "node:dns/promises";

import {
  publicProbeRequestSchema,
  publicProbeResponseSchema,
  type PublicProbeRequest,
  type PublicProbeResponse,
} from "@relaynews/shared";
import ipaddr from "ipaddr.js";

import { config } from "../config";

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

type ProbeAttempt = {
  method: "GET" | "POST";
  url: URL;
  body?: string;
};

type ProbeAttemptResult = {
  response: Response;
  latencyMs: number;
  body: string;
  contentType: string;
};

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

function joinPath(basePath: string, suffix: string) {
  const normalizedBase = basePath === "/" ? "" : basePath.replace(/\/$/, "");
  const normalizedSuffix = suffix.startsWith("/") ? suffix : `/${suffix}`;
  return normalizedBase ? `${normalizedBase}${normalizedSuffix}` : normalizedSuffix;
}

function buildPathVariants(targetUrl: URL) {
  const basePath = targetUrl.pathname === "/" ? "" : targetUrl.pathname.replace(/\/$/, "");
  const variants = new Set<string>();

  if (basePath.endsWith("/v1")) {
    variants.add(basePath);
    variants.add(basePath.slice(0, -3) || "");
  } else {
    variants.add(joinPath(basePath, "/v1"));
    variants.add(basePath);
  }

  return [...variants];
}

function withPath(targetUrl: URL, pathname: string) {
  const nextUrl = new URL(targetUrl.toString());
  nextUrl.pathname = pathname || "/";
  return nextUrl;
}

function buildProbeAttempts(targetUrl: URL, parsed: PublicProbeRequest): ProbeAttempt[] {
  const responsesBody = JSON.stringify({
    model: parsed.model,
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: "ping",
          },
        ],
      },
    ],
    stream: true,
    max_output_tokens: 1,
  });

  const chatCompletionsBody = JSON.stringify({
    model: parsed.model,
    messages: [
      {
        role: "user",
        content: "ping",
      },
    ],
    stream: true,
    max_tokens: 1,
  });

  return buildPathVariants(targetUrl).flatMap((basePath) => [
    {
      method: "POST" as const,
      url: withPath(targetUrl, joinPath(basePath, "/responses")),
      body: responsesBody,
    },
    {
      method: "POST" as const,
      url: withPath(targetUrl, joinPath(basePath, "/chat/completions")),
      body: chatCompletionsBody,
    },
    {
      method: "GET" as const,
      url: withPath(targetUrl, joinPath(basePath, "/models")),
    },
    {
      method: "GET" as const,
      url: withPath(targetUrl, basePath),
    },
  ]);
}

async function executeProbeAttempt(attempt: ProbeAttempt, apiKey: string): Promise<ProbeAttemptResult> {
  const startedAt = Date.now();
  const requestInit: RequestInit = {
    method: attempt.method,
    redirect: "manual",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    headers: {
      authorization: `Bearer ${apiKey}`,
      accept: "text/event-stream,application/json,text/plain;q=0.9,*/*;q=0.8",
      "content-type": "application/json",
      "user-agent": "relaynews-public-probe/0.1",
    },
  };

  if (attempt.body) {
    requestInit.body = attempt.body;
  }

  const response = await fetch(attempt.url, requestInit);
  const latencyMs = Date.now() - startedAt;
  const body = await readLimitedText(response.body, MAX_RESPONSE_BYTES);
  const contentType = response.headers.get("content-type") ?? "";

  return {
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

  try {
    await validateTarget(targetUrl);
    let bestFailure: ProbeAttemptResult | null = null;

    for (const attempt of buildProbeAttempts(targetUrl, parsed)) {
      const result = await executeProbeAttempt(attempt, parsed.apiKey);
      const protocolOk = result.response.ok && (result.body.length > 0 || result.contentType.length > 0);

      if (result.response.ok && protocolOk) {
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
          message: null,
          measuredAt,
        });
      }

      if (
        !bestFailure
        || (bestFailure.response.status === 404 && result.response.status !== 404)
        || (bestFailure.response.status === 405 && ![404, 405].includes(result.response.status))
      ) {
        bestFailure = result;
      }

      if (!RETRIABLE_HTTP_STATUSES.has(result.response.status)) {
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
      message: `Upstream returned ${bestFailure.response.status}`,
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
      message: sanitizeMessage(error),
      measuredAt,
    });
  }
}
