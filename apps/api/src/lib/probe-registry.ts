import {
  type ProbeCompatibilityMode,
  type ProbeResolvedCompatibilityMode,
  type PublicProbeRequest,
} from "@relaynews/shared";

export type ProbeModelFamily = "openai" | "anthropic" | "chat-first" | "gemini-native" | "generic";

export type ProbeAttempt = {
  mode: ProbeResolvedCompatibilityMode;
  method: "POST";
  url: URL;
  body: string;
  headers?: Record<string, string>;
  useBearerAuth?: boolean;
};

export type ProbeAttemptResult = {
  attempt: ProbeAttempt;
  response: Response;
  latencyMs: number;
  ttfbMs: number;
  firstTokenMs: number | null;
  body: string;
  contentType: string;
};

export type ProbeReportedModelMetadata = {
  model: string | null;
  version: string | null;
};

export type ProbeAdapter = {
  key: ProbeResolvedCompatibilityMode;
  label: string;
  buildAttempts: (targetUrl: URL, request: PublicProbeRequest) => ProbeAttempt[];
  buildCredibilityAttempt: (attempt: ProbeAttempt, request: PublicProbeRequest) => ProbeAttempt;
  matches: (result: ProbeAttemptResult) => boolean;
  hasFirstTokenText: (body: string, contentType: string) => boolean;
  extractTextOutput: (body: string, contentType: string) => string | null;
  extractReportedModel: (body: string, contentType: string) => ProbeReportedModelMetadata;
};

const OPENAI_RESPONSES = "openai-responses" as const;
const OPENAI_CHAT = "openai-chat-completions" as const;
const ANTHROPIC_MESSAGES = "anthropic-messages" as const;
const GOOGLE_GEMINI_GENERATE_CONTENT = "google-gemini-generate-content" as const;
const PRIMARY_PROBE_PROMPT = "Reply with exactly one word: pong";
const CREDIBILITY_PROBE_PROMPT = 'Return compact JSON only: {"provider":null,"model_name":null,"model_version":null}. Use null if unsure. Do not guess. Do not add fields.';
const ALL_PROBE_MODES = [
  OPENAI_RESPONSES,
  OPENAI_CHAT,
  ANTHROPIC_MESSAGES,
  GOOGLE_GEMINI_GENERATE_CONTENT,
] as const satisfies ProbeResolvedCompatibilityMode[];

export const probeCompatibilityModeLabels: Record<ProbeResolvedCompatibilityMode, string> = {
  [OPENAI_RESPONSES]: "OpenAI Responses",
  [OPENAI_CHAT]: "OpenAI Chat Completions",
  [ANTHROPIC_MESSAGES]: "Anthropic Messages",
  [GOOGLE_GEMINI_GENERATE_CONTENT]: "Google Gemini Generate Content",
};

const probeModePathSuffixes: Record<ProbeResolvedCompatibilityMode, string> = {
  [OPENAI_RESPONSES]: "/responses",
  [OPENAI_CHAT]: "/chat/completions",
  [ANTHROPIC_MESSAGES]: "/messages",
  [GOOGLE_GEMINI_GENERATE_CONTENT]: ":generatecontent",
};

function normalizePath(pathname: string) {
  if (!pathname || pathname === "/") {
    return "";
  }

  return pathname.replace(/\/+$/, "");
}

function joinPath(basePath: string, suffix: string) {
  const normalizedBase = basePath === "/" ? "" : basePath.replace(/\/$/, "");
  const normalizedSuffix = suffix.startsWith("/") ? suffix : `/${suffix}`;
  return normalizedBase ? `${normalizedBase}${normalizedSuffix}` : normalizedSuffix;
}

function getRootPathVariants(pathname: string) {
  const variants = new Set<string>();
  const basePath = normalizePath(pathname);

  if (basePath.endsWith("/v1")) {
    variants.add(basePath);
    variants.add(basePath.slice(0, -3) || "");
  } else {
    variants.add(joinPath(basePath, "/v1"));
    variants.add(basePath);
  }

  return [...variants];
}

export function inferProbeModeFromPath(pathname: string): ProbeResolvedCompatibilityMode | null {
  const normalizedPath = normalizePath(pathname);
  const loweredPath = normalizedPath.toLowerCase();

  if (loweredPath.endsWith(":generatecontent") || loweredPath.endsWith(":streamgeneratecontent")) {
    return GOOGLE_GEMINI_GENERATE_CONTENT;
  }

  const entries = Object.entries(probeModePathSuffixes).sort((left, right) => right[1].length - left[1].length) as Array<
    [ProbeResolvedCompatibilityMode, string]
  >;

  for (const [mode, suffix] of entries) {
    if (loweredPath === suffix || loweredPath.endsWith(suffix)) {
      return mode;
    }
  }

  return null;
}

export function inferProbeFamilyFromPath(pathname: string): ProbeModelFamily | null {
  const normalizedPath = normalizePath(pathname).toLowerCase();
  const explicitMode = inferProbeModeFromPath(normalizedPath);

  if (explicitMode === GOOGLE_GEMINI_GENERATE_CONTENT) {
    return "gemini-native";
  }

  if (explicitMode === ANTHROPIC_MESSAGES) {
    return "anthropic";
  }

  if (explicitMode === OPENAI_RESPONSES) {
    return "openai";
  }

  if (explicitMode === OPENAI_CHAT) {
    return "chat-first";
  }

  if (
    normalizedPath.includes("/anthropic")
    || normalizedPath.includes("/claude")
  ) {
    return "anthropic";
  }

  if (normalizedPath.includes("/openai")) {
    return "openai";
  }

  return null;
}

function isGeminiNativeHost(hostname: string) {
  return hostname.toLowerCase() === "generativelanguage.googleapis.com";
}

export function inferProbeFamilyFromTarget(targetUrl: URL): ProbeModelFamily | null {
  const familyFromPath = inferProbeFamilyFromPath(targetUrl.pathname);
  if (familyFromPath) {
    return familyFromPath;
  }

  if (isGeminiNativeHost(targetUrl.hostname)) {
    return "gemini-native";
  }

  return null;
}

function buildPathVariants(targetUrl: URL) {
  const basePath = normalizePath(targetUrl.pathname);
  const explicitMode = inferProbeModeFromPath(basePath);
  const rootCandidates = new Set<string>();

  if (explicitMode) {
    const explicitSuffix = probeModePathSuffixes[explicitMode];
    rootCandidates.add(basePath.slice(0, -explicitSuffix.length) || "");
  } else {
    rootCandidates.add(basePath);
  }

  return [...rootCandidates].flatMap((rootPath) => getRootPathVariants(rootPath));
}

function withPath(targetUrl: URL, pathname: string) {
  const nextUrl = new URL(targetUrl.toString());
  nextUrl.pathname = pathname || "/";
  return nextUrl;
}

function asJsonRecord(body: string) {
  if (!body.trim()) {
    return null;
  }

  try {
    const parsed = JSON.parse(body) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return null;
  }

  return null;
}

function hasJsonContentType(contentType: string) {
  return contentType.toLowerCase().includes("application/json");
}

function hasEventStreamContentType(contentType: string) {
  return contentType.toLowerCase().includes("text/event-stream");
}

function hasNonEmptyJsonStringField(body: string, field: string) {
  const pattern = new RegExp(`"${field}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)+)"`);
  return pattern.test(body);
}

function extractJsonStringField(body: string, field: string) {
  const pattern = new RegExp(`"${field}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)+)"`);
  const match = body.match(pattern);
  if (!match?.[1]) {
    return null;
  }

  try {
    return JSON.parse(`"${match[1]}"`) as string;
  } catch {
    return match[1];
  }
}

function extractAllJsonStringFields(body: string, field: string) {
  const pattern = new RegExp(`"${field}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)+)"`, "g");
  return [...body.matchAll(pattern)].map((match) => match[1] ?? "").filter(Boolean);
}

function extractLastJsonStringField(body: string, field: string) {
  const matches = extractAllJsonStringFields(body, field);
  return matches[matches.length - 1] ?? null;
}

function normalizeMatchedUrl(attempt: ProbeAttempt) {
  return new URL(attempt.url.toString());
}

function buildOpenAiResponsesBody(model: string, prompt = PRIMARY_PROBE_PROMPT, options: {
  stream?: boolean;
  maxOutputTokens?: number;
} = {}) {
  return JSON.stringify({
    model,
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: prompt,
          },
        ],
      },
    ],
    stream: options.stream ?? true,
    max_output_tokens: options.maxOutputTokens ?? 64,
  });
}

function buildOpenAiChatBody(model: string, prompt = PRIMARY_PROBE_PROMPT, options: {
  stream?: boolean;
  maxTokens?: number;
} = {}) {
  return JSON.stringify({
    model,
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
    stream: options.stream ?? true,
    max_tokens: options.maxTokens ?? 64,
  });
}

function buildAnthropicMessagesBody(model: string, prompt = PRIMARY_PROBE_PROMPT, options: {
  stream?: boolean;
  maxTokens?: number;
} = {}) {
  return JSON.stringify({
    model,
    max_tokens: options.maxTokens ?? 64,
    stream: options.stream ?? true,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: prompt,
          },
        ],
      },
    ],
  });
}

function buildGoogleGeminiGenerateContentBody(prompt = PRIMARY_PROBE_PROMPT, options: {
  maxOutputTokens?: number;
} = {}) {
  return JSON.stringify({
    contents: [
      {
        role: "user",
        parts: [
          {
            text: prompt,
          },
        ],
      },
    ],
    generationConfig: {
      maxOutputTokens: options.maxOutputTokens ?? 64,
    },
  });
}

function matchOpenAiResponses(result: ProbeAttemptResult) {
  if (!result.response.ok) {
    return false;
  }

  const record = asJsonRecord(result.body);
  if (record?.object === "response") {
    return true;
  }

  if (hasEventStreamContentType(result.contentType)) {
    return result.body.includes("response.created") || result.body.includes('"object":"response"');
  }

  if (hasJsonContentType(result.contentType)) {
    return result.body.includes('"object":"response"');
  }

  return false;
}

function hasOpenAiResponsesFirstToken(body: string, contentType: string) {
  if (hasEventStreamContentType(contentType)) {
    return body.includes('"type":"response.output_text.delta"') && hasNonEmptyJsonStringField(body, "delta");
  }

  return body.includes('"object":"response"') && hasNonEmptyJsonStringField(body, "text");
}

function extractOpenAiResponsesText(body: string) {
  return extractLastJsonStringField(body, "text");
}

function extractOpenAiResponsesReportedModel(body: string): ProbeReportedModelMetadata {
  return {
    model: extractJsonStringField(body, "model"),
    version: null,
  };
}

function matchOpenAiChatCompletions(result: ProbeAttemptResult) {
  if (!result.response.ok) {
    return false;
  }

  const record = asJsonRecord(result.body);
  if (record?.object === "chat.completion" || Array.isArray(record?.choices)) {
    return true;
  }

  if (hasEventStreamContentType(result.contentType)) {
    return result.body.includes('"object":"chat.completion.chunk"') || result.body.includes('"choices"');
  }

  if (hasJsonContentType(result.contentType)) {
    return result.body.includes('"choices"');
  }

  return false;
}

function hasOpenAiChatCompletionsFirstToken(body: string, contentType: string) {
  if (hasEventStreamContentType(contentType)) {
    return body.includes('"object":"chat.completion.chunk"') && hasNonEmptyJsonStringField(body, "content");
  }

  return body.includes('"choices"') && hasNonEmptyJsonStringField(body, "content");
}

function extractOpenAiChatCompletionsText(body: string) {
  return extractLastJsonStringField(body, "content");
}

function extractOpenAiChatCompletionsReportedModel(body: string): ProbeReportedModelMetadata {
  return {
    model: extractJsonStringField(body, "model"),
    version: null,
  };
}

function matchAnthropicMessages(result: ProbeAttemptResult) {
  if (!result.response.ok) {
    return false;
  }

  const record = asJsonRecord(result.body);
  if (record?.type === "message") {
    return true;
  }

  if (hasEventStreamContentType(result.contentType)) {
    return result.body.includes("event: message_start") || result.body.includes('"type":"message_start"');
  }

  if (hasJsonContentType(result.contentType)) {
    return result.body.includes('"type":"message"');
  }

  return false;
}

function hasAnthropicMessagesFirstToken(body: string, contentType: string) {
  if (hasEventStreamContentType(contentType)) {
    return body.includes('"type":"content_block_delta"') && hasNonEmptyJsonStringField(body, "text");
  }

  return body.includes('"type":"message"') && hasNonEmptyJsonStringField(body, "text");
}

function extractAnthropicMessagesText(body: string) {
  return extractLastJsonStringField(body, "text");
}

function extractAnthropicMessagesReportedModel(body: string): ProbeReportedModelMetadata {
  return {
    model: extractJsonStringField(body, "model"),
    version: null,
  };
}

function matchGoogleGeminiGenerateContent(result: ProbeAttemptResult) {
  if (!result.response.ok) {
    return false;
  }

  const record = asJsonRecord(result.body);
  if (Array.isArray(record?.candidates)) {
    return true;
  }

  if (hasEventStreamContentType(result.contentType)) {
    return result.body.includes('"candidates"') || result.body.includes('"promptFeedback"');
  }

  if (hasJsonContentType(result.contentType)) {
    return result.body.includes('"candidates"') || result.body.includes('"promptFeedback"');
  }

  return false;
}

function hasGoogleGeminiGenerateContentFirstToken(body: string) {
  return body.includes('"candidates"') && hasNonEmptyJsonStringField(body, "text");
}

function extractGoogleGeminiGenerateContentText(body: string) {
  return extractLastJsonStringField(body, "text");
}

function extractGoogleGeminiReportedModel(body: string): ProbeReportedModelMetadata {
  const modelVersion = extractJsonStringField(body, "modelVersion");
  return {
    model: extractJsonStringField(body, "model") ?? modelVersion,
    version: modelVersion,
  };
}

function dedupeAttempts(attempts: ProbeAttempt[]) {
  return attempts.filter((attempt, index, all) =>
    all.findIndex((candidate) => candidate.url.toString() === attempt.url.toString()) === index,
  );
}

function buildModeAttempts(
  mode: ProbeResolvedCompatibilityMode,
  targetUrl: URL,
  suffix: string,
  body: string,
  headers?: Record<string, string>,
) {
  const attempts = buildPathVariants(targetUrl).map((basePath) => {
    const attempt: ProbeAttempt = {
      mode,
      method: "POST",
      url: withPath(targetUrl, joinPath(basePath, suffix)),
      body,
    };

    if (headers) {
      attempt.headers = headers;
    }

    return attempt;
  });

  return dedupeAttempts(attempts);
}

function normalizeGeminiModel(model: string) {
  return model.replace(/^models\//i, "");
}

function getGeminiRootVariants(pathname: string) {
  let basePath = normalizePath(pathname);

  basePath = basePath.replace(/\/models\/[^/]+:(?:streamGenerateContent|generateContent)$/i, "");
  basePath = basePath.replace(/\/models$/i, "");

  if (!basePath) {
    return ["/v1beta"];
  }

  if (/\/v1beta$/i.test(basePath) || /\/v1$/i.test(basePath)) {
    return [basePath];
  }

  return [joinPath(basePath, "/v1beta"), basePath];
}

function buildGoogleGeminiAttempts(targetUrl: URL, request: PublicProbeRequest) {
  const model = encodeURIComponent(normalizeGeminiModel(request.model));
  const body = buildGoogleGeminiGenerateContentBody();
  const attempts = getGeminiRootVariants(targetUrl.pathname).flatMap((basePath) => {
    const streamUrl = withPath(targetUrl, joinPath(basePath, `/models/${model}:streamGenerateContent`));
    streamUrl.searchParams.set("alt", "sse");

    const generateUrl = withPath(targetUrl, joinPath(basePath, `/models/${model}:generateContent`));

    return [
      {
        mode: GOOGLE_GEMINI_GENERATE_CONTENT,
        method: "POST" as const,
        url: streamUrl,
        body,
        headers: {
          "x-goog-api-key": request.apiKey,
        },
        useBearerAuth: false,
      },
      {
        mode: GOOGLE_GEMINI_GENERATE_CONTENT,
        method: "POST" as const,
        url: generateUrl,
        body,
        headers: {
          "x-goog-api-key": request.apiKey,
        },
        useBearerAuth: false,
      },
    ];
  });

  return dedupeAttempts(attempts);
}

export const probeAdapterRegistry: Record<ProbeResolvedCompatibilityMode, ProbeAdapter> = {
  [OPENAI_RESPONSES]: {
    key: OPENAI_RESPONSES,
    label: probeCompatibilityModeLabels[OPENAI_RESPONSES],
    buildAttempts: (targetUrl, request) =>
      buildModeAttempts(OPENAI_RESPONSES, targetUrl, "/responses", buildOpenAiResponsesBody(request.model)),
    buildCredibilityAttempt: (attempt, request) => ({
      ...attempt,
      url: normalizeMatchedUrl(attempt),
      body: buildOpenAiResponsesBody(request.model, CREDIBILITY_PROBE_PROMPT, {
        stream: false,
        maxOutputTokens: 192,
      }),
    }),
    matches: matchOpenAiResponses,
    hasFirstTokenText: hasOpenAiResponsesFirstToken,
    extractTextOutput: extractOpenAiResponsesText,
    extractReportedModel: (body) => extractOpenAiResponsesReportedModel(body),
  },
  [OPENAI_CHAT]: {
    key: OPENAI_CHAT,
    label: probeCompatibilityModeLabels[OPENAI_CHAT],
    buildAttempts: (targetUrl, request) =>
      buildModeAttempts(OPENAI_CHAT, targetUrl, "/chat/completions", buildOpenAiChatBody(request.model)),
    buildCredibilityAttempt: (attempt, request) => ({
      ...attempt,
      url: normalizeMatchedUrl(attempt),
      body: buildOpenAiChatBody(request.model, CREDIBILITY_PROBE_PROMPT, {
        stream: false,
        maxTokens: 192,
      }),
    }),
    matches: matchOpenAiChatCompletions,
    hasFirstTokenText: hasOpenAiChatCompletionsFirstToken,
    extractTextOutput: extractOpenAiChatCompletionsText,
    extractReportedModel: (body) => extractOpenAiChatCompletionsReportedModel(body),
  },
  [ANTHROPIC_MESSAGES]: {
    key: ANTHROPIC_MESSAGES,
    label: probeCompatibilityModeLabels[ANTHROPIC_MESSAGES],
    buildAttempts: (targetUrl, request) =>
      buildModeAttempts(
        ANTHROPIC_MESSAGES,
        targetUrl,
        "/messages",
        buildAnthropicMessagesBody(request.model),
        {
          "anthropic-version": "2023-06-01",
          "x-api-key": request.apiKey,
        },
    ),
    buildCredibilityAttempt: (attempt, request) => ({
      ...attempt,
      url: normalizeMatchedUrl(attempt),
      body: buildAnthropicMessagesBody(request.model, CREDIBILITY_PROBE_PROMPT, {
        stream: false,
        maxTokens: 192,
      }),
    }),
    matches: matchAnthropicMessages,
    hasFirstTokenText: hasAnthropicMessagesFirstToken,
    extractTextOutput: extractAnthropicMessagesText,
    extractReportedModel: (body) => extractAnthropicMessagesReportedModel(body),
  },
  [GOOGLE_GEMINI_GENERATE_CONTENT]: {
    key: GOOGLE_GEMINI_GENERATE_CONTENT,
    label: probeCompatibilityModeLabels[GOOGLE_GEMINI_GENERATE_CONTENT],
    buildAttempts: buildGoogleGeminiAttempts,
    buildCredibilityAttempt: (attempt) => {
      const url = normalizeMatchedUrl(attempt);
      url.pathname = url.pathname.replace(/:streamGenerateContent$/i, ":generateContent");
      url.searchParams.delete("alt");

      return {
        ...attempt,
        url,
        body: buildGoogleGeminiGenerateContentBody(CREDIBILITY_PROBE_PROMPT, {
          maxOutputTokens: 192,
        }),
      };
    },
    matches: matchGoogleGeminiGenerateContent,
    hasFirstTokenText: hasGoogleGeminiGenerateContentFirstToken,
    extractTextOutput: extractGoogleGeminiGenerateContentText,
    extractReportedModel: (body) => extractGoogleGeminiReportedModel(body),
  },
};

export function inferProbeModelFamily(model: string): ProbeModelFamily {
  const normalized = model.trim().toLowerCase();

  if (!normalized) {
    return "generic";
  }

  if (
    normalized.includes("claude")
    || normalized.startsWith("anthropic")
    || normalized.startsWith("haiku")
    || normalized.startsWith("sonnet")
    || normalized.startsWith("opus")
  ) {
    return "anthropic";
  }

  if (
    normalized.includes("deepseek")
    || normalized.includes("qwen")
    || normalized.includes("llama")
    || normalized.includes("mistral")
    || normalized.includes("mixtral")
    || normalized.includes("gemini")
    || normalized.includes("grok")
    || normalized.includes("moonshot")
    || normalized.includes("kimi")
    || normalized.includes("glm")
    || normalized.includes("doubao")
    || normalized.includes("yi-")
    || normalized.startsWith("yi")
  ) {
    return "chat-first";
  }

  if (
    normalized.startsWith("gpt")
    || normalized.startsWith("o1")
    || normalized.startsWith("o3")
    || normalized.startsWith("o4")
    || normalized.includes("codex")
    || normalized.includes("openai")
  ) {
    return "openai";
  }

  return "generic";
}

function modesForFamily(family: ProbeModelFamily): ProbeResolvedCompatibilityMode[] {
  switch (family) {
    case "anthropic":
      return [ANTHROPIC_MESSAGES, OPENAI_CHAT, OPENAI_RESPONSES];
    case "chat-first":
      return [OPENAI_CHAT, OPENAI_RESPONSES, ANTHROPIC_MESSAGES];
    case "gemini-native":
      return [GOOGLE_GEMINI_GENERATE_CONTENT];
    case "openai":
      return [OPENAI_RESPONSES, OPENAI_CHAT, ANTHROPIC_MESSAGES];
    default:
      return [OPENAI_RESPONSES, OPENAI_CHAT, ANTHROPIC_MESSAGES];
  }
}

export function getAutoProbeModes(model: string, targetUrl?: URL): ProbeResolvedCompatibilityMode[] {
  const explicitMode = targetUrl ? inferProbeModeFromPath(targetUrl.pathname) : null;
  const familyHint = targetUrl ? inferProbeFamilyFromTarget(targetUrl) : null;
  const family = familyHint ?? inferProbeModelFamily(model);
  const orderedModes = modesForFamily(family);

  if (!explicitMode) {
    return orderedModes;
  }

  return [explicitMode, ...orderedModes.filter((mode) => mode !== explicitMode)];
}

export function getDeepScanProbeModes(model: string, targetUrl?: URL): ProbeResolvedCompatibilityMode[] {
  const orderedModes = getAutoProbeModes(model, targetUrl);
  return [...orderedModes, ...ALL_PROBE_MODES.filter((mode) => !orderedModes.includes(mode))];
}

export function resolveProbeModes(mode: ProbeCompatibilityMode, model: string, targetUrl?: URL): ProbeResolvedCompatibilityMode[] {
  if (mode !== "auto") {
    return [mode];
  }

  return getAutoProbeModes(model, targetUrl);
}

export function buildProbeAttempts(targetUrl: URL, request: PublicProbeRequest): ProbeAttempt[] {
  return resolveProbeModes(request.compatibilityMode, request.model, targetUrl).flatMap((mode) =>
    probeAdapterRegistry[mode].buildAttempts(targetUrl, request),
  );
}
