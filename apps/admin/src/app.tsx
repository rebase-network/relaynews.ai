import { clsx } from "clsx";
import {
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
import { Link, NavLink, Route, Routes } from "react-router-dom";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ?? "http://127.0.0.1:8787";
const PUBLIC_SITE_URL =
  import.meta.env.VITE_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "http://127.0.0.1:4173";

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
      throw new Error(formatApiErrorPayload(payload) ?? `Request failed with ${response.status}`);
    }

    const text = await response.text();
    throw new Error(text || `Request failed with ${response.status}`);
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
    errors.slug = "Slug is required.";
  }

  if (!payload.name) {
    errors.name = "Name is required.";
  }

  if (!payload.baseUrl) {
    errors.baseUrl = "Base URL is required.";
  } else if (!isValidHttpUrl(payload.baseUrl)) {
    errors.baseUrl = "Enter a full base URL such as https://relay.example.ai/v1.";
  }

  if (payload.websiteUrl && !isValidHttpUrl(payload.websiteUrl)) {
    errors.websiteUrl = "Enter a valid website URL such as https://relay.example.ai.";
  }

  if (payload.docsUrl && !isValidHttpUrl(payload.docsUrl)) {
    errors.docsUrl = "Enter a valid docs URL such as https://relay.example.ai/docs.";
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
    errors.name = "Sponsor name is required.";
  }

  if (!payload.placement) {
    errors.placement = "Placement is required.";
  }

  if (!payload.startAt) {
    errors.startAt = "Start time is required.";
  } else if (!isValidTimestamp(payload.startAt)) {
    errors.startAt = "Enter a valid ISO timestamp.";
  }

  if (!payload.endAt) {
    errors.endAt = "End time is required.";
  } else if (!isValidTimestamp(payload.endAt)) {
    errors.endAt = "Enter a valid ISO timestamp.";
  }

  if (!errors.startAt && !errors.endAt && new Date(payload.endAt) <= new Date(payload.startAt)) {
    errors.endAt = "End time must be later than the start time.";
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
    errors.relayId = "Select a relay.";
  }

  if (!payload.modelId) {
    errors.modelId = "Select a model.";
  }

  if (parsedInputPricePer1M !== null && (Number.isNaN(parsedInputPricePer1M) || parsedInputPricePer1M < 0)) {
    errors.inputPricePer1M = "Input price must be a non-negative number.";
  }

  if (parsedOutputPricePer1M !== null && (Number.isNaN(parsedOutputPricePer1M) || parsedOutputPricePer1M < 0)) {
    errors.outputPricePer1M = "Output price must be a non-negative number.";
  }

  if (parsedInputPricePer1M === null && parsedOutputPricePer1M === null) {
    errors.inputPricePer1M = "Provide at least one price field.";
    errors.outputPricePer1M = "Provide at least one price field.";
  }

  if (!payload.effectiveFrom) {
    errors.effectiveFrom = "Effective time is required.";
  } else if (!isValidTimestamp(payload.effectiveFrom)) {
    errors.effectiveFrom = "Enter a valid ISO timestamp.";
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
    errors.ownerId = `Select a ${payload.ownerType}.`;
  }

  if (!payload.apiKey) {
    errors.apiKey = "API key is required.";
  }

  if (!payload.testModel) {
    errors.testModel = "Test model is required.";
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

  return { data, loading, error, reload: () => loader().then(setData) };
}

function useMutationState(): [MutationState, Dispatch<SetStateAction<MutationState>>] {
  const [state, setState] = useState<MutationState>({ pending: false, error: null, success: null });
  return [state, setState];
}

function AdminShell({ children }: { children: ReactNode }) {
  const items = [
    ["/", "Overview"],
    ["/relays", "Relays"],
    ["/submissions", "Submissions"],
    ["/credentials", "Credentials"],
    ["/sponsors", "Sponsors"],
    ["/prices", "Prices"],
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
                relaynew.ai admin
              </div>
              <div>
                <h1 className="text-3xl tracking-[-0.05em] md:text-4xl">Operate the relay catalog, sponsorships, and pricing lanes.</h1>
                <p className="mt-2.5 max-w-2xl text-sm leading-6 text-white/60">
                  Review relay inventory, approve inbound submissions, and keep sponsor and pricing operations on a dedicated control deck.
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
              <a className="pill pill-ghost" href={PUBLIC_SITE_URL} target="_blank" rel="noreferrer">Public site</a>
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

function LoadingCard() {
  return <div className="card text-sm uppercase tracking-[0.16em] text-white/55">Loading...</div>;
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

function OverviewPage() {
  const { data, loading, error } = useLoadable<AdminOverviewResponse>(() => fetchJson("/admin/overview"), []);
  if (loading) return <LoadingCard />;
  if (error || !data) return <ErrorCard message={error ?? "Unable to load admin overview."} />;

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {Object.entries(data.totals).map(([label, value]) => (
        <Card key={label} title={String(value)} kicker={label.replace(/[A-Z]/g, (match) => ` ${match.toLowerCase()}`)}>
          <p className="text-sm text-white/60">Measured at {new Date(data.measuredAt).toLocaleTimeString()}</p>
        </Card>
      ))}
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
  const [form, setForm] = useState<AdminRelayUpsert>(emptyForm);
  const [fieldErrors, setFieldErrors] = useState<RelayFormErrors>({});
  const [mutation, setMutation] = useMutationState();
  const relays = useLoadable<AdminRelaysResponse>(() => fetchJson("/admin/relays"), []);

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
    setFieldErrors({});
  }

  async function submit() {
    const { errors, payload } = validateRelayForm(form);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setMutation({ pending: false, error: "Please fix the highlighted relay fields before saving.", success: null });
      return;
    }

    setMutation({ pending: true, error: null, success: null });
    try {
      const path = editingId ? `/admin/relays/${editingId}` : "/admin/relays";
      await fetchJson(path, {
        method: editingId ? "PATCH" : "POST",
        body: JSON.stringify(payload),
      });
      setMutation({ pending: false, error: null, success: editingId ? "Relay updated." : "Relay created." });
      resetForm();
      await relays.reload();
    } catch (reason) {
      setMutation({ pending: false, error: reason instanceof Error ? reason.message : "Unable to save relay.", success: null });
    }
  }

  if (relays.loading) return <LoadingCard />;
  if (relays.error || !relays.data) return <ErrorCard message={relays.error ?? "Unable to load relays."} />;

  return (
    <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
      <Card title="Relay catalog" kicker="Current rows">
        <div className="space-y-2.5">
          {relays.data.rows.map((relay) => (
            <button
              key={relay.id}
              className="admin-list-card w-full border border-white/10 bg-white/5 p-3.5 text-left transition hover:bg-white/8"
              onClick={() => {
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
              }}
              type="button"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xl tracking-[-0.03em]">{relay.name}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.16em] text-white/45">{relay.slug} · {relay.catalogStatus}</p>
                </div>
                <div className="text-right text-xs uppercase tracking-[0.14em] text-white/50">
                  <p>{relay.isFeatured ? "featured" : "standard"}</p>
                  <p>{relay.isSponsored ? "sponsor hint" : "organic"}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </Card>
      <Card title={editingId ? "Edit relay" : "Create relay"} kicker="Write path">
        <div className="grid gap-2.5">
          {([
            { label: "Slug", key: "slug", placeholder: "northwind-relay", type: "text" },
            { label: "Name", key: "name", placeholder: "Northwind Relay", type: "text" },
            { label: "Base URL", key: "baseUrl", placeholder: "https://northwind.example.ai/v1", type: "url" },
            { label: "Provider", key: "providerName", placeholder: "Northwind Labs", type: "text" },
            { label: "Website", key: "websiteUrl", placeholder: "https://northwind.example.ai", type: "url" },
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
            Catalog status
            <select className="field-input" value={form.catalogStatus} onChange={(event) => setForm((current) => ({ ...current, catalogStatus: event.target.value as AdminRelayUpsert["catalogStatus"] }))}>
              <option value="active">active</option>
              <option value="paused">paused</option>
              <option value="pending">pending</option>
              <option value="retired">retired</option>
              <option value="archived">archived</option>
            </select>
          </label>
          <label className="inline-flex items-center gap-3 text-sm text-white/70"><input type="checkbox" checked={form.isFeatured} onChange={(event) => setForm((current) => ({ ...current, isFeatured: event.target.checked }))} /> Featured</label>
          <label className="inline-flex items-center gap-3 text-sm text-white/70"><input type="checkbox" checked={form.isSponsored} onChange={(event) => setForm((current) => ({ ...current, isSponsored: event.target.checked }))} /> Sponsor hint</label>
          <div className="flex gap-2.5">
            <button className="pill pill-active" disabled={mutation.pending} onClick={submit} type="button">{mutation.pending ? "Saving..." : editingId ? "Update" : "Create"}</button>
            {editingId ? <button className="pill pill-idle" type="button" onClick={resetForm}>Clear</button> : null}
          </div>
          <Notice state={mutation} />
        </div>
      </Card>
    </div>
  );
}

function SubmissionsPage() {
  const submissions = useLoadable<AdminSubmissionsResponse>(() => fetchJson("/admin/submissions"), []);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [mutation, setMutation] = useMutationState();

  async function review(id: string, status: "approved" | "rejected" | "archived") {
    setMutation({ pending: true, error: null, success: null });
    try {
      await fetchJson(`/admin/submissions/${id}/review`, {
        method: "POST",
        body: JSON.stringify({ status, reviewNotes: notes[id] ?? null }),
      });
      setMutation({ pending: false, error: null, success: `Submission ${status}.` });
      await submissions.reload();
    } catch (reason) {
      setMutation({ pending: false, error: reason instanceof Error ? reason.message : "Unable to review submission.", success: null });
    }
  }

  if (submissions.loading) return <LoadingCard />;
  if (submissions.error || !submissions.data) return <ErrorCard message={submissions.error ?? "Unable to load submissions."} />;

  return (
    <Card title="Submission queue" kicker="Review lane">
      <div className="space-y-3">
        {submissions.data.rows.map((row) => (
          <div key={row.id} className="admin-list-card border border-white/10 bg-white/5 p-3.5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-xl tracking-[-0.03em]">{row.relayName}</p>
                <p className="mt-1 text-sm text-white/60">{row.baseUrl}</p>
                <p className="mt-2 text-xs uppercase tracking-[0.16em] text-white/40">{row.status} · {new Date(row.createdAt).toLocaleString()}</p>
                {row.approvedRelay ? <p className="mt-2 text-sm text-emerald-300/80">Linked relay · {row.approvedRelay.name}</p> : null}
                {row.probeCredential ? (
                  <div className="mt-3 space-y-1.5 rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white/65">
                    <p>
                      Credential · {row.probeCredential.status} · {row.probeCredential.apiKeyPreview}
                    </p>
                    <p>
                      Probe · {row.probeCredential.testModel} · {row.probeCredential.lastHealthStatus ?? "unknown"}
                      {row.probeCredential.lastHttpStatus ? ` · ${row.probeCredential.lastHttpStatus}` : ""}
                      {row.probeCredential.lastVerifiedAt
                        ? ` · ${new Date(row.probeCredential.lastVerifiedAt).toLocaleString()}`
                        : ""}
                    </p>
                    {row.probeCredential.lastMessage ? <p className="text-white/48">{row.probeCredential.lastMessage}</p> : null}
                  </div>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <button className="pill pill-active" type="button" onClick={() => review(row.id, "approved")}>Approve</button>
                <button className="pill pill-idle" type="button" onClick={() => review(row.id, "rejected")}>Reject</button>
                <button className="pill pill-ghost" type="button" onClick={() => review(row.id, "archived")}>Archive</button>
              </div>
            </div>
            <textarea className="field-input mt-3 min-h-24" placeholder="Review notes" value={notes[row.id] ?? row.reviewNotes ?? ""} onChange={(event) => setNotes((current) => ({ ...current, [row.id]: event.target.value }))} />
          </div>
        ))}
      </div>
      <div className="mt-4"><Notice state={mutation} /></div>
    </Card>
  );
}

function CredentialsPage() {
  const credentials = useLoadable<AdminProbeCredentialsResponse>(() => fetchJson("/admin/probe-credentials"), []);
  const relays = useLoadable<AdminRelaysResponse>(() => fetchJson("/admin/relays"), []);
  const submissions = useLoadable<AdminSubmissionsResponse>(() => fetchJson("/admin/submissions"), []);
  const [selectedCredentialId, setSelectedCredentialId] = useState<string | null>(null);
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

  useEffect(() => {
    if (!credentials.data?.rows.length) {
      setSelectedCredentialId(null);
      return;
    }

    if (!selectedCredentialId || !credentials.data.rows.some((row) => row.id === selectedCredentialId)) {
      setSelectedCredentialId(credentials.data.rows[0]?.id ?? null);
    }
  }, [credentials.data, selectedCredentialId]);

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

  const relayOwnerOptions = relays.data?.rows ?? [];
  const submissionOwnerOptions = submissions.data?.rows ?? [];

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
      setCreateMutation({ pending: false, error: "Please fix the highlighted credential fields before saving.", success: null });
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
          ? `Credential created. Initial probe ${response.probe.ok ? "passed" : "needs review"}.`
          : "Credential created.",
      });
      setCreateForm((current) => ({ ...current, ownerId: "", apiKey: "" }));
      setFieldErrors({});
      setSelectedCredentialId(response.id);
      await reloadCredentialViews(response.id);
    } catch (reason) {
      setCreateMutation({ pending: false, error: reason instanceof Error ? reason.message : "Unable to create credential.", success: null });
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
          ? `Probe rerun complete: ${response.probe.healthStatus}${response.probe.httpStatus ? ` · ${response.probe.httpStatus}` : ""}.`
          : "Probe rerun complete.",
      });
      await reloadCredentialViews(detail.data.id);
    } catch (reason) {
      setActionMutation({ pending: false, error: reason instanceof Error ? reason.message : "Unable to rerun probe.", success: null });
    }
  }

  async function rotateSelected() {
    if (!detail.data) {
      return;
    }

    const { errors, payload } = validateProbeCredentialForm(rotateForm);
    setRotateErrors(errors);
    if (Object.keys(errors).length > 0) {
      setActionMutation({ pending: false, error: "Please fix the highlighted rotation fields before saving.", success: null });
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
          ? `Credential rotated. New probe ${response.probe.ok ? "passed" : "needs review"}.`
          : "Credential rotated.",
      });
      setSelectedCredentialId(response.id);
      await reloadCredentialViews(response.id);
    } catch (reason) {
      setActionMutation({ pending: false, error: reason instanceof Error ? reason.message : "Unable to rotate credential.", success: null });
    }
  }

  async function revokeSelected() {
    if (!detail.data) {
      return;
    }

    setActionMutation({ pending: true, error: null, success: null });
    try {
      await fetchJson<AdminProbeCredentialMutationResponse>(`/admin/probe-credentials/${detail.data.id}/revoke`, {
        method: "POST",
      });
      setActionMutation({ pending: false, error: null, success: "Credential revoked." });
      await reloadCredentialViews(detail.data.id);
    } catch (reason) {
      setActionMutation({ pending: false, error: reason instanceof Error ? reason.message : "Unable to revoke credential.", success: null });
    }
  }

  async function copySelectedKey() {
    if (!detail.data) {
      return;
    }

    await navigator.clipboard.writeText(detail.data.apiKey);
    setCopiedKey(true);
    setActionMutation((current) => ({ ...current, success: "Credential key copied." }));
  }

  if (credentials.loading || relays.loading || submissions.loading) return <LoadingCard />;
  if (credentials.error || relays.error || submissions.error || !credentials.data || !relays.data || !submissions.data) {
    return <ErrorCard message={credentials.error ?? relays.error ?? submissions.error ?? "Unable to load credentials."} />;
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[1.08fr_0.92fr]">
      <Card title="Probe credentials" kicker="Monitoring keys">
        <div className="space-y-2.5">
          {credentials.data.rows.map((row) => (
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
                    {row.ownerType} · {row.status} · {row.apiKeyPreview}
                  </p>
                </div>
                <p className="text-xs uppercase tracking-[0.14em] text-white/45">{row.compatibilityMode}</p>
              </div>
              <p className="mt-2 text-sm text-white/62">{row.ownerBaseUrl}</p>
              <p className="mt-2 text-sm text-white/70">
                {row.testModel} · {row.lastHealthStatus ?? "unknown"}
                {row.lastHttpStatus ? ` · ${row.lastHttpStatus}` : ""}
              </p>
              {row.lastMessage ? <p className="mt-2 text-sm text-white/45">{row.lastMessage}</p> : null}
            </button>
          ))}
        </div>
      </Card>

      <div className="space-y-4">
        <Card title="Create credential" kicker="Attach a key">
          <div className="grid gap-2.5">
            <label className="field-label">
              Owner type
              <select
                className="field-input"
                value={createForm.ownerType}
                onChange={(event) => {
                  const ownerType = event.target.value as ProbeCredentialOwnerType;
                  setCreateForm((current) => ({ ...current, ownerType, ownerId: "" }));
                  setFieldErrors((current) => withoutFieldError(current, "ownerId"));
                  setCreateMutation((current) => ({ ...current, error: null }));
                }}
              >
                <option value="relay">relay</option>
                <option value="submission">submission</option>
              </select>
            </label>
            <label className="field-label">
              Owner record
              <select
                className="field-input"
                value={createForm.ownerId}
                onChange={(event) => {
                  setCreateForm((current) => ({ ...current, ownerId: event.target.value }));
                  setFieldErrors((current) => withoutFieldError(current, "ownerId"));
                  setCreateMutation((current) => ({ ...current, error: null }));
                }}
              >
                <option value="">Select {createForm.ownerType}</option>
                {createForm.ownerType === "relay"
                  ? relayOwnerOptions.map((owner) => (
                      <option key={owner.id} value={owner.id}>
                        {owner.name}
                      </option>
                    ))
                  : submissionOwnerOptions.map((owner) => (
                      <option key={owner.id} value={owner.id}>
                        {owner.relayName} · {owner.status}
                      </option>
                    ))}
              </select>
              <FieldError message={fieldErrors.ownerId} />
            </label>
            <label className="field-label">
              API key
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
              Test model
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
              API type
              <select
                className="field-input"
                value={createForm.compatibilityMode}
                onChange={(event) => setCreateForm((current) => ({ ...current, compatibilityMode: event.target.value as ProbeCompatibilityMode }))}
              >
                <option value="auto">auto</option>
                <option value="openai-responses">openai-responses</option>
                <option value="openai-chat-completions">openai-chat-completions</option>
                <option value="anthropic-messages">anthropic-messages</option>
              </select>
            </label>
            <button className="pill pill-active" disabled={createMutation.pending} onClick={createCredential} type="button">
              {createMutation.pending ? "Creating..." : "Create credential"}
            </button>
            <Notice state={createMutation} />
          </div>
        </Card>

        <Card title="Credential detail" kicker={detail.data ? detail.data.ownerName : "Select a credential"}>
          {!selectedCredentialId ? (
            <p className="text-sm text-white/55">No credential selected.</p>
          ) : detail.loading ? (
            <p className="text-sm text-white/55">Loading credential detail...</p>
          ) : detail.error || !detail.data ? (
            <p className="text-sm text-[#ffb59c]">{detail.error ?? "Unable to load credential detail."}</p>
          ) : (
            <div className="space-y-4">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3.5">
                <p className="text-xs uppercase tracking-[0.16em] text-white/45">
                  {detail.data.ownerType} · {detail.data.status}
                </p>
                <p className="mt-2 text-sm text-white/72">{detail.data.ownerBaseUrl}</p>
                <p className="mt-2 text-sm text-white/65">
                  {detail.data.testModel} · {detail.data.compatibilityMode}
                </p>
                <p className="mt-2 break-all font-mono text-sm text-[#ffd06a]">
                  {revealedKey ? detail.data.apiKey : detail.data.apiKeyPreview}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button className="pill pill-idle" type="button" onClick={() => setRevealedKey((current) => !current)}>
                    {revealedKey ? "Hide key" : "Reveal key"}
                  </button>
                  <button className="pill pill-idle" type="button" onClick={copySelectedKey}>
                    {copiedKey ? "Copied" : "Copy key"}
                  </button>
                  <button className="pill pill-active" disabled={actionMutation.pending} type="button" onClick={reprobeSelected}>
                    {actionMutation.pending ? "Running..." : "Re-run probe"}
                  </button>
                  <button className="pill pill-ghost" disabled={actionMutation.pending || detail.data.status === "revoked"} type="button" onClick={revokeSelected}>
                    Revoke
                  </button>
                </div>
                <div className="mt-3 space-y-1 text-sm text-white/55">
                  <p>
                    Last probe · {detail.data.lastHealthStatus ?? "unknown"}
                    {detail.data.lastHttpStatus ? ` · ${detail.data.lastHttpStatus}` : ""}
                    {detail.data.lastVerifiedAt ? ` · ${new Date(detail.data.lastVerifiedAt).toLocaleString()}` : ""}
                  </p>
                  {detail.data.lastDetectionMode ? <p>Detection · {detail.data.lastDetectionMode}</p> : null}
                  {detail.data.lastUsedUrl ? <p className="break-all">Used URL · {detail.data.lastUsedUrl}</p> : null}
                  {detail.data.lastMessage ? <p>{detail.data.lastMessage}</p> : null}
                </div>
              </div>

              <div className="grid gap-2.5">
                <p className="text-xs uppercase tracking-[0.16em] text-white/45">Rotate credential</p>
                <label className="field-label">
                  New API key
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
                  New test model
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
                  New API type
                  <select
                    className="field-input"
                    value={rotateForm.compatibilityMode}
                    onChange={(event) => setRotateForm((current) => ({ ...current, compatibilityMode: event.target.value as ProbeCompatibilityMode }))}
                  >
                    <option value="auto">auto</option>
                    <option value="openai-responses">openai-responses</option>
                    <option value="openai-chat-completions">openai-chat-completions</option>
                    <option value="anthropic-messages">anthropic-messages</option>
                  </select>
                </label>
                <button className="pill pill-active" disabled={actionMutation.pending} type="button" onClick={rotateSelected}>
                  {actionMutation.pending ? "Rotating..." : "Rotate credential"}
                </button>
                <Notice state={actionMutation} />
              </div>
            </div>
          )}
        </Card>
      </div>
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

  async function createSponsor() {
    const { errors, payload } = validateSponsorForm(form);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setMutation({ pending: false, error: "Please fix the highlighted sponsor fields before saving.", success: null });
      return;
    }

    setMutation({ pending: true, error: null, success: null });
    try {
      await fetchJson("/admin/sponsors", { method: "POST", body: JSON.stringify(payload) });
      setMutation({ pending: false, error: null, success: "Sponsor placement created." });
      setFieldErrors({});
      await sponsors.reload();
    } catch (reason) {
      setMutation({ pending: false, error: reason instanceof Error ? reason.message : "Unable to create sponsor.", success: null });
    }
  }

  if (sponsors.loading || relays.loading) return <LoadingCard />;
  if (sponsors.error || !sponsors.data || relays.error || !relays.data) return <ErrorCard message={sponsors.error ?? relays.error ?? "Unable to load sponsors."} />;

  return (
    <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
      <Card title="Sponsor placements" kicker="Active windows">
        <div className="space-y-2.5">
          {sponsors.data.rows.map((row) => (
            <div key={row.id} className="admin-list-card border border-white/10 bg-white/5 p-3.5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xl tracking-[-0.03em]">{row.name}</p>
                  <p className="mt-1 text-sm text-white/60">{row.placement}</p>
                </div>
                <p className="text-xs uppercase tracking-[0.16em] text-white/40">{row.status}</p>
              </div>
              <p className="mt-2 text-sm text-white/60">{row.relay ? `${row.relay.name} · ` : "No relay binding · "}{new Date(row.startAt).toLocaleDateString()} → {new Date(row.endAt).toLocaleDateString()}</p>
            </div>
          ))}
        </div>
      </Card>
      <Card title="Create placement" kicker="Sales operations">
        <div className="grid gap-2.5">
          <label className="field-label">Name<input className="field-input" placeholder="Homepage spotlight" value={form.name} onChange={(event) => { setForm((current) => ({ ...current, name: event.target.value })); setFieldErrors((current) => withoutFieldError(current, "name")); setMutation((current) => ({ ...current, error: null })); }} /><FieldError message={fieldErrors.name} /></label>
          <label className="field-label">Placement<input className="field-input" placeholder="homepage-spotlight" value={form.placement} onChange={(event) => { setForm((current) => ({ ...current, placement: event.target.value })); setFieldErrors((current) => withoutFieldError(current, "placement")); setMutation((current) => ({ ...current, error: null })); }} /><FieldError message={fieldErrors.placement} /></label>
          <label className="field-label">Relay<select className="field-input" value={form.relayId} onChange={(event) => setForm((current) => ({ ...current, relayId: event.target.value }))}><option value="">Unbound sponsor</option>{relays.data.rows.map((relay) => <option key={relay.id} value={relay.id}>{relay.name}</option>)}</select></label>
          <label className="field-label">Status<select className="field-input" value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as SponsorFormState["status"] }))}><option value="active">active</option><option value="draft">draft</option><option value="paused">paused</option><option value="ended">ended</option></select></label>
          <label className="field-label">Start<input className="field-input" placeholder="2026-04-16T00:00:00.000Z" value={form.startAt} onChange={(event) => { setForm((current) => ({ ...current, startAt: event.target.value })); setFieldErrors((current) => withoutFieldError(current, "startAt")); setMutation((current) => ({ ...current, error: null })); }} /><FieldError message={fieldErrors.startAt} /></label>
          <label className="field-label">End<input className="field-input" placeholder="2026-05-16T00:00:00.000Z" value={form.endAt} onChange={(event) => { setForm((current) => ({ ...current, endAt: event.target.value })); setFieldErrors((current) => withoutFieldError(current, "endAt")); setMutation((current) => ({ ...current, error: null })); }} /><FieldError message={fieldErrors.endAt} /></label>
          <button className="pill pill-active" disabled={mutation.pending} onClick={createSponsor} type="button">{mutation.pending ? "Saving..." : "Create placement"}</button>
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

  async function createPrice() {
    const { errors, payload } = validatePriceForm(form);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setMutation({ pending: false, error: "Please fix the highlighted price fields before saving.", success: null });
      return;
    }

    setMutation({ pending: true, error: null, success: null });
    try {
      await fetchJson("/admin/prices", { method: "POST", body: JSON.stringify(payload) });
      setMutation({ pending: false, error: null, success: "Price record created." });
      setFieldErrors({});
      await prices.reload();
    } catch (reason) {
      setMutation({ pending: false, error: reason instanceof Error ? reason.message : "Unable to create price record.", success: null });
    }
  }

  if (prices.loading || relays.loading || models.loading) return <LoadingCard />;
  if (prices.error || relays.error || models.error || !prices.data || !relays.data || !models.data) return <ErrorCard message={prices.error ?? relays.error ?? models.error ?? "Unable to load prices."} />;

  return (
    <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
      <Card title="Price history" kicker="Recorded schedules">
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
              <p className="mt-2 text-xs uppercase tracking-[0.16em] text-white/40">{row.source} · {new Date(row.effectiveFrom).toLocaleDateString()}</p>
            </div>
          ))}
        </div>
      </Card>
      <Card title="Create price record" kicker="Pricing ops">
        <div className="grid gap-2.5">
          <label className="field-label">Relay<select className="field-input" value={form.relayId} onChange={(event) => { setForm((current) => ({ ...current, relayId: event.target.value })); setFieldErrors((current) => withoutFieldError(current, "relayId")); setMutation((current) => ({ ...current, error: null })); }}><option value="">Select relay</option>{relays.data.rows.map((relay) => <option key={relay.id} value={relay.id}>{relay.name}</option>)}</select><FieldError message={fieldErrors.relayId} /></label>
          <label className="field-label">Model<select className="field-input" value={form.modelId} onChange={(event) => { setForm((current) => ({ ...current, modelId: event.target.value })); setFieldErrors((current) => withoutFieldError(current, "modelId")); setMutation((current) => ({ ...current, error: null })); }}><option value="">Select model</option>{models.data.rows.map((model) => <option key={model.id} value={model.id}>{model.name}</option>)}</select><FieldError message={fieldErrors.modelId} /></label>
          <label className="field-label">Input price<input className="field-input" type="number" min="0" step="0.01" value={form.inputPricePer1M} onChange={(event) => { setForm((current) => ({ ...current, inputPricePer1M: event.target.value })); setFieldErrors((current) => withoutFieldError(current, "inputPricePer1M")); setMutation((current) => ({ ...current, error: null })); }} /><FieldError message={fieldErrors.inputPricePer1M} /></label>
          <label className="field-label">Output price<input className="field-input" type="number" min="0" step="0.01" value={form.outputPricePer1M} onChange={(event) => { setForm((current) => ({ ...current, outputPricePer1M: event.target.value })); setFieldErrors((current) => withoutFieldError(current, "outputPricePer1M")); setMutation((current) => ({ ...current, error: null })); }} /><FieldError message={fieldErrors.outputPricePer1M} /></label>
          <label className="field-label">Effective from<input className="field-input" placeholder="2026-04-16T00:00:00.000Z" value={form.effectiveFrom} onChange={(event) => { setForm((current) => ({ ...current, effectiveFrom: event.target.value })); setFieldErrors((current) => withoutFieldError(current, "effectiveFrom")); setMutation((current) => ({ ...current, error: null })); }} /><FieldError message={fieldErrors.effectiveFrom} /></label>
          <button className="pill pill-active" disabled={mutation.pending} onClick={createPrice} type="button">{mutation.pending ? "Saving..." : "Create price"}</button>
          <Notice state={mutation} />
        </div>
      </Card>
    </div>
  );
}

export function App() {
  return (
    <AdminShell>
      <Routes>
        <Route path="/" element={<OverviewPage />} />
        <Route path="/relays" element={<RelaysPage />} />
        <Route path="/submissions" element={<SubmissionsPage />} />
        <Route path="/credentials" element={<CredentialsPage />} />
        <Route path="/sponsors" element={<SponsorsPage />} />
        <Route path="/prices" element={<PricesPage />} />
      </Routes>
    </AdminShell>
  );
}
