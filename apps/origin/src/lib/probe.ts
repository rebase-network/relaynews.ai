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

export async function runPublicProbe(input: PublicProbeRequest): Promise<PublicProbeResponse> {
  const parsed = publicProbeRequestSchema.parse(input);
  const measuredAt = new Date().toISOString();
  const targetUrl = new URL(parsed.baseUrl);

  try {
    await validateTarget(targetUrl);
    const startedAt = Date.now();
    const response = await fetch(targetUrl, {
      method: "GET",
      redirect: "manual",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: {
        authorization: `Bearer ${parsed.apiKey}`,
        accept: "application/json,text/plain;q=0.9,*/*;q=0.8",
        "user-agent": "relaynews-public-probe/0.1",
      },
    });
    const latencyMs = Date.now() - startedAt;
    const body = await readLimitedText(response.body, MAX_RESPONSE_BYTES);
    const contentType = response.headers.get("content-type") ?? "";
    const protocolOk = response.ok && (body.length > 0 || contentType.length > 0);

    return publicProbeResponseSchema.parse({
      ok: response.ok,
      targetHost: targetUrl.hostname,
      model: parsed.model,
      connectivity: {
        ok: response.ok,
        latencyMs,
      },
      protocol: {
        ok: protocolOk,
        healthStatus: successHealthStatus(response.status),
        httpStatus: response.status,
      },
      message: response.ok ? null : `Upstream returned ${response.status}`,
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
