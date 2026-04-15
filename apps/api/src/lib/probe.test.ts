import assert from "node:assert/strict";
import test from "node:test";

import type { ProbeResolvedCompatibilityMode } from "@relaynews/shared";

import type { ProbeAttemptResult } from "./probe-registry";
import {
  buildProbeFailureMessage,
  pickPreferredProbeFailure,
  shouldContinueProbeSequence,
} from "./probe";

function makeResult(
  status: number,
  {
    mode = "openai-responses",
    path = "/openai/v1/responses",
    body = "",
    contentType = "application/json",
  }: {
    mode?: ProbeResolvedCompatibilityMode;
    path?: string;
    body?: string;
    contentType?: string;
  } = {},
): ProbeAttemptResult {
  return {
    attempt: {
      mode,
      method: "POST",
      url: new URL(`https://relay.example.ai${path}`),
      body: "{}",
    },
    response: new Response(body, {
      status,
      headers: { "content-type": contentType },
    }),
    latencyMs: 120,
    body,
    contentType,
  };
}

test("probe sequence keeps trying adapters after a 2xx payload mismatch with JSON", () => {
  const result = makeResult(200, {
    body: '{"choices":[{"message":{"role":"assistant","content":"pong"}}]}',
    contentType: "application/json",
  });

  assert.equal(shouldContinueProbeSequence(result), true);
  assert.equal(
    buildProbeFailureMessage(result),
    "Upstream returned 200, but the payload did not match OpenAI Responses",
  );
});

test("probe sequence keeps trying adapters after a 2xx payload mismatch with event-stream output", () => {
  const result = makeResult(200, {
    body: 'data: {"object":"chat.completion.chunk","choices":[{"delta":{"content":"pong"}}]}',
    contentType: "text/event-stream",
  });

  assert.equal(shouldContinueProbeSequence(result), true);
});

test("probe sequence stops after non-retriable auth failures", () => {
  const result = makeResult(401, {
    body: '{"error":"invalid_api_key"}',
    contentType: "application/json",
  });

  assert.equal(shouldContinueProbeSequence(result), false);
});

test("preferred failure selection favors more actionable statuses", () => {
  const pathMismatch = makeResult(404, {
    path: "/openai/v1/responses",
    body: '{"error":"not found"}',
  });
  const payloadMismatch = makeResult(200, {
    path: "/openai/v1/responses",
    body: '{"choices":[{"message":{"role":"assistant","content":"pong"}}]}',
  });
  const authFailure = makeResult(401, {
    path: "/openai/v1/chat/completions",
    mode: "openai-chat-completions",
    body: '{"error":"invalid_api_key"}',
  });

  assert.equal(pickPreferredProbeFailure(pathMismatch, payloadMismatch), payloadMismatch);
  assert.equal(pickPreferredProbeFailure(payloadMismatch, authFailure), authFailure);
});
