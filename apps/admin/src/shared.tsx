import { clsx } from "clsx";
import {
  type AdminModel,
  type AdminModelsResponse,
  type AdminModelUpsert,
  type AdminProbeCredential,
  type AdminProbeCredentialCreate,
  type AdminProbeCredentialDetail,
  type AdminProbeCredentialMutationResponse,
  type AdminProbeCredentialsResponse,
  type AdminOverviewResponse,
  type AdminPriceCreate,
  type AdminPricesResponse,
  type AdminRefreshPublicResponse,
  type AdminRelayUpsert,
  type AdminRelaysResponse,
  type AdminSubmissionsResponse,
  type AdminSponsorsResponse,
  type ProbeCompatibilityMode,
  type ProbeCredentialOwnerType,
} from "@relaynews/shared";
import { type Dispatch, type ReactNode, type SetStateAction, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Link, Navigate, NavLink, Route, Routes, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";

export { clsx, createPortal, Link, Navigate, NavLink, Route, Routes, useEffect, useLocation, useMemo, useNavigate, useParams, useSearchParams, useState };
export type {
  AdminModel,
  AdminModelsResponse,
  AdminModelUpsert,
  AdminProbeCredential,
  AdminProbeCredentialCreate,
  AdminProbeCredentialDetail,
  AdminProbeCredentialMutationResponse,
  AdminProbeCredentialsResponse,
  AdminOverviewResponse,
  AdminPriceCreate,
  AdminPricesResponse,
  AdminRefreshPublicResponse,
  AdminRelayUpsert,
  AdminRelaysResponse,
  AdminSubmissionsResponse,
  AdminSponsorsResponse,
  ProbeCompatibilityMode,
  ProbeCredentialOwnerType,
} from "@relaynews/shared";

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ?? "http://127.0.0.1:8787";
export const PUBLIC_SITE_URL =
  import.meta.env.VITE_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "http://127.0.0.1:4173";
export const ADMIN_AUTH_STORAGE_KEY = "relaynews.admin.basic-auth";
export const ADMIN_AUTH_REQUIRED_EVENT = "relaynews.admin.auth-required";
export const PROBE_COMPATIBILITY_OPTIONS: Array<{ value: ProbeCompatibilityMode; label: string }> = [
  { value: "auto", label: "自动识别" },
  { value: "openai-responses", label: "OpenAI Responses" },
  { value: "openai-chat-completions", label: "OpenAI Chat Completions" },
  { value: "anthropic-messages", label: "Anthropic Messages" },
];

export type MutationState = {
  pending: boolean;
  error: string | null;
  success: string | null;
};

export type StatusTone = "neutral" | "accent" | "success" | "warning" | "danger";

export type RelayFormErrors = Partial<Record<"name" | "baseUrl" | "websiteUrl" | "contactInfo" | "description" | "testApiKey" | "modelPrices", string>>;
export type RelayPriceRowFormState = {
  id: string;
  modelKey: string;
  inputPricePer1M: string;
  outputPricePer1M: string;
};
export type RelayFormState = {
  name: string;
  baseUrl: string;
  websiteUrl: string;
  contactInfo: string;
  description: string;
  catalogStatus: "active" | "paused" | "archived";
  testApiKey: string;
  compatibilityMode: ProbeCompatibilityMode;
  modelPrices: RelayPriceRowFormState[];
};
export type SponsorFormState = {
  relayId: string;
  name: string;
  placement: string;
  status: "draft" | "active" | "paused" | "ended";
  startAt: string;
  endAt: string;
};
export type SponsorFormErrors = Partial<Record<"name" | "placement" | "startAt" | "endAt", string>>;
export type PriceFormState = {
  relayId: string;
  modelId: string;
  currency: string;
  inputPricePer1M: string;
  outputPricePer1M: string;
  effectiveFrom: string;
  source: AdminPriceCreate["source"];
};
export type PriceFormErrors = Partial<Record<"relayId" | "modelId" | "inputPricePer1M" | "outputPricePer1M" | "effectiveFrom", string>>;
export type ModelFormErrors = Partial<Record<"key" | "vendor" | "name" | "family", string>>;
export type ProbeCredentialFormState = {
  ownerType: ProbeCredentialOwnerType;
  ownerId: string;
  apiKey: string;
  testModel: string;
  compatibilityMode: ProbeCompatibilityMode;
};
export type ProbeCredentialFormErrors = Partial<Record<keyof ProbeCredentialFormState, string>>;

export type ApiErrorPayload = {
  message?: string | string[];
};

export type AdminAccessState =
  | { status: "checking" }
  | { status: "login" }
  | { status: "ready"; showLogout: boolean }
  | { status: "error"; message: string };

export class ApiRequestError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = "ApiRequestError";
    this.statusCode = statusCode;
  }
}

export function readStoredAdminAuthorization() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.sessionStorage.getItem(ADMIN_AUTH_STORAGE_KEY);
}

export function writeStoredAdminAuthorization(value: string | null) {
  if (typeof window === "undefined") {
    return;
  }

  if (value) {
    window.sessionStorage.setItem(ADMIN_AUTH_STORAGE_KEY, value);
    return;
  }

  window.sessionStorage.removeItem(ADMIN_AUTH_STORAGE_KEY);
}

export function buildBasicAuthorization(username: string, password: string) {
  return `Basic ${window.btoa(`${username}:${password}`)}`;
}

export function dispatchAdminAuthRequired() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event(ADMIN_AUTH_REQUIRED_EVENT));
}

export function formatApiErrorPayload(payload: ApiErrorPayload | null) {
  if (!payload?.message) {
    return null;
  }

  return Array.isArray(payload.message) ? payload.message.join("; ") : payload.message;
}

export async function fetchJson<T>(
  path: string,
  init?: RequestInit,
  options: {
    authHeader?: string | null;
    skipStoredAuth?: boolean;
    suppressUnauthorizedEvent?: boolean;
  } = {},
): Promise<T> {
  const headers = new Headers(init?.headers);
  const authorization = options.skipStoredAuth
    ? options.authHeader
    : options.authHeader ?? readStoredAdminAuthorization();

  if (typeof init?.body !== "undefined" && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  if (authorization && !headers.has("authorization")) {
    headers.set("authorization", authorization);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
  });

  if (!response.ok) {
    if (response.status === 401 && !options.suppressUnauthorizedEvent) {
      dispatchAdminAuthRequired();
    }

    const contentType = response.headers.get("content-type") ?? "";

    if (contentType.includes("application/json")) {
      const payload = (await response.json()) as ApiErrorPayload;
      throw new ApiRequestError(
        formatApiErrorPayload(payload) ?? `Request failed with ${response.status}`,
        response.status,
      );
    }

    const text = await response.text();
    throw new ApiRequestError(text || `Request failed with ${response.status}`, response.status);
  }

  return (await response.json()) as T;
}

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
  };

  return labels[mode];
}

export function formatOverviewMetricLabel(label: string) {
  const labels: Record<string, string> = {
    relays: "中转站总数",
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

export function createRelayPriceRowFormState(index = 0): RelayPriceRowFormState {
  return {
    id: `relay-price-${Date.now()}-${index}`,
    modelKey: "",
    inputPricePer1M: "",
    outputPricePer1M: "",
  };
}

export function buildRelayFormState(relay?: AdminRelaysResponse["rows"][number]): RelayFormState {
  return {
    name: relay?.name ?? "",
    baseUrl: relay?.baseUrl ?? "",
    websiteUrl: relay?.websiteUrl ?? "",
    contactInfo: relay?.contactInfo ?? "",
    description: relay?.description ?? "",
    catalogStatus:
      relay?.catalogStatus === "active" || relay?.catalogStatus === "paused" || relay?.catalogStatus === "archived"
        ? relay.catalogStatus
        : "paused",
    testApiKey: "",
    compatibilityMode: relay?.probeCredential?.compatibilityMode ?? "auto",
    modelPrices:
      relay?.modelPrices.map((row, index) => ({
        id: `${relay.id}-${row.modelKey}-${index}`,
        modelKey: row.modelKey,
        inputPricePer1M: row.inputPricePer1M === null ? "" : String(row.inputPricePer1M),
        outputPricePer1M: row.outputPricePer1M === null ? "" : String(row.outputPricePer1M),
      })) ?? [createRelayPriceRowFormState()],
  };
}

export function validateRelayForm(form: RelayFormState, options?: { editing: boolean }) {
  const payload: AdminRelayUpsert = {
    name: trimString(form.name),
    baseUrl: trimString(form.baseUrl),
    websiteUrl: emptyToNull(form.websiteUrl),
    contactInfo: emptyToNull(form.contactInfo),
    catalogStatus: form.catalogStatus,
    description: emptyToNull(form.description),
    testApiKey: emptyToNull(form.testApiKey),
    compatibilityMode: form.compatibilityMode,
    modelPrices: form.modelPrices.map((row) => ({
      modelKey: trimString(row.modelKey),
      inputPricePer1M: parseOptionalNumber(row.inputPricePer1M),
      outputPricePer1M: parseOptionalNumber(row.outputPricePer1M),
    })),
  };
  const errors: RelayFormErrors = {};

  if (!payload.name) {
    errors.name = "请输入站点名字。";
  }

  if (!payload.baseUrl) {
    errors.baseUrl = "请输入 Base URL。";
  } else if (!isValidHttpUrl(payload.baseUrl)) {
    errors.baseUrl = "请输入完整的 Base URL，例如 https://relay.example.ai/v1。";
  }

  if (payload.websiteUrl && !isValidHttpUrl(payload.websiteUrl)) {
    errors.websiteUrl = "请输入有效的网站地址，例如 https://relay.example.ai。";
  }

  if (!payload.contactInfo) {
    errors.contactInfo = "请填写联系方式。";
  }

  if (!payload.description) {
    errors.description = "请填写站点简介。";
  }

  if (!options?.editing && !payload.testApiKey) {
    errors.testApiKey = "手动新增 Relay 时需要提供测试API Key。";
  }

  if (payload.modelPrices.length === 0) {
    errors.modelPrices = "请至少添加一条模型价格信息。";
  } else {
    for (const row of payload.modelPrices) {
      if (!row.modelKey) {
        errors.modelPrices = "每条模型价格信息都需要填写模型。";
        break;
      }

      if (
        row.inputPricePer1M !== null
        && (Number.isNaN(row.inputPricePer1M) || row.inputPricePer1M < 0)
      ) {
        errors.modelPrices = "Input 价格必须是大于或等于 0 的数字。";
        break;
      }

      if (
        row.outputPricePer1M !== null
        && (Number.isNaN(row.outputPricePer1M) || row.outputPricePer1M < 0)
      ) {
        errors.modelPrices = "Output 价格必须是大于或等于 0 的数字。";
        break;
      }

      if (row.inputPricePer1M === null && row.outputPricePer1M === null) {
        errors.modelPrices = "每条模型价格信息至少填写一个价格字段。";
        break;
      }
    }
  }

  return { errors, payload };
}

export function validateSponsorForm(form: SponsorFormState) {
  const payload = {
    relayId: form.relayId || null,
    name: trimString(form.name),
    placement: trimString(form.placement),
    status: form.status,
    startAt: trimString(form.startAt),
    endAt: trimString(form.endAt),
  };
  const errors: SponsorFormErrors = {};

  if (!payload.name) {
    errors.name = "请输入赞助名称。";
  }

  if (!payload.placement) {
    errors.placement = "请输入投放位标识。";
  }

  if (!payload.startAt) {
    errors.startAt = "请输入开始时间。";
  } else if (!isValidTimestamp(payload.startAt)) {
    errors.startAt = "请输入有效的 ISO 时间。";
  }

  if (!payload.endAt) {
    errors.endAt = "请输入结束时间。";
  } else if (!isValidTimestamp(payload.endAt)) {
    errors.endAt = "请输入有效的 ISO 时间。";
  }

  if (!errors.startAt && !errors.endAt && new Date(payload.endAt) <= new Date(payload.startAt)) {
    errors.endAt = "结束时间必须晚于开始时间。";
  }

  return { errors, payload };
}

export function validatePriceForm(form: PriceFormState) {
  const parsedInputPricePer1M = parseOptionalNumber(form.inputPricePer1M);
  const parsedOutputPricePer1M = parseOptionalNumber(form.outputPricePer1M);
  const payload: AdminPriceCreate = {
    relayId: form.relayId,
    modelId: form.modelId,
    currency: trimString(form.currency) || "USD",
    inputPricePer1M: parsedInputPricePer1M,
    outputPricePer1M: parsedOutputPricePer1M,
    effectiveFrom: trimString(form.effectiveFrom),
    source: form.source,
  };
  const errors: PriceFormErrors = {};

  if (!payload.relayId) {
    errors.relayId = "请选择中转站。";
  }

  if (!payload.modelId) {
    errors.modelId = "请选择模型。";
  }

  if (parsedInputPricePer1M !== null && (Number.isNaN(parsedInputPricePer1M) || parsedInputPricePer1M < 0)) {
    errors.inputPricePer1M = "输入价必须是大于或等于 0 的数字。";
  }

  if (parsedOutputPricePer1M !== null && (Number.isNaN(parsedOutputPricePer1M) || parsedOutputPricePer1M < 0)) {
    errors.outputPricePer1M = "输出价必须是大于或等于 0 的数字。";
  }

  if (parsedInputPricePer1M === null && parsedOutputPricePer1M === null) {
    errors.inputPricePer1M = "至少填写一个价格字段。";
    errors.outputPricePer1M = "至少填写一个价格字段。";
  }

  if (!payload.effectiveFrom) {
    errors.effectiveFrom = "请输入生效时间。";
  } else if (!isValidTimestamp(payload.effectiveFrom)) {
    errors.effectiveFrom = "请输入有效的 ISO 时间。";
  }

  return { errors, payload };
}

function slugifyModelKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

export function inferModelVendor(modelKey: string) {
  const normalized = slugifyModelKey(modelKey);
  const [vendor] = normalized.split("-");
  return vendor || "relay";
}

export function inferModelFamily(modelKey: string) {
  const normalized = slugifyModelKey(modelKey);
  const parts = normalized.split("-");

  if (parts.length <= 1) {
    return normalized || "custom";
  }

  return parts.slice(1).join("-") || normalized;
}

export function inferModelDisplayName(modelKey: string) {
  return modelKey.trim() || "";
}

export function validateModelForm(form: AdminModelUpsert) {
  const key = trimString(form.key);
  const payload: AdminModelUpsert = {
    key,
    vendor: inferModelVendor(key),
    name: inferModelDisplayName(key),
    family: inferModelFamily(key),
    inputPriceUnit: emptyToNull(form.inputPriceUnit),
    outputPriceUnit: emptyToNull(form.outputPriceUnit),
    isActive: form.isActive,
  };
  const errors: ModelFormErrors = {};

  if (!payload.key) {
    errors.key = "请输入模型键值。";
  }

  return { errors, payload };
}

export function validateProbeCredentialForm(form: ProbeCredentialFormState) {
  const payload: AdminProbeCredentialCreate = {
    ownerType: form.ownerType,
    ownerId: trimString(form.ownerId),
    apiKey: trimString(form.apiKey),
    testModel: trimString(form.testModel),
    compatibilityMode: form.compatibilityMode,
  };
  const errors: ProbeCredentialFormErrors = {};

  if (!payload.ownerId) {
    errors.ownerId = payload.ownerType === "relay" ? "请选择中转站。" : "请选择归属对象。";
  }

  if (!payload.apiKey) {
    errors.apiKey = "请输入 API Key。";
  }

  if (!payload.testModel) {
    errors.testModel = "请输入测试模型。";
  }

  return { errors, payload };
}

export function createDefaultSponsorFormState(): SponsorFormState {
  return {
    relayId: "",
    name: "",
    placement: "homepage-spotlight",
    status: "active",
    startAt: new Date().toISOString(),
    endAt: new Date(Date.now() + 30 * 86400000).toISOString(),
  };
}

export function createDefaultPriceFormState(): PriceFormState {
  return {
    relayId: "",
    modelId: "",
    currency: "USD",
    inputPricePer1M: "0.1",
    outputPricePer1M: "0.5",
    effectiveFrom: new Date().toISOString(),
    source: "manual",
  };
}

export function createDefaultModelFormState(): AdminModelUpsert {
  return {
    key: "",
    vendor: "",
    name: "",
    family: "",
    inputPriceUnit: "USD / 1M tokens",
    outputPriceUnit: "USD / 1M tokens",
    isActive: true,
  };
}

export function useLoadable<T>(loader: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    loader()
      .then((value) => {
        if (active) {
          setData(value);
        }
      })
      .catch((reason: unknown) => {
        if (active) {
          setError(reason instanceof Error ? reason.message : "发生未知错误");
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, deps);

  return { data, loading, error, reload: () => loader().then(setData) };
}

export function useMutationState(): [MutationState, Dispatch<SetStateAction<MutationState>>] {
  const [state, setState] = useState<MutationState>({ pending: false, error: null, success: null });
  return [state, setState];
}

export function AdminShell({
  children,
  showLogout,
  onLogout,
}: {
  children: ReactNode;
  showLogout: boolean;
  onLogout: () => void;
}) {
  const location = useLocation();
  const items = [
    ["/relays", "Relay"],
    ["/relays/history", "Relay历史"],
    ["/intake", "提交记录"],
    ["/intake/history", "提交历史"],
    ["/sponsors", "赞助位"],
    ["/models", "模型"],
  ] as const;

  function isItemActive(path: string) {
    return location.pathname === path;
  }

  return (
    <div className="admin-shell min-h-screen bg-[var(--bg)] text-white">
      <header className="admin-header">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-10">
          <div className="admin-header-bar">
            <div className="space-y-1.5">
              <div className="admin-brand">
                <div className="admin-brand-mark">
                  <span className="bg-[#ffd900]" />
                  <span className="bg-[#ffa110]" />
                  <span className="bg-[#fb6424]" />
                  <span className="bg-[#fa520f]" />
                </div>
                relaynew.ai 管理台
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg leading-tight tracking-[-0.05em] md:text-[1.45rem]">运营后台</h1>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              <div className="admin-nav">
                {items.map(([to, label]) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={false}
                    className={clsx("pill", isItemActive(to) ? "pill-active" : "pill-idle")}
                  >
                    {label}
                  </NavLink>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2.5">
                <a className="pill pill-ghost" href={PUBLIC_SITE_URL} target="_blank" rel="noreferrer">
                  前台站点
                </a>
                {showLogout ? (
                  <button className="pill pill-idle" type="button" onClick={onLogout}>
                    退出登录
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </header>
      <main className="admin-main mx-auto max-w-7xl px-5 lg:px-10">{children}</main>
    </div>
  );
}

export function Card({ title, children }: { title: string; kicker?: string; children: ReactNode }) {
  return (
    <section className="card">
      <h2 className="text-[1.85rem] tracking-[-0.04em] md:text-[1.9rem]">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export function Notice({ state }: { state: MutationState }) {
  if (state.error) {
    return <p className="text-sm text-[#ffb59c]">{state.error}</p>;
  }
  if (state.success) {
    return <p className="text-sm text-[#ffd06a]">{state.success}</p>;
  }
  return null;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  confirmPendingLabel,
  pending,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  confirmPendingLabel: string;
  pending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) {
    return null;
  }

  if (typeof document === "undefined") {
    return null;
  }

  return createPortal((
    <div
      aria-hidden={pending ? "true" : undefined}
      className="confirm-backdrop"
      onClick={pending ? undefined : onCancel}
      role="presentation"
    >
      <section
        aria-modal="true"
        className="confirm-dialog"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <p className="eyebrow">请确认操作</p>
        <h3 className="text-2xl tracking-[-0.04em]">{title}</h3>
        <p className="mt-3 text-sm leading-6 text-white/64">{message}</p>
        <div className="mt-5 flex flex-wrap justify-end gap-2.5">
          <button className="pill pill-idle" disabled={pending} onClick={onCancel} type="button">
            取消
          </button>
          <button className="pill pill-active" disabled={pending} onClick={onConfirm} type="button">
            {pending ? confirmPendingLabel : confirmLabel}
          </button>
        </div>
      </section>
    </div>
  ), document.body);
}

export function LoadingCard() {
  return <div className="card text-sm uppercase tracking-[0.16em] text-white/55">加载中...</div>;
}

export function ErrorCard({ message }: { message: string }) {
  return <div className="card border border-[#fa520f]/30 text-sm text-[#ffd0bd]">{message}</div>;
}

export function FieldError({ message }: { message: string | undefined }) {
  if (!message) {
    return null;
  }

  return <span className="mt-2 block text-xs normal-case tracking-normal text-[#ffb59c]">{message}</span>;
}

export function AdminLogin({ onAuthenticated }: { onAuthenticated: (authorization: string | null) => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    try {
      const authorization = buildBasicAuthorization(username.trim(), password);
      await fetchJson("/admin/overview", undefined, {
        authHeader: authorization,
        skipStoredAuth: true,
        suppressUnauthorizedEvent: true,
      });
      writeStoredAdminAuthorization(authorization);
      onAuthenticated(authorization);
    } catch (reason) {
      if (reason instanceof ApiRequestError && reason.statusCode === 401) {
        setError("管理员账号或密码不正确。");
      } else {
        setError(reason instanceof Error ? reason.message : "登录失败，请稍后重试。");
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="admin-shell min-h-screen bg-[var(--bg)] text-white">
      <main className="admin-main mx-auto flex min-h-screen max-w-7xl items-center justify-center px-5 lg:px-10">
        <section className="card w-full max-w-md">
          <p className="eyebrow">管理员认证</p>
          <h1 className="text-3xl tracking-[-0.04em] md:text-[2rem]">登录后继续</h1>
          <p className="mt-3 text-sm leading-6 text-white/62">
            管理后台需要先完成身份验证，才能访问提交记录、Relay 列表、模型和赞助位管理。
          </p>
          <form className="mt-5 grid gap-3" onSubmit={handleSubmit}>
            <label className="field-label">
              用户名
              <input
                autoComplete="username"
                className="field-input"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="admin"
                required
                type="text"
              />
            </label>
            <label className="field-label">
              密码
              <input
                autoComplete="current-password"
                className="field-input"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                required
                type="password"
              />
            </label>
            {error ? <p className="text-sm text-[#ffb59c]">{error}</p> : null}
            <button className="pill pill-active justify-center" disabled={pending} type="submit">
              {pending ? "验证中..." : "登录"}
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}


export async function verifyAdminAccess(authorization: string | null) {
  await fetchJson("/admin/overview", undefined, {
    authHeader: authorization,
    skipStoredAuth: true,
    suppressUnauthorizedEvent: true,
  });
}
