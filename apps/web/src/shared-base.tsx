import { clsx } from "clsx";
import {
  type HealthStatus,
  type HomeSummaryResponse,
  type LeaderboardDirectoryResponse,
  type LeaderboardResponse,
  type MethodologyResponse,
  type ProbeCompatibilityMode,
  type ProbeDetectionMode,
  type ProbeResolvedCompatibilityMode,
  type PublicProbeScanMode,
  type PublicProbeResponse,
  type RelayHistoryResponse,
  type RelayIncidentsResponse,
  type RelayModelHealthResponse,
  type RelayModelsResponse,
  type RelayOverviewResponse,
  type RelayPricingHistoryResponse,
  type PublicSubmissionResponse,
} from "@relaynews/shared";
import { useEffect, useMemo, useState } from "react";
import {
  Link as RouterLink,
  NavLink as RouterNavLink,
  Route,
  Routes,
  type LinkProps as RouterLinkProps,
  type NavLinkProps as RouterNavLinkProps,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
export { clsx, useEffect, useLocation, useMemo, useNavigate, useParams, useSearchParams, useState };
export type {
  HealthStatus,
  HomeSummaryResponse,
  LeaderboardDirectoryResponse,
  LeaderboardResponse,
  MethodologyResponse,
  ProbeCompatibilityMode,
  ProbeDetectionMode,
  ProbeResolvedCompatibilityMode,
  PublicProbeScanMode,
  PublicProbeResponse,
  RelayHistoryResponse,
  RelayIncidentsResponse,
  RelayModelHealthResponse,
  RelayModelsResponse,
  RelayOverviewResponse,
  RelayPricingHistoryResponse,
  PublicSubmissionResponse,
} from "@relaynews/shared";

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ?? "http://127.0.0.1:8787";
export const PUBLIC_SITE_URL =
  import.meta.env.VITE_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "https://relaynew.ai";

export const PROBE_COMPATIBILITY_OPTIONS: Array<{ value: ProbeCompatibilityMode; label: string }> = [
  { value: "auto", label: "自动识别（推荐）" },
  { value: "openai-responses", label: "OpenAI Responses" },
  { value: "openai-chat-completions", label: "OpenAI Chat Completions" },
  { value: "anthropic-messages", label: "Anthropic Messages" },
  { value: "google-gemini-generate-content", label: "Google Gemini Generate Content" },
];

export const PROBE_FIELD_META = {
  baseUrl: {
    placeholder: "https://relay.example.ai 或 https://relay.example.ai/openai",
    helper:
      "请输入站点根地址或服务商前缀。测试会自动补全 `/v1` 以及协议对应的路由后缀。",
    helperCompact: "请输入站点根地址或服务商前缀；测试会自动补全 `/v1` 和路由后缀。",
    autoComplete: "url",
    inputMode: "url" as const,
  },
  apiKey: {
    placeholder: "请输入 API Key",
    helper:
      "仅用于本次受限的服务端测试请求。结果页不会回显你的密钥。",
    helperCompact: "仅用于本次请求，结果页不会回显密钥。",
    autoComplete: "off",
    inputMode: "text" as const,
  },
  model: {
    placeholder: "gpt-5.3-codex",
    helper:
      "请填写你在线上实际调用的模型标识。自动模式会据此推断适配顺序。",
    helperCompact: "请填写你在线上实际调用的模型 ID。",
    autoComplete: "off",
    inputMode: "text" as const,
  },
} as const;

export const PROBE_COMPATIBILITY_LABELS: Record<ProbeResolvedCompatibilityMode, string> = {
  "openai-responses": "OpenAI Responses",
  "openai-chat-completions": "OpenAI Chat Completions",
  "anthropic-messages": "Anthropic Messages",
  "google-gemini-generate-content": "Google Gemini Generate Content",
};

export const GITHUB_REPOSITORY_URL = "https://github.com/rebase.network";
export const REBASE_NETWORK_URL = "https://rebase.network";

export const HEALTH_STATUS_COPY: Record<string, string> = {
  healthy: "最近观测窗口内响应稳定、可用性可靠，整体表现持续正常。",
  degraded: "该站点仍可访问，但延迟、错误率或协议行为已出现明显下滑。",
  down: "在当前模型分类的测试路径上，该站点暂时无法提供可用服务。",
  paused: "该站点正处于人工复核或运营处理阶段，当前不参与公开排序。",
  unknown: "测试样本数据不足，暂时无法给出明确的评价判断",
};

export const BADGE_COPY: Record<string, string> = {
  "low-latency": "在当前模型分类中多次测得低延迟表现。",
  "high-stability": "观测窗口内波动较小，连续性表现较强。",
  "high-value": "相较同模型分类其他大模型API服务站，价格与质量的平衡更有竞争力。",
  "sample-size-low": "当前样本量仍偏少，解读结论时需要保留谨慎。",
  "under-observation": "该站点已公开展示，但证据仍在继续积累或复核中。",
};

export const POLICY_PILLARS = [
  {
    title: "中立收录",
    body: "站点通过运营者提交与审核进入目录。被收录并不代表会自动获得靠前排名。",
  },
  {
    title: "可观测证据",
    body: "评测排名由各模型分类的实测可用性、延迟、稳定性与性价比信号共同决定。",
  },
  {
    title: "赞助分离",
    body: "赞助方展示会保持清晰可辨，绝不会改写评测榜单中的实测排序。",
  },
  {
    title: "可申诉纠偏",
    body: "如果站点被错误归类，运营者可以提交修正、最新地址或申诉证据供平台复核。",
  },
] as const;

export const PROBE_OUTPUT_CARDS = [
  {
    title: "连通性",
    body: "展示基础可达性结果，以及对目标站点主机的受限延迟测量。",
  },
  {
    title: "协议健康度",
    body: "检查所选 API 协议族是否返回有效结构、状态码与健康状态。",
  },
  {
    title: "执行轨迹",
    body: "你可以查看公开测试实际使用的端点路径与请求尝试记录。",
  },
] as const;

export const HOME_LEADERBOARD_ROW_LIMIT = 3;
export const LEADERBOARD_DIRECTORY_PATH = "/leaderboard";
export const LOADABLE_CACHE_MAX_AGE_MS = 60_000;
export const THIRTY_DAY_BAR_COUNT = 30;

export type PageMetadata = {
  title: string;
  description: string;
  canonicalPath?: string;
};

export const LEADERBOARD_VENDOR_LABELS: Record<string, string> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
  google: "Google",
};

export function buildCanonicalUrl(pathname: string) {
  const normalizedPath = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return new URL(normalizedPath, PUBLIC_SITE_URL).toString();
}

export function upsertNamedMeta(name: string, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);

  if (!element) {
    element = document.createElement("meta");
    element.setAttribute("name", name);
    document.head.appendChild(element);
  }

  element.setAttribute("content", content);
}

export function upsertPropertyMeta(property: string, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[property="${property}"]`);

  if (!element) {
    element = document.createElement("meta");
    element.setAttribute("property", property);
    document.head.appendChild(element);
  }

  element.setAttribute("content", content);
}

export function upsertCanonicalLink(href: string) {
  let element = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');

  if (!element) {
    element = document.createElement("link");
    element.setAttribute("rel", "canonical");
    document.head.appendChild(element);
  }

  element.setAttribute("href", href);
}

export function usePageMetadata(metadata: PageMetadata) {
  const location = useLocation();
  const canonicalUrl = buildCanonicalUrl(metadata.canonicalPath ?? location.pathname);

  useEffect(() => {
    document.title = metadata.title;
    upsertNamedMeta("description", metadata.description);
    upsertCanonicalLink(canonicalUrl);
    upsertPropertyMeta("og:title", metadata.title);
    upsertPropertyMeta("og:description", metadata.description);
    upsertPropertyMeta("og:type", "website");
    upsertPropertyMeta("og:url", canonicalUrl);
    upsertPropertyMeta("og:site_name", "relaynew.ai");
    upsertPropertyMeta("og:locale", "zh_CN");
    upsertNamedMeta("twitter:card", "summary");
    upsertNamedMeta("twitter:title", metadata.title);
    upsertNamedMeta("twitter:description", metadata.description);
  }, [canonicalUrl, metadata.description, metadata.title]);
}

export function formatProbeCompatibilityMode(mode: ProbeResolvedCompatibilityMode | null | undefined) {
  return mode ? PROBE_COMPATIBILITY_LABELS[mode] : "未识别";
}

export function formatProbeScanMode(mode: PublicProbeScanMode | undefined) {
  if (mode === "deep") {
    return "深度兼容扫描";
  }

  return "标准测试";
}

export function formatProbeDetectionMode(mode: ProbeDetectionMode | undefined) {
  if (mode === "manual") {
    return "手动指定";
  }

  return "自动识别";
}

export function formatDateTime(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return typeof value === "string" ? value : "";
  }

  return date.toLocaleString("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
    hour12: false,
    timeZone: "Asia/Shanghai",
  });
}

export function formatDate(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return typeof value === "string" ? value : "";
  }

  return date.toLocaleDateString("zh-CN", {
    month: "numeric",
    day: "numeric",
    timeZone: "Asia/Shanghai",
  });
}

export function formatHealthStatusLabel(status: string) {
  return (
    {
      healthy: "健康",
      degraded: "降级",
      down: "不可用",
      paused: "已暂停",
      unknown: "未知",
    }[status] ?? status
  );
}

export function formatSupportStatusLabel(status: string) {
  return (
    {
      active: "可用",
      degraded: "降级",
      pending: "待确认",
      paused: "已暂停",
      retired: "已退役",
      archived: "已归档",
      unknown: "未知",
    }[status] ?? status
  );
}

export function formatBadgeLabel(badge: string) {
  return (
    {
      "low-latency": "低延迟",
      "high-stability": "高稳定",
      "high-value": "高性价比",
      "sample-size-low": "样本偏少",
      "under-observation": "观察中",
    }[badge] ?? badge
  );
}

export function formatProbeMeasuredAt(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return formatDateTime(date);
}

export function formatProbeHttpStatus(value: number | null | undefined) {
  return value ? String(value) : "无";
}

export function formatAvailability(value: number) {
  return `${(value * 100).toFixed(2)}%`;
}

export function formatLatency(value: number | null) {
  return value === null ? "无数据" : `${value} ms`;
}

export function formatPricePerMillion(value: number | null, currency = "USD") {
  if (value === null) {
    return "-";
  }

  const digits = value >= 100 ? 0 : value >= 10 ? 1 : value >= 1 ? 2 : 3;
  const amount = value.toFixed(digits);
  return currency === "USD" ? `$${amount}` : `${currency} ${amount}`;
}

export function getStatusToneClass(status: string) {
  return status === "healthy"
    ? "bg-emerald-500"
    : status === "degraded"
      ? "bg-amber-500"
      : status === "down"
        ? "bg-red-500"
        : "bg-zinc-400";
}

export function getAvailabilityTrendStatus(availability: number): HealthStatus {
  if (availability >= 0.995) {
    return "healthy";
  }

  if (availability >= 0.97) {
    return "degraded";
  }

  if (availability > 0) {
    return "down";
  }

  return "unknown";
}

export function formatScoreMetricLabel(label: keyof RelayOverviewResponse["scoreSummary"]) {
  return (
    {
      total: "总分",
      availability: "可用性",
      latency: "延迟",
      consistency: "一致性",
      value: "性价比",
      stability: "稳定性",
      credibility: "可信度",
    }[label] ?? label
  );
}

export function formatIncidentSeverityLabel(severity: string) {
  return (
    {
      degraded: "降级",
      down: "中断",
      paused: "已暂停",
      unknown: "待确认",
    }[severity] ?? severity
  );
}

export function getIncidentToneClasses(severity: string) {
  return severity === "down"
    ? "border-[#b42318]/20 bg-[#fff2ef] text-[#8d2d17]"
    : severity === "degraded"
      ? "border-[#b54708]/20 bg-[#fff7e8] text-[#8a450c]"
      : severity === "paused"
        ? "border-black/12 bg-black/[0.03] text-black/72"
      : "border-black/10 bg-white/72 text-black/70";
}

export function formatPricingSourceLabel(source: RelayPricingHistoryResponse["rows"][number]["source"]) {
  return (
    {
      manual: "人工维护",
      scraped: "抓取同步",
      detected: "测试发现",
      api: "接口同步",
    }[source] ?? source
  );
}

export type DailyHistorySlot = {
  dateKey: string;
  point: RelayHistoryResponse["points"][number] | null;
};

export type RelayModelPricingRow = RelayModelsResponse["rows"][number] & {
  currentPrice: RelayPricingHistoryResponse["rows"][number] | null;
};

export type RelayModelHealthRow = RelayModelHealthResponse["rows"][number];

export function getIsoDateKey(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())).toISOString().slice(0, 10);
}

export function buildDailyHistorySlots(
  points: RelayHistoryResponse["points"],
  measuredAt: string,
  dayCount = THIRTY_DAY_BAR_COUNT,
): DailyHistorySlot[] {
  const pointByDateKey = new Map<string, RelayHistoryResponse["points"][number]>();

  for (const point of points) {
    const dateKey = getIsoDateKey(point.bucketStart);

    if (dateKey) {
      pointByDateKey.set(dateKey, point);
    }
  }

  const measuredDateKey = getIsoDateKey(measuredAt);
  const latestPointDateKey = [...pointByDateKey.keys()].sort().at(-1) ?? null;
  const anchorDate = measuredDateKey ?? latestPointDateKey ?? getIsoDateKey(new Date()) ?? new Date().toISOString().slice(0, 10);
  const anchor = new Date(`${anchorDate}T00:00:00.000Z`);

  return Array.from({ length: dayCount }, (_, index) => {
    const slotDate = new Date(anchor);
    slotDate.setUTCDate(anchor.getUTCDate() - (dayCount - index - 1));
    const dateKey = slotDate.toISOString().slice(0, 10);

    return {
      dateKey,
      point: pointByDateKey.get(dateKey) ?? null,
    };
  });
}

export function getLatencyToneColor(latencyMs: number | null) {
  if (latencyMs === null) {
    return "#d4d4d8";
  }

  if (latencyMs < 1000) {
    return "#10b981";
  }

  if (latencyMs < 2000) {
    return "#facc15";
  }

  if (latencyMs < 4000) {
    return "#f97316";
  }

  return "#ef4444";
}

export function getStatusToneColor(status: string) {
  return status === "healthy"
    ? "#10b981"
    : status === "degraded"
      ? "#f59e0b"
      : status === "down"
        ? "#ef4444"
        : "#d4d4d8";
}

export function getModelVendorKey(modelKey: string) {
  return modelKey.split("-")[0] ?? "other";
}

export function getModelVendorLabel(modelKey: string) {
  const vendorKey = getModelVendorKey(modelKey);
  return LEADERBOARD_VENDOR_LABELS[vendorKey] ?? vendorKey.replace(/^\w/, (char) => char.toUpperCase());
}

export function getLeaderboardPath(modelKey: string) {
  return `/leaderboard/${modelKey}`;
}

export type LoadableCacheEntry<T> = {
  data?: T;
  error?: string;
  promise?: Promise<T>;
  updatedAt: number;
};

export const loadableCache = new Map<string, LoadableCacheEntry<unknown>>();

export function getLoadableCacheEntry<T>(key: string) {
  return loadableCache.get(key) as LoadableCacheEntry<T> | undefined;
}

export function getCachedLoadableState<T>(key: string) {
  const entry = getLoadableCacheEntry<T>(key);

  if (!entry) {
    return {
      data: null,
      error: null,
      hasFreshData: false,
      hasAnyData: false,
    };
  }

  const hasAnyData = entry.data !== undefined;
  const hasFreshData = Date.now() - entry.updatedAt < LOADABLE_CACHE_MAX_AGE_MS;

  return {
    data: (entry.data as T | undefined) ?? null,
    error: entry.error ?? null,
    hasFreshData,
    hasAnyData,
  };
}

export function primeLoadableCache<T>(key: string, loader: () => Promise<T>) {
  const cachedEntry = getLoadableCacheEntry<T>(key);

  if (cachedEntry?.promise) {
    return cachedEntry.promise;
  }

  const promise = loader()
    .then((value) => {
      loadableCache.set(key, {
        data: value,
        updatedAt: Date.now(),
      });

      return value;
    })
    .catch((reason: unknown) => {
      const error = reason instanceof Error ? reason.message : "未知错误";

      loadableCache.set(key, {
        error,
        updatedAt: Date.now(),
      });

      throw new Error(error);
    });

  loadableCache.set(key, {
    ...cachedEntry,
    promise,
    updatedAt: cachedEntry?.updatedAt ?? 0,
  });

  return promise;
}

export function prefetchPublicRoute(target: string) {
  let url: URL;

  try {
    url = new URL(target, "https://relaynew.ai");
  } catch {
    return;
  }

  const pathname = url.pathname;
  const limit = url.searchParams.get("limit") ?? "20";

  const prefetches: Array<[string, () => Promise<unknown>]> = [];

  if (pathname === "/") {
    prefetches.push(["/public/home-summary", () => fetchJson("/public/home-summary")]);
  } else if (pathname === LEADERBOARD_DIRECTORY_PATH || pathname === "/leaderboard/directory") {
    prefetches.push(
      ["/public/leaderboard-directory", () => fetchJson("/public/leaderboard-directory")],
    );
  } else if (pathname.startsWith("/leaderboard/")) {
    const modelKey = pathname.slice("/leaderboard/".length);

    if (modelKey && modelKey !== "directory") {
      prefetches.push(
        ["/public/leaderboard-directory", () => fetchJson("/public/leaderboard-directory")],
        [
          `/public/leaderboard/${modelKey}?limit=${limit}`,
          () => fetchJson(`/public/leaderboard/${modelKey}?limit=${limit}`),
        ],
      );
    }
  } else if (pathname.startsWith("/relay/")) {
    const slug = pathname.slice("/relay/".length);

    if (slug) {
      prefetches.push(
        [`/public/relay/${slug}/overview`, () => fetchJson(`/public/relay/${slug}/overview`)],
        [`/public/relay/${slug}/history?window=7d`, () => fetchJson(`/public/relay/${slug}/history?window=7d`)],
        [`/public/relay/${slug}/models`, () => fetchJson(`/public/relay/${slug}/models`)],
        [`/public/relay/${slug}/pricing-history`, () => fetchJson(`/public/relay/${slug}/pricing-history`)],
        [`/public/relay/${slug}/incidents?window=30d`, () => fetchJson(`/public/relay/${slug}/incidents?window=30d`)],
      );
    }
  } else if (pathname === "/methodology") {
    prefetches.push(["/public/methodology", () => fetchJson("/public/methodology")]);
  }

  for (const [key, loader] of prefetches) {
    const cached = getCachedLoadableState(key);

    if (cached.hasFreshData) {
      continue;
    }

    void primeLoadableCache(key, loader).catch(() => undefined);
  }
}

export function getResolvableTarget(to: RouterLinkProps["to"] | RouterNavLinkProps["to"]) {
  if (typeof to === "string") {
    return to;
  }

  const pathname = to.pathname ?? "";
  const search = typeof to.search === "string" ? to.search : "";
  const hash = typeof to.hash === "string" ? to.hash : "";

  return pathname ? `${pathname}${search}${hash}` : null;
}

export type PrefetchableLinkHandlers = {
  onMouseEnter: React.MouseEventHandler<HTMLAnchorElement> | undefined;
  onFocus: React.FocusEventHandler<HTMLAnchorElement> | undefined;
  onTouchStart: React.TouchEventHandler<HTMLAnchorElement> | undefined;
  onMouseDown: React.MouseEventHandler<HTMLAnchorElement> | undefined;
};

export function createPrefetchHandlers<T extends PrefetchableLinkHandlers>(
  target: string | null,
  props: T,
) {
  const triggerPrefetch = () => {
    if (target) {
      prefetchPublicRoute(target);
    }
  };

  return {
    onMouseEnter: (event: React.MouseEvent<HTMLAnchorElement>) => {
      triggerPrefetch();
      props.onMouseEnter?.(event);
    },
    onFocus: (event: React.FocusEvent<HTMLAnchorElement>) => {
      triggerPrefetch();
      props.onFocus?.(event);
    },
    onTouchStart: (event: React.TouchEvent<HTMLAnchorElement>) => {
      triggerPrefetch();
      props.onTouchStart?.(event);
    },
    onMouseDown: (event: React.MouseEvent<HTMLAnchorElement>) => {
      triggerPrefetch();
      props.onMouseDown?.(event);
    },
  };
}

export function Link(props: RouterLinkProps) {
  const target = getResolvableTarget(props.to);
  const prefetchHandlers = createPrefetchHandlers(target, {
    onMouseEnter: props.onMouseEnter,
    onFocus: props.onFocus,
    onTouchStart: props.onTouchStart,
    onMouseDown: props.onMouseDown,
  });

  return <RouterLink {...props} {...prefetchHandlers} viewTransition={props.viewTransition ?? true} />;
}

export function NavLink(props: RouterNavLinkProps) {
  const target = getResolvableTarget(props.to);
  const prefetchHandlers = createPrefetchHandlers(target, {
    onMouseEnter: props.onMouseEnter,
    onFocus: props.onFocus,
    onTouchStart: props.onTouchStart,
    onMouseDown: props.onMouseDown,
  });

  return <RouterNavLink {...props} {...prefetchHandlers} viewTransition={props.viewTransition ?? true} />;
}

export function getProbeResultTone(result: PublicProbeResponse) {
  if (!result.connectivity.ok) {
    return {
      label: "连通性失败",
      description: "该站点未通过基础网络检查。请重新核对上游地址、认证信息和网络路径。",
      className: "border-[#b42318]/20 bg-[#fff2ef] text-[#8d2d17]",
    };
  }

  if (!result.protocol.ok || result.protocol.healthStatus === "down") {
    return {
      label: "协议检查失败",
      description: "端点有响应，但兼容性测试没有拿到有效且健康的协议返回。",
      className: "border-[#b42318]/20 bg-[#fff2ef] text-[#8d2d17]",
    };
  }

  if (result.protocol.healthStatus === "degraded" || !result.ok) {
    return {
      label: "协议状态降级",
      description: "该站点可以访问，但测试发现当前兼容协议形态对应的上游状态已降级。",
      className: "border-[#b54708]/20 bg-[#fff7e8] text-[#8a450c]",
    };
  }

  if (result.scanMode === "deep") {
    return {
      label: "深度扫描完成",
      description: result.matchedModes.length > 1
        ? `已确认 ${result.matchedModes.length} 种可用兼容模式。`
        : "已确认当前至少存在一种可用兼容模式。",
      className: "border-[#027a48]/20 bg-[#edfdf3] text-[#066649]",
    };
  }

  return {
    label: "测试通过",
    description: "连通性、协议校验与兼容模式识别都已针对所选模型成功完成。",
    className: "border-[#027a48]/20 bg-[#edfdf3] text-[#066649]",
  };
}

export function getConnectivityCardTone(ok: boolean) {
  return ok ? "border-emerald-700/12 bg-emerald-50/70" : "border-[#b42318]/15 bg-[#fff2ef]";
}

export function getProtocolCardTone(status: PublicProbeResponse["protocol"]["healthStatus"], ok: boolean) {
  if (!ok || status === "down") {
    return "border-[#b42318]/15 bg-[#fff2ef]";
  }

  if (status === "degraded") {
    return "border-[#b54708]/15 bg-[#fff7e8]";
  }

  return "border-emerald-700/12 bg-emerald-50/70";
}

export function getTraceCardTone(httpStatus: number | null, matched: boolean) {
  if (matched) {
    return "border-emerald-700/12 bg-emerald-50/70 text-[#0b5c3b]";
  }

  if (httpStatus !== null && httpStatus >= 200 && httpStatus < 300) {
    return "border-[#b54708]/15 bg-[#fff7e8] text-[#8a450c]";
  }

  if (httpStatus === 400 || httpStatus === 404 || httpStatus === 405 || httpStatus === 415) {
    return "border-[#b54708]/15 bg-[#fff7e8] text-[#8a450c]";
  }

  if (httpStatus !== null && (httpStatus === 401 || httpStatus === 403 || httpStatus === 429 || httpStatus >= 500)) {
    return "border-[#b42318]/15 bg-[#fff2ef] text-[#8d2d17]";
  }

  return "border-black/10 bg-white/75 text-black/72";
}

export function formatProbeTraceStatus(httpStatus: number | null, matched: boolean) {
  if (matched) {
    return "已匹配";
  }

  if (httpStatus !== null && httpStatus >= 200 && httpStatus < 300) {
    return `HTTP ${httpStatus} · 未匹配`;
  }

  return httpStatus ? `HTTP ${httpStatus}` : "无响应";
}

export function getProbeFailureGuidance(result: PublicProbeResponse) {
  if (result.ok) {
    return null;
  }

  const status = result.protocol.httpStatus ?? null;
  const message = result.message?.toLowerCase() ?? "";

  if (!result.connectivity.ok || status === null) {
    return {
      source: "网络或目标可达性",
      meaning: "公开测试未能完成有效的上游 HTTP 交互。",
      nextStep: "请检查 DNS、HTTPS 是否可用、主机是否被允许访问，以及 base URL 是否能从公网正常连通。",
    };
  }

  if (status === 400) {
    return {
      source: "上游 API 返回 HTTP 400",
      meaning: "该站点可访问，但它拒绝了当前适配器或模型对应的请求结构。",
      nextStep: result.detectionMode === "auto"
        ? "建议尝试手动指定兼容模式。如果站点兼容 OpenAI，但不支持 Responses，可切换到 Chat Completions。"
        : "请重新核对所选兼容模式、模型可用性，以及 base URL 是否已经包含 `/openai` 或 `/v1` 前缀。",
    };
  }

  if (status === 401 || status === 403) {
    return {
      source: "上游 API 鉴权失败",
      meaning: "端点有响应，但提交的密钥被拒绝，或没有当前路由 / 模型所需权限。",
      nextStep: "请检查密钥本身、账号权限，以及该兼容模式是否要求使用不同的认证头。",
    };
  }

  if (status === 404) {
    return {
      source: "上游路由不匹配",
      meaning: "该站点有响应，但当前测试的兼容路径不存在。",
      nextStep: result.detectionMode === "auto"
        ? "建议尝试手动指定兼容模式，或调整 base URL，让测试能拼出正确的 `/v1` 路径。"
        : "请检查 base URL 是否已经包含 `/v1`、`/openai` 或其他服务商专用前缀。",
    };
  }

  if (status === 405) {
    return {
      source: "上游请求方法不匹配",
      meaning: "目标路由存在，但不接受当前适配器使用的请求方法。",
      nextStep: "请再次确认所选兼容模式是否与该服务商及端点族匹配。",
    };
  }

  if (status === 415) {
    return {
      source: "上游内容协商失败",
      meaning: "该端点拒绝了当前适配器使用的 content-type 或流式请求格式。",
      nextStep: "请尝试其他兼容模式，或确认该服务是否要求非流式请求变体。",
    };
  }

  if (status === 429) {
    return {
      source: "上游触发限流",
      meaning: "该站点可以访问，但服务商当前正在对测试请求进行限流。",
      nextStep: "请在冷却时间后重试，或改用仍有配额的密钥与模型。",
    };
  }

  if (status >= 500) {
    if (message.includes("当前模型可能不支持这种协议形态")) {
      return {
        source: "上游协议转换未实现",
        meaning: "该站点存在当前协议路由，但当前模型在这个协议形态下不可用。",
        nextStep: "请改用其他兼容模式，或更换在该协议下已实现支持的模型后再试。",
      };
    }

    return {
      source: "上游服务错误",
      meaning: "该站点已接收请求，但在处理时发生了内部错误。",
      nextStep: "建议稍后重试，或将测得状态与端点路径反馈给站点运营者。",
    };
  }

  if (message.includes("未观测到可见文本输出")) {
    return {
      source: "文本输出异常",
      meaning: "该模式已经命中协议，但本次没有观测到可见文本输出，不能视为真正可用。",
      nextStep: "请改用其他兼容模式，或提高输出预算后复测，确认站点是否能稳定返回文本内容。",
    };
  }

  return {
    source: `上游 API 返回 HTTP ${status}`,
    meaning: "请求已到达站点，但上游响应与所选兼容协议形态不匹配。",
    nextStep: "请核对 base URL、兼容模式和模型支持情况，再用最可能正确的适配器重试。",
  };
}

export type ApiErrorPayload = {
  message?: string | string[];
};

export function formatApiErrorPayload(payload: ApiErrorPayload | null) {
  if (!payload?.message) {
    return null;
  }

  return Array.isArray(payload.message) ? payload.message.join("; ") : payload.message;
}

export async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (typeof init?.body !== "undefined" && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
  });

  if (!response.ok) {
    const contentType = response.headers.get("content-type") ?? "";

    if (contentType.includes("application/json")) {
      const payload = (await response.json()) as ApiErrorPayload;
      throw new Error(formatApiErrorPayload(payload) ?? `请求失败，状态码 ${response.status}`);
    }

    const text = await response.text();
    throw new Error(text || `请求失败，状态码 ${response.status}`);
  }

  return (await response.json()) as T;
}

export function isValidHttpUrl(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export type SubmitFormState = {
  relayName: string;
  baseUrl: string;
  websiteUrl: string;
  contactInfo: string;
  description: string;
  testApiKey: string;
  compatibilityMode: ProbeCompatibilityMode;
  modelPrices: Array<{
    id: string;
    modelKey: string;
    inputPricePer1M: string;
    outputPricePer1M: string;
  }>;
};

export type SubmitFormErrors = Partial<Record<"relayName" | "baseUrl" | "websiteUrl" | "contactInfo" | "description" | "testApiKey" | "modelPrices", string>>;

export function createSubmitModelPriceRow(index = 0) {
  return {
    id: `submit-model-price-${Date.now()}-${index}`,
    modelKey: "",
    inputPricePer1M: "",
    outputPricePer1M: "",
  };
}

export function validateSubmitForm(state: SubmitFormState) {
  const errors: SubmitFormErrors = {};
  const relayName = state.relayName.trim();
  const baseUrl = state.baseUrl.trim();
  const websiteUrl = state.websiteUrl.trim();
  const contactInfo = state.contactInfo.trim();
  const description = state.description.trim();
  const testApiKey = state.testApiKey.trim();
  const modelPrices = state.modelPrices.map((row) => ({
    modelKey: row.modelKey.trim(),
    inputPricePer1M: row.inputPricePer1M.trim() ? Number(row.inputPricePer1M.trim()) : null,
    outputPricePer1M: row.outputPricePer1M.trim() ? Number(row.outputPricePer1M.trim()) : null,
  }));

  if (!relayName) {
    errors.relayName = "请填写大模型API服务站名称。";
  }

  if (!baseUrl) {
    errors.baseUrl = "请填写基础 URL。";
  } else if (!isValidHttpUrl(baseUrl) || !baseUrl.startsWith("https://")) {
    errors.baseUrl = "请输入完整的 HTTPS 基础 URL，例如 https://relay.example.ai/v1。";
  }

  if (websiteUrl && !isValidHttpUrl(websiteUrl)) {
    errors.websiteUrl = "请输入有效的网站地址，例如 https://relay.example.ai。";
  }

  if (!contactInfo) {
    errors.contactInfo = "请填写联系方式。";
  }

  if (!description) {
    errors.description = "请补充简要说明，帮助审核队列快速理解这个站点。";
  }

  if (!testApiKey) {
    errors.testApiKey = "初始测试需要测试API Key。";
  }

  if (modelPrices.length === 0) {
    errors.modelPrices = "请至少填写一条模型价格信息。";
  } else {
    for (const row of modelPrices) {
      if (!row.modelKey) {
        errors.modelPrices = "请为每一行填写模型。";
        break;
      }

      if (row.inputPricePer1M !== null && (Number.isNaN(row.inputPricePer1M) || row.inputPricePer1M < 0)) {
        errors.modelPrices = "Input价格必须是大于或等于 0 的数字。";
        break;
      }

      if (row.outputPricePer1M !== null && (Number.isNaN(row.outputPricePer1M) || row.outputPricePer1M < 0)) {
        errors.modelPrices = "Output价格必须是大于或等于 0 的数字。";
        break;
      }

      if (row.inputPricePer1M === null && row.outputPricePer1M === null) {
        errors.modelPrices = "每一行至少填写一个价格字段。";
        break;
      }
    }
  }

  return {
    errors,
    payload: {
      relayName,
      baseUrl,
      websiteUrl: websiteUrl || undefined,
      contactInfo,
      description,
      modelPrices,
      testApiKey,
      compatibilityMode: state.compatibilityMode,
    },
  };
}

export type ProbeFormState = {
  baseUrl: string;
  apiKey: string;
  model: string;
  compatibilityMode: ProbeCompatibilityMode;
};

export const DEFAULT_PROBE_STATE: ProbeFormState = {
  baseUrl: "",
  apiKey: "",
  model: "",
  compatibilityMode: "auto",
};

export function isProbeCompatibilityMode(value: string | null): value is ProbeCompatibilityMode {
  return PROBE_COMPATIBILITY_OPTIONS.some((option) => option.value === value);
}

export function getProbeStateFromSearchParams(searchParams: URLSearchParams): ProbeFormState {
  const compatibilityMode = searchParams.get("compatibilityMode");

  return {
    baseUrl: searchParams.get("baseUrl") ?? DEFAULT_PROBE_STATE.baseUrl,
    apiKey: "",
    model: searchParams.get("model") ?? DEFAULT_PROBE_STATE.model,
    compatibilityMode: isProbeCompatibilityMode(compatibilityMode)
      ? compatibilityMode
      : DEFAULT_PROBE_STATE.compatibilityMode,
  };
}

export function useProbeController(initialState: ProbeFormState = DEFAULT_PROBE_STATE) {
  const [state, setState] = useState<ProbeFormState>(() => ({ ...initialState }));
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<PublicProbeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");

  async function submitProbe(scanMode: PublicProbeScanMode) {
    setSubmitting(true);
    setError(null);
    setResult(null);
    setCopyState("idle");
    try {
      const response = await fetchJson<PublicProbeResponse>("/public/probe/check", {
        method: "POST",
        body: JSON.stringify({
          ...state,
          scanMode,
        }),
      });
      setResult(response);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "测试失败。");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submitProbe("standard");
  }

  async function handleDeepScan() {
    await submitProbe("deep");
  }

  async function handleCopyUsedUrl() {
    if (!result?.usedUrl) {
      return;
    }

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(result.usedUrl);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = result.usedUrl;
        textarea.setAttribute("readonly", "true");
        textarea.style.position = "absolute";
        textarea.style.left = "-9999px";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  }

  useEffect(() => {
    if (copyState === "idle") {
      return undefined;
    }

    const timer = window.setTimeout(() => setCopyState("idle"), 1800);
    return () => window.clearTimeout(timer);
  }, [copyState]);

  const resultTone = useMemo(() => (result ? getProbeResultTone(result) : null), [result]);
  const failureGuidance = useMemo(() => (result ? getProbeFailureGuidance(result) : null), [result]);
  const attemptTrace = result?.attemptTrace ?? [];

  return {
    attemptTrace,
    copyState,
    error,
    failureGuidance,
    handleDeepScan,
    handleCopyUsedUrl,
    handleSubmit,
    result,
    resultTone,
    setState,
    state,
    submitting,
  };
}

export function useLoadable<T>(cacheKey: string | null, loader: () => Promise<T>, deps: unknown[]) {
  const initialState = cacheKey
    ? getCachedLoadableState<T>(cacheKey)
    : { data: null, error: null, hasFreshData: false, hasAnyData: false };
  const [data, setData] = useState<T | null>(initialState.data);
  const [loading, setLoading] = useState(!initialState.hasAnyData && !initialState.error);
  const [error, setError] = useState<string | null>(initialState.error);

  useEffect(() => {
    let active = true;
    const cachedState = cacheKey
      ? getCachedLoadableState<T>(cacheKey)
      : { data: null, error: null, hasFreshData: false, hasAnyData: false };

    if (cachedState.hasAnyData) {
      setData(cachedState.data);
      setError(null);
      setLoading(false);

      if (cachedState.hasFreshData) {
        return () => {
          active = false;
        };
      }
    } else if (cachedState.error) {
      setData(null);
      setError(cachedState.error);

      if (cachedState.hasFreshData) {
        setLoading(false);
        return () => {
          active = false;
        };
      }

      setLoading(true);
    } else {
      setLoading(true);
      setError(null);
    }

    const request = cacheKey ? primeLoadableCache(cacheKey, loader) : loader();

    request
      .then((value) => {
        if (active) {
          setData(value);
          setError(null);
        }
      })
      .catch((reason: unknown) => {
        if (active) {
          setError(reason instanceof Error ? reason.message : "未知错误");
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

  return { data, loading, error };
}
