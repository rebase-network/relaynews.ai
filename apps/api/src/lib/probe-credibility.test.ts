import assert from "node:assert/strict";
import test from "node:test";

import {
  computeProbeCredibilityLevel,
  parseSelfReportedIdentity,
} from "./probe-credibility";

test("parseSelfReportedIdentity parses compact JSON responses", () => {
  const result = parseSelfReportedIdentity('{"provider":"Google","model_name":"gemini-2.5-flash","model_version":"gemini-2.5-flash"}');

  assert.equal(result?.provider, "Google");
  assert.equal(result?.modelName, "gemini-2.5-flash");
  assert.equal(result?.modelVersion, "gemini-2.5-flash");
});

test("parseSelfReportedIdentity parses fenced JSON responses", () => {
  const result = parseSelfReportedIdentity('```json\n{"provider":"OpenAI","model_name":"gpt-5.4","model_version":null}\n```');

  assert.equal(result?.provider, "OpenAI");
  assert.equal(result?.modelName, "gpt-5.4");
  assert.equal(result?.modelVersion, null);
});

test("computeProbeCredibilityLevel returns high when request, response, and self-report align", () => {
  assert.equal(
    computeProbeCredibilityLevel({
      requestedModel: "gemini-2.5-flash",
      responseReportedModel: "gemini-2.5-flash",
      selfReportedModel: "gemini-2.5-flash",
    }),
    "high",
  );
});

test("computeProbeCredibilityLevel returns medium when request and response align but self-report disagrees", () => {
  assert.equal(
    computeProbeCredibilityLevel({
      requestedModel: "gemini-2.5-flash",
      responseReportedModel: "gemini-2.5-flash",
      selfReportedModel: "gpt-5.4",
    }),
    "medium",
  );
});
