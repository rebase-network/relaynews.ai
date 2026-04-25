import type { ProbeCredibilityLevel } from "@relaynews/shared";

export type ProbeSelfReportedIdentity = {
  provider: string | null;
  modelName: string | null;
  modelVersion: string | null;
  confidence: number | null;
  notes: string | null;
};

function normalizeModelHandle(value: string | null | undefined) {
  return value?.toLowerCase().replace(/[^a-z0-9]+/g, "") ?? "";
}

function asNumberOrNull(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asStringOrNull(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function parseSelfReportedIdentity(text: string | null): ProbeSelfReportedIdentity | null {
  if (!text?.trim()) {
    return null;
  }

  const trimmed = text.trim();
  const jsonStart = trimmed.indexOf("{");
  const jsonEnd = trimmed.lastIndexOf("}");
  const candidate = jsonStart >= 0 && jsonEnd > jsonStart
    ? trimmed.slice(jsonStart, jsonEnd + 1)
    : trimmed;

  try {
    const parsed = JSON.parse(candidate) as Record<string, unknown>;
    return {
      provider: asStringOrNull(parsed.provider),
      modelName: asStringOrNull(parsed.model_name),
      modelVersion: asStringOrNull(parsed.model_version),
      confidence: asNumberOrNull(parsed.confidence),
      notes: asStringOrNull(parsed.notes),
    };
  } catch {
    return null;
  }
}

function modelsLikelyMatch(left: string | null, right: string | null) {
  const normalizedLeft = normalizeModelHandle(left);
  const normalizedRight = normalizeModelHandle(right);

  if (!normalizedLeft || !normalizedRight) {
    return false;
  }

  return normalizedLeft === normalizedRight
    || normalizedLeft.includes(normalizedRight)
    || normalizedRight.includes(normalizedLeft);
}

export function computeProbeCredibilityLevel(input: {
  requestedModel: string;
  responseReportedModel: string | null;
  selfReportedModel: string | null;
}): ProbeCredibilityLevel {
  const requestedMatchesResponse = modelsLikelyMatch(input.requestedModel, input.responseReportedModel);
  const requestedMatchesSelf = modelsLikelyMatch(input.requestedModel, input.selfReportedModel);
  const responseMatchesSelf = modelsLikelyMatch(input.responseReportedModel, input.selfReportedModel);

  if (
    input.responseReportedModel
    && input.selfReportedModel
    && requestedMatchesResponse
    && requestedMatchesSelf
  ) {
    return "high";
  }

  if (
    input.responseReportedModel
    && input.selfReportedModel
    && responseMatchesSelf
  ) {
    return requestedMatchesResponse || requestedMatchesSelf ? "high" : "medium";
  }

  if (requestedMatchesResponse || requestedMatchesSelf) {
    return "medium";
  }

  if (input.responseReportedModel || input.selfReportedModel) {
    return "low";
  }

  return "unknown";
}
