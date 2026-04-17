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

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ?? "http://127.0.0.1:8787";
const PUBLIC_SITE_URL =
  import.meta.env.VITE_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "https://relaynew.ai";

const PROBE_COMPATIBILITY_OPTIONS: Array<{ value: ProbeCompatibilityMode; label: string }> = [
  { value: "auto", label: "自动识别（推荐）" },
  { value: "openai-responses", label: "OpenAI Responses" },
  { value: "openai-chat-completions", label: "OpenAI Chat Completions" },
  { value: "anthropic-messages", label: "Anthropic Messages" },
];

const PROBE_FIELD_META = {
  baseUrl: {
    placeholder: "https://relay.example.ai 或 https://relay.example.ai/openai",
    helper:
      "请输入 relay 根地址或服务商前缀。探测会自动补全 `/v1` 以及协议对应的路由后缀。",
    helperCompact: "请输入 relay 根地址或服务商前缀；探测会自动补全 `/v1` 和路由后缀。",
    autoComplete: "url",
    inputMode: "url" as const,
  },
  apiKey: {
    placeholder: "请输入 relay API Key",
    helper:
      "仅用于本次受限的服务端探测请求。结果页不会回显你的密钥。",
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

const PROBE_COMPATIBILITY_LABELS: Record<ProbeResolvedCompatibilityMode, string> = {
  "openai-responses": "OpenAI Responses",
  "openai-chat-completions": "OpenAI Chat Completions",
  "anthropic-messages": "Anthropic Messages",
};

const GITHUB_REPOSITORY_URL = "https://github.com/rebase.network";
const REBASE_NETWORK_URL = "https://rebase.network";

const HEALTH_STATUS_COPY: Record<string, string> = {
  healthy: "最近观测窗口内响应稳定、可用性可靠，整体表现持续正常。",
  degraded: "该 relay 仍可访问，但延迟、错误率或协议行为已出现明显下滑。",
  down: "在当前模型族的测试路径上，该 relay 暂时无法提供可用服务。",
  paused: "该 relay 正处于人工复核或运营处理阶段，当前不参与公开排序。",
  unknown: "最近证据仍不足，暂时无法给出明确的公开状态判断。",
};

const BADGE_COPY: Record<string, string> = {
  "low-latency": "在当前模型赛道中多次测得低延迟表现。",
  "high-stability": "观测窗口内波动较小，连续性表现较强。",
  "high-value": "相较同赛道其他中转站，价格与质量的平衡更有竞争力。",
  "sample-size-low": "当前样本量仍偏少，解读结论时需要保留谨慎。",
  "under-observation": "该 relay 已公开展示，但证据仍在继续积累或复核中。",
};

const POLICY_PILLARS = [
  {
    title: "中立收录",
    body: "Relay 通过运营者提交与审核进入目录。被收录并不代表会自动获得靠前排名。",
  },
  {
    title: "可观测证据",
    body: "自然排名由各模型赛道的实测可用性、延迟、稳定性与性价比信号共同决定。",
  },
  {
    title: "赞助分离",
    body: "赞助展示会保持清晰可辨，绝不会改写自然榜单中的实测排序。",
  },
  {
    title: "可申诉纠偏",
    body: "如果 relay 被错误归类，运营者可以提交修正、最新地址或申诉证据供平台复核。",
  },
] as const;

const PROBE_OUTPUT_CARDS = [
  {
    title: "连通性",
    body: "展示基础可达性结果，以及对目标 relay 主机的受限延迟测量。",
  },
  {
    title: "协议健康度",
    body: "检查所选 API 协议族是否返回有效结构、状态码与健康状态。",
  },
  {
    title: "执行轨迹",
    body: "你可以查看公开探测实际使用的端点路径与请求尝试记录。",
  },
] as const;

const HOME_LEADERBOARD_ROW_LIMIT = 3;
const DEFAULT_LEADERBOARD_MODEL_KEY = "openai-gpt-5.4";
const LEADERBOARD_DIRECTORY_PATH = "/leaderboard/directory";
const LOADABLE_CACHE_MAX_AGE_MS = 60_000;
const THIRTY_DAY_BAR_COUNT = 30;

type PageMetadata = {
  title: string;
  description: string;
  canonicalPath?: string;
};

const LEADERBOARD_VENDOR_LABELS: Record<string, string> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
  google: "Google",
};

function buildCanonicalUrl(pathname: string) {
  const normalizedPath = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return new URL(normalizedPath, PUBLIC_SITE_URL).toString();
}

function upsertNamedMeta(name: string, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);

  if (!element) {
    element = document.createElement("meta");
    element.setAttribute("name", name);
    document.head.appendChild(element);
  }

  element.setAttribute("content", content);
}

function upsertPropertyMeta(property: string, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[property="${property}"]`);

  if (!element) {
    element = document.createElement("meta");
    element.setAttribute("property", property);
    document.head.appendChild(element);
  }

  element.setAttribute("content", content);
}

function upsertCanonicalLink(href: string) {
  let element = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');

  if (!element) {
    element = document.createElement("link");
    element.setAttribute("rel", "canonical");
    document.head.appendChild(element);
  }

  element.setAttribute("href", href);
}

function usePageMetadata(metadata: PageMetadata) {
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

function formatProbeCompatibilityMode(mode: ProbeResolvedCompatibilityMode | null | undefined) {
  return mode ? PROBE_COMPATIBILITY_LABELS[mode] : "未识别";
}

function GitHubIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg aria-hidden="true" fill="currentColor" viewBox="0 0 24 24" {...props}>
      <path d="M12 .5C5.65.5.5 5.66.5 12.02c0 5.09 3.29 9.4 7.85 10.92.57.1.78-.25.78-.56 0-.27-.01-1.17-.02-2.13-3.19.7-3.86-1.35-3.86-1.35-.52-1.33-1.28-1.68-1.28-1.68-1.04-.71.08-.69.08-.69 1.15.08 1.75 1.18 1.75 1.18 1.02 1.75 2.68 1.25 3.34.96.1-.74.4-1.25.72-1.54-2.55-.29-5.24-1.28-5.24-5.71 0-1.26.45-2.29 1.18-3.1-.12-.29-.51-1.47.11-3.06 0 0 .96-.31 3.15 1.18A10.94 10.94 0 0 1 12 6.34c.97 0 1.95.13 2.86.39 2.18-1.49 3.14-1.18 3.14-1.18.62 1.59.23 2.77.11 3.06.74.81 1.18 1.84 1.18 3.1 0 4.44-2.69 5.41-5.26 5.7.41.35.78 1.03.78 2.08 0 1.5-.01 2.7-.01 3.06 0 .31.2.67.79.56a11.52 11.52 0 0 0 7.84-10.92C23.5 5.66 18.35.5 12 .5Z" />
    </svg>
  );
}

function formatProbeDetectionMode(mode: ProbeDetectionMode | undefined) {
  if (mode === "manual") {
    return "手动指定";
  }

  return "自动识别";
}

function formatDateTime(value: string | Date) {
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

function formatDate(value: string | Date) {
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

function formatHealthStatusLabel(status: string) {
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

function formatSupportStatusLabel(status: string) {
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

function formatBadgeLabel(badge: string) {
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

function formatProbeMeasuredAt(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return formatDateTime(date);
}

function formatProbeHttpStatus(value: number | null | undefined) {
  return value ? String(value) : "无";
}

function formatAvailability(value: number) {
  return `${(value * 100).toFixed(2)}%`;
}

function formatLatency(value: number | null) {
  return value === null ? "无数据" : `${value} ms`;
}

function formatPricePerMillion(value: number | null, currency = "USD") {
  if (value === null) {
    return "-";
  }

  const digits = value >= 100 ? 0 : value >= 10 ? 1 : value >= 1 ? 2 : 3;
  const amount = value.toFixed(digits);
  return currency === "USD" ? `$${amount}` : `${currency} ${amount}`;
}

function getStatusToneClass(status: string) {
  return status === "healthy"
    ? "bg-emerald-500"
    : status === "degraded"
      ? "bg-amber-500"
      : status === "down"
        ? "bg-red-500"
        : "bg-zinc-400";
}

function getAvailabilityTrendStatus(availability: number): HealthStatus {
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

function formatScoreMetricLabel(label: keyof RelayOverviewResponse["scoreSummary"]) {
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

function formatIncidentSeverityLabel(severity: string) {
  return (
    {
      degraded: "降级",
      down: "中断",
      paused: "已暂停",
      unknown: "待确认",
    }[severity] ?? severity
  );
}

function getIncidentToneClasses(severity: string) {
  return severity === "down"
    ? "border-[#b42318]/20 bg-[#fff2ef] text-[#8d2d17]"
    : severity === "degraded"
      ? "border-[#b54708]/20 bg-[#fff7e8] text-[#8a450c]"
      : severity === "paused"
        ? "border-black/12 bg-black/[0.03] text-black/72"
      : "border-black/10 bg-white/72 text-black/70";
}

function formatPricingSourceLabel(source: RelayPricingHistoryResponse["rows"][number]["source"]) {
  return (
    {
      manual: "人工维护",
      scraped: "抓取同步",
      detected: "探测发现",
      api: "接口同步",
    }[source] ?? source
  );
}

type DailyHistorySlot = {
  dateKey: string;
  point: RelayHistoryResponse["points"][number] | null;
};

type RelayModelPricingRow = RelayModelsResponse["rows"][number] & {
  currentPrice: RelayPricingHistoryResponse["rows"][number] | null;
};

function getIsoDateKey(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())).toISOString().slice(0, 10);
}

function buildDailyHistorySlots(
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

function getLatencyToneColor(latencyMs: number | null) {
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

function getStatusToneColor(status: string) {
  return status === "healthy"
    ? "#10b981"
    : status === "degraded"
      ? "#f59e0b"
      : status === "down"
        ? "#ef4444"
        : "#d4d4d8";
}

function getModelVendorKey(modelKey: string) {
  return modelKey.split("-")[0] ?? "other";
}

function getModelVendorLabel(modelKey: string) {
  const vendorKey = getModelVendorKey(modelKey);
  return LEADERBOARD_VENDOR_LABELS[vendorKey] ?? vendorKey.replace(/^\w/, (char) => char.toUpperCase());
}

function getLeaderboardPath(modelKey: string) {
  return modelKey === DEFAULT_LEADERBOARD_MODEL_KEY ? "/leaderboard" : `/leaderboard/${modelKey}`;
}

type LoadableCacheEntry<T> = {
  data?: T;
  error?: string;
  promise?: Promise<T>;
  updatedAt: number;
};

const loadableCache = new Map<string, LoadableCacheEntry<unknown>>();

function getLoadableCacheEntry<T>(key: string) {
  return loadableCache.get(key) as LoadableCacheEntry<T> | undefined;
}

function getCachedLoadableState<T>(key: string) {
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

function primeLoadableCache<T>(key: string, loader: () => Promise<T>) {
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

function prefetchPublicRoute(target: string) {
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

function getResolvableTarget(to: RouterLinkProps["to"] | RouterNavLinkProps["to"]) {
  if (typeof to === "string") {
    return to;
  }

  const pathname = to.pathname ?? "";
  const search = typeof to.search === "string" ? to.search : "";
  const hash = typeof to.hash === "string" ? to.hash : "";

  return pathname ? `${pathname}${search}${hash}` : null;
}

type PrefetchableLinkHandlers = {
  onMouseEnter: React.MouseEventHandler<HTMLAnchorElement> | undefined;
  onFocus: React.FocusEventHandler<HTMLAnchorElement> | undefined;
  onTouchStart: React.TouchEventHandler<HTMLAnchorElement> | undefined;
  onMouseDown: React.MouseEventHandler<HTMLAnchorElement> | undefined;
};

function createPrefetchHandlers<T extends PrefetchableLinkHandlers>(
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

function Link(props: RouterLinkProps) {
  const target = getResolvableTarget(props.to);
  const prefetchHandlers = createPrefetchHandlers(target, {
    onMouseEnter: props.onMouseEnter,
    onFocus: props.onFocus,
    onTouchStart: props.onTouchStart,
    onMouseDown: props.onMouseDown,
  });

  return <RouterLink {...props} {...prefetchHandlers} viewTransition={props.viewTransition ?? true} />;
}

function NavLink(props: RouterNavLinkProps) {
  const target = getResolvableTarget(props.to);
  const prefetchHandlers = createPrefetchHandlers(target, {
    onMouseEnter: props.onMouseEnter,
    onFocus: props.onFocus,
    onTouchStart: props.onTouchStart,
    onMouseDown: props.onMouseDown,
  });

  return <RouterNavLink {...props} {...prefetchHandlers} viewTransition={props.viewTransition ?? true} />;
}

function getProbeResultTone(result: PublicProbeResponse) {
  if (!result.connectivity.ok) {
    return {
      label: "连通性失败",
      description: "该 relay 未通过基础网络检查。请重新核对上游地址、认证信息和网络路径。",
      className: "border-[#b42318]/20 bg-[#fff2ef] text-[#8d2d17]",
    };
  }

  if (!result.protocol.ok || result.protocol.healthStatus === "down") {
    return {
      label: "协议检查失败",
      description: "端点有响应，但兼容性探测没有拿到有效且健康的协议返回。",
      className: "border-[#b42318]/20 bg-[#fff2ef] text-[#8d2d17]",
    };
  }

  if (result.protocol.healthStatus === "degraded" || !result.ok) {
    return {
      label: "协议状态降级",
      description: "该 relay 可以访问，但探测发现当前兼容协议形态对应的上游状态已降级。",
      className: "border-[#b54708]/20 bg-[#fff7e8] text-[#8a450c]",
    };
  }

  return {
    label: "探测通过",
    description: "连通性、协议校验与兼容模式识别都已针对所选模型成功完成。",
    className: "border-[#027a48]/20 bg-[#edfdf3] text-[#066649]",
  };
}

function getConnectivityCardTone(ok: boolean) {
  return ok ? "border-emerald-700/12 bg-emerald-50/70" : "border-[#b42318]/15 bg-[#fff2ef]";
}

function getProtocolCardTone(status: PublicProbeResponse["protocol"]["healthStatus"], ok: boolean) {
  if (!ok || status === "down") {
    return "border-[#b42318]/15 bg-[#fff2ef]";
  }

  if (status === "degraded") {
    return "border-[#b54708]/15 bg-[#fff7e8]";
  }

  return "border-emerald-700/12 bg-emerald-50/70";
}

function getTraceCardTone(httpStatus: number | null, matched: boolean) {
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

function getProbeFailureGuidance(result: PublicProbeResponse) {
  if (result.ok) {
    return null;
  }

  const status = result.protocol.httpStatus ?? null;

  if (!result.connectivity.ok || status === null) {
    return {
      source: "网络或目标可达性",
      meaning: "公开探测未能完成有效的上游 HTTP 交互。",
      nextStep: "请检查 DNS、HTTPS 是否可用、主机是否被允许访问，以及 base URL 是否能从公网正常连通。",
    };
  }

  if (status === 400) {
    return {
      source: "上游 API 返回 HTTP 400",
      meaning: "该 relay 可访问，但它拒绝了当前适配器或模型对应的请求结构。",
      nextStep: result.detectionMode === "auto"
        ? "建议尝试手动指定兼容模式。如果 relay 兼容 OpenAI，但不支持 Responses，可切换到 Chat Completions。"
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
      meaning: "该 relay 有响应，但当前测试的兼容路径不存在。",
      nextStep: result.detectionMode === "auto"
        ? "建议尝试手动指定兼容模式，或调整 base URL，让探测能拼出正确的 `/v1` 路径。"
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
      meaning: "该 relay 可以访问，但服务商当前正在对探测请求进行限流。",
      nextStep: "请在冷却时间后重试，或改用仍有配额的密钥与模型。",
    };
  }

  if (status >= 500) {
    return {
      source: "上游服务错误",
      meaning: "该 relay 已接收请求，但在处理时发生了内部错误。",
      nextStep: "建议稍后重试，或将测得状态与端点路径反馈给 relay 运营者。",
    };
  }

  return {
    source: `上游 API 返回 HTTP ${status}`,
    meaning: "请求已到达 relay，但上游响应与所选兼容协议形态不匹配。",
    nextStep: "请核对 base URL、兼容模式和模型支持情况，再用最可能正确的适配器重试。",
  };
}

type ApiErrorPayload = {
  message?: string | string[];
};

function formatApiErrorPayload(payload: ApiErrorPayload | null) {
  if (!payload?.message) {
    return null;
  }

  return Array.isArray(payload.message) ? payload.message.join("; ") : payload.message;
}

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
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

function isValidHttpUrl(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

type SubmitFormState = {
  relayName: string;
  baseUrl: string;
  websiteUrl: string;
  description: string;
  submitterEmail: string;
  testApiKey: string;
  testModel: string;
  compatibilityMode: ProbeCompatibilityMode;
};

type SubmitFormErrors = Partial<Record<keyof SubmitFormState, string>>;

function validateSubmitForm(state: SubmitFormState) {
  const errors: SubmitFormErrors = {};
  const relayName = state.relayName.trim();
  const baseUrl = state.baseUrl.trim();
  const websiteUrl = state.websiteUrl.trim();
  const description = state.description.trim();
  const submitterEmail = state.submitterEmail.trim();
  const testApiKey = state.testApiKey.trim();
  const testModel = state.testModel.trim();

  if (!relayName) {
    errors.relayName = "请填写 relay 名称。";
  }

  if (!baseUrl) {
    errors.baseUrl = "请填写基础 URL。";
  } else if (!isValidHttpUrl(baseUrl) || !baseUrl.startsWith("https://")) {
    errors.baseUrl = "请输入完整的 HTTPS 基础 URL，例如 https://relay.example.ai/v1。";
  }

  if (websiteUrl && !isValidHttpUrl(websiteUrl)) {
    errors.websiteUrl = "请输入有效的网站地址，例如 https://relay.example.ai。";
  }

  if (!description) {
    errors.description = "请补充简要说明，帮助审核队列快速理解这个 relay。";
  }

  if (submitterEmail && !isValidEmail(submitterEmail)) {
    errors.submitterEmail = "请输入有效的联系邮箱。";
  }

  if (!testApiKey) {
    errors.testApiKey = "初始 relay 探测需要测试密钥。";
  }

  if (!testModel) {
    errors.testModel = "请填写测试模型。";
  }

  return {
    errors,
    payload: {
      relayName,
      baseUrl,
      websiteUrl: websiteUrl || undefined,
      description,
      submitterEmail: submitterEmail || undefined,
      testApiKey,
      testModel,
      compatibilityMode: state.compatibilityMode,
    },
  };
}

type ProbeFormState = {
  baseUrl: string;
  apiKey: string;
  model: string;
  compatibilityMode: ProbeCompatibilityMode;
};

const DEFAULT_PROBE_STATE: ProbeFormState = {
  baseUrl: "",
  apiKey: "",
  model: "openai-gpt-4.1",
  compatibilityMode: "auto",
};

function isProbeCompatibilityMode(value: string | null): value is ProbeCompatibilityMode {
  return PROBE_COMPATIBILITY_OPTIONS.some((option) => option.value === value);
}

function getProbeStateFromSearchParams(searchParams: URLSearchParams): ProbeFormState {
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

function useProbeController(initialState: ProbeFormState = DEFAULT_PROBE_STATE) {
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
      setError(reason instanceof Error ? reason.message : "探测失败。");
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

function ProbeFormFields({
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

function InlineProbeSummary({
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
        探测失败：{error}
      </p>
    );
  }

  if (!result || !resultTone) {
    return (
      <p className="quick-probe-inline-summary">
        探测完成后，这里会显示状态、延迟、HTTP 状态码与接口兼容类型。
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

function useLoadable<T>(cacheKey: string | null, loader: () => Promise<T>, deps: unknown[]) {
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

function AppShell({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const currentYear = new Date().getFullYear();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const navItems = [
    ["/", "首页"],
    ["/leaderboard", "榜单"],
    ["/methodology", "方法论"],
    ["/submit", "提交 Relay"],
    ["/probe", "Relay 探测"],
  ] as const;

  useEffect(() => {
    setMobileNavOpen(false);
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

function Panel({
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

function LoadingPanel() {
  return <div className="panel text-sm uppercase tracking-[0.15em] text-black/60">加载中...</div>;
}

function ErrorPanel({ message }: { message: string }) {
  return <div className="panel border border-[#fa520f]/20 bg-[#fff0c2] text-sm text-[#7b3614]">{message}</div>;
}

function SkeletonBlock({ className }: { className?: string }) {
  return <div aria-hidden="true" className={clsx("skeleton-block", className)} />;
}

function HomePageSkeleton() {
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

function LeaderboardPreviewSkeleton() {
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

function LeaderboardDirectorySkeleton() {
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

function LeaderboardPageSkeleton() {
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

function RelayPageSkeleton() {
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

function MethodologyPageSkeleton() {
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

function StatusDot({ status }: { status: string }) {
  return <span className={clsx("status-dot inline-block h-2.5 w-2.5", getStatusToneClass(status))} />;
}

function MetricGrid({
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

function CompactBadgeList({
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

function LeaderboardPreviewCard({
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
              <div className="leaderboard-preview-scoreline">
                <StatusDot status={row.healthStatus} /> {formatHealthStatusLabel(row.healthStatus)} · {row.score.toFixed(1)}
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

function HomeIncidentCard({
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

function LeaderboardRowCard({ row }: { row: LeaderboardResponse["rows"][number] }) {
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
          <p className="text-[0.64rem] uppercase tracking-[0.18em] text-black/46">输入 / 1M</p>
          <p className="mt-2 text-sm leading-5 text-black/78">{row.inputPricePer1M ?? "-"}</p>
        </div>
        <div className="border border-black/8 bg-white/72 px-3 py-2.5">
          <p className="text-[0.64rem] uppercase tracking-[0.18em] text-black/46">输出 / 1M</p>
          <p className="mt-2 text-sm leading-5 text-black/78">{row.outputPricePer1M ?? "-"}</p>
        </div>
      </div>
    </article>
  );
}

function HomePage() {
  const { data, loading, error } = useLoadable<HomeSummaryResponse>(
    "/public/home-summary",
    () => fetchJson("/public/home-summary"),
    [],
  );
  const quickProbe = useProbeController(DEFAULT_PROBE_STATE);
  usePageMetadata({
    title: "relaynew.ai｜中转站监控、榜单与探测",
    description: "面向中国用户的 relay 情报台，提供模型赛道榜单、异常事件、Relay 自助探测与提交入口。",
  });

  if (loading) return <HomePageSkeleton />;
  if (error || !data) return <ErrorPanel message={error ?? "首页加载失败。"} />;

  return (
    <div className="space-y-5">
      <section className="panel hero-panel min-h-0">
        <div className="grid gap-5 xl:grid-cols-[0.98fr_1.02fr] xl:items-start">
          <div className="order-2 md:order-1">
            <h1 className="max-w-4xl text-[3rem] leading-[0.92] tracking-[-0.07em] md:text-5xl xl:text-[4rem]">
              发现优质中转站点，快速测试API可用性，建立公开站点目录
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-black/72 md:mt-4 md:text-base md:leading-7">
              你可以查看各模型站点榜单、快速检测站点，或在需要更深入诊断时进入完整探测工作台。
            </p>
            <div className="mt-5 flex flex-wrap gap-2.5">
              <Link className="button-dark" to="/leaderboard">查看榜单</Link>
              <Link className="button-cream" to="/probe">开始测试</Link>
              <Link className="button-cream" to="/submit">提交 Relay</Link>
            </div>
          </div>
          <div className="order-1 space-y-3 md:order-2">
            <form className="quick-probe-card quick-probe-form" onSubmit={quickProbe.handleSubmit}>
              <div className="quick-probe-header">
                <div>
                  <p className="quick-probe-heading">快速测试</p>
                </div>
                <Link
                  aria-label="打开完整测试页"
                  className="quick-probe-link"
                  title="打开完整测试页"
                  to="/probe"
                >
                  完整测试
                </Link>
              </div>
              <ProbeFormFields
                compact
                setState={quickProbe.setState}
                showHelpers={false}
                state={quickProbe.state}
              />
              <div className="quick-probe-footer">
                <InlineProbeSummary
                  error={quickProbe.error}
                  result={quickProbe.result}
                  resultTone={quickProbe.resultTone}
                />
                <button className="button-dark quick-probe-action" disabled={quickProbe.submitting} type="submit">
                  {quickProbe.submitting ? "检测中..." : "立即测试"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </section>

      <Panel title="站点榜单">
        <div className="mb-3 flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
          <p className="max-w-2xl text-xs uppercase tracking-[0.16em] text-black/48">
            展示按照主流模型分类的榜单，每个模型分类取评分前五的站点，每天会根据测试数据重新排行
          </p>
          <Link className="button-cream" to={LEADERBOARD_DIRECTORY_PATH}>
            查看全部赛道
          </Link>
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          {data.leaderboards.map((board) => (
            <LeaderboardPreviewCard
              key={board.modelKey}
              board={board}
              rowLimit={HOME_LEADERBOARD_ROW_LIMIT}
            />
          ))}
        </div>
      </Panel>

      <Panel title="最近事件" kicker="异常与退化" titleClassName="text-[2.2rem] md:text-[2.45rem]">
        <div className="mb-4 flex flex-col gap-2.5 lg:flex-row lg:items-end lg:justify-between">
          <p className="max-w-3xl text-sm leading-6 text-black/68">
            这里仅展示最近观测到的异常、退化或暂停事件，帮助普通用户快速判断风险，
            也帮助节点运营者确认哪些问题已经进入公开视野。
          </p>
          <p className="text-xs uppercase tracking-[0.16em] text-black/48">
            与重点榜单、赞助位分别独立展示
          </p>
        </div>
        {data.latestIncidents.length > 0 ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {data.latestIncidents.map((incident) => (
              <HomeIncidentCard key={incident.id} incident={incident} />
            ))}
          </div>
        ) : (
          <div className="surface-card p-4 text-sm leading-6 text-black/68">
            当前快照里还没有需要公开提示的最新异常事件。榜单和赞助位会继续保持独立展示。
          </div>
        )}
      </Panel>

      <section className="home-bridge">
        <p className="home-bridge-copy">
          方法论会说明 relay 的测量与评分方式，政策页则解释收录规则、赞助分离与复核机制。
        </p>
        <div className="home-bridge-actions">
          <Link className="home-bridge-link" to="/methodology">
            方法论
          </Link>
          <Link className="home-bridge-link" to="/policy">
            评估政策
          </Link>
        </div>
      </section>

      {data.highlights.length > 0 ? (
        <section className="panel">
          <div className="mb-4 space-y-2">
            <p className="kicker">赞助展示</p>
            <h2 className="text-3xl leading-[0.95] tracking-[-0.04em] md:text-[2.9rem]">赞助位</h2>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            {data.highlights.map((relay) => (
              <Link
                key={relay.slug}
                to={`/relay/${relay.slug}`}
                className="surface-link flex h-full items-center justify-between gap-4 p-3.5"
              >
                <div className="min-w-0">
                  <p className="text-[1.22rem] tracking-[-0.03em]">{relay.name}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="signal-chip">{formatBadgeLabel(relay.badge)}</span>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="flex items-center justify-end gap-2 text-sm uppercase tracking-[0.12em]">
                    <StatusDot status={relay.healthStatus} /> {formatHealthStatusLabel(relay.healthStatus)}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function LeaderboardIndexPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { data, loading, error } = useLoadable<LeaderboardDirectoryResponse>(
    "/public/leaderboard-directory",
    () => fetchJson("/public/leaderboard-directory"),
    [],
  );
  usePageMetadata({
    title: "Relay 榜单目录｜relaynew.ai",
    description: "按模型赛道查看已跟踪的 relay 榜单目录，快速进入单赛道详情，对比健康状态、延迟与价格信息。",
    canonicalPath: LEADERBOARD_DIRECTORY_PATH,
  });
  const boards = data?.boards ?? [];
  const vendorFilter = searchParams.get("vendor") ?? "all";
  const vendorOptions = useMemo(
    () =>
      Array.from(
        new Map(
          boards.map((board) => {
            const vendorKey = getModelVendorKey(board.modelKey);
            return [vendorKey, { key: vendorKey, label: getModelVendorLabel(board.modelKey) }];
          }),
        ).values(),
      ),
    [boards],
  );
  const filteredBoards = useMemo(
    () =>
      boards.filter((board) => {
        const vendorKey = getModelVendorKey(board.modelKey);
        return vendorFilter === "all" || vendorKey === vendorFilter;
      }),
    [boards, vendorFilter],
  );

  if (loading) return <LeaderboardDirectorySkeleton />;
  if (error || !data) return <ErrorPanel message={error ?? "榜单目录加载失败。"} />;

  function updateDirectorySearch(next: { vendor?: string }) {
    const params = new URLSearchParams(searchParams);

    if (next.vendor !== undefined) {
      if (next.vendor === "all") {
        params.delete("vendor");
      } else {
        params.set("vendor", next.vendor);
      }
    }

    setSearchParams(params);
  }

  return (
    <div className="space-y-6">
      <section className="panel bg-[#fff0c2]">
        <p className="kicker">榜单目录</p>
        <div className="grid gap-4 xl:grid-cols-[1fr_0.9fr] xl:items-end">
          <div>
            <h1 className="max-w-3xl text-4xl leading-[0.92] tracking-[-0.06em] md:text-5xl">
              先浏览所有模型赛道，再进入你关心的单个榜单。
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-black/72">
              目录会按照模型聚合 relay。打开任意模型榜单，即可查看该赛道的完整排名、健康状态、延迟与价格信息。
            </p>
          </div>
          <div className="flex flex-wrap gap-2.5 xl:justify-end">
            <Link className="button-dark" to="/leaderboard">打开实时榜单</Link>
            <Link className="button-cream" to="/probe">开始探测</Link>
          </div>
        </div>
      </section>

      <section className="directory-filters directory-filters-compact">
        <div className="directory-vendor-row">
          <button
            className={clsx("directory-filter-chip", vendorFilter === "all" && "directory-filter-chip-active")}
            onClick={() => updateDirectorySearch({ vendor: "all" })}
            type="button"
          >
            全部
          </button>
          {vendorOptions.map((vendor) => (
            <button
              key={vendor.key}
              className={clsx(
                "directory-filter-chip",
                vendorFilter === vendor.key && "directory-filter-chip-active",
              )}
              onClick={() => updateDirectorySearch({ vendor: vendor.key })}
              type="button"
            >
              {vendor.label}
            </button>
          ))}
        </div>
        <p className="directory-filter-meta">
          {filteredBoards.length === data.boards.length
            ? `${data.boards.length} 个赛道`
            : `${filteredBoards.length} / ${data.boards.length} 个赛道`}
        </p>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        {filteredBoards.map((board) => (
          <LeaderboardPreviewCard key={board.modelKey} board={board} />
        ))}
      </div>
      {filteredBoards.length === 0 ? (
        <section className="directory-empty-state">
          <p className="kicker">没有匹配项</p>
          <h2 className="text-3xl leading-[0.96] tracking-[-0.04em]">当前筛选条件下没有匹配的榜单赛道。</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-black/68">
            请切换服务商筛选条件，恢复完整目录视图。
          </p>
          <button
            className="button-cream mt-5"
            onClick={() => setSearchParams(new URLSearchParams())}
            type="button"
          >
            重置筛选
          </button>
        </section>
      ) : null}
    </div>
  );
}

function LeaderboardPage() {
  const { modelKey = DEFAULT_LEADERBOARD_MODEL_KEY } = useParams();
  const directory = useLoadable<LeaderboardDirectoryResponse>(
    "/public/leaderboard-directory",
    () => fetchJson("/public/leaderboard-directory"),
    [],
  );
  const leaderboardCacheKey = `/public/leaderboard/${modelKey}?limit=50`;
  const { data, loading, error } = useLoadable<LeaderboardResponse>(
    leaderboardCacheKey,
    () => fetchJson(leaderboardCacheKey),
    [modelKey],
  );
  const rows = data?.rows ?? [];
  const trackedRelayCount = rows.length;
  const healthyRelayCount = rows.filter((row) => row.healthStatus === "healthy").length;
  const degradedRelayCount = rows.filter((row) => row.healthStatus === "degraded").length;
  const modelName = data?.model.name ?? "Relay";
  usePageMetadata({
    title: `${modelName} Relay 榜单｜relaynew.ai`,
    description:
      data
        ? `查看 ${data.model.name} 赛道 relay 自然排名，基于可用性、延迟、稳定性与性价比；赞助展示与自然排名严格分离。`
        : "查看 relay 自然排名与实测数据，理解健康状态、延迟表现与赞助分离规则。",
  });

  if (loading) return <LeaderboardPageSkeleton />;
  if (error || !data) return <ErrorPanel message={error ?? "榜单加载失败。"} />;

  return (
    <div className="space-y-6">
      <section className="panel bg-[#fff0c2]">
        <p className="kicker">榜单</p>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-4xl leading-[0.92] tracking-[-0.06em] md:text-5xl">{data.model.name}</h1>
            <p className="mt-2 text-sm uppercase tracking-[0.16em] text-black/60">北京时间 {formatDateTime(data.measuredAt)}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="signal-chip">已跟踪 {trackedRelayCount} 个 relay</span>
              <span className="signal-chip">健康 {healthyRelayCount} 个</span>
              <span className="signal-chip">降级 {degradedRelayCount} 个</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <Link className="button-dark" to={LEADERBOARD_DIRECTORY_PATH}>全部模型赛道</Link>
            <Link className="button-cream" to="/probe">开始探测</Link>
          </div>
        </div>
      </section>
      {directory.data?.boards.length ? (
        <section className="panel-soft border border-black/8 px-4 py-4">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="kicker">切换模型赛道</p>
                <p className="text-sm leading-6 text-black/68">
                  无需离开当前页面，就能快速切换到其他已跟踪榜单。
                </p>
              </div>
              <p className="directory-filter-meta">共 {directory.data.boards.length} 个已跟踪赛道</p>
            </div>
            <div className="leaderboard-model-switcher">
              {directory.data.boards.map((board) => (
                <Link
                  key={board.modelKey}
                  className={clsx(
                    "leaderboard-model-pill",
                    board.modelKey === data.model.key && "leaderboard-model-pill-active",
                  )}
                  to={getLeaderboardPath(board.modelKey)}
                >
                  {board.modelName}
                </Link>
              ))}
            </div>
          </div>
        </section>
      ) : null}
      <section className="grid gap-4 xl:grid-cols-3">
        <div className="surface-card p-4">
          <p className="kicker">自然排名</p>
          <p className="mt-3 text-sm leading-6 text-black/72">
            下方表格只由公开测量结果生成，综合可用性、延迟、稳定性与价格效率，不接受赞助调位。
          </p>
        </div>
        <div className="surface-card p-4">
          <p className="kicker">方法论入口</p>
          <p className="mt-3 text-sm leading-6 text-black/72">
            如果你想理解总分、健康状态与徽章含义，可以先阅读评分口径，再回到榜单做比较。
          </p>
          <Link className="mt-4 inline-flex text-sm underline underline-offset-4" to="/methodology">
            查看方法论
          </Link>
        </div>
        <div className="surface-card p-4">
          <p className="kicker">赞助分离</p>
          <p className="mt-3 text-sm leading-6 text-black/72">
            赞助展示只会出现在独立模块，不会混入自然排名表格，也不会影响这里的实测顺序。
          </p>
          <Link className="mt-4 inline-flex text-sm underline underline-offset-4" to="/policy">
            查看评估政策
          </Link>
        </div>
      </section>
      <Panel title="Relay 排名" kicker="自然排序">
        <div className="mb-4 flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
          <p className="max-w-3xl text-sm leading-6 text-black/68">
            本页只呈现当前模型赛道的自然排序结果。赞助展示不会插入表格，理解分数口径请配合方法论一起阅读。
          </p>
          <p className="text-xs uppercase tracking-[0.16em] text-black/48">
            当前表格不含赞助位
          </p>
        </div>
        {rows.length ? (
          <>
            <div className="space-y-3 md:hidden">
              {rows.map((row) => (
                <LeaderboardRowCard key={row.relay.slug} row={row} />
              ))}
            </div>
            <div className="data-table hidden md:block">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-black/10">
                    <th className="pb-2.5">排名</th>
                    <th className="pb-2.5">Relay</th>
                    <th className="pb-2.5">状态</th>
                    <th className="pb-2.5">评分</th>
                    <th className="pb-2.5">24h 可用性</th>
                    <th className="pb-2.5">P50 延迟</th>
                    <th className="pb-2.5">输入</th>
                    <th className="pb-2.5">输出</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.relay.slug} className="align-top">
                      <td className="py-3 text-2xl tracking-[-0.04em]">#{row.rank}</td>
                      <td className="py-3">
                        <Link to={`/relay/${row.relay.slug}`} className="text-[1.08rem] tracking-[-0.03em] hover:underline">{row.relay.name}</Link>
                        <CompactBadgeList badges={row.badges.map(formatBadgeLabel)} className="mt-2" />
                      </td>
                      <td className="py-3 text-sm uppercase tracking-[0.14em]"><span className="inline-flex items-center gap-2"><StatusDot status={row.healthStatus} /> {formatHealthStatusLabel(row.healthStatus)}</span></td>
                      <td className="py-3 text-[1.08rem] tracking-[-0.03em]">{row.score.toFixed(1)}</td>
                      <td className="py-3">{formatAvailability(row.availability24h)}</td>
                      <td className="py-3">{formatLatency(row.latencyP50Ms)}</td>
                      <td className="py-3">{row.inputPricePer1M ?? "-"}</td>
                      <td className="py-3">{row.outputPricePer1M ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="directory-empty-state">
            <p className="kicker">暂无排名</p>
            <h2 className="text-3xl leading-[0.96] tracking-[-0.04em]">这个赛道暂时还没有 relay 进入排名。</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-black/68">
              可在下一轮测量完成后再来查看，或从上方切换到其他模型赛道。
            </p>
          </div>
        )}
      </Panel>
    </div>
  );
}

type HistoryChartDatum = {
  dateKey: string;
  displayDate: string;
  value: number;
  fill: string;
  barTestId: string;
  tooltipValue: string;
  tooltipMeta?: string;
};

function HistoryChartTooltip({
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

function TimelineBarShape({
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

function RelayLatencyChart({ slots }: { slots: DailyHistorySlot[] }) {
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

function RelayLatencyLegend() {
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

function RelayStatusChart({ slots }: { slots: DailyHistorySlot[] }) {
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

function RelayStatusLegend() {
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

function ScorePopover({ scoreSummary }: { scoreSummary: RelayOverviewResponse["scoreSummary"] }) {
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

function StatusHistoryPanel({
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

function RelayModelsTable({ rows }: { rows: Array<RelayModelPricingRow | null> }) {
  return (
    <div className="data-table relay-models-table px-1.5" data-testid="relay-models-table">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-black/10">
            <th className="pb-2.5 pl-2">模型</th>
            <th className="w-[5.5rem] whitespace-nowrap pb-2.5">状态</th>
            <th className="w-[5.5rem] whitespace-nowrap pb-2.5 text-right">输入</th>
            <th className="w-[5.7rem] whitespace-nowrap pb-2.5 pr-2 text-right">输出</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row?.modelKey ?? `placeholder-${index}`} className="align-top">
              {row ? (
                <>
                  <td className="border-b border-black/8 py-3 pl-2 pr-3 last:border-b-0">
                    <p className="break-words text-[0.96rem] leading-5 tracking-[-0.03em] [overflow-wrap:anywhere]">{row.modelName}</p>
                    <p className="mt-1 font-mono text-[0.64rem] uppercase tracking-[0.16em] text-black/44">{row.vendor}</p>
                  </td>
                  <td className="border-b border-black/8 py-3 pr-3 text-[0.68rem] uppercase tracking-[0.18em] text-black/52 whitespace-nowrap last:border-b-0">
                    {formatSupportStatusLabel(row.supportStatus)}
                  </td>
                  <td className="border-b border-black/8 py-3 pr-3 text-right text-sm tabular-nums whitespace-nowrap last:border-b-0">
                    {formatPricePerMillion(row.currentPrice?.inputPricePer1M ?? null, row.currentPrice?.currency ?? "USD")}
                  </td>
                  <td className="border-b border-black/8 py-3 pr-2 text-right text-sm tabular-nums whitespace-nowrap last:border-b-0">
                    {formatPricePerMillion(row.currentPrice?.outputPricePer1M ?? null, row.currentPrice?.currency ?? "USD")}
                  </td>
                </>
              ) : (
                <>
                  <td className="border-b border-transparent py-3 pl-2 pr-3" aria-hidden="true">
                    <span className="block h-5" />
                    <span className="mt-1 block h-3" />
                  </td>
                  <td className="border-b border-transparent py-3 pr-3" aria-hidden="true" />
                  <td className="border-b border-transparent py-3 pr-3" aria-hidden="true" />
                  <td className="border-b border-transparent py-3 pr-2" aria-hidden="true" />
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RelayPricingHistoryPanel({
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

function modelsLabelFromPricingRows(rows: RelayPricingHistoryResponse["rows"]) {
  return rows[0]?.modelKey ?? "未命名模型";
}

function RelayIncidentTimeline({
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

function RelayPage() {
  const { slug = "aurora-relay" } = useParams();
  const overview = useLoadable<RelayOverviewResponse>(
    `/public/relay/${slug}/overview`,
    () => fetchJson(`/public/relay/${slug}/overview`),
    [slug],
  );
  const history = useLoadable<RelayHistoryResponse>(
    `/public/relay/${slug}/history?window=30d`,
    () => fetchJson(`/public/relay/${slug}/history?window=30d`),
    [slug],
  );
  const models = useLoadable<RelayModelsResponse>(
    `/public/relay/${slug}/models`,
    () => fetchJson(`/public/relay/${slug}/models`),
    [slug],
  );
  const pricing = useLoadable<RelayPricingHistoryResponse>(
    `/public/relay/${slug}/pricing-history`,
    () => fetchJson(`/public/relay/${slug}/pricing-history`),
    [slug],
  );
  const incidents = useLoadable<RelayIncidentsResponse>(
    `/public/relay/${slug}/incidents?window=30d`,
    () => fetchJson(`/public/relay/${slug}/incidents?window=30d`),
    [slug],
  );
  const relayName = overview.data?.relay.name ?? slug;
  usePageMetadata({
    title: `${relayName} Relay 详情｜relaynew.ai`,
    description:
      overview.data
        ? `查看 ${overview.data.relay.name} 的 24h 可用性、延迟走势、模型支持、价格历史与近 30 天事故时间线。`
        : "查看 relay 的 24h 可用性、延迟走势、模型支持、价格历史与近 30 天事故时间线。",
  });
  if (overview.loading) return <RelayPageSkeleton />;
  if (overview.error || !overview.data) return <ErrorPanel message={overview.error ?? "Relay 详情加载失败。"} />;

  const snapshotMetrics = [
    { label: "24h 可用性", value: formatAvailability(overview.data.availability24h) },
    { label: "P50 延迟", value: formatLatency(overview.data.latencyP50Ms) },
    { label: "P95 延迟", value: formatLatency(overview.data.latencyP95Ms) },
    { label: "模型数", value: overview.data.supportedModelsCount },
  ];

  const latestPricingByModelKey = new Map<string, RelayPricingHistoryResponse["rows"][number]>();
  if (pricing.data) {
    for (const row of pricing.data.rows) {
      if (!latestPricingByModelKey.has(row.modelKey)) {
        latestPricingByModelKey.set(row.modelKey, row);
      }
    }
  }

  const modelPricingRows: RelayModelPricingRow[] = models.data?.rows.map((row) => ({
    ...row,
    currentPrice: latestPricingByModelKey.get(row.modelKey) ?? null,
  })) ?? [];
  const modelNames = Object.fromEntries(
    (models.data?.rows ?? []).map((row) => [row.modelKey, row.modelName]),
  );
  const modelRowsPerColumn = Math.ceil(modelPricingRows.length / 2);
  const modelTableColumns: Array<Array<RelayModelPricingRow | null>> = [
    modelPricingRows.slice(0, modelRowsPerColumn),
    modelPricingRows.slice(modelRowsPerColumn),
  ]
    .filter((rows) => rows.length > 0)
    .map((rows) => [...rows, ...Array.from({ length: Math.max(0, modelRowsPerColumn - rows.length) }, () => null)]);
  const historySlots = history.data ? buildDailyHistorySlots(history.data.points, history.data.measuredAt) : [];
  const measuredHistorySlotCount = historySlots.filter((slot) => slot.point).length;
  const latestMeasuredHistoryPoint = [...historySlots].reverse().find((slot) => slot.point?.latencyP95Ms !== null)?.point ?? null;

  return (
    <div className="space-y-4">
      <section className="panel bg-[linear-gradient(135deg,rgba(255,240,194,1),rgba(255,184,62,0.75))]">
        <p className="kicker">Relay 详情</p>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_12rem] lg:items-start">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3 text-sm uppercase tracking-[0.16em]">
              <span className="inline-flex items-center gap-2">
                <StatusDot status={overview.data.healthStatus} />
                {formatHealthStatusLabel(overview.data.healthStatus)}
              </span>
              <span className="text-black/46">北京时间 {formatProbeMeasuredAt(overview.data.measuredAt)}</span>
            </div>
            <div>
              <h1 className="text-4xl leading-[0.92] tracking-[-0.06em] md:text-[4.2rem]">{overview.data.relay.name}</h1>
              <p className="mt-2 break-all font-mono text-[0.8rem] text-black/62">{overview.data.relay.baseUrl}</p>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-black/72">
                {HEALTH_STATUS_COPY[overview.data.healthStatus] ?? "这个 relay 的近期证据仍在持续积累中。"}
              </p>
            </div>
            {overview.data.relay.websiteUrl ? (
              <div className="flex flex-wrap gap-2">
                <a
                  className="signal-chip"
                  href={overview.data.relay.websiteUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  访问官网
                </a>
              </div>
            ) : null}
          </div>
          <ScorePopover scoreSummary={overview.data.scoreSummary} />
        </div>
        <div className="mt-4">
          <MetricGrid
            columnsClassName="grid-cols-2 lg:grid-cols-4"
            items={snapshotMetrics.map((item) => ({
              ...item,
              cardClassName: "probe-metric-card",
              valueClassName: "text-[1.32rem] leading-[1.05]",
              valueSpacingClassName: "mt-2.5",
            }))}
          />
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Panel
          className="h-full"
          title="延迟画像"
          kicker="近 30 天走势"
          headerClassName="mb-3"
          titleClassName="text-[2.2rem] md:text-[2.45rem]"
        >
          {history.error ? (
            <p className="text-sm text-[#b42318]">{history.error}</p>
          ) : history.loading || !history.data ? <p className="text-sm text-black/60">正在加载趋势...</p> : (
            <div className="space-y-3">
              <RelayLatencyChart slots={historySlots} />
              <RelayLatencyLegend />
              <div className="grid gap-2 sm:grid-cols-3">
                <div className="surface-card px-3 py-2.5 text-sm">
                  <p className="font-mono text-[0.64rem] uppercase tracking-[0.18em] text-black/46">窗口</p>
                  <p className="mt-2 text-black/76">30d</p>
                </div>
                <div className="surface-card px-3 py-2.5 text-sm">
                  <p className="font-mono text-[0.64rem] uppercase tracking-[0.18em] text-black/46">覆盖度</p>
                  <p className="mt-2 text-black/76">{measuredHistorySlotCount} / 30 天</p>
                </div>
                <div className="surface-card px-3 py-2.5 text-sm">
                  <p className="font-mono text-[0.64rem] uppercase tracking-[0.18em] text-black/46">最新 P95</p>
                  <p className="mt-2 text-black/76">
                    {formatLatency(latestMeasuredHistoryPoint?.latencyP95Ms ?? null)}
                  </p>
                </div>
              </div>
            </div>
          )}
        </Panel>
        <Panel
          className="h-full"
          title="状态"
          kicker="近 30 天可用性"
          headerClassName="mb-3"
          titleClassName="text-[2.2rem] md:text-[2.45rem]"
        >
          {history.error ? (
            <p className="text-sm text-[#b42318]">{history.error}</p>
          ) : history.loading || !history.data ? (
            <p className="text-sm text-black/60">正在加载状态...</p>
          ) : (
            <StatusHistoryPanel slots={historySlots} />
          )}
        </Panel>
      </section>

      <section className="grid gap-4">
        <Panel
          title="模型支持"
          kicker="当前价格"
          headerClassName="mb-3"
          titleClassName="text-[2.2rem] md:text-[2.45rem]"
        >
          {models.loading || !models.data ? <p className="text-sm text-black/60">正在加载模型...</p> : (
            modelPricingRows.length === 0 ? <p className="text-sm text-black/60">这个 relay 还没有公开模型信息。</p> : (
            <>
              <div className="space-y-2.5 lg:hidden">
                {modelPricingRows.map((row) => (
                  <div key={row.modelKey} className="surface-card p-3.5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-lg tracking-[-0.03em]">{row.modelName}</p>
                        <p className="mt-1 font-mono text-[0.68rem] uppercase tracking-[0.16em] text-black/44">{row.vendor}</p>
                      </div>
                      <p className="text-[0.64rem] uppercase tracking-[0.18em] text-black/50">{formatSupportStatusLabel(row.supportStatus)}</p>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <div className="border border-black/8 bg-white/72 px-3 py-2.5">
                        <p className="font-mono text-[0.64rem] uppercase tracking-[0.18em] text-black/46">输入 / 1M</p>
                        <p className="mt-2 text-sm leading-5 text-black/78">
                          {formatPricePerMillion(row.currentPrice?.inputPricePer1M ?? null, row.currentPrice?.currency ?? "USD")}
                        </p>
                      </div>
                      <div className="border border-black/8 bg-white/72 px-3 py-2.5">
                        <p className="font-mono text-[0.64rem] uppercase tracking-[0.18em] text-black/46">输出 / 1M</p>
                        <p className="mt-2 text-sm leading-5 text-black/78">
                          {formatPricePerMillion(row.currentPrice?.outputPricePer1M ?? null, row.currentPrice?.currency ?? "USD")}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="hidden lg:grid lg:grid-cols-2 lg:gap-3 xl:gap-4">
                {modelTableColumns.map((rows, index) => (
                  <RelayModelsTable key={index} rows={rows} />
                ))}
              </div>
            </>
            )
          )}
        </Panel>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Panel
          title="价格历史"
          kicker="最近公开变更"
          headerClassName="mb-3"
          titleClassName="text-[2.2rem] md:text-[2.45rem]"
        >
          {pricing.error ? (
            <p className="text-sm text-[#b42318]">{pricing.error}</p>
          ) : pricing.loading || !pricing.data ? (
            <p className="text-sm text-black/60">正在加载价格历史...</p>
          ) : (
            <RelayPricingHistoryPanel modelNames={modelNames} rows={pricing.data.rows} />
          )}
        </Panel>
        <Panel
          title="事故时间线"
          kicker="近 30 天"
          headerClassName="mb-3"
          titleClassName="text-[2.2rem] md:text-[2.45rem]"
        >
          {incidents.error ? (
            <p className="text-sm text-[#b42318]">{incidents.error}</p>
          ) : incidents.loading || !incidents.data ? (
            <p className="text-sm text-black/60">正在加载事故时间线...</p>
          ) : (
            <RelayIncidentTimeline rows={incidents.data.rows} />
          )}
        </Panel>
      </section>
    </div>
  );
}

function MethodologyPage() {
  const { data, loading, error } = useLoadable<MethodologyResponse>(
    "/public/methodology",
    () => fetchJson("/public/methodology"),
    [],
  );
  usePageMetadata({
    title: "Relay 榜单方法论｜relaynew.ai",
    description: "解释 relay 评分构成、健康状态定义、徽章含义与榜单阅读方式，帮助运营和用户理解排序依据。",
    canonicalPath: "/methodology",
  });
  if (loading) return <MethodologyPageSkeleton />;
  if (error || !data) return <ErrorPanel message={error ?? "方法论页面加载失败。"} />;

  return (
    <div className="space-y-6">
      <section className="panel bg-[#fff0c2]">
        <p className="kicker">方法论</p>
        <div className="grid gap-4 xl:grid-cols-[1.02fr_0.98fr]">
          <div>
            <h1 className="max-w-3xl text-4xl leading-[0.92] tracking-[-0.06em] md:text-5xl">
              我们如何测试并评估 relay 的综合表现。
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-black/72">
              自然排序综合了五项公开信号：可用性、延迟、一致性、性价比与稳定性。
              赞助展示不会并入这个评分，因此实测排序始终保持清晰可读。
            </p>
            <div className="mt-5 flex flex-wrap gap-2.5">
              <Link className="button-dark" to="/policy">阅读评估政策</Link>
              <Link className="button-cream" to="/probe">开始一次探测</Link>
            </div>
            <p className="mt-4 text-xs uppercase tracking-[0.16em] text-black/50">
              快照时间：北京时间 {formatDateTime(data.measuredAt)}
            </p>
          </div>
          <div className="surface-card p-4">
            <p className="kicker">当前评分构成</p>
            <div className="mt-4 space-y-3">
              {Object.entries(data.weights).map(([label, value]) => (
                <div key={label}>
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-sm uppercase tracking-[0.16em] text-black/62">{formatScoreMetricLabel(label as keyof RelayOverviewResponse["scoreSummary"])}</p>
                    <p className="font-mono text-sm text-black/74">{value}%</p>
                  </div>
                  <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-white/55">
                    <div
                      className="h-full rounded-full bg-[linear-gradient(90deg,#ffd900,#fa520f)]"
                      style={{ width: `${value}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
      <section className="grid gap-4 lg:grid-cols-[0.96fr_1.04fr]">
        <Panel title="公开状态说明" kicker="状态口径">
          <div className="space-y-3">
            {data.healthStatuses.map((status) => (
              <div key={status} className="surface-card p-3.5">
                <div className="flex items-center gap-3 text-sm uppercase tracking-[0.14em] text-black/72">
                  <StatusDot status={status} /> {formatHealthStatusLabel(status)}
                </div>
                <p className="mt-3 text-sm leading-6 text-black/68">
                  {HEALTH_STATUS_COPY[status] ?? "公开状态文案基于最近一次的实测证据生成。"}
                </p>
              </div>
            ))}
          </div>
        </Panel>
        <div className="space-y-4">
          <Panel title="徽章含义" kicker="置信提示">
            <div className="grid gap-3 sm:grid-cols-2">
              {data.badges.map((badge) => (
                <div key={badge} className="surface-card p-3.5">
                  <span className="signal-chip">{formatBadgeLabel(badge)}</span>
                  <p className="mt-3 text-sm leading-6 text-black/68">
                    {BADGE_COPY[badge] ?? "这个徽章用于解释当前的置信度、性价比或运行状态。"}
                  </p>
                </div>
              ))}
            </div>
          </Panel>
          <Panel title="阅读提示" kicker="如何理解榜单">
            <div className="space-y-3 text-sm leading-6 text-black/72">
              {data.notes.map((note) => (
                <div key={note} className="surface-card p-3.5">
                  {note}
                </div>
              ))}
              <div className="surface-card p-3.5">
                如需了解收录规则、赞助分离与争议处理，请继续阅读公开政策页。
                {" "}
                <Link className="underline" to="/policy">查看政策</Link>
              </div>
            </div>
          </Panel>
        </div>
      </section>
    </div>
  );
}

function PolicyPage() {
  usePageMetadata({
    title: "Relay 评估政策｜relaynew.ai",
    description: "说明收录与审核规则、哪些因素影响自然排名、赞助位边界，以及运营者纠错申诉与复核流程。",
    canonicalPath: "/policy",
  });

  return (
    <div className="space-y-6">
      <section className="panel bg-[#fff0c2]">
        <p className="kicker">评估政策</p>
        <div className="grid gap-4 xl:grid-cols-[1.02fr_0.98fr]">
          <div>
            <h1 className="max-w-3xl text-4xl leading-[0.92] tracking-[-0.06em] md:text-5xl">
              目录保持中立、可观测，并支持运营者申诉与复核。
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-black/72">
              这里会解释哪些决策由测量结果驱动，哪些属于运营或编辑判断，以及运营者如何修正收录信息。
            </p>
            <div className="mt-5 flex flex-wrap gap-2.5">
              <Link className="button-dark" to="/submit">提交 Relay</Link>
              <Link className="button-cream" to="/methodology">阅读方法论</Link>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {POLICY_PILLARS.map((pillar) => (
              <div key={pillar.title} className="surface-card p-4">
                <p className="kicker">{pillar.title}</p>
                <p className="text-sm leading-6 text-black/68">{pillar.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <Panel title="哪些因素会影响榜单顺序" kicker="测量输入">
          <div className="space-y-3 text-sm leading-6 text-black/72">
            <div className="surface-card p-3.5">实测可用性，以及请求成功的连续性表现。</div>
            <div className="surface-card p-3.5">特定模型赛道下的延迟分布与近期一致性。</div>
            <div className="surface-card p-3.5">相对同类 relay 的价格效率与性价比。</div>
            <div className="surface-card p-3.5">稳定性信号、事故新鲜度，以及样本量带来的置信度。</div>
          </div>
        </Panel>
        <Panel title="哪些因素不会改变自然排名" kicker="边界说明">
          <div className="space-y-3 text-sm leading-6 text-black/72">
            <div className="surface-card p-3.5">赞助套餐、合作露出或其他推广展示。</div>
            <div className="surface-card p-3.5">缺乏测量变化支撑的人工调位请求。</div>
            <div className="surface-card p-3.5">无法复现、也没有最新证据支撑的单次 anecdote。</div>
            <div className="surface-card p-3.5">单独一次探测成功本身；公开探测用于诊断连通性，不直接定义排名。</div>
          </div>
        </Panel>
      </section>
      <section className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
        <Panel title="运营者复核路径" kicker="纠错与申诉">
          <div className="space-y-3 text-sm leading-6 text-black/72">
            <p className="surface-card p-3.5">
              如果你的 relay 端点、支持模型或公开信息发生变化，请使用最新的基础 URL 与运营者联系方式重新提交更新。
            </p>
            <p className="surface-card p-3.5">
              如果你认为公开状态不准确，请提供可复现的探测数据、受影响模型与需要复查的时间窗口。
            </p>
            <p className="surface-card p-3.5">
              在补充证据期间，条目可能会被暂停或标记为观察中，但赞助展示与自然排序的分离不会因此改变。
            </p>
          </div>
        </Panel>
        <Panel title="建议的运营动作顺序" kicker="实践流程">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="surface-card p-3.5">
              <p className="kicker !text-black/52">1. 探测</p>
              <p className="text-sm leading-6 text-black/68">先用受限探测验证公开路由、API 协议族和模型行为是否正常。</p>
            </div>
            <div className="surface-card p-3.5">
              <p className="kicker !text-black/52">2. 提交</p>
              <p className="text-sm leading-6 text-black/68">提交规范的 URL 与运营者联系信息，让 relay 带着上下文进入审核队列。</p>
            </div>
            <div className="surface-card p-3.5">
              <p className="kicker !text-black/52">3. 观察</p>
              <p className="text-sm leading-6 text-black/68">随着观测窗口逐渐填满，持续关注公开榜单、事故记录与备注说明。</p>
            </div>
          </div>
        </Panel>
      </section>
    </div>
  );
}

function SubmitPage() {
  const [state, setState] = useState<SubmitFormState>({
    relayName: "",
    baseUrl: "",
    websiteUrl: "",
    description: "",
    submitterEmail: "",
    testApiKey: "",
    testModel: "gpt-5.4",
    compatibilityMode: "auto",
  });
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<PublicSubmissionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<SubmitFormErrors>({});
  usePageMetadata({
    title: "提交 Relay｜relaynew.ai",
    description: "提交 relay 基础信息与测试参数进入审核队列，完成初始探测；赞助流程与自然排名逻辑分离。",
    canonicalPath: "/submit",
  });

  function updateField<Key extends keyof SubmitFormState>(key: Key, value: SubmitFormState[Key]) {
    setState((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => ({ ...current, [key]: undefined }));
    setError(null);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setResult(null);
    const { errors, payload } = validateSubmitForm(state);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setError("请先修正高亮字段后再提交。");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetchJson<PublicSubmissionResponse>("/public/submissions", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setResult(response);
      setState({
        relayName: "",
        baseUrl: "",
        websiteUrl: "",
        description: "",
        submitterEmail: "",
        testApiKey: "",
        testModel: "gpt-5.4",
        compatibilityMode: "auto",
      });
      setFieldErrors({});
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "提交 Relay 失败。");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
      <div className="panel hero-panel min-h-0">
        <p className="kicker">提交 Relay</p>
        <h1 className="text-4xl leading-[0.92] tracking-[-0.06em] md:text-5xl">把你的Relay站点信息提交，收录到站点目录中，有机会进入榜单排行，获得更多用户的认可</h1>
        <p className="mt-4 max-w-xl text-black/70">通过表单把 relay 送入审核队列。运营审批与赞助展示会独立处理，不会影响自然排名逻辑。</p>
        <div className="mt-6 grid gap-2.5 sm:grid-cols-3">
          <div className="surface-card p-3.5">
            <p className="kicker !text-black/52">先审核</p>
            <p className="text-sm leading-6 text-black/72">每个 relay 都会先进入运营审核队列，确认后才会出现在公开页面。</p>
          </div>
          <div className="surface-card p-3.5">
            <p className="kicker !text-black/52">验证信息</p>
            <p className="text-sm leading-6 text-black/72">请提供可用密钥、测试模型和简要说明，方便审核队列完成验证与归类。</p>
          </div>
          <div className="surface-card p-3.5">
            <p className="kicker !text-black/52">初始测试</p>
            <p className="text-sm leading-6 text-black/72">提交后会立即执行一次自动测试，后续会持续测试，请确保测试Key可用性。</p>
          </div>
        </div>
      </div>
      <form className="panel form-shell" noValidate onSubmit={handleSubmit}>
        <label className="form-field">
          中转站名称
          <input
            className="input-shell mt-2"
            type="text"
            placeholder="北风中转站"
            required
            value={state.relayName}
            onChange={(event) => updateField("relayName", event.target.value)}
          />
          {fieldErrors.relayName ? <span className="field-error">{fieldErrors.relayName}</span> : null}
        </label>
        <label className="form-field">
          Base URL
          <input
            className="input-shell mt-2"
            type="url"
            placeholder="https://northwind.example.ai/v1"
            required
            value={state.baseUrl}
            onChange={(event) => updateField("baseUrl", event.target.value)}
          />
          {fieldErrors.baseUrl ? <span className="field-error">{fieldErrors.baseUrl}</span> : null}
        </label>
        <label className="form-field">
          网站地址
          <input
            className="input-shell mt-2"
            type="url"
            placeholder="https://northwind.example.ai"
            value={state.websiteUrl}
            onChange={(event) => updateField("websiteUrl", event.target.value)}
          />
          {fieldErrors.websiteUrl ? <span className="field-error">{fieldErrors.websiteUrl}</span> : null}
        </label>
        <label className="form-field">
          中转站简介
          <textarea
            className="input-shell mt-2 min-h-28"
            placeholder="请提供中转站点的介绍，支持的模型、价格信息等等，这些信息将由社区运营志愿者整理后作为站点说明和价格表"
            required
            value={state.description}
            onChange={(event) => updateField("description", event.target.value)}
          />
          {fieldErrors.description ? <span className="field-error">{fieldErrors.description}</span> : null}
        </label>
        <label className="form-field">
          联系邮箱
          <input
            className="input-shell mt-2"
            type="email"
            placeholder="ops@example.com"
            value={state.submitterEmail}
            onChange={(event) => updateField("submitterEmail", event.target.value)}
          />
          {fieldErrors.submitterEmail ? <span className="field-error">{fieldErrors.submitterEmail}</span> : null}
        </label>
        <label className="form-field">
          测试API Key
          <input
            className="input-shell mt-2"
            type="password"
            placeholder="sk-monitoring-or-relay-key"
            required
            value={state.testApiKey}
            onChange={(event) => updateField("testApiKey", event.target.value)}
          />
          {fieldErrors.testApiKey ? <span className="field-error">{fieldErrors.testApiKey}</span> : null}
        </label>
        <div className="grid gap-4 md:grid-cols-[1fr_0.82fr]">
          <label className="form-field">
            测试模型
            <input
              className="input-shell mt-2"
              type="text"
              placeholder="gpt-5.4"
              required
              value={state.testModel}
              onChange={(event) => updateField("testModel", event.target.value)}
            />
            {fieldErrors.testModel ? <span className="field-error">{fieldErrors.testModel}</span> : null}
          </label>
          <label className="form-field">
            接口兼容类型
            <select
              className="input-shell mt-2"
              value={state.compatibilityMode}
              onChange={(event) => updateField("compatibilityMode", event.target.value as ProbeCompatibilityMode)}
            >
              {PROBE_COMPATIBILITY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
        </div>
        <button className="button-dark" disabled={submitting} type="submit">{submitting ? "提交中..." : "提交"}</button>
        {result ? (
          <div className="surface-card space-y-2 p-3.5">
            <p className="text-sm form-feedback-success">提交成功，记录 ID：{result.id}</p>
            {result.probe ? (
              <>
                <p className="text-sm leading-6 text-black/72">
                  初始测试：{result.probe.ok ? "已通过" : "需要复核"} · {formatHealthStatusLabel(result.probe.healthStatus)}
                  {result.probe.httpStatus ? ` · ${result.probe.httpStatus}` : ""}
                </p>
                {result.probe.message ? <p className="text-sm leading-6 text-black/58">{result.probe.message}</p> : null}
              </>
            ) : null}
          </div>
        ) : null}
        {error ? <p className="text-sm form-feedback-error">{error}</p> : null}
      </form>
    </section>
  );
}

function ProbePage() {
  const [searchParams] = useSearchParams();
  const {
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
  } = useProbeController(getProbeStateFromSearchParams(searchParams));
  usePageMetadata({
    title: "Relay 探测｜relaynew.ai",
    description: "在线检测 relay 连通性、协议兼容模式、HTTP 状态与请求轨迹，快速定位接入问题。",
    canonicalPath: "/probe",
  });

  return (
    <div className="space-y-6">
      <section className="grid gap-4 xl:grid-cols-[1.02fr_0.98fr] xl:items-start">
        <section className="panel">
          <p className="kicker">自助探测</p>
          <h1 className="text-[2.45rem] leading-[0.92] tracking-[-0.06em] md:text-5xl">
            运行探测
          </h1>
          <p className="form-note mt-4 text-sm leading-6">
            请使用你线上应用实际发送的基础 URL、密钥与模型。除非你已经明确知道所需协议族，否则建议从自动模式开始。
          </p>
          <form className="form-shell mt-4" onSubmit={handleSubmit}>
            <ProbeFormFields setState={setState} state={state} />
            <details className="surface-card p-4">
              <summary className="cursor-pointer font-mono text-sm uppercase tracking-[0.16em] text-black/70">高级选项 / 接口类型</summary>
              <label className="form-field mt-4">
                兼容模式
                <select
                  className="input-shell mt-2"
                  value={state.compatibilityMode}
                  onChange={(event) =>
                    setState((current) => ({
                      ...current,
                      compatibilityMode: event.target.value as ProbeCompatibilityMode,
                    }))
                  }
                >
                  {PROBE_COMPATIBILITY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <p className="mt-3 text-sm leading-6 text-black/60">
                自动模式会根据模型推断适配顺序；手动模式则会把探测锁定在单一兼容协议形态上。
              </p>
            </details>
            <button className="button-dark" disabled={submitting} type="submit">{submitting ? "检测中..." : "开始探测"}</button>
          </form>
        </section>

        <Panel title="探测结果" kicker={result ? "诊断输出" : error ? "请求失败" : "等待输入"} className={!result && !error ? "panel-soft" : ""}>
          {result ? (
            <>
              <div className={clsx("mb-5 border px-4 py-4", resultTone?.className)}>
                <p className="text-2xl tracking-[-0.05em]">{resultTone?.label}</p>
                <p className="mt-2 text-sm leading-6 text-current/85">{resultTone?.description}</p>
              </div>
              <MetricGrid
                columnsClassName="sm:grid-cols-2 xl:grid-cols-4"
                items={[
                  {
                    label: "连通性",
                    value: result.connectivity.ok ? "正常" : "失败",
                    testId: "probe-connectivity-value",
                    cardClassName: clsx("probe-metric-card", getConnectivityCardTone(result.connectivity.ok)),
                    valueClassName: "text-[1.08rem] leading-[1]",
                    valueSpacingClassName: "mt-2",
                  },
                  {
                    label: "协议",
                    value: result.protocol.ok ? formatHealthStatusLabel(result.protocol.healthStatus) : "未知",
                    testId: "probe-protocol-value",
                    cardClassName: clsx("probe-metric-card", getProtocolCardTone(result.protocol.healthStatus, result.protocol.ok)),
                    valueClassName: "text-[1.08rem] leading-[1]",
                    valueSpacingClassName: "mt-2",
                  },
                  {
                    label: "延迟",
                    value: result.connectivity.latencyMs ? `${result.connectivity.latencyMs} ms` : "-",
                    testId: "probe-latency-value",
                    cardClassName: "probe-metric-card",
                    valueClassName: "text-[1.08rem] leading-[1]",
                    valueSpacingClassName: "mt-2",
                  },
                  {
                    label: "HTTP 状态码",
                    value: formatProbeHttpStatus(result.protocol.httpStatus),
                    testId: "probe-http-status-value",
                    cardClassName: "probe-metric-card",
                    valueClassName: "text-[1.08rem] leading-[1]",
                    valueSpacingClassName: "mt-2",
                  },
                ]}
              />
              <div className="mt-5 space-y-4">
                <div className="surface-card p-4">
                  <p className="kicker">解析结果</p>
                  <div className="mt-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="kicker !text-black/52">主机</p>
                      <p
                        className="mt-1 break-all font-mono text-sm leading-6 tracking-[-0.02em] text-black/78"
                        data-testid="probe-host-value"
                        title={result.targetHost}
                      >
                        {result.targetHost}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-start justify-between gap-3">
                    <p
                        className="min-w-0 break-all font-mono text-sm leading-6 text-black/72"
                        data-testid="probe-used-url-value"
                        title={result.usedUrl ?? undefined}
                    >
                      {result.usedUrl ?? "本次没有记录到最终解析端点。"}
                    </p>
                    {result.usedUrl ? (
                      <button
                        className="copy-button"
                        data-testid="probe-copy-endpoint-button"
                        onClick={handleCopyUsedUrl}
                        type="button"
                      >
                        {copyState === "copied" ? "已复制" : copyState === "failed" ? "复制失败" : "复制"}
                      </button>
                    ) : null}
                  </div>
                  <dl className="mt-4 grid gap-x-4 gap-y-3 sm:grid-cols-2">
                    <div>
                      <dt className="kicker !text-black/52">兼容模式</dt>
                      <dd className="mt-1 text-sm leading-6 break-words text-black/78" data-testid="probe-mode-value">
                        {formatProbeCompatibilityMode(result.compatibilityMode)}
                      </dd>
                    </div>
                    <div>
                      <dt className="kicker !text-black/52">识别方式</dt>
                      <dd className="mt-1 text-sm leading-6 break-words text-black/78" data-testid="probe-detection-value">
                        {formatProbeDetectionMode(result.detectionMode)}
                      </dd>
                    </div>
                    <div>
                      <dt className="kicker !text-black/52">模型</dt>
                      <dd
                        className="mt-1 text-sm leading-6 break-words text-black/78"
                        data-testid="probe-model-value"
                        title={result.model}
                      >
                        {result.model}
                      </dd>
                    </div>
                    <div>
                      <dt className="kicker !text-black/52">测量时间</dt>
                      <dd
                        className="mt-1 text-sm leading-6 text-black/78"
                        data-testid="probe-measured-at-value"
                        title={result.measuredAt}
                      >
                        {formatProbeMeasuredAt(result.measuredAt)}
                      </dd>
                    </div>
                  </dl>
                </div>
                {result.message && !result.ok ? (
                  <div className="border border-[#b54708]/20 bg-[#fff7e8] p-4 text-sm leading-6 text-[#8a450c]">
                    {result.message}
                  </div>
                ) : null}
                <details className="surface-card p-4">
                  <summary className="cursor-pointer font-mono text-[0.72rem] uppercase tracking-[0.16em] text-black/68">
                    执行轨迹
                  </summary>
                  {attemptTrace.length > 0 ? (
                    <div className="mt-4 space-y-3">
                      {attemptTrace.map((attempt, index) => (
                        <div
                          className={clsx("trace-card border px-3 py-3", getTraceCardTone(attempt.httpStatus, attempt.matched))}
                          key={`${attempt.url}-${index}`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-xs uppercase tracking-[0.16em]">
                              #{index + 1} {attempt.label}
                            </p>
                            <p className="text-xs uppercase tracking-[0.16em]">
                              {attempt.matched ? "已匹配" : attempt.httpStatus ? `HTTP ${attempt.httpStatus}` : "无响应"}
                            </p>
                          </div>
                          <p className="mt-2 break-all font-mono text-xs leading-5 opacity-80">{attempt.url}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-4 text-sm leading-6 text-black/68">
                      本次运行没有记录到请求尝试。
                    </p>
                  )}
                </details>
                {failureGuidance ? (
                  <div className="surface-card p-4">
                    <p className="kicker">失败解读</p>
                    <div className="space-y-3 text-sm leading-6 text-black/72">
                      <p><span className="font-medium text-black/90">来源：</span>{failureGuidance.source}</p>
                      <p><span className="font-medium text-black/90">含义：</span>{failureGuidance.meaning}</p>
                      <p><span className="font-medium text-black/90">下一步：</span>{failureGuidance.nextStep}</p>
                    </div>
                  </div>
                ) : null}
                {!result.ok && result.detectionMode === "auto" ? (
                  <div className="border border-[#b54708]/20 bg-[#fff7e8] p-4 text-sm leading-6 text-[#8a450c]">
                    如果你觉得自动识别结果不对，请在高级选项中手动指定兼容模式后重新探测。
                  </div>
                ) : null}
              </div>
            </>
          ) : error ? (
            <div className="border border-[#b42318]/20 bg-[#fff2ef] px-4 py-4 text-[#8d2d17]" role="alert">
              <p className="kicker !text-current/70">探测请求失败</p>
              <p className="text-xl tracking-[-0.04em]">这次 relay 检查未能完成。</p>
              <p className="mt-3 text-sm leading-6 text-current/85">{error}</p>
              <p className="mt-2 text-sm leading-6 text-current/80">
                请重新检查基础 URL、密钥、兼容模式和上游路由后再重试。
              </p>
            </div>
          ) : (
            <div className="space-y-3 text-sm leading-6 text-black/70">
              <p className="text-sm leading-6 text-black/70">
                结果面板会展示连通性、协议状态、兼容模式识别结果、最终解析端点，以及到达上游路由时使用的请求轨迹。
              </p>
              <ul className="m-0 list-disc space-y-2 pl-5 text-black/66">
                <li>连通性会展示目标 relay 主机是否可达，以及对应延迟。</li>
                <li>协议检查会确认所选 API 协议族是否返回有效结构和健康状态。</li>
                <li>轨迹详情会展示探测实际使用的端点路径与请求尝试记录。</li>
              </ul>
            </div>
          )}
        </Panel>
      </section>
    </div>
  );
}

function NotFoundPage() {
  const navigate = useNavigate();
  usePageMetadata({
    title: "页面不存在｜relaynew.ai",
    description: "你访问的页面不存在，系统将返回 relaynew.ai 首页。",
  });

  useEffect(() => {
    const timer = window.setTimeout(() => navigate("/"), 2000);
    return () => window.clearTimeout(timer);
  }, [navigate]);
  return <ErrorPanel message="页面不存在，正在返回首页..." />;
}

export function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/leaderboard" element={<LeaderboardPage />} />
        <Route path={LEADERBOARD_DIRECTORY_PATH} element={<LeaderboardIndexPage />} />
        <Route path="/leaderboard/:modelKey" element={<LeaderboardPage />} />
        <Route path="/relay/:slug" element={<RelayPage />} />
        <Route path="/methodology" element={<MethodologyPage />} />
        <Route path="/policy" element={<PolicyPage />} />
        <Route path="/submit" element={<SubmitPage />} />
        <Route path="/probe" element={<ProbePage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </AppShell>
  );
}
