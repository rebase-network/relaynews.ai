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
import rebaseLogoUrl from "./assets/rebase-logo-wordmark-white-text.svg";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ?? "http://127.0.0.1:8787";

const PROBE_COMPATIBILITY_OPTIONS: Array<{ value: ProbeCompatibilityMode; label: string }> = [
  { value: "auto", label: "Auto detect (Recommended)" },
  { value: "openai-responses", label: "OpenAI Responses" },
  { value: "openai-chat-completions", label: "OpenAI Chat Completions" },
  { value: "anthropic-messages", label: "Anthropic Messages" },
];

const PROBE_FIELD_META = {
  baseUrl: {
    placeholder: "https://relay.example.ai or https://relay.example.ai/openai",
    helper:
      "Paste the relay root or provider prefix. The probe can add `/v1` and protocol-specific route suffixes automatically.",
    autoComplete: "url",
    inputMode: "url" as const,
  },
  apiKey: {
    placeholder: "Paste a relay API key",
    helper:
      "Used only for this bounded server-side request path. The result UI never prints the key back out.",
    autoComplete: "off",
    inputMode: "text" as const,
  },
  model: {
    placeholder: "gpt-5.3-codex",
    helper:
      "Use the exact model identifier you call in production. Automatic mode infers the adapter order from it.",
    autoComplete: "off",
    inputMode: "text" as const,
  },
} as const;

const PROBE_COMPATIBILITY_LABELS: Record<ProbeResolvedCompatibilityMode, string> = {
  "openai-responses": "OpenAI Responses",
  "openai-chat-completions": "OpenAI Chat Completions",
  "anthropic-messages": "Anthropic Messages",
};

const GITHUB_REPOSITORY_URL = "https://github.com/rebase-network/relaynews.ai";
const REBASE_NETWORK_URL = "https://rebase.network";

const HEALTH_STATUS_COPY: Record<string, string> = {
  healthy: "Consistent responses and stable measurements across the recent observation window.",
  degraded: "The relay is reachable, but latency, errors, or protocol behavior show material weakness.",
  down: "The relay is not serving the tested route in a usable way for the selected model family.",
  paused: "The relay is intentionally not ranked while the operator or catalog team reviews its state.",
  unknown: "There is not enough recent evidence to make a strong public status claim yet.",
};

const BADGE_COPY: Record<string, string> = {
  "low-latency": "Repeated low-latency performance for the measured model lane.",
  "high-stability": "Low variance and strong continuity over the observation window.",
  "high-value": "Competitive price-to-quality balance relative to peers in the same lane.",
  "sample-size-low": "The relay is still building evidence, so confidence should be interpreted carefully.",
  "under-observation": "The relay is visible, but current evidence is still being accumulated or reviewed.",
};

const POLICY_PILLARS = [
  {
    title: "Neutral inclusion",
    body: "Relays enter the catalog through operator submission and review. Listing does not guarantee a strong ranking position.",
  },
  {
    title: "Observable evidence",
    body: "Natural ranking is driven by measured availability, latency, stability, and value signals for each model lane.",
  },
  {
    title: "Sponsor separation",
    body: "Sponsored promotion stays visually distinct and never rewrites the measured order of the natural leaderboard.",
  },
  {
    title: "Operator recourse",
    body: "If a relay is misclassified, the operator can submit corrections, updated endpoints, or dispute evidence for review.",
  },
] as const;

const PROBE_OUTPUT_CARDS = [
  {
    title: "Connectivity",
    body: "Basic reachability plus a bounded latency measurement to the tested relay host.",
  },
  {
    title: "Protocol health",
    body: "The selected API family is checked for a valid response shape, status code, and health state.",
  },
  {
    title: "Trace detail",
    body: "You can inspect the exact endpoint path and request attempts the public probe used.",
  },
] as const;

const HOME_LEADERBOARD_ROW_LIMIT = 3;
const DEFAULT_LEADERBOARD_MODEL_KEY = "openai-gpt-5.4";
const LEADERBOARD_DIRECTORY_PATH = "/leaderboard/directory";
const LOADABLE_CACHE_MAX_AGE_MS = 60_000;

const LEADERBOARD_VENDOR_LABELS: Record<string, string> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
  google: "Google",
};

type LeaderboardHealthFilter = "all" | HealthStatus;

const LEADERBOARD_HEALTH_FILTERS: Array<{ value: LeaderboardHealthFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "healthy", label: "Healthy" },
  { value: "degraded", label: "Degraded" },
  { value: "down", label: "Down" },
  { value: "paused", label: "Paused" },
  { value: "unknown", label: "Unknown" },
];

function formatProbeCompatibilityMode(mode: ProbeResolvedCompatibilityMode | null | undefined) {
  return mode ? PROBE_COMPATIBILITY_LABELS[mode] : "Not detected";
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
    return "Manual override";
  }

  return "Automatic";
}

function formatProbeMeasuredAt(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatProbeHttpStatus(value: number | null | undefined) {
  return value ? String(value) : "n/a";
}

function formatProbeRequestCount(value: number) {
  return `${value} request${value === 1 ? "" : "s"}`;
}

function formatAvailability(value: number) {
  return `${(value * 100).toFixed(2)}%`;
}

function formatLatency(value: number | null) {
  return value === null ? "n/a" : `${value} ms`;
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
      const error = reason instanceof Error ? reason.message : "Unknown error";

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
        [`/public/relay/${slug}/incidents`, () => fetchJson(`/public/relay/${slug}/incidents`)],
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

function getProbeEndpointPath(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  try {
    return new URL(value).pathname || "/";
  } catch {
    return null;
  }
}

function getProbeResultTone(result: PublicProbeResponse) {
  if (!result.connectivity.ok) {
    return {
      label: "Connectivity failed",
      description: "The relay did not complete the basic network check. Review the upstream URL, auth, and network path.",
      className: "border-[#b42318]/20 bg-[#fff2ef] text-[#8d2d17]",
    };
  }

  if (!result.protocol.ok || result.protocol.healthStatus === "down") {
    return {
      label: "Protocol failed",
      description: "The endpoint answered, but the compatibility probe did not see a valid healthy protocol response.",
      className: "border-[#b42318]/20 bg-[#fff2ef] text-[#8d2d17]",
    };
  }

  if (result.protocol.healthStatus === "degraded" || !result.ok) {
    return {
      label: "Protocol degraded",
      description: "The relay is reachable, but the probe detected a degraded upstream state for this compatibility shape.",
      className: "border-[#b54708]/20 bg-[#fff7e8] text-[#8a450c]",
    };
  }

  return {
    label: "Probe healthy",
    description: "Connectivity, protocol validation, and compatibility resolution all completed successfully for the selected model.",
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
      source: "Network or target reachability",
      meaning: "The public probe could not complete a valid upstream HTTP exchange.",
      nextStep: "Check DNS, HTTPS availability, host allowlisting, and whether the base URL is reachable from the public internet.",
    };
  }

  if (status === 400) {
    return {
      source: "Upstream API returned HTTP 400",
      meaning: "The relay is reachable, but it rejected the request shape for this adapter or model.",
      nextStep: result.detectionMode === "auto"
        ? "Try a manual compatibility override. If the relay is OpenAI-compatible but not Responses-compatible, switch to Chat Completions."
        : "Recheck the selected compatibility mode, model availability, and whether the base URL already includes an `/openai` or `/v1` prefix.",
    };
  }

  if (status === 401 || status === 403) {
    return {
      source: "Upstream API authentication",
      meaning: "The endpoint answered, but the supplied key was rejected or lacks permission for this route/model.",
      nextStep: "Verify the key, account permissions, and whether the provider expects a different auth header for this compatibility mode.",
    };
  }

  if (status === 404) {
    return {
      source: "Upstream route mismatch",
      meaning: "The relay answered, but the tested compatibility path was not found.",
      nextStep: result.detectionMode === "auto"
        ? "Try a manual compatibility override or adjust the base URL so the probe builds the correct `/v1` path."
        : "Check whether the base URL already includes `/v1`, `/openai`, or another provider-specific prefix.",
    };
  }

  if (status === 405) {
    return {
      source: "Upstream method mismatch",
      meaning: "The route exists, but it does not accept the probe request method for this adapter.",
      nextStep: "Double-check that the chosen compatibility mode matches the provider and endpoint family.",
    };
  }

  if (status === 415) {
    return {
      source: "Upstream content negotiation",
      meaning: "The endpoint rejected the request content-type or streaming shape for this adapter.",
      nextStep: "Try a different compatibility mode or verify whether the provider expects a non-streaming variant for this endpoint.",
    };
  }

  if (status === 429) {
    return {
      source: "Upstream rate limit",
      meaning: "The relay is reachable, but the provider is currently throttling the probe request.",
      nextStep: "Retry after the provider cooldown or test with a key and model that still have quota.",
    };
  }

  if (status >= 500) {
    return {
      source: "Upstream server error",
      meaning: "The relay accepted the request but failed internally while serving it.",
      nextStep: "Retry later or contact the relay operator with the measured status and endpoint path.",
    };
  }

  return {
    source: `Upstream API returned HTTP ${status}`,
    meaning: "The request reached the relay, but the upstream response did not match the selected compatibility shape.",
    nextStep: "Verify the base URL, compatibility mode, and model support, then retry with the most likely adapter.",
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
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const contentType = response.headers.get("content-type") ?? "";

    if (contentType.includes("application/json")) {
      const payload = (await response.json()) as ApiErrorPayload;
      throw new Error(formatApiErrorPayload(payload) ?? `Request failed with ${response.status}`);
    }

    const text = await response.text();
    throw new Error(text || `Request failed with ${response.status}`);
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
  submitterEmail: string;
};

type SubmitFormErrors = Partial<Record<keyof SubmitFormState, string>>;

function validateSubmitForm(state: SubmitFormState) {
  const errors: SubmitFormErrors = {};
  const relayName = state.relayName.trim();
  const baseUrl = state.baseUrl.trim();
  const websiteUrl = state.websiteUrl.trim();
  const submitterEmail = state.submitterEmail.trim();

  if (!relayName) {
    errors.relayName = "Relay name is required.";
  }

  if (!baseUrl) {
    errors.baseUrl = "Base URL is required.";
  } else if (!isValidHttpUrl(baseUrl)) {
    errors.baseUrl = "Enter a full base URL such as https://relay.example.ai/v1.";
  }

  if (websiteUrl && !isValidHttpUrl(websiteUrl)) {
    errors.websiteUrl = "Enter a valid website URL such as https://relay.example.ai.";
  }

  if (submitterEmail && !isValidEmail(submitterEmail)) {
    errors.submitterEmail = "Enter a valid contact email address.";
  }

  return {
    errors,
    payload: {
      relayName,
      baseUrl,
      websiteUrl: websiteUrl || undefined,
      submitterEmail: submitterEmail || undefined,
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
      setError(reason instanceof Error ? reason.message : "Probe failed.");
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
  const usedEndpointPath = useMemo(() => getProbeEndpointPath(result?.usedUrl), [result?.usedUrl]);
  const requestSummary = useMemo(() => {
    if (!result) {
      return null;
    }

    if (result.ok) {
      return attemptTrace.length <= 1
        ? "Matched on the first request"
        : `Matched after ${formatProbeRequestCount(attemptTrace.length)}`;
    }

    return attemptTrace.length > 0
      ? `Checked ${formatProbeRequestCount(attemptTrace.length)}`
      : "Probe did not reach the upstream route";
  }, [attemptTrace.length, result]);

  return {
    attemptTrace,
    copyState,
    error,
    failureGuidance,
    handleCopyUsedUrl,
    handleSubmit,
    requestSummary,
    result,
    resultTone,
    setState,
    state,
    submitting,
    usedEndpointPath,
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
    ["API key", "apiKey"],
    ["Model", "model"],
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
              <span className="input-helper">
                {PROBE_FIELD_META[key].helper}
              </span>
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
        Probe failed. {error}
      </p>
    );
  }

  if (!result || !resultTone) {
    return (
      <p className="quick-probe-inline-summary">
        Status, latency, HTTP, and API type appear here after a probe.
      </p>
    );
  }

  const latencyText = result.connectivity.latencyMs ? `${result.connectivity.latencyMs} ms` : "latency n/a";
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
          setError(reason instanceof Error ? reason.message : "Unknown error");
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
    ["/", "Home"],
    ["/leaderboard", "Leaderboard"],
    ["/methodology", "Methodology"],
    ["/submit", "Submit"],
    ["/probe", "Probe"],
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
                  relay health, latency, pricing, and trust signals
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
              {mobileNavOpen ? "Close" : "Menu"}
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

function Panel({ title, kicker, children, className }: { title?: string; kicker?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={clsx("panel", className)}>
      {(kicker || title) && (
        <header className="mb-4">
          {kicker ? <p className="kicker">{kicker}</p> : null}
          {title ? <h2 className="text-3xl leading-[0.95] tracking-[-0.04em] md:text-[2.9rem]">{title}</h2> : null}
        </header>
      )}
      {children}
    </section>
  );
}

function LoadingPanel() {
  return <div className="panel text-sm uppercase tracking-[0.15em] text-black/60">Loading...</div>;
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
              {["Base URL", "API key", "Model"].map((label) => (
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

      <section className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
        <section className="panel">
          <div className="mb-4 space-y-2">
            <SkeletonBlock className="skeleton-kicker max-w-[7rem]" />
            <SkeletonBlock className="skeleton-heading-md max-w-[14rem]" />
          </div>
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, index) => (
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
        <section className="panel">
          <div className="mb-4 space-y-2">
            <SkeletonBlock className="skeleton-kicker max-w-[8rem]" />
            <SkeletonBlock className="skeleton-heading-md max-w-[12rem]" />
          </div>
          <div className="space-y-3">
            {Array.from({ length: 2 }).map((_, index) => (
              <div key={index} className="surface-card p-3.5">
                <div className="flex items-center justify-between gap-4">
                  <SkeletonBlock className="skeleton-line max-w-[11rem]" />
                  <SkeletonBlock className="skeleton-pill w-[5.8rem]" />
                </div>
                <div className="mt-3 space-y-2">
                  <SkeletonBlock className="skeleton-line" />
                  <SkeletonBlock className="skeleton-line max-w-[80%]" />
                </div>
              </div>
            ))}
          </div>
        </section>
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

      <section className="directory-filters">
        <div className="space-y-2">
          <SkeletonBlock className="skeleton-kicker max-w-[8rem]" />
          <SkeletonBlock className="skeleton-input" />
        </div>
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
        <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-3">
            <SkeletonBlock className="skeleton-pill w-[6rem]" />
            <div className="space-y-3">
              <SkeletonBlock className="skeleton-heading-lg max-w-[18rem]" />
              <SkeletonBlock className="skeleton-line max-w-[20rem]" />
            </div>
            <div className="flex flex-wrap gap-2">
              <SkeletonBlock className="skeleton-pill w-[5rem]" />
              <SkeletonBlock className="skeleton-pill w-[6rem]" />
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
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <section className="panel">
          <div className="mb-4 space-y-2">
            <SkeletonBlock className="skeleton-kicker max-w-[9rem]" />
            <SkeletonBlock className="skeleton-heading-md max-w-[15rem]" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="metric-card">
                <SkeletonBlock className="skeleton-kicker max-w-[5rem]" />
                <SkeletonBlock className="skeleton-heading-md mt-4 max-w-[4rem]" />
              </div>
            ))}
          </div>
        </section>
        <section className="panel">
          <div className="mb-4 space-y-2">
            <SkeletonBlock className="skeleton-kicker max-w-[8rem]" />
            <SkeletonBlock className="skeleton-heading-md max-w-[12rem]" />
          </div>
          <SkeletonBlock className="h-36 w-full" />
        </section>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <section key={index} className="panel">
            <div className="mb-4 space-y-2">
              <SkeletonBlock className="skeleton-kicker max-w-[8rem]" />
              <SkeletonBlock className="skeleton-heading-md max-w-[13rem]" />
            </div>
            <div className="space-y-2.5">
              {Array.from({ length: 3 }).map((__, innerIndex) => (
                <div key={innerIndex} className="surface-card p-3.5">
                  <div className="space-y-2">
                    <SkeletonBlock className="skeleton-line max-w-[10rem]" />
                    <SkeletonBlock className="skeleton-line max-w-[7rem]" />
                    <SkeletonBlock className="skeleton-line max-w-[12rem]" />
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
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
  const tone =
    status === "healthy"
      ? "bg-emerald-500"
      : status === "degraded"
        ? "bg-amber-500"
        : status === "down"
          ? "bg-red-500"
          : "bg-zinc-400";

  return <span className={clsx("status-dot inline-block h-2.5 w-2.5", tone)} />;
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
            className={clsx("mt-3 tracking-[-0.04em]", item.valueClassName ?? "text-3xl")}
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

function LeaderboardPreviewCard({
  board,
  rowLimit,
}: {
  board: HomeSummaryResponse["leaderboards"][number];
  rowLimit?: number;
}) {
  const rows = board.rows.slice(0, rowLimit ?? board.rows.length);

  return (
    <section className="panel h-full">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="kicker">{board.modelKey}</p>
          <h2 className="text-3xl leading-[0.94] tracking-[-0.05em]">{board.modelName}</h2>
          <p className="mt-2 text-sm uppercase tracking-[0.16em] text-black/50">
            Snapshot {new Date(board.measuredAt).toLocaleString()}
          </p>
        </div>
        <Link className="signal-chip" to={getLeaderboardPath(board.modelKey)}>
          Open full board
        </Link>
      </div>
      <div className="mt-5 space-y-2.5">
        {rows.map((row) => (
          <Link
            key={row.relay.slug}
            className="surface-link flex items-center justify-between gap-4 p-3.5"
            to={`/relay/${row.relay.slug}`}
          >
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-black/55">#{row.rank}</p>
              <p className="text-xl tracking-[-0.03em]">{row.relay.name}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {row.badges.slice(0, 2).map((badge) => (
                  <span key={badge} className="signal-chip">
                    {badge}
                  </span>
                ))}
              </div>
            </div>
            <div className="min-w-[8.5rem] text-right text-sm">
              <div className="flex items-center justify-end gap-2 uppercase tracking-[0.12em]">
                <StatusDot status={row.healthStatus} /> {row.healthStatus}
              </div>
              <p className="mt-1">{row.score.toFixed(1)} score</p>
              <p className="mt-1 text-xs uppercase tracking-[0.14em] text-black/54">
                {formatAvailability(row.availability24h)} · {formatLatency(row.latencyP50Ms)}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

function LeaderboardRowCard({ row }: { row: LeaderboardResponse["rows"][number] }) {
  return (
    <article className="surface-card p-4 md:hidden">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.16em] text-black/55">#{row.rank}</p>
          <Link to={`/relay/${row.relay.slug}`} className="mt-1 block text-[1.65rem] leading-[0.96] tracking-[-0.04em] hover:underline">
            {row.relay.name}
          </Link>
          <div className="mt-3 flex flex-wrap gap-2 text-xs uppercase tracking-[0.14em] text-black/55">
            {row.badges.map((badge) => <span key={badge} className="signal-chip">{badge}</span>)}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-black/62">
            <StatusDot status={row.healthStatus} /> {row.healthStatus}
          </div>
          <p className="mt-3 text-[2rem] leading-[0.94] tracking-[-0.05em]">{row.score.toFixed(1)}</p>
          <p className="text-[0.68rem] uppercase tracking-[0.18em] text-black/46">score</p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2.5">
        <div className="border border-black/8 bg-white/72 px-3 py-2.5">
          <p className="text-[0.64rem] uppercase tracking-[0.18em] text-black/46">Avail 24h</p>
          <p className="mt-2 text-sm leading-5 text-black/78">{formatAvailability(row.availability24h)}</p>
        </div>
        <div className="border border-black/8 bg-white/72 px-3 py-2.5">
          <p className="text-[0.64rem] uppercase tracking-[0.18em] text-black/46">Latency p50</p>
          <p className="mt-2 text-sm leading-5 text-black/78">{formatLatency(row.latencyP50Ms)}</p>
        </div>
        <div className="border border-black/8 bg-white/72 px-3 py-2.5">
          <p className="text-[0.64rem] uppercase tracking-[0.18em] text-black/46">Input / 1M</p>
          <p className="mt-2 text-sm leading-5 text-black/78">{row.inputPricePer1M ?? "-"}</p>
        </div>
        <div className="border border-black/8 bg-white/72 px-3 py-2.5">
          <p className="text-[0.64rem] uppercase tracking-[0.18em] text-black/46">Output / 1M</p>
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

  if (loading) return <HomePageSkeleton />;
  if (error || !data) return <ErrorPanel message={error ?? "Unable to load homepage."} />;

  return (
    <div className="space-y-5">
      <section className="panel hero-panel min-h-0">
        <div className="grid gap-5 xl:grid-cols-[0.98fr_1.02fr] xl:items-start">
          <div>
            <p className="kicker text-black/70">Relay intelligence</p>
            <h1 className="max-w-4xl text-4xl leading-[0.92] tracking-[-0.07em] md:text-5xl xl:text-[4rem]">
              Find strong relays fast, test your own endpoint, and submit for inclusion.
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-black/75">
              Browse model-specific boards, inspect neutral ranking signals, and open the full probe workspace when you need deeper diagnostics.
            </p>
            <div className="mt-6 flex flex-wrap gap-2.5">
              <Link className="button-dark" to="/leaderboard">Browse leaderboards</Link>
              <Link className="button-cream" to="/probe">Run probe</Link>
              <Link className="button-cream" to="/submit">Submit relay</Link>
            </div>
          </div>
          <div className="space-y-3">
            <form className="quick-probe-card quick-probe-form" onSubmit={quickProbe.handleSubmit}>
              <div className="quick-probe-header">
                <div>
                  <p className="quick-probe-heading">Quick probe</p>
                </div>
                <Link
                  aria-label="Open the pro probe page"
                  className="quick-probe-link"
                  title="Open the pro probe page"
                  to="/probe"
                >
                  Pro Probe
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
                  {quickProbe.submitting ? "Checking..." : "Probe"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </section>

      <Panel title="Featured boards" kicker="Model lanes">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <p className="max-w-3xl text-sm leading-6 text-black/68">
            The homepage highlights a curated set of model lanes. Open any board to inspect the full ranked table, then compare pricing, stability, and latency in more detail.
          </p>
          <Link className="button-cream" to={LEADERBOARD_DIRECTORY_PATH}>
            All model lanes
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

      <section className="home-bridge">
        <p className="home-bridge-copy">
          Methodology explains how relays are measured. Policy covers listing rules, sponsor separation, and review.
        </p>
        <div className="home-bridge-actions">
          <Link className="home-bridge-link" to="/methodology">
            Methodology
          </Link>
          <Link className="home-bridge-link" to="/policy">
            Policy
          </Link>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
        <Panel title="Watchlist" kicker="Relays to watch">
          <div className="space-y-3">
            {data.highlights.map((relay) => (
              <Link key={relay.slug} to={`/relay/${relay.slug}`} className="surface-link flex items-center justify-between gap-4 p-3.5">
                <div>
                  <p className="text-xl tracking-[-0.03em]">{relay.name}</p>
                  <p className="mt-2"><span className="signal-chip">{relay.badge}</span></p>
                </div>
                <div className="flex items-center gap-2 text-sm uppercase tracking-[0.12em]"><StatusDot status={relay.healthStatus} /> {relay.healthStatus}</div>
              </Link>
            ))}
          </div>
        </Panel>
        <Panel title="Incidents" kicker="Recent disruptions">
          <div className="space-y-3">
            {data.latestIncidents.length === 0 ? (
              <p className="text-sm text-black/65">No incidents recorded in the current snapshot.</p>
            ) : (
              data.latestIncidents.map((incident) => (
                <div key={incident.id} className="surface-card p-3.5">
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-xl tracking-[-0.03em]">{incident.title}</p>
                    <div className="flex items-center gap-2 text-sm uppercase tracking-[0.16em]"><StatusDot status={incident.severity} /> {incident.severity}</div>
                  </div>
                  <p className="mt-2 text-sm text-black/70">{incident.summary}</p>
                  <p className="mt-4 text-xs uppercase tracking-[0.14em] text-black/50">{incident.relay.name} · {new Date(incident.startedAt).toLocaleString()}</p>
                </div>
              ))
            )}
          </div>
        </Panel>
      </section>
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
  const boards = data?.boards ?? [];
  const searchQuery = searchParams.get("q")?.trim() ?? "";
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
  const filteredBoards = useMemo(() => {
    const normalizedQuery = searchQuery.toLowerCase();

    return boards.filter((board) => {
      const vendorKey = getModelVendorKey(board.modelKey);
      const matchesVendor = vendorFilter === "all" || vendorKey === vendorFilter;
      const matchesQuery =
        normalizedQuery.length === 0 ||
        board.modelName.toLowerCase().includes(normalizedQuery) ||
        board.modelKey.toLowerCase().includes(normalizedQuery) ||
        getModelVendorLabel(board.modelKey).toLowerCase().includes(normalizedQuery);

      return matchesVendor && matchesQuery;
    });
  }, [boards, searchQuery, vendorFilter]);

  if (loading) return <LeaderboardDirectorySkeleton />;
  if (error || !data) return <ErrorPanel message={error ?? "Unable to load leaderboard directory."} />;

  function updateDirectorySearch(next: { q?: string; vendor?: string }) {
    const params = new URLSearchParams(searchParams);

    if (next.q !== undefined) {
      const value = next.q.trim();
      if (value) {
        params.set("q", value);
      } else {
        params.delete("q");
      }
    }

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
        <p className="kicker">Leaderboard directory</p>
        <div className="grid gap-4 xl:grid-cols-[1fr_0.9fr] xl:items-end">
          <div>
            <h1 className="max-w-3xl text-4xl leading-[0.92] tracking-[-0.06em] md:text-5xl">
              Browse every model lane before drilling into a single board.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-black/72">
              The directory groups relays by model. Open any model board to inspect the full ranked table, health state, latency, and pricing context for that lane.
            </p>
          </div>
          <div className="flex flex-wrap gap-2.5 xl:justify-end">
            <Link className="button-dark" to="/leaderboard">Open live board</Link>
            <Link className="button-cream" to="/probe">Run probe</Link>
          </div>
        </div>
      </section>

      <section className="directory-filters">
        <label className="directory-search">
          <span className="directory-search-label">Search lanes</span>
          <input
            aria-label="Search lanes"
            className="input-shell"
            onChange={(event) => updateDirectorySearch({ q: event.target.value })}
            placeholder="Search model or vendor"
            type="search"
            value={searchQuery}
          />
        </label>
        <div className="directory-vendor-row">
          <button
            className={clsx("directory-filter-chip", vendorFilter === "all" && "directory-filter-chip-active")}
            onClick={() => updateDirectorySearch({ vendor: "all" })}
            type="button"
          >
            All
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
          Showing {filteredBoards.length} of {data.boards.length} boards
        </p>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        {filteredBoards.map((board) => (
          <LeaderboardPreviewCard key={board.modelKey} board={board} />
        ))}
      </div>
      {filteredBoards.length === 0 ? (
        <section className="directory-empty-state">
          <p className="kicker">No matches</p>
          <h2 className="text-3xl leading-[0.96] tracking-[-0.04em]">No leaderboard lanes match this filter.</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-black/68">
            Clear the search term or switch vendor filters to bring the full directory back.
          </p>
          <button
            className="button-cream mt-5"
            onClick={() => setSearchParams(new URLSearchParams())}
            type="button"
          >
            Reset filters
          </button>
        </section>
      ) : null}
    </div>
  );
}

function LeaderboardPage() {
  const { modelKey = DEFAULT_LEADERBOARD_MODEL_KEY } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const limit = searchParams.get("limit") ?? "20";
  const rowQuery = searchParams.get("q")?.trim() ?? "";
  const rawHealthFilter = searchParams.get("health");
  const healthFilter: LeaderboardHealthFilter = LEADERBOARD_HEALTH_FILTERS.some(
    (option) => option.value === rawHealthFilter,
  )
    ? (rawHealthFilter as LeaderboardHealthFilter)
    : "all";
  const directory = useLoadable<LeaderboardDirectoryResponse>(
    "/public/leaderboard-directory",
    () => fetchJson("/public/leaderboard-directory"),
    [],
  );
  const leaderboardCacheKey = `/public/leaderboard/${modelKey}?limit=${limit}`;
  const { data, loading, error } = useLoadable<LeaderboardResponse>(
    leaderboardCacheKey,
    () => fetchJson(leaderboardCacheKey),
    [modelKey, limit],
  );
  const rows = data?.rows ?? [];

  const filteredRows = useMemo(() => {
    const normalizedQuery = rowQuery.toLowerCase();

    return rows.filter((row) => {
      const matchesHealth = healthFilter === "all" || row.healthStatus === healthFilter;
      const matchesQuery =
        normalizedQuery.length === 0 ||
        row.relay.name.toLowerCase().includes(normalizedQuery) ||
        row.relay.slug.toLowerCase().includes(normalizedQuery) ||
        row.badges.some((badge) => badge.toLowerCase().includes(normalizedQuery));

      return matchesHealth && matchesQuery;
    });
  }, [healthFilter, rowQuery, rows]);

  const healthFilterOptions = useMemo(
    () =>
      LEADERBOARD_HEALTH_FILTERS.filter((option) => {
        if (option.value === "all" || option.value === healthFilter) {
          return true;
        }

        return rows.some((row) => row.healthStatus === option.value);
      }).map((option) => ({
        ...option,
        count:
          option.value === "all"
            ? rows.length
            : rows.filter((row) => row.healthStatus === option.value).length,
      })),
    [healthFilter, rows],
  );

  const leaderboardSearch = searchParams.toString();

  if (loading) return <LeaderboardPageSkeleton />;
  if (error || !data) return <ErrorPanel message={error ?? "Unable to load leaderboard."} />;

  function updateLeaderboardFilters(next: {
    limit?: string;
    q?: string;
    health?: LeaderboardHealthFilter;
  }) {
    const params = new URLSearchParams(searchParams);

    if (next.limit !== undefined) {
      if (next.limit === "20") {
        params.delete("limit");
      } else {
        params.set("limit", next.limit);
      }
    }

    if (next.q !== undefined) {
      const value = next.q.trim();
      if (value) {
        params.set("q", value);
      } else {
        params.delete("q");
      }
    }

    if (next.health !== undefined) {
      if (next.health === "all") {
        params.delete("health");
      } else {
        params.set("health", next.health);
      }
    }

    setSearchParams(params);
  }

  return (
    <div className="space-y-6">
      <section className="panel bg-[#fff0c2]">
        <p className="kicker">Leaderboard</p>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-4xl leading-[0.92] tracking-[-0.06em] md:text-5xl">{data.model.name}</h1>
            <p className="mt-2 text-sm uppercase tracking-[0.16em] text-black/60">Measured at {new Date(data.measuredAt).toLocaleString()}</p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <Link className="button-dark" to={LEADERBOARD_DIRECTORY_PATH}>All model lanes</Link>
            <Link className="button-cream" to="/probe">Run probe</Link>
          </div>
        </div>
      </section>
      {directory.data?.boards.length ? (
        <section className="panel-soft border border-black/8 px-4 py-4">
          <div className="flex flex-col gap-3">
            <div>
              <p className="kicker">Switch model lane</p>
              <p className="text-sm leading-6 text-black/68">
                Move across tracked model boards without leaving the full ranking view.
              </p>
            </div>
            <div className="leaderboard-model-switcher">
              {directory.data.boards.map((board) => (
                <Link
                  key={board.modelKey}
                  className={clsx(
                    "leaderboard-model-pill",
                    board.modelKey === data.model.key && "leaderboard-model-pill-active",
                  )}
                  to={{
                    pathname: getLeaderboardPath(board.modelKey),
                    search: leaderboardSearch ? `?${leaderboardSearch}` : "",
                  }}
                >
                  {board.modelName}
                </Link>
              ))}
            </div>
          </div>
        </section>
      ) : null}
      <section className="leaderboard-row-filters">
        <div className="leaderboard-row-filter-grid">
          <label className="directory-search">
            <span className="directory-search-label">Search relays</span>
            <input
              aria-label="Search relays"
              className="input-shell"
              onChange={(event) => updateLeaderboardFilters({ q: event.target.value })}
              placeholder="Search relay name, slug, or badge"
              type="search"
              value={rowQuery}
            />
          </label>
          <label className="directory-search">
            <span className="directory-search-label">Rows</span>
            <select
              aria-label="Rows"
              className="input-shell"
              value={limit}
              onChange={(event) => updateLeaderboardFilters({ limit: event.target.value })}
            >
              <option value="10">10</option>
              <option value="20">20</option>
              <option value="50">50</option>
            </select>
          </label>
        </div>
        <div className="directory-vendor-row">
          {healthFilterOptions.map((option) => (
            <button
              key={option.value}
              className={clsx(
                "directory-filter-chip",
                healthFilter === option.value && "directory-filter-chip-active",
              )}
              onClick={() => updateLeaderboardFilters({ health: option.value })}
              type="button"
            >
              {option.label}
              <span className="leaderboard-chip-count">{option.count}</span>
            </button>
          ))}
        </div>
        <p className="directory-filter-meta">
          Showing {filteredRows.length} of {data.rows.length} rows
          {rowQuery ? ` for "${rowQuery}"` : ""}
        </p>
      </section>
      <Panel title="Ranked relay rows" kicker="Natural ranking">
        {filteredRows.length ? (
          <>
            <div className="space-y-3 md:hidden">
              {filteredRows.map((row) => (
                <LeaderboardRowCard key={row.relay.slug} row={row} />
              ))}
            </div>
            <div className="data-table hidden md:block">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-black/10">
                    <th className="pb-2.5">Rank</th>
                    <th className="pb-2.5">Relay</th>
                    <th className="pb-2.5">Health</th>
                    <th className="pb-2.5">Score</th>
                    <th className="pb-2.5">Avail 24h</th>
                    <th className="pb-2.5">Latency p50</th>
                    <th className="pb-2.5">Input</th>
                    <th className="pb-2.5">Output</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row) => (
                    <tr key={row.relay.slug} className="align-top">
                      <td className="py-3.5 text-2xl tracking-[-0.04em]">#{row.rank}</td>
                      <td className="py-3.5">
                        <Link to={`/relay/${row.relay.slug}`} className="text-xl tracking-[-0.03em] hover:underline">{row.relay.name}</Link>
                        <div className="mt-2 flex flex-wrap gap-2 text-xs uppercase tracking-[0.14em] text-black/55">
                          {row.badges.map((badge) => <span key={badge} className="signal-chip">{badge}</span>)}
                        </div>
                      </td>
                      <td className="py-3.5 text-sm uppercase tracking-[0.14em]"><span className="inline-flex items-center gap-2"><StatusDot status={row.healthStatus} /> {row.healthStatus}</span></td>
                      <td className="py-3.5 text-xl tracking-[-0.03em]">{row.score.toFixed(1)}</td>
                      <td className="py-3.5">{formatAvailability(row.availability24h)}</td>
                      <td className="py-3.5">{formatLatency(row.latencyP50Ms)}</td>
                      <td className="py-3.5">{row.inputPricePer1M ?? "-"}</td>
                      <td className="py-3.5">{row.outputPricePer1M ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="directory-empty-state">
            <p className="kicker">No rows</p>
            <h2 className="text-3xl leading-[0.96] tracking-[-0.04em]">No relays match this combination yet.</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-black/68">
              Clear the search term or switch the health filter to bring the full ranked table back.
            </p>
            <button
              className="button-cream mt-5"
              onClick={() => setSearchParams(limit === "20" ? new URLSearchParams() : new URLSearchParams({ limit }))}
              type="button"
            >
              Reset filters
            </button>
          </div>
        )}
      </Panel>
    </div>
  );
}

function MiniBars({ points }: { points: RelayHistoryResponse["points"] }) {
  const maxLatency = Math.max(...points.map((point) => point.latencyP95Ms ?? 0), 1);
  return (
    <div className="flex h-36 items-end gap-1">
      {points.map((point) => (
        <div key={point.bucketStart} className="flex-1 bg-[linear-gradient(180deg,#ffd900,#fa520f)]" style={{ height: `${((point.latencyP95Ms ?? 0) / maxLatency) * 100}%` }} title={`${point.bucketStart} · ${point.latencyP95Ms ?? 0} ms`} />
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
    `/public/relay/${slug}/history?window=7d`,
    () => fetchJson(`/public/relay/${slug}/history?window=7d`),
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
    `/public/relay/${slug}/incidents`,
    () => fetchJson(`/public/relay/${slug}/incidents`),
    [slug],
  );

  if (overview.loading) return <RelayPageSkeleton />;
  if (overview.error || !overview.data) return <ErrorPanel message={overview.error ?? "Unable to load relay."} />;

  return (
    <div className="space-y-6">
      <section className="panel bg-[linear-gradient(135deg,rgba(255,240,194,1),rgba(255,184,62,0.75))]">
        <p className="kicker">Relay detail</p>
        <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <div className="flex items-center gap-3 text-sm uppercase tracking-[0.16em]"><StatusDot status={overview.data.healthStatus} /> {overview.data.healthStatus}</div>
            <h1 className="mt-3 text-4xl leading-[0.92] tracking-[-0.06em] md:text-5xl">{overview.data.relay.name}</h1>
            <p className="mt-3 max-w-2xl text-black/70">{overview.data.relay.baseUrl}</p>
            <div className="mt-5 flex flex-wrap gap-2 text-xs uppercase tracking-[0.14em] text-black/65">
              {overview.data.badges.map((badge) => <span key={badge} className="signal-chip">{badge}</span>)}
            </div>
          </div>
          <MetricGrid
            items={[
              { label: "Availability 24h", value: `${(overview.data.availability24h * 100).toFixed(2)}%` },
              { label: "Latency p50", value: `${overview.data.latencyP50Ms ?? "-"} ms` },
              { label: "Models", value: overview.data.supportedModelsCount },
              { label: "Incidents 7d", value: overview.data.incidents7d },
            ]}
          />
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <Panel title="Score composition" kicker="Why the relay ranks here">
          <MetricGrid
            items={Object.entries(overview.data.scoreSummary).map(([label, value]) => ({ label, value: value.toFixed(1) }))}
          />
        </Panel>
        <Panel title="Latency profile" kicker="Seven-day shape">
          {history.loading || !history.data ? <p className="text-sm text-black/60">Loading trend...</p> : <MiniBars points={history.data.points} />}
        </Panel>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <Panel title="Supported models" kicker="Coverage">
          {models.loading || !models.data ? <p className="text-sm text-black/60">Loading models...</p> : (
            <div className="space-y-2.5">
              {models.data.rows.map((row) => (
                <div key={row.modelKey} className="surface-card p-3.5">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xl tracking-[-0.03em]">{row.modelName}</p>
                    <p className="text-xs uppercase tracking-[0.16em] text-black/55">{row.supportStatus}</p>
                  </div>
                  <p className="mt-3 text-sm text-black/65">stream {row.supportsStream ? "yes" : "no"} · tools {row.supportsTools ? "yes" : "no"} · reasoning {row.supportsReasoning ? "yes" : "no"}</p>
                </div>
              ))}
            </div>
          )}
        </Panel>
        <Panel title="Pricing history" kicker="Current economics">
          {pricing.loading || !pricing.data ? <p className="text-sm text-black/60">Loading pricing...</p> : (
            <div className="space-y-2.5">
              {pricing.data.rows.map((row) => (
                <div key={`${row.modelKey}-${row.effectiveFrom}`} className="surface-card p-3.5 text-sm">
                  <p className="text-lg tracking-[-0.03em]">{row.modelKey}</p>
                  <p className="mt-2">Input {row.inputPricePer1M ?? "-"} · Output {row.outputPricePer1M ?? "-"}</p>
                  <p className="mt-2 text-xs uppercase tracking-[0.14em] text-black/50">{row.source} · {new Date(row.effectiveFrom).toLocaleDateString()}</p>
                </div>
              ))}
            </div>
          )}
        </Panel>
        <Panel title="Incident timeline" kicker="Operator awareness">
          {incidents.loading || !incidents.data ? <p className="text-sm text-black/60">Loading incidents...</p> : (
            <div className="space-y-2.5">
              {incidents.data.rows.length === 0 ? <p className="text-sm text-black/60">No incidents in the selected window.</p> : incidents.data.rows.map((row) => (
                <div key={row.id} className="surface-card p-3.5">
                  <div className="flex items-center gap-2 text-sm uppercase tracking-[0.14em]"><StatusDot status={row.severity} /> {row.severity}</div>
                  <p className="mt-3 text-xl tracking-[-0.03em]">{row.title}</p>
                  <p className="mt-2 text-sm text-black/70">{row.summary}</p>
                </div>
              ))}
            </div>
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
  if (loading) return <MethodologyPageSkeleton />;
  if (error || !data) return <ErrorPanel message={error ?? "Unable to load methodology."} />;

  return (
    <div className="space-y-6">
      <section className="panel bg-[#fff0c2]">
        <p className="kicker">Methodology</p>
        <div className="grid gap-4 xl:grid-cols-[1.02fr_0.98fr]">
          <div>
            <h1 className="max-w-3xl text-4xl leading-[0.92] tracking-[-0.06em] md:text-5xl">
              How we test and score relay performance.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-black/72">
              Natural ranking blends five public signals: availability, latency, consistency, value, and stability.
              Sponsor placement is handled outside this score so measured order remains readable.
            </p>
            <div className="mt-5 flex flex-wrap gap-2.5">
              <Link className="button-dark" to="/policy">Read evaluation policy</Link>
              <Link className="button-cream" to="/probe">Run a probe</Link>
            </div>
            <p className="mt-4 text-xs uppercase tracking-[0.16em] text-black/50">
              Snapshot measured at {new Date(data.measuredAt).toLocaleString()}
            </p>
          </div>
          <div className="surface-card p-4">
            <p className="kicker">Current scoring mix</p>
            <div className="mt-4 space-y-3">
              {Object.entries(data.weights).map(([label, value]) => (
                <div key={label}>
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-sm uppercase tracking-[0.16em] text-black/62">{label}</p>
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
        <Panel title="Health state language" kicker="Public taxonomy">
          <div className="space-y-3">
            {data.healthStatuses.map((status) => (
              <div key={status} className="surface-card p-3.5">
                <div className="flex items-center gap-3 text-sm uppercase tracking-[0.14em] text-black/72">
                  <StatusDot status={status} /> {status}
                </div>
                <p className="mt-3 text-sm leading-6 text-black/68">
                  {HEALTH_STATUS_COPY[status] ?? "Public status language is based on recent measured evidence."}
                </p>
              </div>
            ))}
          </div>
        </Panel>
        <div className="space-y-4">
          <Panel title="Badge cues" kicker="Confidence hints">
            <div className="grid gap-3 sm:grid-cols-2">
              {data.badges.map((badge) => (
                <div key={badge} className="surface-card p-3.5">
                  <span className="signal-chip">{badge}</span>
                  <p className="mt-3 text-sm leading-6 text-black/68">
                    {BADGE_COPY[badge] ?? "This badge helps explain confidence, value, or current operational posture."}
                  </p>
                </div>
              ))}
            </div>
          </Panel>
          <Panel title="Interpretation notes" kicker="Reading the board">
            <div className="space-y-3 text-sm leading-6 text-black/72">
              {data.notes.map((note) => (
                <div key={note} className="surface-card p-3.5">
                  {note}
                </div>
              ))}
              <div className="surface-card p-3.5">
                For listing rules, sponsor separation, and dispute handling, continue to the public policy page.
                {" "}
                <Link className="underline" to="/policy">Read policy</Link>
              </div>
            </div>
          </Panel>
        </div>
      </section>
    </div>
  );
}

function PolicyPage() {
  return (
    <div className="space-y-6">
      <section className="panel bg-[#fff0c2]">
        <p className="kicker">Evaluation policy</p>
        <div className="grid gap-4 xl:grid-cols-[1.02fr_0.98fr]">
          <div>
            <h1 className="max-w-3xl text-4xl leading-[0.92] tracking-[-0.06em] md:text-5xl">
              The catalog stays neutral, observable, and operator-reviewable.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-black/72">
              This page explains which decisions are measurement-driven, which are editorial or operational, and how operators can correct a listing.
            </p>
            <div className="mt-5 flex flex-wrap gap-2.5">
              <Link className="button-dark" to="/submit">Submit a relay</Link>
              <Link className="button-cream" to="/methodology">Read methodology</Link>
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
        <Panel title="What affects leaderboard order" kicker="Measured inputs">
          <div className="space-y-3 text-sm leading-6 text-black/72">
            <div className="surface-card p-3.5">Observed availability and successful request continuity.</div>
            <div className="surface-card p-3.5">Latency distribution and recent consistency for the specific model lane.</div>
            <div className="surface-card p-3.5">Price efficiency relative to measured peers in the same category.</div>
            <div className="surface-card p-3.5">Stability signals, incident recency, and confidence level from sample size.</div>
          </div>
        </Panel>
        <Panel title="What does not change natural rank" kicker="Boundaries">
          <div className="space-y-3 text-sm leading-6 text-black/72">
            <div className="surface-card p-3.5">Sponsor packages, partner visibility, or promotional placement.</div>
            <div className="surface-card p-3.5">Direct operator requests to move a row without supporting measurement changes.</div>
            <div className="surface-card p-3.5">One-off anecdotes that are not backed by reproducible tests or fresh evidence.</div>
            <div className="surface-card p-3.5">Probe success alone; public probe helps diagnose connectivity but does not define rank on its own.</div>
          </div>
        </Panel>
      </section>
      <section className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
        <Panel title="Operator review path" kicker="Corrections and disputes">
          <div className="space-y-3 text-sm leading-6 text-black/72">
            <p className="surface-card p-3.5">
              If your relay endpoint, supported models, or public metadata changed, submit an updated relay entry with the latest base URL and operator contact.
            </p>
            <p className="surface-card p-3.5">
              If you believe a public status is inaccurate, provide reproducible probe data, affected models, and the time window that should be rechecked.
            </p>
            <p className="surface-card p-3.5">
              Listings can be paused or marked under observation while evidence is refreshed, but sponsor separation remains intact during review.
            </p>
          </div>
        </Panel>
        <Panel title="Recommended operator workflow" kicker="Practical sequence">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="surface-card p-3.5">
              <p className="kicker !text-black/52">1. Probe</p>
              <p className="text-sm leading-6 text-black/68">Verify the public route, API family, and model behavior with the bounded probe.</p>
            </div>
            <div className="surface-card p-3.5">
              <p className="kicker !text-black/52">2. Submit</p>
              <p className="text-sm leading-6 text-black/68">Send clean URLs and operator contact info so the relay enters the review lane with context.</p>
            </div>
            <div className="surface-card p-3.5">
              <p className="kicker !text-black/52">3. Monitor</p>
              <p className="text-sm leading-6 text-black/68">Watch the public leaderboard, incidents, and notes as the observation window fills in.</p>
            </div>
          </div>
        </Panel>
      </section>
    </div>
  );
}

function SubmitPage() {
  const [state, setState] = useState<SubmitFormState>({ relayName: "", baseUrl: "", websiteUrl: "", submitterEmail: "" });
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<PublicSubmissionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<SubmitFormErrors>({});
  const fields = [
    {
      label: "Relay name",
      key: "relayName",
      type: "text",
      required: true,
      placeholder: "Northwind Relay",
    },
    {
      label: "Base URL",
      key: "baseUrl",
      type: "url",
      required: true,
      placeholder: "https://northwind.example.ai/v1",
    },
    {
      label: "Website URL",
      key: "websiteUrl",
      type: "url",
      required: false,
      placeholder: "https://northwind.example.ai",
    },
    {
      label: "Contact email",
      key: "submitterEmail",
      type: "email",
      required: false,
      placeholder: "ops@example.com",
    },
  ] as const;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setResult(null);
    const { errors, payload } = validateSubmitForm(state);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setError("Please fix the highlighted fields before submitting.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetchJson<PublicSubmissionResponse>("/public/submissions", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setResult(response);
      setState({ relayName: "", baseUrl: "", websiteUrl: "", submitterEmail: "" });
      setFieldErrors({});
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to submit relay.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
      <div className="panel hero-panel min-h-0">
        <p className="kicker">Submit a relay</p>
        <h1 className="text-4xl leading-[0.92] tracking-[-0.06em] md:text-5xl">Nominate a relay for monitoring, ranking, or sponsor intake.</h1>
        <p className="mt-4 max-w-xl text-black/70">Use the intake form to put a relay into review. Operational approval and sponsor placement are reviewed separately from natural ranking.</p>
        <div className="mt-6 grid gap-2.5 sm:grid-cols-3">
          <div className="surface-card p-3.5">
            <p className="kicker !text-black/52">Review first</p>
            <p className="text-sm leading-6 text-black/72">Every relay enters an operator review lane before it appears anywhere public.</p>
          </div>
          <div className="surface-card p-3.5">
            <p className="kicker !text-black/52">Natural board</p>
            <p className="text-sm leading-6 text-black/72">Ranking stays tied to observed quality, not to sponsor placement decisions.</p>
          </div>
          <div className="surface-card p-3.5">
            <p className="kicker !text-black/52">Fast intake</p>
            <p className="text-sm leading-6 text-black/72">URL and contact checks happen in-browser first so the write path stays clean.</p>
          </div>
        </div>
      </div>
      <form className="panel form-shell" noValidate onSubmit={handleSubmit}>
        {fields.map(({ label, key, type, required, placeholder }) => (
          <label key={key} className="form-field">
            {label}
            <input
              className="input-shell mt-2"
              type={type}
              placeholder={placeholder}
              value={state[key]}
              onChange={(event) => {
                const nextValue = event.target.value;
                setState((current) => ({ ...current, [key]: nextValue }));
                setFieldErrors((current) => ({ ...current, [key]: undefined }));
                setError(null);
              }}
              required={required}
            />
            {fieldErrors[key] ? <span className="field-error">{fieldErrors[key]}</span> : null}
          </label>
        ))}
        <button className="button-dark" disabled={submitting} type="submit">{submitting ? "Submitting..." : "Submit relay"}</button>
        {result ? <p className="text-sm form-feedback-success">Submission created: {result.id}</p> : null}
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
    requestSummary,
    result,
    resultTone,
    setState,
    state,
    submitting,
    usedEndpointPath,
  } = useProbeController(getProbeStateFromSearchParams(searchParams));

  return (
    <div className="space-y-6">
      <section className="panel bg-[#fff0c2]">
        <p className="kicker">Self-check probe</p>
        <div className="grid gap-4 xl:grid-cols-[1.08fr_0.92fr] xl:items-start">
          <div>
            <h1 className="max-w-3xl text-4xl leading-[0.92] tracking-[-0.06em] md:text-5xl">
              Check the exact relay route your operators rely on.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-black/72">
              Run a bounded server-side probe for connectivity, compatibility detection, and endpoint resolution. Start with automatic mode unless you already know the required API family.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <span className="signal-chip">No persistent key storage</span>
              <span className="signal-chip">Auto detect first</span>
              <span className="signal-chip">Copy resolved endpoint</span>
            </div>
          </div>
          <div className="surface-card p-4">
            <p className="kicker">Before you run</p>
            <div className="space-y-3 text-sm leading-6 text-black/68">
              <p>Paste the relay root or provider prefix you use in production. The probe can add protocol-specific suffixes automatically.</p>
              <p>Model names help automatic mode decide whether OpenAI Responses, Chat Completions, or Anthropic Messages should be checked first.</p>
              <p>If the automatic result looks wrong, rerun with a manual compatibility override in the advanced section.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.08fr_0.92fr] xl:items-start">
        <form className="panel form-shell" onSubmit={handleSubmit}>
          <div className="form-note text-sm leading-6">
            Use the same base URL, key, and model that your application sends in production. The result panel below will show the resolved route and request trace.
          </div>
          <ProbeFormFields setState={setState} state={state} />
          <details className="surface-card p-4">
            <summary className="cursor-pointer font-mono text-sm uppercase tracking-[0.16em] text-black/70">Advanced / API type</summary>
            <label className="form-field mt-4">
              Compatibility Mode
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
              Automatic mode infers the adapter order from the model. Manual mode locks the probe to a single compatibility shape.
            </p>
          </details>
          <button className="button-dark" disabled={submitting} type="submit">{submitting ? "Checking..." : "Run probe"}</button>
        </form>

        <Panel title="What the result includes" kicker="Output preview" className="panel-soft">
          <div className="space-y-3">
            {PROBE_OUTPUT_CARDS.map((item) => (
              <div key={item.title} className="surface-card p-3.5">
                <p className="kicker !text-black/52">{item.title}</p>
                <p className="text-sm leading-6 text-black/68">{item.body}</p>
              </div>
            ))}
          </div>
        </Panel>
      </section>

      {result ? (
        <Panel title="Probe result" kicker="Diagnostic output">
          <div className={clsx("mb-5 border px-4 py-4", resultTone?.className)}>
            <p className="kicker !mb-2 !text-current/70">Result state</p>
            <p className="text-2xl tracking-[-0.05em]">{resultTone?.label}</p>
            <p className="mt-2 text-sm leading-6 text-current/85">{resultTone?.description}</p>
          </div>
          <div className="mb-5 flex flex-wrap gap-2">
            <div className="border border-black/10 bg-white/80 px-3 py-2 text-[0.72rem] uppercase tracking-[0.16em] text-black/62">
              {requestSummary}
            </div>
            <div className="border border-black/10 bg-white/80 px-3 py-2 text-[0.72rem] uppercase tracking-[0.16em] text-black/62">
              {formatProbeCompatibilityMode(result.compatibilityMode)}
            </div>
            <div className="border border-black/10 bg-white/80 px-3 py-2 text-[0.72rem] uppercase tracking-[0.16em] text-black/62">
              HTTP {formatProbeHttpStatus(result.protocol.httpStatus)}
            </div>
            {usedEndpointPath ? (
              <div className="border border-black/10 bg-white/80 px-3 py-2 text-[0.72rem] uppercase tracking-[0.16em] text-black/62">
                {usedEndpointPath}
              </div>
            ) : null}
          </div>
          <MetricGrid
            columnsClassName="sm:grid-cols-2 xl:grid-cols-3"
            items={[
              {
                label: "Host",
                value: result.targetHost,
                testId: "probe-host-value",
                valueClassName: "font-mono text-[1.12rem] leading-6 break-all",
                valueTitle: result.targetHost,
              },
              {
                label: "Connectivity",
                value: result.connectivity.ok ? "ok" : "failed",
                testId: "probe-connectivity-value",
                cardClassName: getConnectivityCardTone(result.connectivity.ok),
              },
              {
                label: "Protocol",
                value: result.protocol.ok ? result.protocol.healthStatus : "unknown",
                testId: "probe-protocol-value",
                cardClassName: getProtocolCardTone(result.protocol.healthStatus, result.protocol.ok),
              },
              { label: "Latency", value: result.connectivity.latencyMs ? `${result.connectivity.latencyMs} ms` : "-", testId: "probe-latency-value" },
              {
                label: "Compatibility",
                value: formatProbeCompatibilityMode(result.compatibilityMode),
                testId: "probe-mode-value",
                valueClassName: "text-[1.7rem] leading-[0.94]",
              },
              { label: "Detection", value: formatProbeDetectionMode(result.detectionMode), testId: "probe-detection-value" },
            ]}
          />
          <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
            <div className="space-y-4">
              {result.usedUrl ? (
                <div className="surface-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="kicker">Used endpoint</p>
                    <button
                      className="copy-button"
                      data-testid="probe-copy-endpoint-button"
                      onClick={handleCopyUsedUrl}
                      type="button"
                    >
                      {copyState === "copied" ? "Copied" : copyState === "failed" ? "Copy failed" : "Copy"}
                    </button>
                  </div>
                  <p
                    className="overflow-hidden break-all font-mono text-sm leading-6 text-black/72"
                    data-testid="probe-used-url-value"
                    title={result.usedUrl}
                  >
                    {result.usedUrl}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2 text-[0.68rem] uppercase tracking-[0.16em] text-black/48">
                    {usedEndpointPath ? <span className="signal-chip">{usedEndpointPath}</span> : null}
                    <span className="signal-chip">{formatProbeRequestCount(attemptTrace.length)}</span>
                  </div>
                </div>
              ) : null}
              {attemptTrace.length > 0 ? (
                <div className="surface-card p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="kicker">Execution trace</p>
                    <p className="text-[0.7rem] uppercase tracking-[0.16em] text-black/45">
                      {attemptTrace.length} request{attemptTrace.length === 1 ? "" : "s"}
                    </p>
                  </div>
                  <div className="space-y-3">
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
                            {attempt.matched ? "Matched" : attempt.httpStatus ? `HTTP ${attempt.httpStatus}` : "No response"}
                          </p>
                        </div>
                        <p className="mt-2 break-all font-mono text-xs leading-5 opacity-80">{attempt.url}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              {result.message ? (
                <div
                  className={clsx(
                    "border p-4 text-sm leading-6",
                    result.ok ? "border-black/10 bg-[#fff4da] text-black/72" : "border-[#b54708]/20 bg-[#fff7e8] text-[#8a450c]",
                  )}
                >
                  {result.message}
                </div>
              ) : null}
              {failureGuidance ? (
                <div className="surface-card p-4">
                  <p className="kicker">Failure interpretation</p>
                  <div className="space-y-3 text-sm leading-6 text-black/72">
                    <p><span className="font-medium text-black/90">Source:</span> {failureGuidance.source}</p>
                    <p><span className="font-medium text-black/90">Meaning:</span> {failureGuidance.meaning}</p>
                    <p><span className="font-medium text-black/90">Next step:</span> {failureGuidance.nextStep}</p>
                  </div>
                </div>
              ) : null}
              {!result.ok && result.detectionMode === "auto" ? (
                <div className="border border-[#b54708]/20 bg-[#fff7e8] p-4 text-sm leading-6 text-[#8a450c]">
                  If the automatic match looks wrong, rerun the probe with a manual compatibility override in the advanced section.
                </div>
              ) : null}
            </div>
            <MetricGrid
              columnsClassName="sm:grid-cols-2 xl:grid-cols-1"
              items={[
                {
                  label: "Model",
                  value: result.model,
                  testId: "probe-model-value",
                  valueClassName: "text-[1.35rem] leading-[1.05] break-words",
                  valueTitle: result.model,
                },
                {
                  label: "HTTP status",
                  value: formatProbeHttpStatus(result.protocol.httpStatus),
                  testId: "probe-http-status-value",
                  valueClassName: "text-[1.8rem] leading-[0.95]",
                },
                {
                  label: "Measured at",
                  value: formatProbeMeasuredAt(result.measuredAt),
                  testId: "probe-measured-at-value",
                  valueClassName: "text-lg leading-7",
                  valueTitle: result.measuredAt,
                },
              ]}
            />
          </div>
        </Panel>
      ) : null}
      {error ? (
        <div className="panel border border-[#b42318]/20 bg-[#fff2ef] text-[#8d2d17]" role="alert">
          <p className="kicker !text-current/70">Probe request failed</p>
          <p className="text-xl tracking-[-0.04em]">The relay check did not complete.</p>
          <p className="mt-3 text-sm leading-6 text-current/85">{error}</p>
          <p className="mt-2 text-sm leading-6 text-current/80">
            Recheck the base URL, key, compatibility mode, and upstream route, then try again.
          </p>
        </div>
      ) : null}
    </div>
  );
}

function NotFoundPage() {
  const navigate = useNavigate();
  useEffect(() => {
    const timer = window.setTimeout(() => navigate("/"), 2000);
    return () => window.clearTimeout(timer);
  }, [navigate]);
  return <ErrorPanel message="Page not found. Returning home..." />;
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
