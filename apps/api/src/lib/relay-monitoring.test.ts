import assert from "node:assert/strict";
import test from "node:test";

import { resolveTrackedModel } from "./relay-monitoring";

const models = [
  {
    id: "model-gpt-54",
    key: "openai-gpt-5.4",
    family: "gpt-5",
  },
  {
    id: "model-sonnet-46",
    key: "anthropic-claude-sonnet-4.6",
    family: "claude-4.6",
  },
  {
    id: "model-gemini-31",
    key: "google-gemini-3.1",
    family: "gemini-3",
  },
];

test("resolveTrackedModel matches vendorless model keys", () => {
  const match = resolveTrackedModel(models, "gpt-5.4");
  assert.equal(match?.id, "model-gpt-54");
});

test("resolveTrackedModel matches vendorless model keys and short names", () => {
  assert.equal(resolveTrackedModel(models, "claude-sonnet-4.6")?.id, "model-sonnet-46");
  assert.equal(resolveTrackedModel(models, "gemini-3.1")?.id, "model-gemini-31");
});

test("resolveTrackedModel returns null for unknown models", () => {
  assert.equal(resolveTrackedModel(models, "qwen-max-latest"), null);
});
