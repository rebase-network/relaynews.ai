export const PROBE_LIMITS = {
  responseBodyBytes: 256 * 1024,
  primary: {
    timeoutMs: 16_000,
    outputTokens: 256,
  },
  credibility: {
    timeoutMs: 32_000,
    outputTokens: 2048,
  },
} as const;
