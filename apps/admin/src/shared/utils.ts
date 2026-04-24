import { type AdminModel, type AdminProbeCredential, type AdminRelaysResponse, type ProbeCompatibilityMode, type ProbeCredentialOwnerType } from "@relaynews/shared";
import { type StatusTone } from "./types";

export function trimString(value: string | null | undefined) {
  return value?.trim() ?? "";
}

export function emptyToNull(value: string | null | undefined) {
  const trimmed = trimString(value);
  return trimmed ? trimmed : null;
}

export function normalizeSearchText(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

export function matchesSearchQuery(query: string, values: Array<string | null | undefined>) {
  const normalizedQuery = normalizeSearchText(query);

  if (!normalizedQuery) {
    return true;
  }

  return values.some((value) => normalizeSearchText(value).includes(normalizedQuery));
}

export function isValidHttpUrl(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function isValidTimestamp(value: string) {
  return !Number.isNaN(new Date(value).getTime());
}

export function parseOptionalNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

export function withoutFieldError<T extends string>(current: Partial<Record<T, string>>, key: T) {
  const next = { ...current };
  delete next[key];
  return next;
}

export function credentialStatusPriority(status: AdminProbeCredential["status"]) {
  if (status === "active") {
    return 3;
  }

  if (status === "rotated") {
    return 2;
  }

  return 1;
}

export function pickPreferredCredential(current: AdminProbeCredential | undefined, next: AdminProbeCredential) {
  if (!current) {
    return next;
  }

  if (credentialStatusPriority(next.status) > credentialStatusPriority(current.status)) {
    return next;
  }

  if ((next.lastVerifiedAt ?? "") > (current.lastVerifiedAt ?? "")) {
    return next;
  }

  return current;
}

export function buildCredentialRoute(params: {
  credentialId?: string | null;
  ownerType?: ProbeCredentialOwnerType;
  ownerId?: string | null;
}) {
  const search = new URLSearchParams();

  if (params.credentialId) {
    search.set("credential", params.credentialId);
  }

  if (params.ownerType) {
    search.set("ownerType", params.ownerType);
  }

  if (params.ownerId) {
    search.set("ownerId", params.ownerId);
  }

  const suffix = search.toString();
  return suffix ? `/credentials?${suffix}` : "/credentials";
}

export const zhDateTimeFormatter = new Intl.DateTimeFormat("zh-CN", {
  dateStyle: "medium",
  timeStyle: "short",
  hour12: false,
  timeZone: "Asia/Shanghai",
});

export const zhDateFormatter = new Intl.DateTimeFormat("zh-CN", {
  dateStyle: "medium",
  timeZone: "Asia/Shanghai",
});

export const zhTimeFormatter = new Intl.DateTimeFormat("zh-CN", {
  timeStyle: "short",
  hour12: false,
  timeZone: "Asia/Shanghai",
});

export function formatDateTime(value: string) {
  return zhDateTimeFormatter.format(new Date(value));
}

export function formatDate(value: string) {
  return zhDateFormatter.format(new Date(value));
}

export function formatTime(value: string) {
  return zhTimeFormatter.format(new Date(value));
}

export function formatCatalogStatus(status: string) {
  const labels: Record<string, string> = {
    pending: "待处理",
    active: "启用中",
    paused: "已暂停",
    retired: "已退役",
    archived: "已归档",
  };

  return labels[status] ?? status;
}

export function statusToneForCatalogStatus(status: string): StatusTone {
  if (status === "active") {
    return "success";
  }

  if (status === "paused") {
    return "warning";
  }

  if (status === "pending") {
    return "accent";
  }

  if (status === "archived" || status === "retired") {
    return "neutral";
  }

  return "neutral";
}

export function formatSubmissionStatus(status: string) {
  const labels: Record<string, string> = {
    pending: "待审核",
    approved: "已通过",
    rejected: "已拒绝",
    archived: "已归档",
  };

  return labels[status] ?? status;
}

export function statusToneForSubmissionStatus(status: string): StatusTone {
  if (status === "approved") {
    return "success";
  }

  if (status === "pending") {
    return "accent";
  }

  if (status === "rejected") {
    return "danger";
  }

  return "neutral";
}

export function formatCredentialStatus(status: string) {
  const labels: Record<string, string> = {
    active: "生效中",
    rotated: "已轮换",
    revoked: "已撤销",
  };

  return labels[status] ?? status;
}

export function formatSponsorStatus(status: string) {
  const labels: Record<string, string> = {
    draft: "草稿",
    active: "投放中",
    paused: "已暂停",
    ended: "已结束",
  };

  return labels[status] ?? status;
}

export function formatHealthStatus(status: string | null | undefined) {
  if (!status) {
    return "未知";
  }

  const labels: Record<string, string> = {
    healthy: "健康",
    degraded: "降级",
    down: "不可用",
    unknown: "未知",
  };

  return labels[status] ?? status;
}

export function formatCompatibilityMode(mode: ProbeCompatibilityMode) {
  const labels: Record<ProbeCompatibilityMode, string> = {
    auto: "自动检测",
    "openai-responses": "OpenAI Responses",
    "openai-chat-completions": "OpenAI Chat Completions",
    "anthropic-messages": "Anthropic Messages",
    "google-gemini-generate-content": "Google Gemini Generate Content",
  };

  return labels[mode];
}

export function formatOverviewMetricLabel(label: string) {
  const labels: Record<string, string> = {
    relays: "大模型API服务站总数",
    pendingSubmissions: "待审核提交",
    activeSponsors: "投放中赞助位",
    priceRecords: "价格记录",
  };

  return labels[label] ?? label;
}

export function getRelayOptionLabel(relay: AdminRelaysResponse["rows"][number]) {
  return relay.catalogStatus === "archived" ? `${relay.name} · 已归档` : relay.name;
}

export function getModelOptionLabel(model: AdminModel) {
  return model.isActive ? model.name : `${model.name} · 已停用`;
}

export function formatModelStatus(isActive: boolean) {
  return isActive ? "启用中" : "已停用";
}

export function statusToneForModelStatus(isActive: boolean): StatusTone {
  return isActive ? "success" : "neutral";
}

export function buildPriceModelOptions(models: AdminModel[], selectedModelId: string) {
  return models.filter((model) => model.isActive || model.id === selectedModelId);
}

export function buildRelaySelectOptions(
  relays: AdminRelaysResponse["rows"],
  selectedRelayId?: string | null,
) {
  return relays.filter(
    (relay) => relay.catalogStatus !== "archived" || (selectedRelayId ? relay.id === selectedRelayId : false),
  );
}
