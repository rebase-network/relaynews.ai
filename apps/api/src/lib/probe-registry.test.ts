import assert from "node:assert/strict";
import test from "node:test";

import {
  getDeepScanProbeModes,
  buildProbeAttempts,
  getAutoProbeModes,
  inferProbeFamilyFromPath,
  inferProbeFamilyFromTarget,
  inferProbeModeFromPath,
  inferProbeModelFamily,
  probeAdapterRegistry,
  type ProbeAttempt,
  type ProbeAttemptResult,
} from "./probe-registry";

test("openai-family models prefer responses before chat completions", () => {
  assert.equal(inferProbeModelFamily("gpt-5.3-codex"), "openai");
  assert.deepEqual(getAutoProbeModes("gpt-5.3-codex"), [
    "openai-responses",
    "openai-chat-completions",
    "anthropic-messages",
  ]);
});

test("anthropic-family models prefer messages first", () => {
  assert.equal(inferProbeModelFamily("claude-sonnet-4-5"), "anthropic");
  assert.deepEqual(getAutoProbeModes("claude-sonnet-4-5"), [
    "anthropic-messages",
    "openai-chat-completions",
    "openai-responses",
  ]);
});

test("chat-oriented non-openai model names prefer chat completions first", () => {
  assert.equal(inferProbeModelFamily("qwen-plus"), "chat-first");
  assert.deepEqual(getAutoProbeModes("qwen-plus"), [
    "openai-chat-completions",
    "openai-responses",
    "anthropic-messages",
  ]);
});

test("google gemini native targets resolve to the native generate-content adapter", () => {
  assert.equal(
    inferProbeModeFromPath("/v1beta/models/gemini-2.5-flash:generateContent"),
    "google-gemini-generate-content",
  );
  assert.equal(
    inferProbeModeFromPath("/v1beta/models/gemini-2.5-flash:streamGenerateContent"),
    "google-gemini-generate-content",
  );
  assert.equal(
    inferProbeFamilyFromPath("/v1beta/models/gemini-2.5-flash:generateContent"),
    "gemini-native",
  );
  assert.equal(
    inferProbeFamilyFromTarget(new URL("https://generativelanguage.googleapis.com")),
    "gemini-native",
  );
  assert.deepEqual(
    getAutoProbeModes("gemini-2.5-flash", new URL("https://generativelanguage.googleapis.com")),
    ["google-gemini-generate-content"],
  );
  assert.deepEqual(
    getDeepScanProbeModes("gemini-2.5-flash", new URL("https://easyrouter.io/v1")),
    [
      "openai-chat-completions",
      "openai-responses",
      "anthropic-messages",
      "google-gemini-generate-content",
    ],
  );
});

test("path hints can override model-family ordering during auto detection", () => {
  assert.equal(inferProbeFamilyFromPath("/openai"), "openai");
  assert.equal(inferProbeFamilyFromPath("/v1/chat/completions"), "chat-first");
  assert.equal(inferProbeModeFromPath("/v1/chat/completions"), "openai-chat-completions");
  assert.deepEqual(getAutoProbeModes("claude-sonnet-4-5", new URL("https://relay.example.ai/openai")), [
    "openai-responses",
    "openai-chat-completions",
    "anthropic-messages",
  ]);
  assert.deepEqual(getAutoProbeModes("gpt-5.3-codex", new URL("https://relay.example.ai/v1/chat/completions")), [
    "openai-chat-completions",
    "openai-responses",
    "anthropic-messages",
  ]);
});

test("manual compatibility mode only builds attempts for the requested adapter", () => {
  const attempts = buildProbeAttempts(new URL("https://relay.example.ai/openai"), {
    baseUrl: "https://relay.example.ai/openai",
    apiKey: "sk-live",
    model: "gpt-5.1",
    compatibilityMode: "openai-chat-completions",
    scanMode: "standard",
  });

  assert.ok(attempts.length > 0);
  assert.ok(attempts.every((attempt) => attempt.mode === "openai-chat-completions"));
});

test("gemini adapter builds official native endpoints and uses x-goog-api-key", () => {
  const attempts = buildProbeAttempts(new URL("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"), {
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
    apiKey: "google-key",
    model: "models/gemini-2.5-flash",
    compatibilityMode: "google-gemini-generate-content",
    scanMode: "standard",
  });

  assert.deepEqual(
    attempts.map((attempt) => attempt.url.toString()),
    [
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse",
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
    ],
  );
  assert.ok(attempts.every((attempt) => attempt.useBearerAuth === false));
  assert.ok(attempts.every((attempt) => attempt.headers?.["x-goog-api-key"] === "google-key"));
  assert.ok(attempts.every((attempt) => JSON.parse(attempt.body).generationConfig.maxOutputTokens === 16));
});

test("exact endpoint base URLs are normalized back to protocol roots before building attempts", () => {
  const attempts = buildProbeAttempts(new URL("https://relay.example.ai/openai/v1/responses"), {
    baseUrl: "https://relay.example.ai/openai/v1/responses",
    apiKey: "sk-live",
    model: "gpt-5.1",
    compatibilityMode: "openai-responses",
    scanMode: "standard",
  });

  assert.deepEqual(
    attempts.map((attempt) => attempt.url.toString()),
    [
      "https://relay.example.ai/openai/v1/responses",
      "https://relay.example.ai/openai/responses",
    ],
  );
});

function firstAttempt(result: ProbeAttempt[]) {
  const attempt = result[0];
  assert.ok(attempt);
  return attempt;
}

function asResult(body: string, contentType: string): ProbeAttemptResult {
  const attempt = firstAttempt(probeAdapterRegistry["openai-responses"].buildAttempts(new URL("https://relay.example.ai/openai"), {
    baseUrl: "https://relay.example.ai/openai",
    apiKey: "sk-live",
    model: "gpt-5.1",
    compatibilityMode: "openai-responses",
    scanMode: "standard",
  }));

  return {
    attempt,
    response: new Response(body, {
      status: 200,
      headers: { "content-type": contentType },
    }),
    latencyMs: 120,
    ttfbMs: 120,
    firstTokenMs: 160,
    body,
    contentType,
  };
}

test("responses adapter matches OpenAI responses event stream", () => {
  const result = asResult(
    'event: response.created\ndata: {"type":"response.created","response":{"object":"response"}}',
    "text/event-stream",
  );

  assert.equal(probeAdapterRegistry["openai-responses"].matches(result), true);
  assert.equal(
    probeAdapterRegistry["openai-responses"].hasFirstTokenText(
      'event: response.output_text.delta\ndata: {"type":"response.output_text.delta","delta":"pong"}',
      "text/event-stream",
    ),
    true,
  );
});

test("responses adapter uses bounded max output tokens compatible with OpenAI-style responses", () => {
  const attempt = firstAttempt(probeAdapterRegistry["openai-responses"].buildAttempts(new URL("https://relay.example.ai/openai"), {
    baseUrl: "https://relay.example.ai/openai",
    apiKey: "sk-live",
    model: "gpt-5.1",
    compatibilityMode: "openai-responses",
    scanMode: "standard",
  }));

  assert.equal(JSON.parse(attempt.body).max_output_tokens, 16);
});

test("chat completions adapter uses enough output budget to emit visible text", () => {
  const attempt = firstAttempt(probeAdapterRegistry["openai-chat-completions"].buildAttempts(new URL("https://relay.example.ai/openai"), {
    baseUrl: "https://relay.example.ai/openai",
    apiKey: "sk-live",
    model: "gpt-5.1",
    compatibilityMode: "openai-chat-completions",
    scanMode: "standard",
  }));

  assert.equal(JSON.parse(attempt.body).max_tokens, 16);
});

test("anthropic adapter uses enough output budget to emit visible text", () => {
  const attempt = firstAttempt(probeAdapterRegistry["anthropic-messages"].buildAttempts(new URL("https://relay.example.ai/anthropic"), {
    baseUrl: "https://relay.example.ai/anthropic",
    apiKey: "sk-live",
    model: "claude-sonnet-4-5",
    compatibilityMode: "anthropic-messages",
    scanMode: "standard",
  }));

  assert.equal(JSON.parse(attempt.body).max_tokens, 16);
});

test("chat completions adapter matches chat completion chunks", () => {
  const attempt = firstAttempt(probeAdapterRegistry["openai-chat-completions"].buildAttempts(new URL("https://relay.example.ai/openai"), {
    baseUrl: "https://relay.example.ai/openai",
    apiKey: "sk-live",
    model: "gpt-5.1",
    compatibilityMode: "openai-chat-completions",
    scanMode: "standard",
  }));

  const result: ProbeAttemptResult = {
    attempt,
    response: new Response('data: {"object":"chat.completion.chunk","choices":[{"delta":{"content":"pong"}}]}', {
      status: 200,
      headers: { "content-type": "text/event-stream" },
    }),
    latencyMs: 140,
    ttfbMs: 140,
    firstTokenMs: 210,
    body: 'data: {"object":"chat.completion.chunk","choices":[{"delta":{"content":"pong"}}]}',
    contentType: "text/event-stream",
  };

  assert.equal(probeAdapterRegistry["openai-chat-completions"].matches(result), true);
  assert.equal(probeAdapterRegistry["openai-chat-completions"].hasFirstTokenText(result.body, result.contentType), true);
});

test("anthropic adapter matches message-start event stream", () => {
  const attempt = firstAttempt(probeAdapterRegistry["anthropic-messages"].buildAttempts(new URL("https://relay.example.ai/anthropic"), {
    baseUrl: "https://relay.example.ai/anthropic",
    apiKey: "sk-live",
    model: "claude-sonnet-4-5",
    compatibilityMode: "anthropic-messages",
    scanMode: "standard",
  }));

  const result: ProbeAttemptResult = {
    attempt,
    response: new Response('event: message_start\ndata: {"type":"message_start"}', {
      status: 200,
      headers: { "content-type": "text/event-stream" },
    }),
    latencyMs: 160,
    ttfbMs: 160,
    firstTokenMs: null,
    body: 'event: message_start\ndata: {"type":"message_start"}',
    contentType: "text/event-stream",
  };

  assert.equal(probeAdapterRegistry["anthropic-messages"].matches(result), true);
  assert.equal(
    probeAdapterRegistry["anthropic-messages"].hasFirstTokenText(
      'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"pong"}}',
      "text/event-stream",
    ),
    true,
  );
});

test("gemini adapter matches native generate-content json responses", () => {
  const attempt = firstAttempt(probeAdapterRegistry["google-gemini-generate-content"].buildAttempts(new URL("https://generativelanguage.googleapis.com"), {
    baseUrl: "https://generativelanguage.googleapis.com",
    apiKey: "google-key",
    model: "gemini-2.5-flash",
    compatibilityMode: "google-gemini-generate-content",
    scanMode: "standard",
  }));

  const result: ProbeAttemptResult = {
    attempt,
    response: new Response('{"candidates":[{"content":{"role":"model","parts":[{"text":"pong"}]},"finishReason":"STOP"}]}', {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
    latencyMs: 180,
    ttfbMs: 180,
    firstTokenMs: 240,
    body: '{"candidates":[{"content":{"role":"model","parts":[{"text":"pong"}]},"finishReason":"STOP"}]}',
    contentType: "application/json",
  };

  assert.equal(probeAdapterRegistry["google-gemini-generate-content"].matches(result), true);
  assert.equal(probeAdapterRegistry["google-gemini-generate-content"].hasFirstTokenText(result.body, result.contentType), true);
});
