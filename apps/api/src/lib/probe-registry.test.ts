import assert from "node:assert/strict";
import test from "node:test";

import {
  buildProbeAttempts,
  getAutoProbeModes,
  inferProbeFamilyFromPath,
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
  });

  assert.ok(attempts.length > 0);
  assert.ok(attempts.every((attempt) => attempt.mode === "openai-chat-completions"));
});

test("exact endpoint base URLs are normalized back to protocol roots before building attempts", () => {
  const attempts = buildProbeAttempts(new URL("https://relay.example.ai/openai/v1/responses"), {
    baseUrl: "https://relay.example.ai/openai/v1/responses",
    apiKey: "sk-live",
    model: "gpt-5.1",
    compatibilityMode: "openai-responses",
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
  }));

  return {
    attempt,
    response: new Response(body, {
      status: 200,
      headers: { "content-type": contentType },
    }),
    latencyMs: 120,
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
});

test("chat completions adapter matches chat completion chunks", () => {
  const attempt = firstAttempt(probeAdapterRegistry["openai-chat-completions"].buildAttempts(new URL("https://relay.example.ai/openai"), {
    baseUrl: "https://relay.example.ai/openai",
    apiKey: "sk-live",
    model: "gpt-5.1",
    compatibilityMode: "openai-chat-completions",
  }));

  const result: ProbeAttemptResult = {
    attempt,
    response: new Response('data: {"object":"chat.completion.chunk","choices":[{"delta":{"content":"pong"}}]}', {
      status: 200,
      headers: { "content-type": "text/event-stream" },
    }),
    latencyMs: 140,
    body: 'data: {"object":"chat.completion.chunk","choices":[{"delta":{"content":"pong"}}]}',
    contentType: "text/event-stream",
  };

  assert.equal(probeAdapterRegistry["openai-chat-completions"].matches(result), true);
});

test("anthropic adapter matches message-start event stream", () => {
  const attempt = firstAttempt(probeAdapterRegistry["anthropic-messages"].buildAttempts(new URL("https://relay.example.ai/anthropic"), {
    baseUrl: "https://relay.example.ai/anthropic",
    apiKey: "sk-live",
    model: "claude-sonnet-4-5",
    compatibilityMode: "anthropic-messages",
  }));

  const result: ProbeAttemptResult = {
    attempt,
    response: new Response('event: message_start\ndata: {"type":"message_start"}', {
      status: 200,
      headers: { "content-type": "text/event-stream" },
    }),
    latencyMs: 160,
    body: 'event: message_start\ndata: {"type":"message_start"}',
    contentType: "text/event-stream",
  };

  assert.equal(probeAdapterRegistry["anthropic-messages"].matches(result), true);
});
