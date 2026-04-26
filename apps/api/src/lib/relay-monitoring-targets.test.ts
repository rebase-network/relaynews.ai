import assert from "node:assert/strict";
import test from "node:test";

import {
  getRequestedModelForTarget,
  resolveMonitoringCompatibilityMode,
  selectRelayMonitoringTargets,
  shouldBackoffMonitoringTarget,
  type RelayMonitoringTarget,
} from "./relay-monitoring";

function createTarget(overrides: Partial<RelayMonitoringTarget> = {}): RelayMonitoringTarget {
  return {
    credentialId: "credential-1",
    relayId: "relay-1",
    relaySlug: "relay-1",
    relayName: "Relay 1",
    baseUrl: "https://relay.example.ai/v1",
    apiKey: "sk-live",
    credentialTestModel: "gpt-5.4",
    credentialCompatibilityMode: "auto",
    modelId: "model-1",
    modelKey: "gpt-5.4",
    remoteModelName: null,
    supportStatus: "active",
    monitoringPriority: 100,
    compatibilityModeOverride: null,
    lastCompatibilityMode: null,
    lastVerifiedAt: null,
    lastProbeOk: null,
    consecutiveFailureCount: 0,
    ...overrides,
  };
}

test("resolveMonitoringCompatibilityMode prefers model override then last mode then credential default", () => {
  assert.equal(
    resolveMonitoringCompatibilityMode(createTarget({
      compatibilityModeOverride: "anthropic-messages",
      lastCompatibilityMode: "openai-chat-completions",
      credentialCompatibilityMode: "openai-responses",
    })),
    "anthropic-messages",
  );
  assert.equal(
    resolveMonitoringCompatibilityMode(createTarget({
      lastCompatibilityMode: "openai-chat-completions",
      credentialCompatibilityMode: "openai-responses",
    })),
    "openai-chat-completions",
  );
  assert.equal(
    resolveMonitoringCompatibilityMode(createTarget({
      credentialCompatibilityMode: "openai-responses",
    })),
    "openai-responses",
  );
});

test("getRequestedModelForTarget prefers remote model name", () => {
  assert.equal(
    getRequestedModelForTarget(createTarget({
      remoteModelName: "gpt-5.4-2026-03-05",
    })),
    "gpt-5.4-2026-03-05",
  );
  assert.equal(
    getRequestedModelForTarget(createTarget()),
    "gpt-5.4",
  );
});

test("shouldBackoffMonitoringTarget backs off recent repeated failures", () => {
  const now = new Date("2026-04-26T10:00:00.000Z");

  assert.equal(
    shouldBackoffMonitoringTarget(createTarget({
      lastProbeOk: false,
      consecutiveFailureCount: 3,
      lastVerifiedAt: "2026-04-26T09:30:00.000Z",
    }), now),
    true,
  );

  assert.equal(
    shouldBackoffMonitoringTarget(createTarget({
      lastProbeOk: false,
      consecutiveFailureCount: 2,
      lastVerifiedAt: "2026-04-26T09:30:00.000Z",
    }), now),
    false,
  );

  assert.equal(
    shouldBackoffMonitoringTarget(createTarget({
      lastProbeOk: true,
      consecutiveFailureCount: 5,
      lastVerifiedAt: "2026-04-26T09:30:00.000Z",
    }), now),
    false,
  );
});

test("selectRelayMonitoringTargets enforces per-relay cap and priority order", () => {
  const now = new Date("2026-04-26T10:00:00.000Z");
  const result = selectRelayMonitoringTargets([
    createTarget({
      relayId: "relay-1",
      relaySlug: "relay-1",
      modelId: "model-1",
      modelKey: "gpt-5.4",
      monitoringPriority: 200,
      lastVerifiedAt: "2026-04-25T10:00:00.000Z",
    }),
    createTarget({
      relayId: "relay-1",
      relaySlug: "relay-1",
      modelId: "model-2",
      modelKey: "gpt-5.5",
      monitoringPriority: 50,
      lastVerifiedAt: "2026-04-26T08:00:00.000Z",
    }),
    createTarget({
      relayId: "relay-1",
      relaySlug: "relay-1",
      modelId: "model-3",
      modelKey: "claude-sonnet-4-6",
      supportStatus: "degraded",
      monitoringPriority: 100,
      lastVerifiedAt: "2026-04-24T10:00:00.000Z",
    }),
    createTarget({
      relayId: "relay-1",
      relaySlug: "relay-1",
      modelId: "model-4",
      modelKey: "gemini-3-1-pro-preview",
      monitoringPriority: 10,
      lastProbeOk: false,
      consecutiveFailureCount: 3,
      lastVerifiedAt: "2026-04-26T09:30:00.000Z",
    }),
  ], now);

  assert.deepEqual(result.selected.map((target) => target.modelKey), [
    "gpt-5.5",
    "claude-sonnet-4-6",
    "gpt-5.4",
  ]);
  assert.deepEqual(result.skippedBackoff.map((target) => target.modelKey), [
    "gemini-3-1-pro-preview",
  ]);
});
