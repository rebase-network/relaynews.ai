import { clsx } from "clsx";
import {
  type HomeSummaryResponse,
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
  Link,
  NavLink,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";

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

function formatProbeCompatibilityMode(mode: ProbeResolvedCompatibilityMode | null | undefined) {
  return mode ? PROBE_COMPATIBILITY_LABELS[mode] : "Not detected";
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
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const navItems = [
    ["/", "Home"],
    ["/leaderboard/openai-gpt-4.1", "Leaderboard"],
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
      <footer className="site-footer px-5 py-8 lg:px-10">
        <div className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-2">
            <p className="kicker !text-white/55">Relay intelligence</p>
            <p className="max-w-xl text-xl leading-tight tracking-[-0.04em] text-white md:text-2xl">
              Relay monitoring, pricing, and ranking stay in one warm signal surface.
            </p>
          </div>
          <div className="grid gap-2 text-sm uppercase tracking-[0.18em] text-white/78 md:grid-cols-2">
            <span>Public discovery and probe tooling.</span>
            <span>Natural ranking and sponsor placement stay separate.</span>
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

function HomePage() {
  const { data, loading, error } = useLoadable<HomeSummaryResponse>(() => fetchJson("/public/home-summary"), []);

  if (loading) return <LoadingPanel />;
  if (error || !data) return <ErrorPanel message={error ?? "Unable to load homepage."} />;

  return (
    <div className="space-y-6">
      <section className="grid gap-4 xl:grid-cols-[1.18fr_0.82fr]">
        <div className="panel hero-panel">
          <p className="kicker text-black/70">Relay intelligence</p>
          <h1 className="max-w-4xl text-4xl leading-[0.9] tracking-[-0.07em] md:text-6xl xl:text-[4.75rem]">
            Watch relay health, latency, price pressure, and trust signals in one warm control tower.
          </h1>
          <p className="mt-4 max-w-2xl text-base text-black/75 md:text-lg">
            Track operational quality, compare model-specific performance, and highlight the relays worth promoting.
          </p>
          <div className="mt-6 flex flex-wrap gap-2.5">
            <Link className="button-dark" to="/leaderboard/openai-gpt-4.1">Open leaderboard</Link>
            <Link className="button-cream" to="/probe">Run self-check probe</Link>
          </div>
          <div className="mt-7 grid gap-2.5 sm:grid-cols-3">
            <div className="surface-card p-3.5">
              <p className="kicker !text-black/52">Ranking lane</p>
              <p className="text-sm leading-6 text-black/72">Model-specific leaderboards keep quality and price pressure in the same frame.</p>
            </div>
            <div className="surface-card p-3.5">
              <p className="kicker !text-black/52">Probe lane</p>
              <p className="text-sm leading-6 text-black/72">Operators can reproduce the exact compatibility path that the public check selected.</p>
            </div>
            <div className="surface-card p-3.5">
              <p className="kicker !text-black/52">Promo lane</p>
              <p className="text-sm leading-6 text-black/72">Sponsored placements stay visible while remaining separate from natural ranking logic.</p>
            </div>
          </div>
        </div>
        <div className="space-y-4">
          <Panel title="Current market pulse" kicker="Hero snapshot" className="panel-soft">
            <MetricGrid
              items={[
                { label: "Total relays", value: data.hero.totalRelays },
                { label: "Healthy", value: data.hero.healthyRelays },
                { label: "Degraded", value: data.hero.degradedRelays },
                { label: "Measured", value: new Date(data.hero.measuredAt).toLocaleTimeString() },
              ]}
            />
          </Panel>
          <div className="panel surface-card">
            <p className="kicker">Sponsor boundary</p>
            <p className="text-2xl leading-[0.95] tracking-[-0.04em] md:text-3xl">Promotion can be visible without contaminating natural board order.</p>
            <p className="mt-3 text-sm leading-6 text-black/68">
              The site keeps ranking inputs, public probe diagnostics, and sponsor intake in separate operating lanes so trust signals stay readable.
            </p>
          </div>
        </div>
      </section>

      <Panel title="Featured leaderboards" kicker="Top model lanes">
        <div className="grid gap-4 lg:grid-cols-2">
          {data.leaderboards.map((board) => (
            <div key={board.modelKey} className="surface-card p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="kicker">{board.modelKey}</p>
                  <h3 className="text-xl tracking-[-0.04em] md:text-2xl">{board.modelName}</h3>
                </div>
                <Link className="signal-chip" to={`/leaderboard/${board.modelKey}`}>
                  Full board
                </Link>
              </div>
              <div className="mt-4 space-y-2.5">
                {board.rows.map((row) => (
                  <Link key={row.relay.slug} to={`/relay/${row.relay.slug}`} className="surface-link flex items-center justify-between gap-4 p-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.16em] text-black/55">#{row.rank}</p>
                      <p className="text-xl tracking-[-0.03em]">{row.relay.name}</p>
                    </div>
                    <div className="text-right text-sm">
                      <div className="flex items-center justify-end gap-2"><StatusDot status={row.healthStatus} /> {row.healthStatus}</div>
                      <p>{row.score.toFixed(1)} score</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <section className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <Panel title="Relays to watch" kicker="Highlights">
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
        <Panel title="Latest incident flow" kicker="Recent disruptions">
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

function LeaderboardPage() {
  const { modelKey = "openai-gpt-4.1" } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const limit = searchParams.get("limit") ?? "20";
  const { data, loading, error } = useLoadable<LeaderboardResponse>(
    () => fetchJson(`/public/leaderboard/${modelKey}?limit=${limit}`),
    [modelKey, limit],
  );

  if (loading) return <LoadingPanel />;
  if (error || !data) return <ErrorPanel message={error ?? "Unable to load leaderboard."} />;

  return (
    <div className="space-y-6">
      <section className="panel bg-[#fff0c2]">
        <p className="kicker">Leaderboard</p>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-4xl leading-[0.92] tracking-[-0.06em] md:text-5xl">{data.model.name}</h1>
            <p className="mt-2 text-sm uppercase tracking-[0.16em] text-black/60">Measured at {new Date(data.measuredAt).toLocaleString()}</p>
          </div>
          <label className="form-field max-w-[9rem]">
            Rows
            <select
              className="input-shell mt-2 block"
              value={limit}
              onChange={(event) => setSearchParams({ limit: event.target.value })}
            >
              <option value="10">10</option>
              <option value="20">20</option>
              <option value="50">50</option>
            </select>
          </label>
        </div>
      </section>
      <Panel title="Ranked relay rows" kicker="Natural ranking">
        <div className="data-table">
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
              {data.rows.map((row) => (
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
                  <td className="py-3.5">{(row.availability24h * 100).toFixed(2)}%</td>
                  <td className="py-3.5">{row.latencyP50Ms ?? "-"} ms</td>
                  <td className="py-3.5">{row.inputPricePer1M ?? "-"}</td>
                  <td className="py-3.5">{row.outputPricePer1M ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
  const overview = useLoadable<RelayOverviewResponse>(() => fetchJson(`/public/relay/${slug}/overview`), [slug]);
  const history = useLoadable<RelayHistoryResponse>(() => fetchJson(`/public/relay/${slug}/history?window=7d`), [slug]);
  const models = useLoadable<RelayModelsResponse>(() => fetchJson(`/public/relay/${slug}/models`), [slug]);
  const pricing = useLoadable<RelayPricingHistoryResponse>(() => fetchJson(`/public/relay/${slug}/pricing-history`), [slug]);
  const incidents = useLoadable<RelayIncidentsResponse>(() => fetchJson(`/public/relay/${slug}/incidents`), [slug]);

  if (overview.loading) return <LoadingPanel />;
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
  const { data, loading, error } = useLoadable<MethodologyResponse>(() => fetchJson("/public/methodology"), []);
  if (loading) return <LoadingPanel />;
  if (error || !data) return <ErrorPanel message={error ?? "Unable to load methodology."} />;

  return (
    <div className="space-y-6">
      <Panel title="Methodology" kicker="Ranking anatomy">
        <div className="grid gap-3 md:grid-cols-5">
          {Object.entries(data.weights).map(([label, value]) => (
            <div key={label} className="metric-card">
              <p className="kicker">{label}</p>
              <p className="mt-3 text-4xl tracking-[-0.05em]">{value}</p>
            </div>
          ))}
        </div>
      </Panel>
      <section className="grid gap-4 lg:grid-cols-2">
        <Panel title="Health state language" kicker="Public taxonomy">
          <div className="space-y-2.5">
            {data.healthStatuses.map((status) => (
              <div key={status} className="surface-card flex items-center gap-3 p-3.5 text-sm uppercase tracking-[0.14em]">
                <StatusDot status={status} /> {status}
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Ranking notes" kicker="Interpretation">
          <div className="space-y-2.5 text-sm text-black/70">
            {data.notes.map((note) => <p key={note}>{note}</p>)}
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
  const [state, setState] = useState<{
    baseUrl: string;
    apiKey: string;
    model: string;
    compatibilityMode: ProbeCompatibilityMode;
  }>({
    baseUrl: "https://example.com",
    apiKey: "",
    model: "openai-gpt-4.1",
    compatibilityMode: "auto",
  });
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<PublicProbeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const fields = [
    ["Base URL", "baseUrl"],
    ["API key", "apiKey"],
    ["Target model", "model"],
  ] as const;

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

  return (
    <section className="grid gap-4 lg:grid-cols-[0.82fr_1.18fr] lg:items-start">
      <div className="panel hero-panel min-h-0">
        <p className="kicker">Self-check probe</p>
        <h1 className="text-4xl leading-[0.92] tracking-[-0.06em] md:text-5xl">Run a bounded connectivity check against a relay endpoint.</h1>
        <p className="mt-4 text-black/70">The public probe uses a tightly controlled server-side request path. It never echoes your API key back into the UI.</p>
        <p className="mt-3 text-sm text-black/60">Most relays should work with automatic compatibility detection. Use the advanced override only when you already know the protocol shape.</p>
        <div className="mt-6 grid gap-2.5 sm:grid-cols-3">
          <div className="surface-card p-3">
            <p className="kicker">Request scope</p>
            <p className="text-sm leading-6 text-black/75">Single bounded check with no persistent key storage.</p>
          </div>
          <div className="surface-card p-3">
            <p className="kicker">Best default</p>
            <p className="text-sm leading-6 text-black/75">Start with auto detection, then override only when needed.</p>
          </div>
          <div className="surface-card p-3">
            <p className="kicker">What you get</p>
            <p className="text-sm leading-6 text-black/75">Latency, protocol health, resolved endpoint, and adapter trace.</p>
          </div>
        </div>
      </div>
      <div className="space-y-6">
        <form className="panel form-shell" onSubmit={handleSubmit}>
          <div className="form-note text-sm leading-6">
            Paste the same relay endpoint, key, and model you use in production. Start with auto detection unless you already know the upstream protocol family.
          </div>
          {fields.map(([label, key]) => (
            <label key={key} className="form-field">
              {label}
              <input
                className="input-shell mt-2"
                type={key === "apiKey" ? "password" : "text"}
                placeholder={PROBE_FIELD_META[key].placeholder}
                value={state[key]}
                onChange={(event) => setState((current) => ({ ...current, [key]: event.target.value }))}
                autoComplete={PROBE_FIELD_META[key].autoComplete}
                inputMode={PROBE_FIELD_META[key].inputMode}
                spellCheck={false}
                required
              />
              <span className="input-helper">
                {PROBE_FIELD_META[key].helper}
              </span>
            </label>
          ))}
          <details className="surface-card p-4">
            <summary className="cursor-pointer font-mono text-sm uppercase tracking-[0.16em] text-black/70">Advanced</summary>
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
            <p className="mt-3 text-sm text-black/60">Automatic mode uses the target model to infer the best adapter order. Manual mode probes only the selected compatibility shape.</p>
          </details>
          <button className="button-dark" disabled={submitting} type="submit">{submitting ? "Checking..." : "Run probe"}</button>
        </form>
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
                    label: "Target model",
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
    </section>
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
        <Route path="/leaderboard/:modelKey" element={<LeaderboardPage />} />
        <Route path="/relay/:slug" element={<RelayPage />} />
        <Route path="/methodology" element={<MethodologyPage />} />
        <Route path="/submit" element={<SubmitPage />} />
        <Route path="/probe" element={<ProbePage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </AppShell>
  );
}
