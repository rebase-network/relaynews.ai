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

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed with ${response.status}`);
  }

  return (await response.json()) as T;
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
  const navItems = [
    ["/", "Home"],
    ["/leaderboard/openai-gpt-4.1", "Leaderboard"],
    ["/methodology", "Methodology"],
    ["/submit", "Submit"],
    ["/probe", "Probe"],
  ] as const;

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--ink)]">
      <div className="absolute inset-x-0 top-0 -z-10 h-[32rem] bg-[radial-gradient(circle_at_top,_rgba(255,217,0,0.36),_transparent_55%),linear-gradient(180deg,_rgba(255,240,194,0.96),_rgba(255,250,235,0.96))]" />
      <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6 lg:px-10">
        <Link to="/" className="flex items-center gap-3 text-sm uppercase tracking-[0.25em]">
          <div className="flex shadow-[var(--shadow)]">
            <span className="h-4 w-4 bg-[#ffd900]" />
            <span className="h-4 w-4 bg-[#ffa110]" />
            <span className="h-4 w-4 bg-[#fb6424]" />
            <span className="h-4 w-4 bg-[#fa520f]" />
          </div>
          relaynew.ai
        </Link>
        <nav className="hidden items-center gap-5 md:flex">
          {navItems.map(([to, label]) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                clsx(
                  "text-sm uppercase tracking-[0.18em] transition-opacity",
                  isActive ? "opacity-100" : "opacity-65 hover:opacity-100",
                )
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-7xl px-6 pb-24 lg:px-10">{children}</main>
      <footer className="border-t border-black/10 bg-[linear-gradient(180deg,rgba(255,161,16,0.15),rgba(31,31,31,1))] px-6 py-10 text-white lg:px-10">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 text-sm uppercase tracking-[0.18em] md:flex-row md:items-center md:justify-between">
          <span>Relay monitoring, pricing, and ranking.</span>
          <span className="opacity-75">Natural ranking and sponsor placement stay separate.</span>
        </div>
      </footer>
    </div>
  );
}

function Panel({ title, kicker, children, className }: { title?: string; kicker?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={clsx("panel", className)}>
      {(kicker || title) && (
        <header className="mb-5">
          {kicker ? <p className="kicker">{kicker}</p> : null}
          {title ? <h2 className="text-3xl leading-[0.95] tracking-[-0.04em] md:text-5xl">{title}</h2> : null}
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

  return <span className={clsx("inline-block h-2.5 w-2.5", tone)} />;
}

function MetricGrid({ items }: { items: Array<{ label: string; value: string | number; testId?: string }> }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="border border-black/10 bg-white/75 p-4">
          <p className="kicker">{item.label}</p>
          <p className="mt-3 text-3xl tracking-[-0.04em]" data-testid={item.testId}>{item.value}</p>
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
    <div className="space-y-8">
      <section className="grid gap-6 lg:grid-cols-[1.4fr_0.8fr]">
        <div className="panel bg-[linear-gradient(135deg,rgba(255,217,0,0.7),rgba(250,82,15,0.9))] text-[#1f1f1f]">
          <p className="kicker text-black/70">Relay intelligence</p>
          <h1 className="max-w-4xl text-5xl leading-[0.9] tracking-[-0.07em] md:text-7xl xl:text-[5.3rem]">
            Watch relay health, latency, price pressure, and trust signals in one warm control tower.
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-black/75">
            Track operational quality, compare model-specific performance, and highlight the relays worth promoting.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link className="button-dark" to="/leaderboard/openai-gpt-4.1">Open leaderboard</Link>
            <Link className="button-cream" to="/probe">Run self-check probe</Link>
          </div>
        </div>
        <Panel title="Current market pulse" kicker="Hero snapshot">
          <MetricGrid
            items={[
              { label: "Total relays", value: data.hero.totalRelays },
              { label: "Healthy", value: data.hero.healthyRelays },
              { label: "Degraded", value: data.hero.degradedRelays },
              { label: "Measured", value: new Date(data.hero.measuredAt).toLocaleTimeString() },
            ]}
          />
        </Panel>
      </section>

      <Panel title="Featured leaderboards" kicker="Top model lanes">
        <div className="grid gap-6 lg:grid-cols-2">
          {data.leaderboards.map((board) => (
            <div key={board.modelKey} className="border border-black/10 bg-white/80 p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="kicker">{board.modelKey}</p>
                  <h3 className="text-2xl tracking-[-0.04em]">{board.modelName}</h3>
                </div>
                <Link className="text-sm uppercase tracking-[0.16em] opacity-70 hover:opacity-100" to={`/leaderboard/${board.modelKey}`}>
                  Full board
                </Link>
              </div>
              <div className="mt-5 space-y-3">
                {board.rows.map((row) => (
                  <Link key={row.relay.slug} to={`/relay/${row.relay.slug}`} className="flex items-center justify-between gap-4 border border-black/8 bg-[var(--surface)] p-4 transition-transform hover:-translate-y-0.5">
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

      <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <Panel title="Relays to watch" kicker="Highlights">
          <div className="space-y-4">
            {data.highlights.map((relay) => (
              <Link key={relay.slug} to={`/relay/${relay.slug}`} className="flex items-center justify-between gap-4 border border-black/10 bg-white/70 p-4">
                <div>
                  <p className="text-xl tracking-[-0.03em]">{relay.name}</p>
                  <p className="text-sm uppercase tracking-[0.16em] text-black/60">{relay.badge}</p>
                </div>
                <div className="flex items-center gap-2 text-sm uppercase tracking-[0.12em]"><StatusDot status={relay.healthStatus} /> {relay.healthStatus}</div>
              </Link>
            ))}
          </div>
        </Panel>
        <Panel title="Latest incident flow" kicker="Recent disruptions">
          <div className="space-y-4">
            {data.latestIncidents.length === 0 ? (
              <p className="text-sm text-black/65">No incidents recorded in the current snapshot.</p>
            ) : (
              data.latestIncidents.map((incident) => (
                <div key={incident.id} className="border border-black/10 bg-white/80 p-4">
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
    <div className="space-y-8">
      <section className="panel bg-[#fff0c2]">
        <p className="kicker">Leaderboard</p>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-5xl leading-[0.92] tracking-[-0.06em]">{data.model.name}</h1>
            <p className="mt-3 text-sm uppercase tracking-[0.16em] text-black/60">Measured at {new Date(data.measuredAt).toLocaleString()}</p>
          </div>
          <label className="text-sm uppercase tracking-[0.16em] text-black/70">
            Rows
            <select
              className="mt-2 block border border-black/15 bg-white px-3 py-2"
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
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-left">
            <thead>
              <tr className="border-b border-black/10 text-xs uppercase tracking-[0.16em] text-black/55">
                <th className="pb-3">Rank</th>
                <th className="pb-3">Relay</th>
                <th className="pb-3">Health</th>
                <th className="pb-3">Score</th>
                <th className="pb-3">Avail 24h</th>
                <th className="pb-3">Latency p50</th>
                <th className="pb-3">Input</th>
                <th className="pb-3">Output</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => (
                <tr key={row.relay.slug} className="border-b border-black/8 align-top">
                  <td className="py-4 text-2xl tracking-[-0.04em]">#{row.rank}</td>
                  <td className="py-4">
                    <Link to={`/relay/${row.relay.slug}`} className="text-xl tracking-[-0.03em] hover:underline">{row.relay.name}</Link>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs uppercase tracking-[0.14em] text-black/55">
                      {row.badges.map((badge) => <span key={badge}>{badge}</span>)}
                    </div>
                  </td>
                  <td className="py-4 text-sm uppercase tracking-[0.14em]"><span className="inline-flex items-center gap-2"><StatusDot status={row.healthStatus} /> {row.healthStatus}</span></td>
                  <td className="py-4 text-xl tracking-[-0.03em]">{row.score.toFixed(1)}</td>
                  <td className="py-4">{(row.availability24h * 100).toFixed(2)}%</td>
                  <td className="py-4">{row.latencyP50Ms ?? "-"} ms</td>
                  <td className="py-4">{row.inputPricePer1M ?? "-"}</td>
                  <td className="py-4">{row.outputPricePer1M ?? "-"}</td>
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
    <div className="space-y-8">
      <section className="panel bg-[linear-gradient(135deg,rgba(255,240,194,1),rgba(255,184,62,0.75))]">
        <p className="kicker">Relay detail</p>
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <div className="flex items-center gap-3 text-sm uppercase tracking-[0.16em]"><StatusDot status={overview.data.healthStatus} /> {overview.data.healthStatus}</div>
            <h1 className="mt-4 text-5xl leading-[0.92] tracking-[-0.06em]">{overview.data.relay.name}</h1>
            <p className="mt-4 max-w-2xl text-black/70">{overview.data.relay.baseUrl}</p>
            <div className="mt-6 flex flex-wrap gap-2 text-xs uppercase tracking-[0.14em] text-black/65">
              {overview.data.badges.map((badge) => <span key={badge}>{badge}</span>)}
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

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Panel title="Score composition" kicker="Why the relay ranks here">
          <MetricGrid
            items={Object.entries(overview.data.scoreSummary).map(([label, value]) => ({ label, value: value.toFixed(1) }))}
          />
        </Panel>
        <Panel title="Latency profile" kicker="Seven-day shape">
          {history.loading || !history.data ? <p className="text-sm text-black/60">Loading trend...</p> : <MiniBars points={history.data.points} />}
        </Panel>
      </section>

      <section className="grid gap-6 xl:grid-cols-3">
        <Panel title="Supported models" kicker="Coverage">
          {models.loading || !models.data ? <p className="text-sm text-black/60">Loading models...</p> : (
            <div className="space-y-3">
              {models.data.rows.map((row) => (
                <div key={row.modelKey} className="border border-black/10 bg-white/80 p-4">
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
            <div className="space-y-3">
              {pricing.data.rows.map((row) => (
                <div key={`${row.modelKey}-${row.effectiveFrom}`} className="border border-black/10 bg-white/80 p-4 text-sm">
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
            <div className="space-y-3">
              {incidents.data.rows.length === 0 ? <p className="text-sm text-black/60">No incidents in the selected window.</p> : incidents.data.rows.map((row) => (
                <div key={row.id} className="border border-black/10 bg-white/80 p-4">
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
    <div className="space-y-8">
      <Panel title="Methodology" kicker="Ranking anatomy">
        <div className="grid gap-4 md:grid-cols-5">
          {Object.entries(data.weights).map(([label, value]) => (
            <div key={label} className="border border-black/10 bg-white/80 p-4">
              <p className="kicker">{label}</p>
              <p className="mt-3 text-4xl tracking-[-0.05em]">{value}</p>
            </div>
          ))}
        </div>
      </Panel>
      <section className="grid gap-6 lg:grid-cols-2">
        <Panel title="Health state language" kicker="Public taxonomy">
          <div className="space-y-3">
            {data.healthStatuses.map((status) => (
              <div key={status} className="flex items-center gap-3 border border-black/10 bg-white/80 p-4 text-sm uppercase tracking-[0.14em]">
                <StatusDot status={status} /> {status}
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Ranking notes" kicker="Interpretation">
          <div className="space-y-3 text-sm text-black/70">
            {data.notes.map((note) => <p key={note}>{note}</p>)}
          </div>
        </Panel>
      </section>
    </div>
  );
}

function SubmitPage() {
  const [state, setState] = useState({ relayName: "", baseUrl: "", websiteUrl: "", submitterEmail: "" });
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<PublicSubmissionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fields = [
    ["Relay name", "relayName"],
    ["Base URL", "baseUrl"],
    ["Website URL", "websiteUrl"],
    ["Contact email", "submitterEmail"],
  ] as const;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setResult(null);
    try {
      const response = await fetchJson<PublicSubmissionResponse>("/public/submissions", {
        method: "POST",
        body: JSON.stringify(state),
      });
      setResult(response);
      setState({ relayName: "", baseUrl: "", websiteUrl: "", submitterEmail: "" });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to submit relay.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
      <div className="panel bg-[#fff0c2]">
        <p className="kicker">Submit a relay</p>
        <h1 className="text-5xl leading-[0.92] tracking-[-0.06em]">Nominate a relay for monitoring, ranking, or sponsor intake.</h1>
        <p className="mt-5 max-w-xl text-black/70">Use the intake form to put a relay into review. Operational approval and sponsor placement are reviewed separately from natural ranking.</p>
      </div>
      <form className="panel space-y-4" onSubmit={handleSubmit}>
        {fields.map(([label, key]) => (
          <label key={key} className="block text-sm uppercase tracking-[0.14em] text-black/65">
            {label}
            <input
              className="mt-2 w-full border border-black/15 bg-white px-4 py-3"
              value={state[key]}
              onChange={(event) => setState((current) => ({ ...current, [key]: event.target.value }))}
              required={key === "relayName" || key === "baseUrl"}
            />
          </label>
        ))}
        <button className="button-dark" disabled={submitting} type="submit">{submitting ? "Submitting..." : "Submit relay"}</button>
        {result ? <p className="text-sm text-emerald-700">Submission created: {result.id}</p> : null}
        {error ? <p className="text-sm text-[#a33a16]">{error}</p> : null}
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

  return (
    <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
      <div className="panel bg-[#fff0c2]">
        <p className="kicker">Self-check probe</p>
        <h1 className="text-5xl leading-[0.92] tracking-[-0.06em]">Run a bounded connectivity check against a relay endpoint.</h1>
        <p className="mt-5 text-black/70">The public probe uses a tightly controlled server-side request path. It never echoes your API key back into the UI.</p>
        <p className="mt-3 text-sm text-black/60">Most relays should work with automatic compatibility detection. Use the advanced override only when you already know the protocol shape.</p>
      </div>
      <div className="space-y-6">
        <form className="panel space-y-4" onSubmit={handleSubmit}>
          {fields.map(([label, key]) => (
            <label key={key} className="block text-sm uppercase tracking-[0.14em] text-black/65">
              {label}
              <input
                className="mt-2 w-full border border-black/15 bg-white px-4 py-3"
                type={key === "apiKey" ? "password" : "text"}
                value={state[key]}
                onChange={(event) => setState((current) => ({ ...current, [key]: event.target.value }))}
                required
              />
            </label>
          ))}
          <details className="border border-black/10 bg-white/70 p-4">
            <summary className="cursor-pointer text-sm uppercase tracking-[0.16em] text-black/70">Advanced</summary>
            <label className="mt-4 block text-sm uppercase tracking-[0.14em] text-black/65">
              Compatibility Mode
              <select
                className="mt-2 w-full border border-black/15 bg-white px-4 py-3"
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
            <MetricGrid
              items={[
                { label: "Host", value: result.targetHost, testId: "probe-host-value" },
                { label: "Connectivity", value: result.connectivity.ok ? "ok" : "failed", testId: "probe-connectivity-value" },
                { label: "Protocol", value: result.protocol.ok ? result.protocol.healthStatus : "unknown", testId: "probe-protocol-value" },
                { label: "Latency", value: result.connectivity.latencyMs ? `${result.connectivity.latencyMs} ms` : "-", testId: "probe-latency-value" },
                { label: "Compatibility", value: formatProbeCompatibilityMode(result.compatibilityMode), testId: "probe-mode-value" },
                { label: "Detection", value: formatProbeDetectionMode(result.detectionMode), testId: "probe-detection-value" },
              ]}
            />
            {result.usedUrl ? (
              <p className="mt-4 text-sm text-black/70">
                Used endpoint: <span className="font-medium" data-testid="probe-used-url-value">{result.usedUrl}</span>
              </p>
            ) : null}
            {result.attemptedModes.length > 0 ? (
              <p className="mt-2 text-sm text-black/60">
                Attempted modes: {result.attemptedModes.map((mode) => PROBE_COMPATIBILITY_LABELS[mode]).join(", ")}
              </p>
            ) : null}
            {result.message ? <p className="mt-4 text-sm text-black/70">{result.message}</p> : null}
            {!result.ok && result.detectionMode === "auto" ? (
              <p className="mt-2 text-sm text-[#a33a16]">If the automatic match looks wrong, rerun the probe with a manual compatibility override in the advanced section.</p>
            ) : null}
          </Panel>
        ) : null}
        {error ? <ErrorPanel message={error} /> : null}
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
