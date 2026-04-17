import { clsx } from "clsx";
import {
  type AdminProbeCredential,
  type AdminProbeCredentialCreate,
  type AdminProbeCredentialDetail,
  type AdminProbeCredentialMutationResponse,
  type AdminProbeCredentialsResponse,
  type AdminOverviewResponse,
  type AdminPriceCreate,
  type AdminPricesResponse,
  type AdminRelayUpsert,
  type AdminRelaysResponse,
  type AdminSubmissionsResponse,
  type AdminSponsorsResponse,
  type ProbeCompatibilityMode,
  type ProbeCredentialOwnerType,
} from "@relaynews/shared";
import { type Dispatch, type ReactNode, type SetStateAction, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Link, Navigate, NavLink, Route, Routes, useSearchParams } from "react-router-dom";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ?? "http://127.0.0.1:8787";
const PUBLIC_SITE_URL =
  import.meta.env.VITE_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "http://127.0.0.1:4173";
const ADMIN_AUTH_STORAGE_KEY = "relaynews.admin.basic-auth";
const ADMIN_AUTH_REQUIRED_EVENT = "relaynews.admin.auth-required";

type AdminModelOption = {
  id: string;
  key: string;
  name: string;
  vendor: string;
};

type MutationState = {
  pending: boolean;
  error: string | null;
  success: string | null;
};

type RelayFormErrors = Partial<Record<"slug" | "name" | "baseUrl" | "providerName" | "websiteUrl" | "docsUrl", string>>;
type SponsorFormState = {
  relayId: string;
  name: string;
  placement: string;
  status: "draft" | "active" | "paused" | "ended";
  startAt: string;
  endAt: string;
};
type SponsorFormErrors = Partial<Record<"name" | "placement" | "startAt" | "endAt", string>>;
type PriceFormState = {
  relayId: string;
  modelId: string;
  currency: string;
  inputPricePer1M: string;
  outputPricePer1M: string;
  effectiveFrom: string;
  source: AdminPriceCreate["source"];
};
type PriceFormErrors = Partial<Record<"relayId" | "modelId" | "inputPricePer1M" | "outputPricePer1M" | "effectiveFrom", string>>;
type ProbeCredentialFormState = {
  ownerType: ProbeCredentialOwnerType;
  ownerId: string;
  apiKey: string;
  testModel: string;
  compatibilityMode: ProbeCompatibilityMode;
};
type ProbeCredentialFormErrors = Partial<Record<keyof ProbeCredentialFormState, string>>;

type ApiErrorPayload = {
  message?: string | string[];
};

type AdminAccessState =
  | { status: "checking" }
  | { status: "login" }
  | { status: "ready"; showLogout: boolean }
  | { status: "error"; message: string };

class ApiRequestError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = "ApiRequestError";
    this.statusCode = statusCode;
  }
}

function readStoredAdminAuthorization() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.sessionStorage.getItem(ADMIN_AUTH_STORAGE_KEY);
}

function writeStoredAdminAuthorization(value: string | null) {
  if (typeof window === "undefined") {
    return;
  }

  if (value) {
    window.sessionStorage.setItem(ADMIN_AUTH_STORAGE_KEY, value);
    return;
  }

  window.sessionStorage.removeItem(ADMIN_AUTH_STORAGE_KEY);
}

function buildBasicAuthorization(username: string, password: string) {
  return `Basic ${window.btoa(`${username}:${password}`)}`;
}

function dispatchAdminAuthRequired() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event(ADMIN_AUTH_REQUIRED_EVENT));
}

function formatApiErrorPayload(payload: ApiErrorPayload | null) {
  if (!payload?.message) {
    return null;
  }

  return Array.isArray(payload.message) ? payload.message.join("; ") : payload.message;
}

async function fetchJson<T>(
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

function trimString(value: string | null | undefined) {
  return value?.trim() ?? "";
}

function emptyToNull(value: string | null | undefined) {
  const trimmed = trimString(value);
  return trimmed ? trimmed : null;
}

function isValidHttpUrl(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function isValidTimestamp(value: string) {
  return !Number.isNaN(new Date(value).getTime());
}

function parseOptionalNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function withoutFieldError<T extends string>(current: Partial<Record<T, string>>, key: T) {
  const next = { ...current };
  delete next[key];
  return next;
}

function credentialStatusPriority(status: AdminProbeCredential["status"]) {
  if (status === "active") {
    return 3;
  }

  if (status === "rotated") {
    return 2;
  }

  return 1;
}

function pickPreferredCredential(current: AdminProbeCredential | undefined, next: AdminProbeCredential) {
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

function buildCredentialRoute(params: {
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

const zhDateTimeFormatter = new Intl.DateTimeFormat("zh-CN", {
  dateStyle: "medium",
  timeStyle: "short",
  hour12: false,
  timeZone: "Asia/Shanghai",
});

const zhDateFormatter = new Intl.DateTimeFormat("zh-CN", {
  dateStyle: "medium",
  timeZone: "Asia/Shanghai",
});

const zhTimeFormatter = new Intl.DateTimeFormat("zh-CN", {
  timeStyle: "short",
  hour12: false,
  timeZone: "Asia/Shanghai",
});

function formatDateTime(value: string) {
  return zhDateTimeFormatter.format(new Date(value));
}

function formatDate(value: string) {
  return zhDateFormatter.format(new Date(value));
}

function formatTime(value: string) {
  return zhTimeFormatter.format(new Date(value));
}

function formatCatalogStatus(status: string) {
  const labels: Record<string, string> = {
    pending: "待处理",
    active: "启用中",
    paused: "已暂停",
    retired: "已退役",
    archived: "已归档",
  };

  return labels[status] ?? status;
}

function formatSubmissionStatus(status: string) {
  const labels: Record<string, string> = {
    pending: "待审核",
    approved: "已通过",
    rejected: "已拒绝",
    archived: "已归档",
  };

  return labels[status] ?? status;
}

function formatCredentialStatus(status: string) {
  const labels: Record<string, string> = {
    active: "生效中",
    rotated: "已轮换",
    revoked: "已撤销",
  };

  return labels[status] ?? status;
}

function formatSponsorStatus(status: string) {
  const labels: Record<string, string> = {
    draft: "草稿",
    active: "投放中",
    paused: "已暂停",
    ended: "已结束",
  };

  return labels[status] ?? status;
}

function formatHealthStatus(status: string | null | undefined) {
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

function formatCompatibilityMode(mode: ProbeCompatibilityMode) {
  const labels: Record<ProbeCompatibilityMode, string> = {
    auto: "自动检测",
    "openai-responses": "OpenAI Responses",
    "openai-chat-completions": "OpenAI Chat Completions",
    "anthropic-messages": "Anthropic Messages",
  };

  return labels[mode];
}

function formatOverviewMetricLabel(label: string) {
  const labels: Record<string, string> = {
    relays: "中转站总数",
    pendingSubmissions: "待审核提交",
    activeSponsors: "投放中赞助位",
    priceRecords: "价格记录",
  };

  return labels[label] ?? label;
}

function getRelayOptionLabel(relay: AdminRelaysResponse["rows"][number]) {
  return relay.catalogStatus === "archived" ? `${relay.name} · 已归档` : relay.name;
}

function buildRelaySelectOptions(
  relays: AdminRelaysResponse["rows"],
  selectedRelayId?: string | null,
) {
  return relays.filter(
    (relay) => relay.catalogStatus !== "archived" || (selectedRelayId ? relay.id === selectedRelayId : false),
  );
}

function validateRelayForm(form: AdminRelayUpsert) {
  const payload: AdminRelayUpsert = {
    slug: trimString(form.slug),
    name: trimString(form.name),
    baseUrl: trimString(form.baseUrl),
    providerName: emptyToNull(form.providerName),
    websiteUrl: emptyToNull(form.websiteUrl),
    catalogStatus: form.catalogStatus,
    isFeatured: form.isFeatured,
    isSponsored: form.isSponsored,
    description: emptyToNull(form.description),
    docsUrl: emptyToNull(form.docsUrl),
    notes: emptyToNull(form.notes),
  };
  const errors: RelayFormErrors = {};

  if (!payload.slug) {
    errors.slug = "请输入 Slug。";
  }

  if (!payload.name) {
    errors.name = "请输入名称。";
  }

  if (!payload.baseUrl) {
    errors.baseUrl = "请输入基础 URL。";
  } else if (!isValidHttpUrl(payload.baseUrl)) {
    errors.baseUrl = "请输入完整的基础 URL，例如 https://relay.example.ai/v1。";
  }

  if (payload.websiteUrl && !isValidHttpUrl(payload.websiteUrl)) {
    errors.websiteUrl = "请输入有效的网站 URL，例如 https://relay.example.ai。";
  }

  if (payload.docsUrl && !isValidHttpUrl(payload.docsUrl)) {
    errors.docsUrl = "请输入有效的文档 URL，例如 https://relay.example.ai/docs。";
  }

  return { errors, payload };
}

function validateSponsorForm(form: SponsorFormState) {
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

function validatePriceForm(form: PriceFormState) {
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

function validateProbeCredentialForm(form: ProbeCredentialFormState) {
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

function useLoadable<T>(loader: () => Promise<T>, deps: unknown[]) {
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

function useMutationState(): [MutationState, Dispatch<SetStateAction<MutationState>>] {
  const [state, setState] = useState<MutationState>({ pending: false, error: null, success: null });
  return [state, setState];
}

function AdminShell({
  children,
  showLogout,
  onLogout,
}: {
  children: ReactNode;
  showLogout: boolean;
  onLogout: () => void;
}) {
  const items = [
    ["/", "概览"],
    ["/relays", "中转站"],
    ["/intake", "审核队列"],
    ["/credentials", "密钥"],
    ["/sponsors", "赞助位"],
    ["/prices", "价格"],
  ] as const;

  return (
    <div className="admin-shell min-h-screen bg-[var(--bg)] text-white">
      <header className="admin-header">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-10">
          <div className="admin-header-bar">
            <div className="space-y-3">
              <div className="admin-brand">
                <div className="admin-brand-mark">
                  <span className="bg-[#ffd900]" />
                  <span className="bg-[#ffa110]" />
                  <span className="bg-[#fb6424]" />
                  <span className="bg-[#fa520f]" />
                </div>
                relaynew.ai 管理台
              </div>
              <div>
                <h1 className="text-3xl tracking-[-0.05em] md:text-4xl">统一管理中转站目录、赞助位与价格记录。</h1>
                <p className="mt-2.5 max-w-2xl text-sm leading-6 text-white/60">
                  在一个中文化控制台里处理提交审核、目录维护、赞助投放和价格更新。
                </p>
              </div>
            </div>
            <div className="space-y-3">
              <div className="admin-nav">
                {items.map(([to, label]) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={to === "/"}
                    className={({ isActive }) => clsx("pill", isActive ? "pill-active" : "pill-idle")}
                  >
                    {label}
                  </NavLink>
                ))}
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2.5">
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

function Card({ title, kicker, children }: { title: string; kicker?: string; children: ReactNode }) {
  return (
    <section className="card">
      {kicker ? <p className="eyebrow">{kicker}</p> : null}
      <h2 className="text-3xl tracking-[-0.04em] md:text-[2rem]">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Notice({ state }: { state: MutationState }) {
  if (state.error) {
    return <p className="text-sm text-[#ffb59c]">{state.error}</p>;
  }
  if (state.success) {
    return <p className="text-sm text-[#ffd06a]">{state.success}</p>;
  }
  return null;
}

function ConfirmDialog({
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

function LoadingCard() {
  return <div className="card text-sm uppercase tracking-[0.16em] text-white/55">加载中...</div>;
}

function ErrorCard({ message }: { message: string }) {
  return <div className="card border border-[#fa520f]/30 text-sm text-[#ffd0bd]">{message}</div>;
}

function FieldError({ message }: { message: string | undefined }) {
  if (!message) {
    return null;
  }

  return <span className="mt-2 block text-xs normal-case tracking-normal text-[#ffb59c]">{message}</span>;
}

function AdminLogin({ onAuthenticated }: { onAuthenticated: (authorization: string | null) => void }) {
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
            管理后台需要先完成身份验证，才能访问审核队列、中转站、赞助位和价格管理。
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

function OverviewPage() {
  const { data, loading, error } = useLoadable<AdminOverviewResponse>(() => fetchJson("/admin/overview"), []);
  if (loading) return <LoadingCard />;
  if (error || !data) return <ErrorCard message={error ?? "无法加载管理概览。"} />;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Object.entries(data.totals).map(([label, value]) => (
          <Card key={label} title={String(value)} kicker={formatOverviewMetricLabel(label)}>
            <p className="text-sm text-white/60">统计时间：{formatTime(data.measuredAt)}</p>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <Card title="核心流程" kicker="运营日常路径">
          <div className="grid gap-3 md:grid-cols-3">
            {[
              {
                step: "1",
                title: "先看审核队列",
                text: "先处理审核队列。待审核记录已经带有初始 Probe 快照和提交密钥预览。",
                action: { href: "/intake", label: "打开审核队列" },
              },
              {
                step: "2",
                title: "批准并启用",
                text: "批准后会关联或创建中转站、迁移启用中的密钥，并启动首次 Relay 自有监测。",
                action: { href: "/intake", label: "处理待审核项" },
              },
              {
                step: "3",
                title: "后续运营维护",
                text: "目录信息在中转站页面维护；密钥页只处理轮换、删除或修复等后续操作。",
                action: { href: "/relays", label: "打开中转站页面" },
              },
            ].map((item) => (
              <div key={item.step} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-white/38">步骤 {item.step}</p>
                <p className="mt-2 text-lg tracking-[-0.03em]">{item.title}</p>
                <p className="mt-2 text-sm leading-6 text-white/62">{item.text}</p>
                <Link className="pill pill-idle mt-4 inline-flex" to={item.action.href}>
                  {item.action.label}
                </Link>
              </div>
            ))}
          </div>
        </Card>

        <Card title="快捷入口" kicker="常用页面">
          <div className="grid gap-3">
            <Link className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 transition hover:bg-white/8" to="/intake">
              <p className="text-sm uppercase tracking-[0.16em] text-white/42">审核队列</p>
              <p className="mt-1 text-lg tracking-[-0.03em]">优先处理待审核提交</p>
            </Link>
            <Link className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 transition hover:bg-white/8" to="/relays">
              <p className="text-sm uppercase tracking-[0.16em] text-white/42">目录管理</p>
              <p className="mt-1 text-lg tracking-[-0.03em]">查看 Relay 状态与元数据</p>
            </Link>
            <Link className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 transition hover:bg-white/8" to="/credentials">
              <p className="text-sm uppercase tracking-[0.16em] text-white/42">Relay 密钥</p>
              <p className="mt-1 text-lg tracking-[-0.03em]">轮换或恢复监测密钥</p>
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}

function RelaysPage() {
  const emptyForm: AdminRelayUpsert = {
    slug: "",
    name: "",
    baseUrl: "",
    providerName: null,
    websiteUrl: null,
    catalogStatus: "active",
    isFeatured: false,
    isSponsored: false,
    description: null,
    docsUrl: null,
    notes: null,
  };
  const [editingId, setEditingId] = useState<string | null>(null);
  const [relayDeleteTarget, setRelayDeleteTarget] = useState<AdminRelaysResponse["rows"][number] | null>(null);
  const [form, setForm] = useState<AdminRelayUpsert>(emptyForm);
  const [fieldErrors, setFieldErrors] = useState<RelayFormErrors>({});
  const [mutation, setMutation] = useMutationState();
  const relays = useLoadable<AdminRelaysResponse>(() => fetchJson("/admin/relays"), []);
  const credentials = useLoadable<AdminProbeCredentialsResponse>(() => fetchJson("/admin/probe-credentials"), []);

  function beginEditingRelay(relay: AdminRelaysResponse["rows"][number]) {
    setEditingId(relay.id);
    setForm({
      slug: relay.slug,
      name: relay.name,
      baseUrl: relay.baseUrl,
      providerName: relay.providerName,
      websiteUrl: relay.websiteUrl,
      catalogStatus: relay.catalogStatus,
      isFeatured: relay.isFeatured,
      isSponsored: relay.isSponsored,
      description: null,
      docsUrl: null,
      notes: null,
    });
    setFieldErrors({});
    setMutation({ pending: false, error: null, success: null });
    setRelayDeleteTarget(null);
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
    setFieldErrors({});
    setRelayDeleteTarget(null);
  }

  async function softDeleteRelay(relay: AdminRelaysResponse["rows"][number]) {
    setMutation({ pending: true, error: null, success: null });
    try {
      await fetchJson<{ ok: true }>(`/admin/relays/${relay.id}`, {
        method: "DELETE",
      });
      if (editingId === relay.id) {
        resetForm();
      }
      setRelayDeleteTarget(null);
      setMutation({
        pending: false,
        error: null,
        success: "中转站已归档。它会从运营视图中隐藏，但仍保留在 Postgres 中。",
      });
      await relays.reload();
    } catch (reason) {
      setRelayDeleteTarget(null);
      setMutation({
        pending: false,
        error: reason instanceof Error ? reason.message : "无法归档中转站。",
        success: null,
      });
    }
  }

  async function submit() {
    const { errors, payload } = validateRelayForm(form);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setMutation({ pending: false, error: "请先修正高亮字段，再保存中转站。", success: null });
      return;
    }

    setMutation({ pending: true, error: null, success: null });
    try {
      const path = editingId ? `/admin/relays/${editingId}` : "/admin/relays";
      await fetchJson(path, {
        method: editingId ? "PATCH" : "POST",
        body: JSON.stringify(payload),
      });
      setMutation({ pending: false, error: null, success: editingId ? "中转站已更新。" : "中转站已创建。" });
      resetForm();
      await relays.reload();
    } catch (reason) {
      setMutation({ pending: false, error: reason instanceof Error ? reason.message : "无法保存中转站。", success: null });
    }
  }

  const relayCredentialLookup = useMemo(() => {
    const lookup = new Map<string, AdminProbeCredential>();

    for (const row of credentials.data?.rows ?? []) {
      if (row.ownerType !== "relay") {
        continue;
      }

      lookup.set(row.ownerId, pickPreferredCredential(lookup.get(row.ownerId), row));
    }

    return lookup;
  }, [credentials.data]);

  if (relays.loading || credentials.loading) return <LoadingCard />;
  if (relays.error || credentials.error || !relays.data || !credentials.data) {
    return <ErrorCard message={relays.error ?? credentials.error ?? "无法加载中转站列表。"} />;
  }

  const visibleRelays = relays.data.rows.filter((relay) => relay.catalogStatus !== "archived");

  return (
    <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
      <Card title="中转站目录" kicker="当前记录">
        <div className="mb-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/62">
          这里是审核通过后的最快检查点。你可以确认目录状态、查看是否已绑定监测密钥，直接进入密钥轮换，
          也可以在不删除数据库记录的前提下归档一个中转站。
        </div>
        <div className="space-y-2.5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-white/40">中转站列表</p>
              <p className="mt-1 text-lg tracking-[-0.03em]">当前可编辑的启用记录</p>
            </div>
            <p className="text-sm text-white/48">共 {visibleRelays.length} 条</p>
          </div>
          {visibleRelays.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-5 text-sm text-white/58">
              当前还没有可展示的中转站记录。
            </div>
          ) : visibleRelays.map((relay) => (
            <div
              key={relay.id}
              className="admin-list-card w-full border border-white/10 bg-white/5 p-3.5 text-left transition hover:bg-white/8"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xl tracking-[-0.03em]">{relay.name}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.16em] text-white/45">{relay.slug} · {formatCatalogStatus(relay.catalogStatus)}</p>
                </div>
                <div className="text-right text-xs uppercase tracking-[0.14em] text-white/50">
                  <p>{relay.isFeatured ? "精选展示" : "标准展示"}</p>
                  <p>{relay.isSponsored ? "带赞助提示" : "自然位"}</p>
                </div>
              </div>
              {(() => {
                const credential = relayCredentialLookup.get(relay.id);

                return (
                  <>
                    <p className="mt-3 text-sm text-white/62">{relay.baseUrl}</p>
                    <p className={clsx("mt-3 text-sm", credential ? "text-white/72" : "text-[#ffd06a]")}>
                      {credential ? `监测密钥 · ${formatCredentialStatus(credential.status)}` : "缺少监测密钥"}
                    </p>
                    <p className="mt-1 text-sm text-white/55">
                      {credential
                        ? `${credential.testModel} · ${formatHealthStatus(credential.lastHealthStatus)}${credential.lastHttpStatus ? ` · ${credential.lastHttpStatus}` : ""}`
                        : "请先绑定中转站自有监测密钥，定时 Probe 才能开始运行。"}
                      {credential?.lastVerifiedAt
                        ? ` · ${formatDateTime(credential.lastVerifiedAt)}`
                        : ""}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button className="pill pill-active" onClick={() => beginEditingRelay(relay)} type="button">
                        编辑中转站
                      </button>
                      <Link
                        className="pill pill-idle"
                        to={buildCredentialRoute({
                          credentialId: credential?.id ?? null,
                          ownerType: "relay",
                          ownerId: relay.id,
                        })}
                      >
                        {credential ? "管理密钥" : "添加密钥"}
                      </Link>
                      <a
                        className="pill pill-ghost"
                        href={`${PUBLIC_SITE_URL}/relay/${relay.slug}`}
                        rel="noreferrer"
                        target="_blank"
                      >
                        前台详情页
                      </a>
                      <button
                        className="pill pill-ghost"
                        disabled={mutation.pending}
                        onClick={() => setRelayDeleteTarget(relay)}
                        type="button"
                      >
                        归档
                      </button>
                    </div>
                  </>
                );
              })()}
            </div>
          ))}
        </div>
        <ConfirmDialog
          confirmLabel="归档中转站"
          confirmPendingLabel="归档中..."
          message={
            relayDeleteTarget
              ? `${relayDeleteTarget.name} 将被归档并从运营列表中隐藏，但记录仍会保留在 Postgres 中。`
              : ""
          }
          onCancel={() => setRelayDeleteTarget(null)}
          onConfirm={() => {
            if (relayDeleteTarget) {
              void softDeleteRelay(relayDeleteTarget);
            }
          }}
          open={Boolean(relayDeleteTarget)}
          pending={mutation.pending}
          title={relayDeleteTarget ? `确认归档 ${relayDeleteTarget.name}？` : ""}
        />
      </Card>
      <Card title={editingId ? "编辑中转站" : "创建中转站"} kicker="写入操作">
        <div className="grid gap-2.5">
          {([
            { label: "标识 Slug", key: "slug", placeholder: "northwind-relay", type: "text" },
            { label: "名称", key: "name", placeholder: "北风中转站", type: "text" },
            { label: "基础 URL", key: "baseUrl", placeholder: "https://northwind.example.ai/v1", type: "url" },
            { label: "提供方", key: "providerName", placeholder: "Northwind Labs", type: "text" },
            { label: "官网地址", key: "websiteUrl", placeholder: "https://northwind.example.ai", type: "url" },
          ] as const).map(({ label, key, placeholder, type }) => (
            <label key={key} className="field-label">
              {label}
              <input
                className="field-input"
                type={type}
                placeholder={placeholder}
                value={form[key] ?? ""}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  setForm((current) => ({
                    ...current,
                    [key]: key === "slug" || key === "name" || key === "baseUrl" ? nextValue : nextValue || null,
                  }));
                  setFieldErrors((current) => withoutFieldError(current, key));
                  setMutation((current) => ({ ...current, error: null }));
                }}
              />
              <FieldError message={fieldErrors[key]} />
            </label>
          ))}
          <label className="field-label">
            目录状态
            <select className="field-input" value={form.catalogStatus} onChange={(event) => setForm((current) => ({ ...current, catalogStatus: event.target.value as AdminRelayUpsert["catalogStatus"] }))}>
              <option value="active">启用中</option>
              <option value="paused">已暂停</option>
              <option value="pending">待处理</option>
              <option value="retired">已退役</option>
              <option value="archived">已归档</option>
            </select>
          </label>
          <label className="inline-flex items-center gap-3 text-sm text-white/70"><input type="checkbox" checked={form.isFeatured} onChange={(event) => setForm((current) => ({ ...current, isFeatured: event.target.checked }))} /> 设为精选</label>
          <label className="inline-flex items-center gap-3 text-sm text-white/70"><input type="checkbox" checked={form.isSponsored} onChange={(event) => setForm((current) => ({ ...current, isSponsored: event.target.checked }))} /> 显示赞助提示</label>
          <div className="flex gap-2.5">
            <button className="pill pill-active" disabled={mutation.pending} onClick={submit} type="button">{mutation.pending ? "保存中..." : editingId ? "更新" : "创建"}</button>
            {editingId ? <button className="pill pill-idle" type="button" onClick={resetForm}>清空</button> : null}
          </div>
          <Notice state={mutation} />
        </div>
      </Card>
    </div>
  );
}

function IntakePage() {
  const submissions = useLoadable<AdminSubmissionsResponse>(() => fetchJson("/admin/submissions"), []);
  const relays = useLoadable<AdminRelaysResponse>(() => fetchJson("/admin/relays"), []);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [mutation, setMutation] = useMutationState();

  async function review(id: string, status: "approved" | "rejected" | "archived") {
    setMutation({ pending: true, error: null, success: null });
    try {
      await fetchJson(`/admin/submissions/${id}/review`, {
        method: "POST",
        body: JSON.stringify({ status, reviewNotes: notes[id] ?? null }),
      });
      setMutation({
        pending: false,
        error: null,
        success:
          status === "approved"
            ? "提交已通过，Relay 已启用，密钥已迁移，并已启动监测。"
            : `提交已标记为${formatSubmissionStatus(status)}。`,
      });
      await submissions.reload();
    } catch (reason) {
      setMutation({ pending: false, error: reason instanceof Error ? reason.message : "无法处理提交记录。", success: null });
    }
  }

  const relayIdBySlug = useMemo(() => {
    const lookup = new Map<string, string>();

    for (const relay of relays.data?.rows ?? []) {
      lookup.set(relay.slug, relay.id);
    }

    return lookup;
  }, [relays.data]);

  if (submissions.loading || relays.loading) return <LoadingCard />;
  if (submissions.error || relays.error || !submissions.data || !relays.data) {
    return <ErrorCard message={submissions.error ?? relays.error ?? "无法加载提交记录。"} />;
  }

  const pendingRows = submissions.data.rows.filter((row) => row.status === "pending");
  const approvedRows = submissions.data.rows.filter((row) => row.status === "approved");
  const closedRows = submissions.data.rows.filter((row) => row.status === "rejected" || row.status === "archived");
  const needsAttention = pendingRows.filter((row) => row.probeCredential?.lastProbeOk === false).length;

  return (
    <Card title="审核队列" kicker="审核操作">
      <div className="space-y-3">
        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3.5 text-sm text-white/68">
          <p className="text-[11px] uppercase tracking-[0.18em] text-white/42">批准流程</p>
          <p className="mt-2 text-white/78">
            现在点击批准即可一次完成完整交接：创建或关联中转站、迁移测试密钥、启用 Relay、执行首次监测，并刷新公开快照。
          </p>
          <p className="mt-2 text-white/54">
            后续轮换、删除或恢复操作请到密钥页面处理。
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-[11px] uppercase tracking-[0.18em] text-white/40">待审核</p>
            <p className="mt-2 text-3xl tracking-[-0.04em]">{pendingRows.length}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-[11px] uppercase tracking-[0.18em] text-white/40">已通过</p>
            <p className="mt-2 text-3xl tracking-[-0.04em]">{approvedRows.length}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-[11px] uppercase tracking-[0.18em] text-white/40">需关注</p>
            <p className="mt-2 text-3xl tracking-[-0.04em]">{needsAttention}</p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-white/40">待审核提交</p>
              <p className="mt-1 text-lg tracking-[-0.03em]">优先处理这些记录</p>
            </div>
            <p className="text-sm text-white/48">共 {pendingRows.length} 条待审核</p>
          </div>

          {pendingRows.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-5 text-sm text-white/58">
              当前没有待审核提交。
            </div>
          ) : pendingRows.map((row) => (
            <div key={row.id} className="admin-list-card border border-white/10 bg-white/5 p-3.5">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-xl tracking-[-0.03em]">{row.relayName}</p>
                  <p className="mt-1 text-sm text-white/60">{row.baseUrl}</p>
                  <p className="mt-2 text-xs uppercase tracking-[0.16em] text-white/40">{formatSubmissionStatus(row.status)} · {formatDateTime(row.createdAt)}</p>
                  {row.description ? (
                    <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-white/38">Relay 说明</p>
                      <p className="mt-2 text-sm leading-6 text-white/72">{row.description}</p>
                    </div>
                  ) : null}
                  {row.probeCredential ? (
                    <div className="mt-3 space-y-1.5 rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white/65">
                      <p>
                        关联密钥 · {formatCredentialStatus(row.probeCredential.status)} · {row.probeCredential.apiKeyPreview}
                      </p>
                      <p>
                        Probe · {row.probeCredential.testModel} · {formatHealthStatus(row.probeCredential.lastHealthStatus)}
                        {row.probeCredential.lastHttpStatus ? ` · ${row.probeCredential.lastHttpStatus}` : ""}
                        {row.probeCredential.lastVerifiedAt
                          ? ` · ${formatDateTime(row.probeCredential.lastVerifiedAt)}`
                          : ""}
                      </p>
                      {row.probeCredential.lastMessage ? <p className="text-white/48">{row.probeCredential.lastMessage}</p> : null}
                    </div>
                  ) : null}
                  <p className="mt-3 text-sm text-white/48">
                    批准后会立即启用该 Relay，并开始公开监测。
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button className="pill pill-active" type="button" onClick={() => review(row.id, "approved")}>批准并启用</button>
                  <button className="pill pill-idle" type="button" onClick={() => review(row.id, "rejected")}>拒绝</button>
                  <button className="pill pill-ghost" type="button" onClick={() => review(row.id, "archived")}>归档</button>
                </div>
              </div>
              <textarea className="field-input mt-3 min-h-24" placeholder="审核备注" value={notes[row.id] ?? row.reviewNotes ?? ""} onChange={(event) => setNotes((current) => ({ ...current, [row.id]: event.target.value }))} />
            </div>
          ))}
        </div>

        {approvedRows.length > 0 ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-white/40">已启用 Relay</p>
                <p className="mt-1 text-lg tracking-[-0.03em]">最近完成的交接</p>
              </div>
              <p className="text-sm text-white/48">共 {approvedRows.length} 条已通过</p>
            </div>

            {approvedRows.slice(0, 8).map((row) => (
              <div key={row.id} className="admin-list-card border border-white/10 bg-white/5 p-3.5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-xl tracking-[-0.03em]">{row.relayName}</p>
                    <p className="mt-1 text-sm text-white/60">{row.baseUrl}</p>
                    <p className="mt-2 text-xs uppercase tracking-[0.16em] text-white/40">{formatSubmissionStatus(row.status)} · {formatDateTime(row.createdAt)}</p>
                    {row.description ? <p className="mt-3 text-sm leading-6 text-white/64">{row.description}</p> : null}
                    {row.approvedRelay ? <p className="mt-2 text-sm text-emerald-300/80">已关联中转站 · {row.approvedRelay.name}</p> : null}
                    {row.probeCredential ? (
                      <p className="mt-3 text-sm text-white/55">
                        审核快照 · {row.probeCredential.testModel} · {formatHealthStatus(row.probeCredential.lastHealthStatus)}
                        {row.probeCredential.lastVerifiedAt
                          ? ` · ${formatDateTime(row.probeCredential.lastVerifiedAt)}`
                          : ""}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {row.approvedRelay ? (
                      <>
                        {relayIdBySlug.get(row.approvedRelay.slug) ? (
                          <Link
                            className="pill pill-idle"
                            to={buildCredentialRoute(
                              (() => {
                                const ownerId = relayIdBySlug.get(row.approvedRelay.slug);
                                return ownerId
                                  ? {
                                    ownerType: "relay" as const,
                                    ownerId,
                                  }
                                  : {};
                              })(),
                            )}
                          >
                            管理密钥
                          </Link>
                        ) : null}
                        <Link className="pill pill-idle" to="/relays">
                          打开 Relay 运营页
                        </Link>
                        <a
                          className="pill pill-ghost"
                          href={`${PUBLIC_SITE_URL}/relay/${row.approvedRelay.slug}`}
                          rel="noreferrer"
                          target="_blank"
                        >
                          打开前台页面
                        </a>
                      </>
                    ) : null}
                  </div>
                </div>
                <textarea className="field-input mt-3 min-h-24" placeholder="审核备注" value={notes[row.id] ?? row.reviewNotes ?? ""} onChange={(event) => setNotes((current) => ({ ...current, [row.id]: event.target.value }))} />
              </div>
            ))}
          </div>
        ) : null}

        {closedRows.length > 0 ? (
          <details className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
            <summary className="cursor-pointer list-none text-sm uppercase tracking-[0.16em] text-white/45">
              已关闭记录 · {closedRows.length}
            </summary>
            <div className="mt-3 space-y-2.5">
              {closedRows.slice(0, 8).map((row) => (
                <div key={row.id} className="rounded-2xl border border-white/10 bg-black/10 px-3 py-3 text-sm text-white/60">
                  <p className="text-white/78">{row.relayName}</p>
                  <p className="mt-1">{formatSubmissionStatus(row.status)} · {formatDateTime(row.createdAt)}</p>
                </div>
              ))}
            </div>
          </details>
        ) : null}
      </div>
      <div className="mt-4"><Notice state={mutation} /></div>
    </Card>
  );
}

function CredentialsPage() {
  const credentials = useLoadable<AdminProbeCredentialsResponse>(() => fetchJson("/admin/probe-credentials"), []);
  const relays = useLoadable<AdminRelaysResponse>(() => fetchJson("/admin/relays"), []);
  const [searchParams] = useSearchParams();
  const [selectedCredentialId, setSelectedCredentialId] = useState<string | null>(null);
  const [credentialDeleteTarget, setCredentialDeleteTarget] = useState<AdminProbeCredentialDetail | null>(null);
  const detail = useLoadable<AdminProbeCredentialDetail | null>(
    () => (selectedCredentialId ? fetchJson(`/admin/probe-credentials/${selectedCredentialId}`) : Promise.resolve(null)),
    [selectedCredentialId],
  );
  const [createForm, setCreateForm] = useState<ProbeCredentialFormState>({
    ownerType: "relay",
    ownerId: "",
    apiKey: "",
    testModel: "gpt-5.4",
    compatibilityMode: "auto",
  });
  const [rotateForm, setRotateForm] = useState<ProbeCredentialFormState>({
    ownerType: "relay",
    ownerId: "",
    apiKey: "",
    testModel: "gpt-5.4",
    compatibilityMode: "auto",
  });
  const [fieldErrors, setFieldErrors] = useState<ProbeCredentialFormErrors>({});
  const [rotateErrors, setRotateErrors] = useState<ProbeCredentialFormErrors>({});
  const [createMutation, setCreateMutation] = useMutationState();
  const [actionMutation, setActionMutation] = useMutationState();
  const [revealedKey, setRevealedKey] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const requestedCredentialId = searchParams.get("credential");
  const requestedOwnerType = searchParams.get("ownerType") === "relay" ? "relay" : null;
  const requestedOwnerId = searchParams.get("ownerId");
  const relayCredentials = useMemo(
    () => (credentials.data?.rows ?? []).filter((row) => row.ownerType === "relay"),
    [credentials.data],
  );

  useEffect(() => {
    if (!relayCredentials.length) {
      setSelectedCredentialId(null);
      return;
    }

    if (requestedCredentialId && relayCredentials.some((row) => row.id === requestedCredentialId)) {
      if (requestedCredentialId !== selectedCredentialId) {
        setSelectedCredentialId(requestedCredentialId);
      }
      return;
    }

    if (requestedOwnerId && requestedOwnerType === "relay") {
      const ownerCredential = relayCredentials.find((row) =>
        row.ownerId === requestedOwnerId && row.ownerType === "relay",
      );

      if (ownerCredential) {
        if (ownerCredential.id !== selectedCredentialId) {
          setSelectedCredentialId(ownerCredential.id);
        }
        return;
      }

      if (selectedCredentialId !== null) {
        setSelectedCredentialId(null);
      }
      return;
    }

    if (!selectedCredentialId || !relayCredentials.some((row) => row.id === selectedCredentialId)) {
      setSelectedCredentialId(relayCredentials[0]?.id ?? null);
    }
  }, [relayCredentials, requestedCredentialId, requestedOwnerId, requestedOwnerType, selectedCredentialId]);

  useEffect(() => {
    if (!detail.data) {
      setRevealedKey(false);
      setCopiedKey(false);
      return;
    }

    setRotateForm({
      ownerType: detail.data.ownerType,
      ownerId: detail.data.ownerId,
      apiKey: "",
      testModel: detail.data.testModel,
      compatibilityMode: detail.data.compatibilityMode,
    });
    setRotateErrors({});
    setRevealedKey(false);
    setCopiedKey(false);
  }, [detail.data]);

  useEffect(() => {
    if (!requestedOwnerId || requestedOwnerType !== "relay") {
      return;
    }

    setCreateForm((current) => ({
      ...current,
      ownerType: "relay",
      ownerId: requestedOwnerId,
    }));
  }, [requestedOwnerId, requestedOwnerType]);

  const relayOwnerOptions = buildRelaySelectOptions(relays.data?.rows ?? [], createForm.ownerId);

  async function reloadCredentialViews(nextSelectedId?: string | null) {
    await credentials.reload();

    if (nextSelectedId && nextSelectedId !== selectedCredentialId) {
      setSelectedCredentialId(nextSelectedId);
      return;
    }

    if (selectedCredentialId) {
      await detail.reload();
    }
  }

  async function createCredential() {
    const { errors, payload } = validateProbeCredentialForm(createForm);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setCreateMutation({ pending: false, error: "请先修正高亮字段，再保存监测密钥。", success: null });
      return;
    }

    setCreateMutation({ pending: true, error: null, success: null });
    try {
      const response = await fetchJson<AdminProbeCredentialMutationResponse>("/admin/probe-credentials", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setCreateMutation({
        pending: false,
        error: null,
        success: response.probe
          ? `监测密钥已绑定。初始 Probe ${response.probe.ok ? "通过" : "需要人工复核"}。`
          : "监测密钥已绑定。",
      });
      setCreateForm((current) => ({ ...current, ownerId: "", apiKey: "" }));
      setFieldErrors({});
      setSelectedCredentialId(response.id);
      await reloadCredentialViews(response.id);
    } catch (reason) {
      setCreateMutation({ pending: false, error: reason instanceof Error ? reason.message : "无法绑定监测密钥。", success: null });
    }
  }

  async function reprobeSelected() {
    if (!detail.data) {
      return;
    }

    setActionMutation({ pending: true, error: null, success: null });
    try {
      const response = await fetchJson<AdminProbeCredentialMutationResponse>(`/admin/probe-credentials/${detail.data.id}/reprobe`, {
        method: "POST",
      });
      setActionMutation({
        pending: false,
        error: null,
        success: response.probe
          ? `Probe 重跑完成：${formatHealthStatus(response.probe.healthStatus)}${response.probe.httpStatus ? ` · ${response.probe.httpStatus}` : ""}。`
          : "Probe 重跑完成。",
      });
      await reloadCredentialViews(detail.data.id);
    } catch (reason) {
      setActionMutation({ pending: false, error: reason instanceof Error ? reason.message : "无法重新执行 Probe。", success: null });
    }
  }

  async function rotateSelected() {
    if (!detail.data) {
      return;
    }

    const { errors, payload } = validateProbeCredentialForm(rotateForm);
    setRotateErrors(errors);
    if (Object.keys(errors).length > 0) {
      setActionMutation({ pending: false, error: "请先修正高亮字段，再保存轮换信息。", success: null });
      return;
    }

    setActionMutation({ pending: true, error: null, success: null });
    try {
      const response = await fetchJson<AdminProbeCredentialMutationResponse>(`/admin/probe-credentials/${detail.data.id}/rotate`, {
        method: "POST",
        body: JSON.stringify({
          apiKey: payload.apiKey,
          testModel: payload.testModel,
          compatibilityMode: payload.compatibilityMode,
        }),
      });
      setActionMutation({
        pending: false,
        error: null,
        success: response.probe
          ? `监测密钥已轮换。新的 Probe ${response.probe.ok ? "通过" : "需要人工复核"}。`
          : "监测密钥已轮换。",
      });
      setSelectedCredentialId(response.id);
      await reloadCredentialViews(response.id);
    } catch (reason) {
      setActionMutation({ pending: false, error: reason instanceof Error ? reason.message : "无法轮换监测密钥。", success: null });
    }
  }

  async function deleteSelectedCredential(credential: AdminProbeCredentialDetail) {
    setActionMutation({ pending: true, error: null, success: null });
    try {
      await fetchJson<{ ok: true }>(`/admin/probe-credentials/${credential.id}`, {
        method: "DELETE",
      });
      setCredentialDeleteTarget(null);
      setSelectedCredentialId(null);
      setActionMutation({ pending: false, error: null, success: "监测密钥已删除。" });
      await credentials.reload();
    } catch (reason) {
      setCredentialDeleteTarget(null);
      setActionMutation({
        pending: false,
        error: reason instanceof Error ? reason.message : "无法删除监测密钥。",
        success: null,
      });
    }
  }

  async function copySelectedKey() {
    if (!detail.data) {
      return;
    }

    await navigator.clipboard.writeText(detail.data.apiKey);
    setCopiedKey(true);
    setActionMutation((current) => ({ ...current, success: "密钥已复制。" }));
  }

  if (credentials.loading || relays.loading) return <LoadingCard />;
  if (credentials.error || relays.error || !credentials.data || !relays.data) {
    return <ErrorCard message={credentials.error ?? relays.error ?? "无法加载监测密钥。"} />;
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[1.08fr_0.92fr]">
      <Card title="Relay 监测密钥" kicker="监测操作">
        <div className="mb-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/62">
          这里仅展示 Relay 自有的监测密钥。待审核提交中的测试密钥会保留在审核队列，不会出现在这里。
        </div>
        <div className="space-y-2.5">
          {relayCredentials.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-5 text-sm text-white/58">
              当前还没有 Relay 监测密钥。
            </div>
          ) : relayCredentials.map((row) => (
              <button
                key={row.id}
                className={clsx(
                  "admin-list-card w-full border p-3.5 text-left transition",
                  row.id === selectedCredentialId
                    ? "border-[#ffd06a]/70 bg-white/10"
                    : "border-white/10 bg-white/5 hover:bg-white/8",
                )}
                onClick={() => setSelectedCredentialId(row.id)}
                type="button"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-lg tracking-[-0.03em]">{row.ownerName}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.16em] text-white/45">
                      {formatCredentialStatus(row.status)} · {row.apiKeyPreview}
                    </p>
                  </div>
                  <p className="text-xs uppercase tracking-[0.14em] text-white/45">{formatCompatibilityMode(row.compatibilityMode)}</p>
                </div>
                <p className="mt-2 text-sm text-white/62">{row.ownerBaseUrl}</p>
                <p className="mt-2 text-sm text-white/70">
                  {row.testModel} · {formatHealthStatus(row.lastHealthStatus)}
                  {row.lastHttpStatus ? ` · ${row.lastHttpStatus}` : ""}
                </p>
                {row.lastMessage ? <p className="mt-2 text-sm text-white/45">{row.lastMessage}</p> : null}
              </button>
            ))}
        </div>
      </Card>

      <div className="space-y-4">
        <Card title="绑定监测密钥" kicker="Relay 自有凭据">
          {requestedOwnerId && requestedOwnerType === "relay" ? (
            <div className="mb-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/62">
              表单已从上一页带入 Relay 信息，你可以直接绑定监测密钥，无需再次选择。
            </div>
          ) : null}
          <div className="mb-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/62">
            仅在已批准的 Relay 当前没有可用监测密钥时使用该表单。
          </div>
          <div className="grid gap-2.5">
            <label className="field-label">
              中转站
              <select
                className="field-input"
                value={createForm.ownerId}
                onChange={(event) => {
                  setCreateForm((current) => ({ ...current, ownerType: "relay", ownerId: event.target.value }));
                  setFieldErrors((current) => withoutFieldError(current, "ownerId"));
                  setCreateMutation((current) => ({ ...current, error: null }));
                }}
              >
                <option value="">请选择中转站</option>
                {relayOwnerOptions.map((owner) => (
                  <option key={owner.id} value={owner.id}>
                    {getRelayOptionLabel(owner)}
                  </option>
                ))}
              </select>
              <FieldError message={fieldErrors.ownerId} />
            </label>
            <label className="field-label">
              API Key
              <input
                className="field-input"
                type="password"
                placeholder="sk-monitoring"
                value={createForm.apiKey}
                onChange={(event) => {
                  setCreateForm((current) => ({ ...current, apiKey: event.target.value }));
                  setFieldErrors((current) => withoutFieldError(current, "apiKey"));
                  setCreateMutation((current) => ({ ...current, error: null }));
                }}
              />
              <FieldError message={fieldErrors.apiKey} />
            </label>
            <label className="field-label">
              测试模型
              <input
                className="field-input"
                placeholder="gpt-5.4"
                value={createForm.testModel}
                onChange={(event) => {
                  setCreateForm((current) => ({ ...current, testModel: event.target.value }));
                  setFieldErrors((current) => withoutFieldError(current, "testModel"));
                  setCreateMutation((current) => ({ ...current, error: null }));
                }}
              />
              <FieldError message={fieldErrors.testModel} />
            </label>
            <label className="field-label">
              兼容协议
              <select
                className="field-input"
                value={createForm.compatibilityMode}
                onChange={(event) => setCreateForm((current) => ({ ...current, compatibilityMode: event.target.value as ProbeCompatibilityMode }))}
              >
                <option value="auto">自动检测</option>
                <option value="openai-responses">openai-responses</option>
                <option value="openai-chat-completions">openai-chat-completions</option>
                <option value="anthropic-messages">anthropic-messages</option>
              </select>
            </label>
            <button className="pill pill-active" disabled={createMutation.pending} onClick={createCredential} type="button">
              {createMutation.pending ? "绑定中..." : "绑定监测密钥"}
            </button>
            <Notice state={createMutation} />
          </div>
        </Card>

        <Card title="监测密钥详情" kicker={detail.data ? detail.data.ownerName : "请选择一条密钥"}>
          {!selectedCredentialId ? (
            <p className="text-sm text-white/55">尚未选择密钥。</p>
          ) : detail.loading ? (
            <p className="text-sm text-white/55">正在加载密钥详情...</p>
          ) : detail.error || !detail.data ? (
            <p className="text-sm text-[#ffb59c]">{detail.error ?? "无法加载密钥详情。"}</p>
          ) : (
            <div className="space-y-4">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3.5">
                <p className="text-xs uppercase tracking-[0.16em] text-white/45">{formatCredentialStatus(detail.data.status)}</p>
                <p className="mt-2 text-sm text-white/72">{detail.data.ownerBaseUrl}</p>
                <p className="mt-2 text-sm text-white/65">
                  {detail.data.testModel} · {formatCompatibilityMode(detail.data.compatibilityMode)}
                </p>
                <p className="mt-2 break-all font-mono text-sm text-[#ffd06a]">
                  {revealedKey ? detail.data.apiKey : detail.data.apiKeyPreview}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button className="pill pill-idle" type="button" onClick={() => setRevealedKey((current) => !current)}>
                    {revealedKey ? "隐藏密钥" : "显示密钥"}
                  </button>
                  <button className="pill pill-idle" type="button" onClick={copySelectedKey}>
                    {copiedKey ? "已复制" : "复制密钥"}
                  </button>
                  <button className="pill pill-active" disabled={actionMutation.pending} type="button" onClick={reprobeSelected}>
                    {actionMutation.pending ? "执行中..." : "重新运行 Probe"}
                  </button>
                  <button
                    className="pill pill-ghost"
                    disabled={actionMutation.pending}
                    type="button"
                    onClick={() => setCredentialDeleteTarget(detail.data)}
                  >
                    删除密钥
                  </button>
                </div>
                <div className="mt-3 space-y-1 text-sm text-white/55">
                  <p>
                    最近一次 Probe · {formatHealthStatus(detail.data.lastHealthStatus)}
                    {detail.data.lastHttpStatus ? ` · ${detail.data.lastHttpStatus}` : ""}
                    {detail.data.lastVerifiedAt ? ` · ${formatDateTime(detail.data.lastVerifiedAt)}` : ""}
                  </p>
                  {detail.data.lastDetectionMode ? <p>检测方式 · {detail.data.lastDetectionMode === "manual" ? "手动指定" : detail.data.lastDetectionMode === "auto" ? "自动检测" : detail.data.lastDetectionMode}</p> : null}
                  {detail.data.lastUsedUrl ? <p className="break-all">实际探测地址 · {detail.data.lastUsedUrl}</p> : null}
                  {detail.data.lastMessage ? <p>{detail.data.lastMessage}</p> : null}
                </div>
              </div>

              <div className="grid gap-2.5">
                <p className="text-xs uppercase tracking-[0.16em] text-white/45">轮换密钥</p>
                <label className="field-label">
                  新的 API Key
                  <input
                    className="field-input"
                    type="password"
                    placeholder="sk-new-monitoring"
                    value={rotateForm.apiKey}
                    onChange={(event) => {
                      setRotateForm((current) => ({ ...current, apiKey: event.target.value }));
                      setRotateErrors((current) => withoutFieldError(current, "apiKey"));
                      setActionMutation((current) => ({ ...current, error: null }));
                    }}
                  />
                  <FieldError message={rotateErrors.apiKey} />
                </label>
                <label className="field-label">
                  新的测试模型
                  <input
                    className="field-input"
                    value={rotateForm.testModel}
                    onChange={(event) => {
                      setRotateForm((current) => ({ ...current, testModel: event.target.value }));
                      setRotateErrors((current) => withoutFieldError(current, "testModel"));
                      setActionMutation((current) => ({ ...current, error: null }));
                    }}
                  />
                  <FieldError message={rotateErrors.testModel} />
                </label>
                <label className="field-label">
                  新的兼容协议
                  <select
                    className="field-input"
                    value={rotateForm.compatibilityMode}
                    onChange={(event) => setRotateForm((current) => ({ ...current, compatibilityMode: event.target.value as ProbeCompatibilityMode }))}
                  >
                    <option value="auto">自动检测</option>
                    <option value="openai-responses">openai-responses</option>
                    <option value="openai-chat-completions">openai-chat-completions</option>
                    <option value="anthropic-messages">anthropic-messages</option>
                  </select>
                </label>
                <button className="pill pill-active" disabled={actionMutation.pending} type="button" onClick={rotateSelected}>
                  {actionMutation.pending ? "轮换中..." : "轮换密钥"}
                </button>
                <Notice state={actionMutation} />
              </div>
            </div>
          )}
        </Card>
      </div>
      <ConfirmDialog
        confirmLabel="删除密钥"
        confirmPendingLabel="删除中..."
        message={
          credentialDeleteTarget
            ? `${credentialDeleteTarget.ownerName} 将失去这条监测密钥记录。只有在确定要从系统中移除该密钥时才执行删除。`
            : ""
        }
        onCancel={() => setCredentialDeleteTarget(null)}
        onConfirm={() => {
          if (credentialDeleteTarget) {
            void deleteSelectedCredential(credentialDeleteTarget);
          }
        }}
        open={Boolean(credentialDeleteTarget)}
        pending={actionMutation.pending}
        title={credentialDeleteTarget ? `确认删除 ${credentialDeleteTarget.ownerName} 的密钥？` : ""}
      />
    </div>
  );
}

function SponsorsPage() {
  const sponsors = useLoadable<AdminSponsorsResponse>(() => fetchJson("/admin/sponsors"), []);
  const relays = useLoadable<AdminRelaysResponse>(() => fetchJson("/admin/relays"), []);
  const [form, setForm] = useState<SponsorFormState>({
    relayId: "",
    name: "",
    placement: "homepage-spotlight",
    status: "active",
    startAt: new Date().toISOString(),
    endAt: new Date(Date.now() + 30 * 86400000).toISOString(),
  });
  const [fieldErrors, setFieldErrors] = useState<SponsorFormErrors>({});
  const [mutation, setMutation] = useMutationState();
  const relayOptions = buildRelaySelectOptions(relays.data?.rows ?? [], form.relayId);

  async function createSponsor() {
    const { errors, payload } = validateSponsorForm(form);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setMutation({ pending: false, error: "请先修正高亮字段，再保存赞助位。", success: null });
      return;
    }

    setMutation({ pending: true, error: null, success: null });
    try {
      await fetchJson("/admin/sponsors", { method: "POST", body: JSON.stringify(payload) });
      setMutation({ pending: false, error: null, success: "赞助位已创建。" });
      setFieldErrors({});
      await sponsors.reload();
    } catch (reason) {
      setMutation({ pending: false, error: reason instanceof Error ? reason.message : "无法创建赞助位。", success: null });
    }
  }

  if (sponsors.loading || relays.loading) return <LoadingCard />;
  if (sponsors.error || !sponsors.data || relays.error || !relays.data) return <ErrorCard message={sponsors.error ?? relays.error ?? "无法加载赞助位。"} />;

  return (
    <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
      <Card title="赞助位列表" kicker="投放时间窗口">
        <div className="space-y-2.5">
          {sponsors.data.rows.map((row) => (
            <div key={row.id} className="admin-list-card border border-white/10 bg-white/5 p-3.5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xl tracking-[-0.03em]">{row.name}</p>
                  <p className="mt-1 text-sm text-white/60">{row.placement}</p>
                </div>
                <p className="text-xs uppercase tracking-[0.16em] text-white/40">{formatSponsorStatus(row.status)}</p>
              </div>
              <p className="mt-2 text-sm text-white/60">{row.relay ? `${row.relay.name} · ` : "未绑定中转站 · "}{formatDate(row.startAt)} 至 {formatDate(row.endAt)}</p>
            </div>
          ))}
        </div>
      </Card>
      <Card title="创建赞助位" kicker="商务操作">
        <div className="grid gap-2.5">
          <label className="field-label">名称<input className="field-input" placeholder="首页焦点位" value={form.name} onChange={(event) => { setForm((current) => ({ ...current, name: event.target.value })); setFieldErrors((current) => withoutFieldError(current, "name")); setMutation((current) => ({ ...current, error: null })); }} /><FieldError message={fieldErrors.name} /></label>
          <label className="field-label">投放位标识<input className="field-input" placeholder="homepage-spotlight" value={form.placement} onChange={(event) => { setForm((current) => ({ ...current, placement: event.target.value })); setFieldErrors((current) => withoutFieldError(current, "placement")); setMutation((current) => ({ ...current, error: null })); }} /><FieldError message={fieldErrors.placement} /></label>
          <label className="field-label">关联中转站<select className="field-input" value={form.relayId} onChange={(event) => setForm((current) => ({ ...current, relayId: event.target.value }))}><option value="">不绑定中转站</option>{relayOptions.map((relay) => <option key={relay.id} value={relay.id}>{getRelayOptionLabel(relay)}</option>)}</select></label>
          <label className="field-label">状态<select className="field-input" value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as SponsorFormState["status"] }))}><option value="active">投放中</option><option value="draft">草稿</option><option value="paused">已暂停</option><option value="ended">已结束</option></select></label>
          <label className="field-label">开始时间<input className="field-input" placeholder="2026-04-16T00:00:00.000Z" value={form.startAt} onChange={(event) => { setForm((current) => ({ ...current, startAt: event.target.value })); setFieldErrors((current) => withoutFieldError(current, "startAt")); setMutation((current) => ({ ...current, error: null })); }} /><FieldError message={fieldErrors.startAt} /></label>
          <label className="field-label">结束时间<input className="field-input" placeholder="2026-05-16T00:00:00.000Z" value={form.endAt} onChange={(event) => { setForm((current) => ({ ...current, endAt: event.target.value })); setFieldErrors((current) => withoutFieldError(current, "endAt")); setMutation((current) => ({ ...current, error: null })); }} /><FieldError message={fieldErrors.endAt} /></label>
          <button className="pill pill-active" disabled={mutation.pending} onClick={createSponsor} type="button">{mutation.pending ? "保存中..." : "创建赞助位"}</button>
          <Notice state={mutation} />
        </div>
      </Card>
    </div>
  );
}

function PricesPage() {
  const prices = useLoadable<AdminPricesResponse>(() => fetchJson("/admin/prices"), []);
  const relays = useLoadable<AdminRelaysResponse>(() => fetchJson("/admin/relays"), []);
  const models = useLoadable<{ rows: AdminModelOption[] }>(() => fetchJson("/admin/models"), []);
  const [form, setForm] = useState<PriceFormState>({
    relayId: "",
    modelId: "",
    currency: "USD",
    inputPricePer1M: "0.1",
    outputPricePer1M: "0.5",
    effectiveFrom: new Date().toISOString(),
    source: "manual",
  });
  const [fieldErrors, setFieldErrors] = useState<PriceFormErrors>({});
  const [mutation, setMutation] = useMutationState();
  const relayOptions = buildRelaySelectOptions(relays.data?.rows ?? [], form.relayId);

  async function createPrice() {
    const { errors, payload } = validatePriceForm(form);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setMutation({ pending: false, error: "请先修正高亮字段，再保存价格记录。", success: null });
      return;
    }

    setMutation({ pending: true, error: null, success: null });
    try {
      await fetchJson("/admin/prices", { method: "POST", body: JSON.stringify(payload) });
      setMutation({ pending: false, error: null, success: "价格记录已创建。" });
      setFieldErrors({});
      await prices.reload();
    } catch (reason) {
      setMutation({ pending: false, error: reason instanceof Error ? reason.message : "无法创建价格记录。", success: null });
    }
  }

  if (prices.loading || relays.loading || models.loading) return <LoadingCard />;
  if (prices.error || relays.error || models.error || !prices.data || !relays.data || !models.data) return <ErrorCard message={prices.error ?? relays.error ?? models.error ?? "无法加载价格记录。"} />;

  return (
    <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
      <Card title="价格历史" kicker="已记录的价格计划">
        <div className="space-y-2.5">
          {prices.data.rows.map((row) => (
            <div key={row.id} className="admin-list-card border border-white/10 bg-white/5 p-3.5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xl tracking-[-0.03em]">{row.relay.name}</p>
                  <p className="mt-1 text-sm text-white/60">{row.modelName}</p>
                </div>
                <p className="text-sm text-white/60">{row.inputPricePer1M ?? "-"} / {row.outputPricePer1M ?? "-"}</p>
              </div>
              <p className="mt-2 text-xs uppercase tracking-[0.16em] text-white/40">{row.source === "manual" ? "手动录入" : row.source} · {formatDate(row.effectiveFrom)}</p>
            </div>
          ))}
        </div>
      </Card>
      <Card title="创建价格记录" kicker="价格操作">
        <div className="grid gap-2.5">
          <label className="field-label">中转站<select className="field-input" value={form.relayId} onChange={(event) => { setForm((current) => ({ ...current, relayId: event.target.value })); setFieldErrors((current) => withoutFieldError(current, "relayId")); setMutation((current) => ({ ...current, error: null })); }}><option value="">请选择中转站</option>{relayOptions.map((relay) => <option key={relay.id} value={relay.id}>{getRelayOptionLabel(relay)}</option>)}</select><FieldError message={fieldErrors.relayId} /></label>
          <label className="field-label">模型<select className="field-input" value={form.modelId} onChange={(event) => { setForm((current) => ({ ...current, modelId: event.target.value })); setFieldErrors((current) => withoutFieldError(current, "modelId")); setMutation((current) => ({ ...current, error: null })); }}><option value="">请选择模型</option>{models.data.rows.map((model) => <option key={model.id} value={model.id}>{model.name}</option>)}</select><FieldError message={fieldErrors.modelId} /></label>
          <label className="field-label">输入价<input className="field-input" type="number" min="0" step="0.01" value={form.inputPricePer1M} onChange={(event) => { setForm((current) => ({ ...current, inputPricePer1M: event.target.value })); setFieldErrors((current) => withoutFieldError(current, "inputPricePer1M")); setMutation((current) => ({ ...current, error: null })); }} /><FieldError message={fieldErrors.inputPricePer1M} /></label>
          <label className="field-label">输出价<input className="field-input" type="number" min="0" step="0.01" value={form.outputPricePer1M} onChange={(event) => { setForm((current) => ({ ...current, outputPricePer1M: event.target.value })); setFieldErrors((current) => withoutFieldError(current, "outputPricePer1M")); setMutation((current) => ({ ...current, error: null })); }} /><FieldError message={fieldErrors.outputPricePer1M} /></label>
          <label className="field-label">生效时间<input className="field-input" placeholder="2026-04-16T00:00:00.000Z" value={form.effectiveFrom} onChange={(event) => { setForm((current) => ({ ...current, effectiveFrom: event.target.value })); setFieldErrors((current) => withoutFieldError(current, "effectiveFrom")); setMutation((current) => ({ ...current, error: null })); }} /><FieldError message={fieldErrors.effectiveFrom} /></label>
          <button className="pill pill-active" disabled={mutation.pending} onClick={createPrice} type="button">{mutation.pending ? "保存中..." : "创建价格记录"}</button>
          <Notice state={mutation} />
        </div>
      </Card>
    </div>
  );
}

async function verifyAdminAccess(authorization: string | null) {
  await fetchJson("/admin/overview", undefined, {
    authHeader: authorization,
    skipStoredAuth: true,
    suppressUnauthorizedEvent: true,
  });
}

function AdminBootstrapCard({
  title,
  message,
  actionLabel,
  onAction,
}: {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="admin-shell min-h-screen bg-[var(--bg)] text-white">
      <main className="admin-main mx-auto flex min-h-screen max-w-7xl items-center justify-center px-5 lg:px-10">
        <section className="card w-full max-w-md">
          <h1 className="text-3xl tracking-[-0.04em] md:text-[2rem]">{title}</h1>
          <p className="mt-3 text-sm leading-6 text-white/62">{message}</p>
          {actionLabel && onAction ? (
            <button className="pill pill-active mt-5" type="button" onClick={onAction}>
              {actionLabel}
            </button>
          ) : null}
        </section>
      </main>
    </div>
  );
}

function AdminRoutes() {
  return (
    <Routes>
      <Route path="/" element={<OverviewPage />} />
      <Route path="/relays" element={<RelaysPage />} />
      <Route path="/intake" element={<IntakePage />} />
      <Route path="/submissions" element={<Navigate replace to="/intake" />} />
      <Route path="/credentials" element={<CredentialsPage />} />
      <Route path="/sponsors" element={<SponsorsPage />} />
      <Route path="/prices" element={<PricesPage />} />
      <Route path="*" element={<Navigate replace to="/" />} />
    </Routes>
  );
}

export function App() {
  const [authState, setAuthState] = useState<AdminAccessState>({ status: "checking" });

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      const storedAuthorization = readStoredAdminAuthorization();

      try {
        await verifyAdminAccess(storedAuthorization);

        if (active) {
          setAuthState({
            status: "ready",
            showLogout: Boolean(storedAuthorization),
          });
        }
      } catch (reason) {
        if (!active) {
          return;
        }

        if (reason instanceof ApiRequestError && reason.statusCode === 401) {
          writeStoredAdminAuthorization(null);
          setAuthState({ status: "login" });
          return;
        }

        setAuthState({
          status: "error",
          message: reason instanceof Error ? reason.message : "无法连接管理 API。",
        });
      }
    }

    void bootstrap();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    function handleAuthRequired() {
      writeStoredAdminAuthorization(null);
      setAuthState({ status: "login" });
    }

    window.addEventListener(ADMIN_AUTH_REQUIRED_EVENT, handleAuthRequired);

    return () => {
      window.removeEventListener(ADMIN_AUTH_REQUIRED_EVENT, handleAuthRequired);
    };
  }, []);

  function handleAuthenticated(authorization: string | null) {
    setAuthState({
      status: "ready",
      showLogout: Boolean(authorization),
    });
  }

  function handleLogout() {
    writeStoredAdminAuthorization(null);
    setAuthState({ status: "login" });
  }

  if (authState.status === "checking") {
    return (
      <AdminBootstrapCard
        title="正在检查管理权限"
        message="正在确认管理 API 是否需要登录凭据，然后再加载控制台。"
      />
    );
  }

  if (authState.status === "error") {
    return (
      <AdminBootstrapCard
        title="管理 API 暂时不可用"
        message={authState.message}
        actionLabel="重试"
        onAction={() => window.location.reload()}
      />
    );
  }

  if (authState.status === "login") {
    return <AdminLogin onAuthenticated={handleAuthenticated} />;
  }

  return (
    <AdminShell onLogout={handleLogout} showLogout={authState.showLogout}>
      <AdminRoutes />
    </AdminShell>
  );
}
