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
  type PublicProbeResponse,
  type RelayHistoryResponse,
  type RelayIncidentsResponse,
  type RelayModelsResponse,
  type RelayOverviewResponse,
  type RelayPricingHistoryResponse,
  type PublicSubmissionResponse,
} from "@relaynews/shared";
import { createPortal } from "react-dom";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { useEffect, useMemo, useRef, useState } from "react";
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
import rebaseLogoUrl from "./assets/rebase-logo-wordmark-white-text.svg";

export { clsx, useEffect, useLocation, useMemo, useNavigate, useParams, useRef, useSearchParams, useState };
export type {
  HealthStatus,
  HomeSummaryResponse,
  LeaderboardDirectoryResponse,
  LeaderboardResponse,
  MethodologyResponse,
  ProbeCompatibilityMode,
  ProbeDetectionMode,
  ProbeResolvedCompatibilityMode,
  PublicProbeResponse,
  RelayHistoryResponse,
  RelayIncidentsResponse,
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
  "high-value": "相较同模型分类其他中转站，价格与质量的平衡更有竞争力。",
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
export const DEFAULT_LEADERBOARD_MODEL_KEY = "openai-gpt-5.4";
export const LEADERBOARD_DIRECTORY_PATH = "/leaderboard/directory";
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

export function GitHubIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg aria-hidden="true" fill="currentColor" viewBox="0 0 24 24" {...props}>
      <path d="M12 .5C5.65.5.5 5.66.5 12.02c0 5.09 3.29 9.4 7.85 10.92.57.1.78-.25.78-.56 0-.27-.01-1.17-.02-2.13-3.19.7-3.86-1.35-3.86-1.35-.52-1.33-1.28-1.68-1.28-1.68-1.04-.71.08-.69.08-.69 1.15.08 1.75 1.18 1.75 1.18 1.02 1.75 2.68 1.25 3.34.96.1-.74.4-1.25.72-1.54-2.55-.29-5.24-1.28-5.24-5.71 0-1.26.45-2.29 1.18-3.1-.12-.29-.51-1.47.11-3.06 0 0 .96-.31 3.15 1.18A10.94 10.94 0 0 1 12 6.34c.97 0 1.95.13 2.86.39 2.18-1.49 3.14-1.18 3.14-1.18.62 1.59.23 2.77.11 3.06.74.81 1.18 1.84 1.18 3.1 0 4.44-2.69 5.41-5.26 5.7.41.35.78 1.03.78 2.08 0 1.5-.01 2.7-.01 3.06 0 .31.2.67.79.56a11.52 11.52 0 0 0 7.84-10.92C23.5 5.66 18.35.5 12 .5Z" />
    </svg>
  );
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
  return modelKey === DEFAULT_LEADERBOARD_MODEL_KEY ? "/leaderboard" : `/leaderboard/${modelKey}`;
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
  } else if (pathname === "/leaderboard") {
    prefetches.push(
      ["/public/leaderboard-directory", () => fetchJson("/public/leaderboard-directory")],
      [
        `/public/leaderboard/${DEFAULT_LEADERBOARD_MODEL_KEY}?limit=${limit}`,
        () => fetchJson(`/public/leaderboard/${DEFAULT_LEADERBOARD_MODEL_KEY}?limit=${limit}`),
      ],
    );
  } else if (pathname === LEADERBOARD_DIRECTORY_PATH) {
    prefetches.push(["/public/leaderboard-directory", () => fetchJson("/public/leaderboard-directory")]);
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
  if (matched || (httpStatus !== null && httpStatus >= 200 && httpStatus < 300)) {
    return "border-emerald-700/12 bg-emerald-50/70 text-[#0b5c3b]";
  }

  if (httpStatus === 400 || httpStatus === 404 || httpStatus === 405 || httpStatus === 415) {
    return "border-[#b54708]/15 bg-[#fff7e8] text-[#8a450c]";
  }

  if (httpStatus !== null && (httpStatus === 401 || httpStatus === 403 || httpStatus === 429 || httpStatus >= 500)) {
    return "border-[#b42318]/15 bg-[#fff2ef] text-[#8d2d17]";
  }

  return "border-black/10 bg-white/75 text-black/72";
}

export function getProbeFailureGuidance(result: PublicProbeResponse) {
  if (result.ok) {
    return null;
  }

  const status = result.protocol.httpStatus ?? null;

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
    return {
      source: "上游服务错误",
      meaning: "该站点已接收请求，但在处理时发生了内部错误。",
      nextStep: "建议稍后重试，或将测得状态与端点路径反馈给站点运营者。",
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
    errors.relayName = "请填写中转站名称。";
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

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setResult(null);
    setCopyState("idle");
    try {
      const response = await fetchJson<PublicProbeResponse>("/public/probe/check", {
        method: "POST",
        body: JSON.stringify(state),
      });
      setResult(response);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "测试失败。");
    } finally {
      setSubmitting(false);
    }
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
    handleCopyUsedUrl,
    handleSubmit,
    result,
    resultTone,
    setState,
    state,
    submitting,
  };
}

export function ProbeFormFields({
  state,
  setState,
  compact = false,
  showHelpers = true,
}: {
  state: ProbeFormState;
  setState: React.Dispatch<React.SetStateAction<ProbeFormState>>;
  compact?: boolean;
  showHelpers?: boolean;
}) {
  const fields = [
    ["Base URL", "baseUrl"],
    ["API Key", "apiKey"],
    ["模型", "model"],
  ] as const;

  return (
    <>
      {fields.map(([label, key]) => (
        <label
          key={key}
          className={clsx(
            "form-field",
            compact ? "form-field-inline quick-probe-field" : "block",
          )}
        >
          <span>{label}</span>
          <div>
            <input
              className={clsx("input-shell", compact ? "quick-probe-input" : "mt-2")}
              type={key === "apiKey" ? "password" : "text"}
              placeholder={PROBE_FIELD_META[key].placeholder}
              value={state[key]}
              onChange={(event) => setState((current) => ({ ...current, [key]: event.target.value }))}
              autoComplete={PROBE_FIELD_META[key].autoComplete}
              inputMode={PROBE_FIELD_META[key].inputMode}
              spellCheck={false}
              required
            />
            {showHelpers ? (
              <>
                <span className="input-helper input-helper-mobile">
                  {PROBE_FIELD_META[key].helperCompact}
                </span>
                <span className="input-helper input-helper-desktop">
                  {PROBE_FIELD_META[key].helper}
                </span>
              </>
            ) : null}
          </div>
        </label>
      ))}
    </>
  );
}

export function InlineProbeSummary({
  result,
  error,
  resultTone,
}: {
  result: PublicProbeResponse | null;
  error: string | null;
  resultTone: ReturnType<typeof getProbeResultTone> | null;
}) {
  if (error) {
    return (
      <p className="quick-probe-inline-summary quick-probe-inline-summary-error" role="alert">
        测试失败：{error}
      </p>
    );
  }

  if (!result || !resultTone) {
    return (
      <p className="quick-probe-inline-summary">
        测试完成后，这里会显示状态、延迟、HTTP 状态码与接口兼容类型。
      </p>
    );
  }

  const latencyText = result.connectivity.latencyMs ? `${result.connectivity.latencyMs} ms` : "延迟无数据";
  const httpText = `HTTP ${formatProbeHttpStatus(result.protocol.httpStatus)}`;
  const compatibilityText = formatProbeCompatibilityMode(result.compatibilityMode);

  return (
    <p className={clsx("quick-probe-inline-summary", resultTone.className)}>
      {resultTone.label} · {latencyText} · {httpText} · {compatibilityText}
    </p>
  );
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

export function AppShell({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const currentYear = new Date().getFullYear();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const navItems = [
    ["/", "首页"],
    ["/leaderboard", "榜单"],
    ["/methodology", "评测方式"],
    ["/submit", "提交站点"],
    ["/probe", "站点测试"],
  ] as const;

  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  return (
    <div className="site-shell min-h-screen bg-[var(--bg)] text-[var(--ink)]">
      <header className="site-header">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-10">
          <div className="site-header-bar">
            <Link to="/" className="site-brand">
              <div className="site-brand-mark">
                <span className="bg-[#ffd900]" />
                <span className="bg-[#ffa110]" />
                <span className="bg-[#fb6424]" />
                <span className="bg-[#fa520f]" />
              </div>
              <div>
                <span className="block">relaynew.ai</span>
                <span className="hidden text-[0.6rem] tracking-[0.2em] text-black/44 md:block">
                  relay 健康度、延迟、价格与可信度
                </span>
              </div>
            </Link>
            <button
              aria-controls="mobile-primary-nav"
              aria-expanded={mobileNavOpen}
              className="mobile-nav-toggle md:hidden"
              onClick={() => setMobileNavOpen((current) => !current)}
              type="button"
            >
              {mobileNavOpen ? "关闭菜单" : "打开菜单"}
            </button>
            <nav className="site-nav hidden md:flex md:flex-wrap md:items-center">
              {navItems.map(([to, label]) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    clsx("site-nav-link", isActive && "site-nav-link-active")
                  }
                >
                  {label}
                </NavLink>
              ))}
            </nav>
          </div>
        </div>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-10">
          {mobileNavOpen ? (
            <nav className="site-mobile-nav panel mt-3 md:hidden" id="mobile-primary-nav">
              {navItems.map(([to, label]) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    clsx(
                      "site-nav-link",
                      "justify-center text-center",
                      isActive && "site-nav-link-active",
                    )
                  }
                >
                  {label}
                </NavLink>
              ))}
            </nav>
          ) : null}
        </div>
      </header>
      <main className="site-main mx-auto max-w-7xl px-5 lg:px-10">{children}</main>
      <footer className="site-footer px-5 py-6 md:py-7 lg:px-10">
        <div className="site-footer-shell mx-auto max-w-7xl">
          <div className="site-footer-inline">
            <p className="site-footer-meta">© {currentYear} relaynew.ai</p>
            <div className="site-footer-link-list">
              <a
                aria-label="Rebase"
                className="site-footer-mark-link"
                href={REBASE_NETWORK_URL}
                rel="noreferrer"
                target="_blank"
              >
                <img alt="" aria-hidden="true" className="site-footer-mark-image" src={rebaseLogoUrl} />
              </a>
              <a
                aria-label="GitHub repository"
                className="site-footer-github"
                href={GITHUB_REPOSITORY_URL}
                rel="noreferrer"
                target="_blank"
              >
                <GitHubIcon className="site-footer-github-icon" />
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export function Panel({
  title,
  kicker,
  children,
  className,
  headerClassName,
  titleClassName,
  kickerClassName,
}: {
  title?: string;
  kicker?: string;
  children: React.ReactNode;
  className?: string;
  headerClassName?: string;
  titleClassName?: string;
  kickerClassName?: string;
}) {
  return (
    <section className={clsx("panel", className)}>
      {(kicker || title) && (
        <header className={clsx("mb-4", headerClassName)}>
          {kicker ? <p className={clsx("kicker", kickerClassName)}>{kicker}</p> : null}
          {title ? (
            <h2 className={clsx("text-3xl leading-[0.95] tracking-[-0.04em] md:text-[2.9rem]", titleClassName)}>
              {title}
            </h2>
          ) : null}
        </header>
      )}
      {children}
    </section>
  );
}

export function LoadingPanel() {
  return <div className="panel text-sm uppercase tracking-[0.15em] text-black/60">加载中...</div>;
}

export function ErrorPanel({ message }: { message: string }) {
  return <div className="panel border border-[#fa520f]/20 bg-[#fff0c2] text-sm text-[#7b3614]">{message}</div>;
}

export function SkeletonBlock({ className }: { className?: string }) {
  return <div aria-hidden="true" className={clsx("skeleton-block", className)} />;
}

export function HomePageSkeleton() {
  return (
    <div aria-busy="true" className="space-y-5">
      <section className="panel hero-panel min-h-0">
        <div className="grid gap-5 xl:grid-cols-[0.98fr_1.02fr] xl:items-start">
          <div className="space-y-4">
            <SkeletonBlock className="skeleton-kicker max-w-[8rem]" />
            <div className="space-y-3">
              <SkeletonBlock className="skeleton-heading-lg max-w-[30rem]" />
              <SkeletonBlock className="skeleton-heading-lg max-w-[26rem]" />
              <SkeletonBlock className="skeleton-heading-lg max-w-[18rem]" />
            </div>
            <div className="space-y-2">
              <SkeletonBlock className="skeleton-line max-w-[31rem]" />
              <SkeletonBlock className="skeleton-line max-w-[26rem]" />
            </div>
            <div className="flex flex-wrap gap-2.5">
              <SkeletonBlock className="skeleton-button w-[12.8rem]" />
              <SkeletonBlock className="skeleton-button w-[7rem]" />
              <SkeletonBlock className="skeleton-button w-[8.8rem]" />
            </div>
          </div>
          <div className="quick-probe-card quick-probe-form">
            <div className="quick-probe-header">
              <SkeletonBlock className="skeleton-kicker w-[7.5rem]" />
              <SkeletonBlock className="skeleton-pill w-[7.2rem]" />
            </div>
            <div className="space-y-3">
              {["基础 URL", "API 密钥", "目标模型"].map((label) => (
                <div key={label} className="form-field-inline quick-probe-field">
                  <SkeletonBlock className="skeleton-kicker h-4 w-[4.8rem]" />
                  <SkeletonBlock className="skeleton-input" />
                </div>
              ))}
            </div>
            <div className="quick-probe-footer">
              <SkeletonBlock className="skeleton-line max-w-[18rem]" />
              <SkeletonBlock className="skeleton-button w-[7.8rem]" />
            </div>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <SkeletonBlock className="skeleton-kicker max-w-[7rem]" />
            <SkeletonBlock className="skeleton-heading-md max-w-[17rem]" />
            <SkeletonBlock className="skeleton-line max-w-[30rem]" />
          </div>
          <SkeletonBlock className="skeleton-button w-[10rem]" />
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <LeaderboardPreviewSkeleton key={index} />
          ))}
        </div>
      </section>

      <section className="home-bridge">
        <SkeletonBlock className="skeleton-line max-w-[28rem]" />
        <div className="home-bridge-actions">
          <SkeletonBlock className="skeleton-pill w-[7.4rem]" />
          <SkeletonBlock className="skeleton-pill w-[5.8rem]" />
        </div>
      </section>

      <section className="panel">
        <div className="mb-4 space-y-2">
          <SkeletonBlock className="skeleton-kicker max-w-[7rem]" />
          <SkeletonBlock className="skeleton-heading-md max-w-[14rem]" />
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="surface-card p-3.5">
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-2">
                  <SkeletonBlock className="skeleton-line max-w-[9rem]" />
                  <SkeletonBlock className="skeleton-pill w-[5.2rem]" />
                </div>
                <SkeletonBlock className="skeleton-pill w-[5.8rem]" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export function LeaderboardPreviewSkeleton() {
  return (
    <section className="panel h-full">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <SkeletonBlock className="skeleton-kicker max-w-[11rem]" />
          <SkeletonBlock className="skeleton-heading-md max-w-[14rem]" />
          <SkeletonBlock className="skeleton-line max-w-[12rem]" />
        </div>
        <SkeletonBlock className="skeleton-pill w-[8.6rem]" />
      </div>
      <div className="mt-5 space-y-2.5">
        {Array.from({ length: HOME_LEADERBOARD_ROW_LIMIT }).map((_, index) => (
          <div key={index} className="surface-card p-3.5">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-2">
                <SkeletonBlock className="skeleton-kicker w-[2rem]" />
                <SkeletonBlock className="skeleton-line max-w-[11rem]" />
                <div className="flex flex-wrap gap-1.5">
                  <SkeletonBlock className="skeleton-pill w-[4.8rem]" />
                  <SkeletonBlock className="skeleton-pill w-[4.2rem]" />
                </div>
              </div>
              <div className="min-w-[8.5rem] space-y-2">
                <SkeletonBlock className="skeleton-pill ml-auto w-[6rem]" />
                <SkeletonBlock className="skeleton-line ml-auto max-w-[5rem]" />
                <SkeletonBlock className="skeleton-line ml-auto max-w-[7rem]" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function LeaderboardDirectorySkeleton() {
  return (
    <div aria-busy="true" className="space-y-6">
      <section className="panel bg-[#fff0c2]">
        <div className="grid gap-4 xl:grid-cols-[1fr_0.9fr] xl:items-end">
          <div className="space-y-3">
            <SkeletonBlock className="skeleton-kicker max-w-[10rem]" />
            <div className="space-y-3">
              <SkeletonBlock className="skeleton-heading-lg max-w-[29rem]" />
              <SkeletonBlock className="skeleton-heading-lg max-w-[24rem]" />
            </div>
            <SkeletonBlock className="skeleton-line max-w-[31rem]" />
          </div>
          <div className="flex flex-wrap gap-2.5 xl:justify-end">
            <SkeletonBlock className="skeleton-button w-[10.4rem]" />
            <SkeletonBlock className="skeleton-button w-[8.4rem]" />
          </div>
        </div>
      </section>

      <section className="directory-filters directory-filters-compact">
        <div className="directory-vendor-row">
          {Array.from({ length: 4 }).map((_, index) => (
            <SkeletonBlock key={index} className="skeleton-pill w-[5.5rem]" />
          ))}
        </div>
        <SkeletonBlock className="skeleton-line max-w-[10rem]" />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <LeaderboardPreviewSkeleton key={index} />
        ))}
      </div>
    </div>
  );
}

export function LeaderboardPageSkeleton() {
  return (
    <div aria-busy="true" className="space-y-6">
      <section className="panel bg-[#fff0c2]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <SkeletonBlock className="skeleton-kicker max-w-[8rem]" />
            <SkeletonBlock className="skeleton-heading-lg max-w-[18rem]" />
            <SkeletonBlock className="skeleton-line max-w-[14rem]" />
          </div>
          <div className="flex flex-wrap gap-2.5">
            <SkeletonBlock className="skeleton-button w-[10.8rem]" />
            <SkeletonBlock className="skeleton-button w-[8rem]" />
          </div>
        </div>
      </section>

      <section className="panel-soft border border-black/8 px-4 py-4">
        <div className="space-y-3">
          <div className="space-y-2">
            <SkeletonBlock className="skeleton-kicker max-w-[9rem]" />
            <SkeletonBlock className="skeleton-line max-w-[26rem]" />
          </div>
          <div className="leaderboard-model-switcher">
            {Array.from({ length: 6 }).map((_, index) => (
              <SkeletonBlock key={index} className="skeleton-pill w-[7rem]" />
            ))}
          </div>
        </div>
      </section>

      <section className="leaderboard-row-filters">
        <div className="leaderboard-row-filter-grid">
          <div className="space-y-2">
            <SkeletonBlock className="skeleton-kicker max-w-[8rem]" />
            <SkeletonBlock className="skeleton-input" />
          </div>
          <div className="space-y-2">
            <SkeletonBlock className="skeleton-kicker max-w-[4rem]" />
            <SkeletonBlock className="skeleton-input" />
          </div>
        </div>
        <div className="directory-vendor-row">
          {Array.from({ length: 3 }).map((_, index) => (
            <SkeletonBlock key={index} className="skeleton-pill w-[6.2rem]" />
          ))}
        </div>
        <SkeletonBlock className="skeleton-line max-w-[11rem]" />
      </section>

      <section className="panel">
        <div className="mb-4 space-y-2">
          <SkeletonBlock className="skeleton-kicker max-w-[8rem]" />
          <SkeletonBlock className="skeleton-heading-md max-w-[18rem]" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="surface-card p-4">
              <div className="grid gap-3 lg:grid-cols-[4.5rem_minmax(0,1.2fr)_minmax(0,0.8fr)_repeat(4,minmax(0,0.55fr))] lg:items-center">
                <SkeletonBlock className="skeleton-line max-w-[3rem]" />
                <div className="space-y-2">
                  <SkeletonBlock className="skeleton-line max-w-[11rem]" />
                  <div className="flex flex-wrap gap-2">
                    <SkeletonBlock className="skeleton-pill w-[4.4rem]" />
                    <SkeletonBlock className="skeleton-pill w-[5rem]" />
                  </div>
                </div>
                <SkeletonBlock className="skeleton-pill w-[5.8rem]" />
                <SkeletonBlock className="skeleton-line max-w-[4rem]" />
                <SkeletonBlock className="skeleton-line max-w-[4.6rem]" />
                <SkeletonBlock className="skeleton-line max-w-[4rem]" />
                <SkeletonBlock className="skeleton-line max-w-[4rem]" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export function RelayPageSkeleton() {
  return (
    <div aria-busy="true" className="space-y-6">
      <section className="panel bg-[linear-gradient(135deg,rgba(255,240,194,1),rgba(255,184,62,0.75))]">
        <div className="relative z-20 grid gap-4 lg:grid-cols-[minmax(0,1fr)_12rem] lg:items-start">
          <div className="space-y-4">
            <div className="space-y-3">
              <SkeletonBlock className="skeleton-pill w-[10rem]" />
              <div className="space-y-3">
                <SkeletonBlock className="skeleton-heading-lg max-w-[18rem]" />
                <SkeletonBlock className="skeleton-line max-w-[20rem]" />
                <SkeletonBlock className="skeleton-line max-w-[32rem]" />
              </div>
              <div className="flex flex-wrap gap-2">
                <SkeletonBlock className="skeleton-pill w-[5rem]" />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="metric-card">
                  <SkeletonBlock className="skeleton-kicker max-w-[6rem]" />
                  <SkeletonBlock className="skeleton-heading-md mt-4 max-w-[5rem]" />
                </div>
              ))}
            </div>
          </div>
          <div className="surface-card p-4">
            <SkeletonBlock className="skeleton-kicker max-w-[5rem]" />
            <SkeletonBlock className="skeleton-heading-md mt-3 max-w-[5.5rem]" />
            <div className="mt-4 space-y-2">
              {Array.from({ length: 5 }).map((_, index) => (
                <SkeletonBlock key={index} className="skeleton-line max-w-[8rem]" />
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <section className="panel">
          <div className="mb-4 space-y-2">
            <SkeletonBlock className="skeleton-kicker max-w-[8rem]" />
            <SkeletonBlock className="skeleton-heading-md max-w-[12rem]" />
          </div>
          <SkeletonBlock className="h-28 w-full" />
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <SkeletonBlock key={index} className="h-[4.2rem] w-full" />
            ))}
          </div>
        </section>
        <section className="panel">
          <div className="mb-4 space-y-2">
            <SkeletonBlock className="skeleton-kicker max-w-[6rem]" />
            <SkeletonBlock className="skeleton-heading-md max-w-[10rem]" />
          </div>
          <div className="grid grid-cols-5 gap-2">
            {Array.from({ length: 15 }).map((_, index) => (
              <SkeletonBlock key={index} className="h-10 w-full" />
            ))}
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {Array.from({ length: 2 }).map((_, index) => (
              <SkeletonBlock key={index} className="h-[4.2rem] w-full" />
            ))}
          </div>
        </section>
      </section>

      <section className="grid gap-4">
        <section className="panel">
          <div className="mb-4 space-y-2">
            <SkeletonBlock className="skeleton-kicker max-w-[8rem]" />
            <SkeletonBlock className="skeleton-heading-md max-w-[18rem]" />
          </div>
          <div className="space-y-2.5 lg:hidden">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="surface-card p-3.5">
                <div className="space-y-2">
                  <SkeletonBlock className="skeleton-line max-w-[10rem]" />
                  <SkeletonBlock className="skeleton-line max-w-[7rem]" />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <SkeletonBlock className="h-[4.3rem] w-full" />
                  <SkeletonBlock className="h-[4.3rem] w-full" />
                </div>
              </div>
            ))}
          </div>
          <div className="hidden lg:grid lg:grid-cols-2 lg:gap-4">
            {Array.from({ length: 2 }).map((_, tableIndex) => (
              <div key={tableIndex} className="space-y-2">
                <SkeletonBlock className="h-9 w-full" />
                {Array.from({ length: 4 }).map((_, index) => (
                  <SkeletonBlock key={index} className="h-14 w-full" />
                ))}
              </div>
            ))}
          </div>
        </section>
      </section>
    </div>
  );
}

export function MethodologyPageSkeleton() {
  return (
    <div aria-busy="true" className="space-y-6">
      <section className="panel bg-[#fff0c2]">
        <div className="grid gap-4 xl:grid-cols-[1.02fr_0.98fr]">
          <div className="space-y-3">
            <SkeletonBlock className="skeleton-kicker max-w-[8rem]" />
            <SkeletonBlock className="skeleton-heading-lg max-w-[26rem]" />
            <SkeletonBlock className="skeleton-heading-lg max-w-[20rem]" />
            <div className="space-y-2">
              <SkeletonBlock className="skeleton-line max-w-[30rem]" />
              <SkeletonBlock className="skeleton-line max-w-[24rem]" />
            </div>
            <div className="flex flex-wrap gap-2.5">
              <SkeletonBlock className="skeleton-button w-[11rem]" />
              <SkeletonBlock className="skeleton-button w-[8rem]" />
            </div>
          </div>
          <div className="surface-card p-4">
            <SkeletonBlock className="skeleton-kicker max-w-[9rem]" />
            <div className="mt-4 space-y-4">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex items-center justify-between gap-4">
                    <SkeletonBlock className="skeleton-line max-w-[8rem]" />
                    <SkeletonBlock className="skeleton-line max-w-[3rem]" />
                  </div>
                  <SkeletonBlock className="h-2.5 w-full" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[0.96fr_1.04fr]">
        <section className="panel">
          <div className="mb-4 space-y-2">
            <SkeletonBlock className="skeleton-kicker max-w-[8rem]" />
            <SkeletonBlock className="skeleton-heading-md max-w-[15rem]" />
          </div>
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="surface-card p-3.5">
                <SkeletonBlock className="skeleton-pill w-[6rem]" />
                <div className="mt-3 space-y-2">
                  <SkeletonBlock className="skeleton-line" />
                  <SkeletonBlock className="skeleton-line max-w-[90%]" />
                </div>
              </div>
            ))}
          </div>
        </section>
        <div className="space-y-4">
          <section className="panel">
            <div className="mb-4 space-y-2">
              <SkeletonBlock className="skeleton-kicker max-w-[8rem]" />
              <SkeletonBlock className="skeleton-heading-md max-w-[12rem]" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="surface-card p-3.5">
                  <SkeletonBlock className="skeleton-pill w-[5.5rem]" />
                  <div className="mt-3 space-y-2">
                    <SkeletonBlock className="skeleton-line" />
                    <SkeletonBlock className="skeleton-line max-w-[85%]" />
                  </div>
                </div>
              ))}
            </div>
          </section>
          <section className="panel">
            <div className="mb-4 space-y-2">
              <SkeletonBlock className="skeleton-kicker max-w-[8rem]" />
              <SkeletonBlock className="skeleton-heading-md max-w-[13rem]" />
            </div>
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="surface-card p-3.5">
                  <SkeletonBlock className="skeleton-line" />
                </div>
              ))}
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}

export function StatusDot({ status }: { status: string }) {
  return <span className={clsx("status-dot inline-block h-2.5 w-2.5", getStatusToneClass(status))} />;
}

export function MetricGrid({
  items,
  columnsClassName = "sm:grid-cols-2 xl:grid-cols-4",
}: {
  items: Array<{
    label: string;
    value: string | number;
    testId?: string;
    cardClassName?: string;
    valueClassName?: string;
    valueSpacingClassName?: string;
    valueTitle?: string;
  }>;
  columnsClassName?: string;
}) {
  return (
    <div className={clsx("grid gap-4", columnsClassName)}>
      {items.map((item) => (
        <div
          key={item.label}
          className={clsx("metric-card transition-colors", item.cardClassName)}
        >
          <p className="kicker">{item.label}</p>
          <p
            className={clsx(item.valueSpacingClassName ?? "mt-3", "tracking-[-0.04em]", item.valueClassName ?? "text-3xl")}
            data-testid={item.testId}
            title={item.valueTitle}
          >
            {item.value}
          </p>
        </div>
      ))}
    </div>
  );
}

export function CompactBadgeList({
  badges,
  limit = 2,
  className,
}: {
  badges: string[];
  limit?: number;
  className?: string;
}) {
  const visibleBadges = badges.slice(0, limit);
  const remainingCount = badges.length - visibleBadges.length;

  return (
    <div className={clsx("flex flex-wrap gap-1.5", className)}>
      {visibleBadges.map((badge) => (
        <span key={badge} className="signal-chip">
          {badge}
        </span>
      ))}
      {remainingCount > 0 ? <span className="signal-chip">+{remainingCount}</span> : null}
    </div>
  );
}

export function LeaderboardPreviewCard({
  board,
  rowLimit,
}: {
  board: HomeSummaryResponse["leaderboards"][number];
  rowLimit?: number;
}) {
  const rows = board.rows.slice(0, rowLimit ?? board.rows.length);

  return (
    <section className="panel leaderboard-preview-card h-full">
      <div className="leaderboard-preview-header">
        <div>
          <h2 className="leaderboard-preview-title">{board.modelName}</h2>
          <p className="leaderboard-preview-meta">最新快照 · {formatDateTime(board.measuredAt)}</p>
        </div>
        <Link className="leaderboard-preview-link" to={getLeaderboardPath(board.modelKey)}>
          查看完整榜单
        </Link>
      </div>
      <div className="leaderboard-preview-stack">
        {rows.map((row) => (
          <Link
            key={row.relay.slug}
            className="surface-link leaderboard-preview-row"
            to={`/relay/${row.relay.slug}`}
          >
            <div className="leaderboard-preview-main min-w-0">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <p className="text-[0.65rem] uppercase tracking-[0.18em] text-black/50">#{row.rank}</p>
                <p className="leaderboard-preview-name">{row.relay.name}</p>
              </div>
              <CompactBadgeList badges={row.badges.map(formatBadgeLabel)} className="leaderboard-preview-badges" limit={1} />
            </div>
            <div className="leaderboard-preview-score">
              <p className="leaderboard-preview-score-value">{row.score.toFixed(1)}</p>
              <div className="leaderboard-preview-scoreline">
                <StatusDot status={row.healthStatus} /> {formatHealthStatusLabel(row.healthStatus)}
              </div>
              <p className="leaderboard-preview-metrics">
                {formatAvailability(row.availability24h)} · {formatLatency(row.latencyP50Ms)}
              </p>
            </div>
          </Link>
        ))}
      </div>
      <p className="leaderboard-preview-snapshot">
        快照时间：{formatDateTime(board.measuredAt)}
      </p>
    </section>
  );
}

export function HomeIncidentCard({
  incident,
}: {
  incident: HomeSummaryResponse["latestIncidents"][number];
}) {
  const incidentOngoing = incident.endedAt === null;

  return (
    <Link
      className={clsx(
        "surface-link flex h-full flex-col justify-between gap-4 border p-4 transition-transform hover:-translate-y-[1px]",
        getIncidentToneClasses(incident.severity),
      )}
      to={`/relay/${incident.relay.slug}`}
    >
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="signal-chip bg-white/70">{formatIncidentSeverityLabel(incident.severity)}</span>
          <span className="text-[0.68rem] uppercase tracking-[0.16em] text-current/72">
            {incidentOngoing ? "仍在影响中" : "已记录"}
          </span>
        </div>
        <div>
          <p className="text-[1.08rem] tracking-[-0.03em] text-current">{incident.title}</p>
          <p className="mt-2 text-sm leading-6 text-current/82">{incident.summary}</p>
        </div>
      </div>
      <div className="space-y-2 text-sm leading-6 text-current/80">
        <p className="font-mono text-[0.64rem] uppercase tracking-[0.18em] text-current/64">
          {incident.relay.name}
        </p>
        <p>开始：北京时间 {formatDateTime(incident.startedAt)}</p>
        <p>
          {incidentOngoing
            ? "结束：仍在观察中"
            : `结束：北京时间 ${formatDateTime(incident.endedAt ?? incident.startedAt)}`}
        </p>
      </div>
    </Link>
  );
}

export function LeaderboardRowCard({ row }: { row: LeaderboardResponse["rows"][number] }) {
  return (
    <article className="surface-card leaderboard-mobile-row p-3.5 md:hidden">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.16em] text-black/55">#{row.rank}</p>
          <Link to={`/relay/${row.relay.slug}`} className="mt-1 block text-[1.5rem] leading-[0.96] tracking-[-0.04em] hover:underline">
            {row.relay.name}
          </Link>
          <CompactBadgeList badges={row.badges.map(formatBadgeLabel)} className="mt-3" />
        </div>
        <div className="shrink-0 text-right">
          <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-black/62">
            <StatusDot status={row.healthStatus} /> {formatHealthStatusLabel(row.healthStatus)}
          </div>
          <p className="mt-3 text-[2rem] leading-[0.94] tracking-[-0.05em]">{row.score.toFixed(1)}</p>
          <p className="text-[0.68rem] uppercase tracking-[0.18em] text-black/46">评分</p>
        </div>
      </div>
      <div className="mt-3.5 grid grid-cols-2 gap-2">
        <div className="border border-black/8 bg-white/72 px-3 py-2.5">
          <p className="text-[0.64rem] uppercase tracking-[0.18em] text-black/46">24h 可用性</p>
          <p className="mt-2 text-sm leading-5 text-black/78">{formatAvailability(row.availability24h)}</p>
        </div>
        <div className="border border-black/8 bg-white/72 px-3 py-2.5">
          <p className="text-[0.64rem] uppercase tracking-[0.18em] text-black/46">P50 延迟</p>
          <p className="mt-2 text-sm leading-5 text-black/78">{formatLatency(row.latencyP50Ms)}</p>
        </div>
        <div className="border border-black/8 bg-white/72 px-3 py-2.5">
          <p className="text-[0.64rem] uppercase tracking-[0.18em] text-black/46">输入价格 / 1M</p>
          <p className="mt-2 text-sm leading-5 text-black/78">{row.inputPricePer1M ?? "-"}</p>
        </div>
        <div className="border border-black/8 bg-white/72 px-3 py-2.5">
          <p className="text-[0.64rem] uppercase tracking-[0.18em] text-black/46">输出价格 / 1M</p>
          <p className="mt-2 text-sm leading-5 text-black/78">{row.outputPricePer1M ?? "-"}</p>
        </div>
      </div>
    </article>
  );
}


export type HistoryChartDatum = {
  dateKey: string;
  displayDate: string;
  value: number;
  fill: string;
  barTestId: string;
  tooltipValue: string;
  tooltipMeta?: string;
};

export function HistoryChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: HistoryChartDatum }>;
}) {
  const datum = payload?.[0]?.payload;

  if (!active || !datum) {
    return null;
  }

  return (
    <div className="surface-card min-w-[10rem] px-3 py-2.5 shadow-[rgba(127,99,21,0.16)_0_12px_28px]">
      <p className="font-mono text-[0.64rem] uppercase tracking-[0.18em] text-black/46">{datum.displayDate}</p>
      <p className="mt-2 text-sm text-black/78">{datum.tooltipValue}</p>
      {datum.tooltipMeta ? <p className="mt-1 text-xs text-black/56">{datum.tooltipMeta}</p> : null}
    </div>
  );
}

export function TimelineBarShape({
  x = 0,
  y = 0,
  width = 0,
  height = 0,
  fill = "#d4d4d8",
  payload,
}: {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  fill?: string;
  payload?: HistoryChartDatum;
}) {
  return (
    <rect
      data-testid={payload?.barTestId}
      fill={fill}
      height={Math.max(height, 1)}
      rx={1}
      ry={1}
      width={Math.max(width, 1)}
      x={x}
      y={y}
    />
  );
}

export function RelayLatencyChart({ slots }: { slots: DailyHistorySlot[] }) {
  const domainMax = Math.max(...slots.map((slot) => slot.point?.latencyP95Ms ?? 0), 4000);
  const missingBarValue = Math.max(80, Math.round(domainMax * 0.03));
  const data: HistoryChartDatum[] = slots.map((slot) => {
    const latencyMs = slot.point?.latencyP95Ms ?? null;
    const datum = {
      dateKey: slot.dateKey,
      displayDate: formatDate(`${slot.dateKey}T00:00:00.000Z`),
      value: latencyMs ?? missingBarValue,
      fill: getLatencyToneColor(latencyMs),
      barTestId: "relay-latency-bar",
      tooltipValue: latencyMs === null ? "暂无延迟样本" : `P95 ${formatLatency(latencyMs)}`,
    };

    return latencyMs === null
      ? datum
      : {
          ...datum,
          tooltipMeta: `档位 ${latencyMs < 1000 ? "<1s" : latencyMs < 2000 ? "1-2s" : latencyMs < 4000 ? "2-4s" : "4s+"}`,
        };
  });

  return (
    <div data-testid="relay-latency-chart" className="h-24 md:h-28">
      <ResponsiveContainer height="100%" width="100%">
        <BarChart barCategoryGap="20%" data={data} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
          <Tooltip content={<HistoryChartTooltip />} cursor={false} />
          <Bar dataKey="value" isAnimationActive={false} minPointSize={8} shape={<TimelineBarShape />}>
            {data.map((entry) => (
              <Cell key={entry.dateKey} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function RelayLatencyLegend() {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1.5 text-[0.64rem] uppercase tracking-[0.16em] text-black/48">
      {[
        { label: "<1s", toneClassName: "bg-emerald-500" },
        { label: "1-2s", toneClassName: "bg-yellow-400" },
        { label: "2-4s", toneClassName: "bg-orange-500" },
        { label: "4s+", toneClassName: "bg-red-500" },
        { label: "无样本", toneClassName: "bg-zinc-300" },
      ].map((item) => (
        <span key={item.label} className="inline-flex items-center gap-1.5">
          <span className={clsx("h-2 w-2 rounded-full", item.toneClassName)} />
          {item.label}
        </span>
      ))}
    </div>
  );
}

export function RelayStatusChart({ slots }: { slots: DailyHistorySlot[] }) {
  const data: HistoryChartDatum[] = slots.map((slot) => {
    const status = slot.point ? getAvailabilityTrendStatus(slot.point.availability) : "unknown";
    const datum = {
      dateKey: slot.dateKey,
      displayDate: formatDate(`${slot.dateKey}T00:00:00.000Z`),
      value: 100,
      fill: getStatusToneColor(status),
      barTestId: "relay-status-bar",
      tooltipValue: slot.point ? formatHealthStatusLabel(status) : "无样本",
    };

    return slot.point
      ? {
          ...datum,
          tooltipMeta: formatAvailability(slot.point.availability),
        }
      : datum;
  });

  return (
    <div data-testid="relay-status-chart" className="h-24 md:h-28">
      <ResponsiveContainer height="100%" width="100%">
        <BarChart barCategoryGap="20%" data={data} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
          <Tooltip content={<HistoryChartTooltip />} cursor={false} />
          <Bar dataKey="value" isAnimationActive={false} shape={<TimelineBarShape />}>
            {data.map((entry) => (
              <Cell key={entry.dateKey} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function RelayStatusLegend() {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1.5 text-[0.64rem] uppercase tracking-[0.16em] text-black/48">
      {[
        { label: "稳定", toneClassName: "bg-emerald-500" },
        { label: "降级", toneClassName: "bg-amber-500" },
        { label: "不可用", toneClassName: "bg-red-500" },
        { label: "无样本", toneClassName: "bg-zinc-300" },
      ].map((item) => (
        <span key={item.label} className="inline-flex items-center gap-1.5">
          <span className={clsx("h-2 w-2 rounded-full", item.toneClassName)} />
          {item.label}
        </span>
      ))}
    </div>
  );
}

export function ScorePopover({ scoreSummary }: { scoreSummary: RelayOverviewResponse["scoreSummary"] }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ left: number; top: number; width: number } | null>(null);
  const toggleRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const entries = (["availability", "latency", "consistency", "value", "stability"] as const).map((label) => [
    label,
    scoreSummary[label],
  ] as const);

  useEffect(() => {
    if (!open) {
      return;
    }

    function updatePosition() {
      if (!toggleRef.current) {
        return;
      }

      const rect = toggleRef.current.getBoundingClientRect();
      const viewportPadding = 12;
      const width = Math.min(248, Math.max(212, window.innerWidth - viewportPadding * 2));
      const left = Math.min(
        Math.max(rect.right - width, viewportPadding),
        window.innerWidth - width - viewportPadding,
      );
      const top = Math.min(rect.bottom + 8, window.innerHeight - viewportPadding);

      setPosition({ left, top, width });
    }

    updatePosition();

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;

      if (!popoverRef.current?.contains(target) && !toggleRef.current?.contains(target)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  return (
    <>
      <button
        aria-label="查看评分拆解"
        aria-expanded={open}
        className="surface-link w-full cursor-pointer p-3.5 text-left"
        data-testid="score-popover-toggle"
        ref={toggleRef}
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        <p className="font-mono text-[0.64rem] uppercase tracking-[0.18em] text-black/46">评分</p>
        <p className="mt-2 text-[2.2rem] leading-none tracking-[-0.05em]">{scoreSummary.total.toFixed(1)}</p>
        <p className="mt-2 text-xs text-black/58">查看拆解</p>
      </button>
      {open && position ? createPortal(
        <div
          aria-label="评分拆解"
          className="fixed z-[140]"
          data-testid="score-popover"
          ref={popoverRef}
          role="dialog"
          style={{ left: `${position.left}px`, top: `${position.top}px`, width: `${position.width}px` }}
        >
          <div className="surface-card border border-black/8 p-3 shadow-[rgba(127,99,21,0.18)_0_18px_40px]">
            <div className="flex items-center justify-between gap-3 border-b border-black/8 pb-2.5">
              <p className="kicker">评分拆解</p>
              <p className="text-sm tracking-[-0.03em] text-black/66">{scoreSummary.total.toFixed(1)}</p>
            </div>
            <div className="mt-2.5 space-y-1.5">
              {entries.map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-4 border border-black/8 bg-white/72 px-3 py-2">
                  <p className="font-mono text-[0.64rem] uppercase tracking-[0.18em] text-black/46">{formatScoreMetricLabel(label)}</p>
                  <p className="text-base tracking-[-0.03em] text-black/82">{value.toFixed(1)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>,
        document.body,
      ) : null}
    </>
  );
}

export function StatusHistoryPanel({
  slots,
}: {
  slots: DailyHistorySlot[];
}) {
  const measuredSlots = slots.filter((slot) => slot.point);

  if (slots.length === 0) {
    return <p className="text-sm text-black/60">近 30 天还没有状态样本。</p>;
  }

  const healthyCount = measuredSlots.filter((slot) => slot.point && getAvailabilityTrendStatus(slot.point.availability) === "healthy").length;

  return (
    <div className="space-y-3">
      <RelayStatusChart slots={slots} />
      <RelayStatusLegend />
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="surface-card px-3 py-2.5 text-sm">
          <p className="font-mono text-[0.64rem] uppercase tracking-[0.18em] text-black/46">稳定天数</p>
          <p className="mt-2 text-black/76">{healthyCount} / {measuredSlots.length || 0}</p>
        </div>
        <div className="surface-card px-3 py-2.5 text-sm">
          <p className="font-mono text-[0.64rem] uppercase tracking-[0.18em] text-black/46">覆盖度</p>
          <p className="mt-2 text-black/76">{measuredSlots.length} / {slots.length}</p>
        </div>
      </div>
    </div>
  );
}

export function RelayModelsTable({ rows }: { rows: Array<RelayModelPricingRow | null> }) {
  return (
    <div className="data-table relay-models-table relay-models-table-compact px-1.5" data-testid="relay-models-table">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-black/10">
            <th className="pb-2 pl-2">模型</th>
            <th className="w-[4.6rem] whitespace-nowrap pb-2">状态</th>
            <th className="w-[5.2rem] whitespace-nowrap pb-2 text-right">输入</th>
            <th className="w-[5.2rem] whitespace-nowrap pb-2 pr-2 text-right">输出</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row?.modelKey ?? `placeholder-${index}`} className="align-top">
              {row ? (
                <>
                  <td className="border-b border-black/8 py-2.5 pl-2 pr-3 last:border-b-0">
                    <p className="break-words text-[0.93rem] leading-5 tracking-[-0.03em] [overflow-wrap:anywhere]">{row.modelName}</p>
                    <p className="mt-1 font-mono text-[0.6rem] uppercase tracking-[0.14em] text-black/40">{row.vendor}</p>
                  </td>
                  <td className="border-b border-black/8 py-2.5 pr-3 text-[0.6rem] uppercase tracking-[0.14em] text-black/44 whitespace-nowrap last:border-b-0">
                    {formatSupportStatusLabel(row.supportStatus)}
                  </td>
                  <td className="border-b border-black/8 py-2.5 pr-3 text-right text-[0.92rem] font-medium tabular-nums whitespace-nowrap last:border-b-0">
                    {formatPricePerMillion(row.currentPrice?.inputPricePer1M ?? null, row.currentPrice?.currency ?? "USD")}
                  </td>
                  <td className="border-b border-black/8 py-2.5 pr-2 text-right text-[0.92rem] font-medium tabular-nums whitespace-nowrap last:border-b-0">
                    {formatPricePerMillion(row.currentPrice?.outputPricePer1M ?? null, row.currentPrice?.currency ?? "USD")}
                  </td>
                </>
              ) : (
                <>
                  <td className="border-b border-transparent py-2.5 pl-2 pr-3" aria-hidden="true">
                    <span className="block h-5" />
                    <span className="mt-1 block h-3" />
                  </td>
                  <td className="border-b border-transparent py-2.5 pr-3" aria-hidden="true" />
                  <td className="border-b border-transparent py-2.5 pr-3" aria-hidden="true" />
                  <td className="border-b border-transparent py-2.5 pr-2" aria-hidden="true" />
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function RelayPricingHistoryPanel({
  rows,
  modelNames,
}: {
  rows: RelayPricingHistoryResponse["rows"];
  modelNames: Record<string, string>;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-black/60">当前还没有公开价格历史。</p>;
  }

  const pricingGroups = Array.from(
    rows.reduce((map, row) => {
      const existing = map.get(row.modelKey);

      if (existing) {
        existing.rows.push(row);
      } else {
        map.set(row.modelKey, { modelKey: row.modelKey, rows: [row] });
      }

      return map;
    }, new Map<string, { modelKey: string; rows: RelayPricingHistoryResponse["rows"][number][] }>() ).values(),
  ).map((group) => {
    const sortedRows = [...group.rows].sort(
      (left, right) => new Date(right.effectiveFrom).getTime() - new Date(left.effectiveFrom).getTime(),
    );
    const latestRow = sortedRows[0];
    const oldestRow = sortedRows.at(-1) ?? latestRow;

    if (!latestRow || !oldestRow) {
      return null;
    }

    return {
      modelKey: group.modelKey,
      modelName: modelNames[group.modelKey] ?? modelsLabelFromPricingRows(sortedRows),
      latestRow,
      oldestRow,
      rows: sortedRows,
    };
  }).filter((group): group is NonNullable<typeof group> => group !== null);

  return (
    <div className="space-y-3">
      {pricingGroups.map((group) => (
        <div key={group.modelKey} className="surface-card p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-[1.05rem] tracking-[-0.03em] text-black/88">{group.modelName}</p>
              <p className="mt-1 text-xs uppercase tracking-[0.16em] text-black/48">
                最近生效：北京时间 {formatDateTime(group.latestRow.effectiveFrom)}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:min-w-[18rem]">
              <div className="border border-black/8 bg-white/72 px-3 py-2.5">
                <p className="font-mono text-[0.64rem] uppercase tracking-[0.18em] text-black/46">最新输入 / 1M</p>
                <p className="mt-2 text-sm leading-5 text-black/78">
                  {formatPricePerMillion(group.latestRow.inputPricePer1M, group.latestRow.currency)}
                </p>
              </div>
              <div className="border border-black/8 bg-white/72 px-3 py-2.5">
                <p className="font-mono text-[0.64rem] uppercase tracking-[0.18em] text-black/46">最新输出 / 1M</p>
                <p className="mt-2 text-sm leading-5 text-black/78">
                  {formatPricePerMillion(group.latestRow.outputPricePer1M, group.latestRow.currency)}
                </p>
              </div>
            </div>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <div className="border border-black/8 bg-white/72 px-3 py-2.5 text-sm">
              <p className="font-mono text-[0.64rem] uppercase tracking-[0.18em] text-black/46">价格变更次数</p>
              <p className="mt-2 text-black/76">{group.rows.length} 次</p>
            </div>
            <div className="border border-black/8 bg-white/72 px-3 py-2.5 text-sm">
              <p className="font-mono text-[0.64rem] uppercase tracking-[0.18em] text-black/46">首个记录</p>
              <p className="mt-2 text-black/76">北京时间 {formatDateTime(group.oldestRow.effectiveFrom)}</p>
            </div>
            <div className="border border-black/8 bg-white/72 px-3 py-2.5 text-sm">
              <p className="font-mono text-[0.64rem] uppercase tracking-[0.18em] text-black/46">来源</p>
              <p className="mt-2 text-black/76">{formatPricingSourceLabel(group.latestRow.source)}</p>
            </div>
          </div>
          <div className="mt-4 space-y-2">
            {group.rows.map((row) => (
              <div
                key={`${row.modelKey}-${row.effectiveFrom}-${row.source}`}
                className="flex flex-col gap-2 border-l-2 border-black/12 pl-3 text-sm leading-6 text-black/72 sm:flex-row sm:items-start sm:justify-between"
              >
                <div>
                  <p className="font-mono text-[0.64rem] uppercase tracking-[0.18em] text-black/46">
                    北京时间 {formatDateTime(row.effectiveFrom)}
                  </p>
                  <p className="mt-1">
                    输入 {formatPricePerMillion(row.inputPricePer1M, row.currency)} / 输出{" "}
                    {formatPricePerMillion(row.outputPricePer1M, row.currency)}
                  </p>
                </div>
                <span className="text-xs uppercase tracking-[0.16em] text-black/48">
                  来源 {formatPricingSourceLabel(row.source)}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function modelsLabelFromPricingRows(rows: RelayPricingHistoryResponse["rows"]) {
  return rows[0]?.modelKey ?? "未命名模型";
}

export function RelayIncidentTimeline({
  rows,
}: {
  rows: RelayIncidentsResponse["rows"];
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-black/60">近 30 天没有公开事故记录。</p>;
  }

  return (
    <div className="space-y-3">
      {rows.map((incident) => (
        <div
          key={incident.id}
          className={clsx("border p-4", getIncidentToneClasses(incident.severity))}
        >
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="signal-chip bg-white/70">{formatIncidentSeverityLabel(incident.severity)}</span>
                <span className="text-[0.68rem] uppercase tracking-[0.16em] text-current/70">
                  {incident.endedAt ? "已结束" : "进行中"}
                </span>
              </div>
              <div>
                <p className="text-[1.05rem] tracking-[-0.03em] text-current">{incident.title}</p>
                <p className="mt-2 text-sm leading-6 text-current/82">{incident.summary}</p>
              </div>
            </div>
            <div className="min-w-[12rem] space-y-1 text-sm leading-6 text-current/78">
              <p>开始：北京时间 {formatDateTime(incident.startedAt)}</p>
              <p>
                {incident.endedAt
                  ? `结束：北京时间 ${formatDateTime(incident.endedAt)}`
                  : "结束：仍在观察中"}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
