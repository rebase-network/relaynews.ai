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
    ttfbMs: 120,
    firstTokenMs: 180,
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
    "上游返回 HTTP 200，但响应内容不符合 OpenAI Responses",
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

test("failure message explains protocol conversion failures behind 5xx responses", () => {
  const result = makeResult(500, {
    mode: "openai-responses",
    body: '{"error":{"message":"not implemented","type":"easy_router_error","code":"convert_request_failed"}}',
  });

  assert.equal(
    buildProbeFailureMessage(result),
    "站点接受了 OpenAI Responses 请求，但当前模型可能不支持这种协议形态",
  );
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
      scanMode: "standard",
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

  globalThis.fetch = async (input, init) => {
    const requestUrl = new URL(typeof input === "string" ? input : input.toString());
    const requestBody = typeof init?.body === "string" ? init.body : "";
    seenUrls.push(requestUrl.toString());

    if (requestUrl.pathname.endsWith("/responses")) {
      return new Response('{"error":"not found"}', {
        status: 404,
        headers: { "content-type": "application/json" },
      });
    }

    if (requestUrl.pathname.endsWith("/chat/completions")) {
      if (requestBody.includes("model_name")) {
        return new Response('{"model":"gpt-5.4","object":"chat.completion","choices":[{"message":{"role":"assistant","content":"{\\"provider\\":\\"OpenAI\\",\\"model_name\\":\\"gpt-5.4\\",\\"model_version\\":null}"}}]}', {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }

      return new Response('{"model":"gpt-5.4","object":"chat.completion","choices":[{"message":{"role":"assistant","content":"pong"}}]}', {
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
      if (requestBody.includes("model_name")) {
        return new Response('{"modelVersion":"gemini-2.5-flash","candidates":[{"content":{"role":"model","parts":[{"text":"{\\"provider\\":\\"Google\\",\\"model_name\\":\\"gemini-2.5-flash\\",\\"model_version\\":\\"gemini-2.5-flash\\"}"}]}}]}', {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }

      return new Response('{"modelVersion":"gemini-2.5-flash","candidates":[{"content":{"role":"model","parts":[{"text":"pong"}]}}]}', {
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
      "google-gemini-generate-content",
    ]);
    assert.ok(result.matchedModes[0]?.credibility);
    assert.equal(result.matchedModes[0]?.credibility?.responseReportedModel, "gpt-5.4");
    assert.notEqual(result.matchedModes[0]?.credibility?.identityConfidence, "unknown");
    assert.ok(result.matchedModes[1]?.credibility);
    assert.equal(result.matchedModes[1]?.credibility?.responseReportedModel, "gemini-2.5-flash");
    assert.notEqual(result.matchedModes[1]?.credibility?.identityConfidence, "unknown");
    assert.equal(result.attemptTrace.filter((entry) => entry.matched).length, 2);
    assert.equal(
      result.attemptTrace.find((entry) => entry.mode === "openai-responses" && entry.httpStatus === 404)?.message,
      "测试 OpenAI Responses 时，上游返回了 HTTP 404",
    );
    assert.equal(
      result.attemptTrace.find((entry) => entry.mode === "anthropic-messages" && entry.httpStatus === 200)?.message,
      "测试 Anthropic Messages 时，协议已命中，但未观测到可见文本输出",
    );
    assert.equal(seenUrls.some((url) => url.endsWith("/messages")), true);
    assert.equal(seenUrls.some((url) => url.includes(":generateContent") || url.includes(":streamGenerateContent")), true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
