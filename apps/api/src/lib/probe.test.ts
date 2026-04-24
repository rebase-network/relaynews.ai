import assert from "node:assert/strict";
import test from "node:test";

import type { ProbeResolvedCompatibilityMode } from "@relaynews/shared";

import type { ProbeAttemptResult } from "./probe-registry";
import {
  buildProbeFailureMessage,
  pickPreferredProbeFailure,
  runPublicProbe,
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

test("probe sequence keeps trying adapters after a 2xx payload mismatch with html output", () => {
  const result = makeResult(200, {
    body: "<!doctype html><html><body>relay landing page</body></html>",
    contentType: "text/html; charset=utf-8",
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

test("public probe stops at the first matched mode during standard auto detection", async () => {
  const originalFetch = globalThis.fetch;
  const seenUrls: string[] = [];

  globalThis.fetch = async (input) => {
    const requestUrl = new URL(typeof input === "string" ? input : input.toString());
    seenUrls.push(requestUrl.toString());

    if (requestUrl.pathname.endsWith("/responses")) {
      return new Response('{"error":"not found"}', {
        status: 404,
        headers: { "content-type": "application/json" },
      });
    }

    if (requestUrl.pathname.endsWith("/chat/completions")) {
      return new Response('{"object":"chat.completion","choices":[{"message":{"role":"assistant","content":"pong"}}]}', {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }

    return new Response('{"type":"message"}', {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    const result = await runPublicProbe({
      baseUrl: "https://example.com/openai",
      apiKey: "sk-live",
      model: "gpt-5.4",
      compatibilityMode: "auto",
    });

    assert.equal(result.ok, true);
    assert.equal(result.scanMode, "standard");
    assert.equal(result.compatibilityMode, "openai-chat-completions");
    assert.deepEqual(result.matchedModes.map((entry) => entry.mode), ["openai-chat-completions"]);
    assert.equal(seenUrls.some((url) => url.endsWith("/messages")), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("public probe deep scan returns every matched mode in auto detection order", async () => {
  const originalFetch = globalThis.fetch;
  const seenUrls: string[] = [];

  globalThis.fetch = async (input) => {
    const requestUrl = new URL(typeof input === "string" ? input : input.toString());
    seenUrls.push(requestUrl.toString());

    if (requestUrl.pathname.endsWith("/responses")) {
      return new Response('{"error":"not found"}', {
        status: 404,
        headers: { "content-type": "application/json" },
      });
    }

    if (requestUrl.pathname.endsWith("/chat/completions")) {
      return new Response('{"object":"chat.completion","choices":[{"message":{"role":"assistant","content":"pong"}}]}', {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }

    if (requestUrl.pathname.endsWith("/messages")) {
      return new Response('{"type":"message","role":"assistant","content":[]}', {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }

    if (requestUrl.pathname.includes(":generateContent") || requestUrl.pathname.includes(":streamGenerateContent")) {
      return new Response('{"candidates":[{"content":{"role":"model","parts":[{"text":"pong"}]}}]}', {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }

    return new Response('{"error":"unexpected"}', {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    const result = await runPublicProbe({
      baseUrl: "https://example.com/openai",
      apiKey: "sk-live",
      model: "gpt-5.4",
      compatibilityMode: "auto",
      scanMode: "deep",
    });

    assert.equal(result.ok, true);
    assert.equal(result.scanMode, "deep");
    assert.equal(result.compatibilityMode, "openai-chat-completions");
    assert.deepEqual(result.matchedModes.map((entry) => entry.mode), [
      "openai-chat-completions",
      "anthropic-messages",
      "google-gemini-generate-content",
    ]);
    assert.equal(result.attemptTrace.filter((entry) => entry.matched).length, 3);
    assert.equal(seenUrls.some((url) => url.endsWith("/messages")), true);
    assert.equal(seenUrls.some((url) => url.includes(":generateContent") || url.includes(":streamGenerateContent")), true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
