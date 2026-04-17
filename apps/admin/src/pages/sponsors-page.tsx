import * as Shared from "../shared";
import { InfoTip } from "../components/info-tip";
import { StatusBadge } from "../components/status-badge";

const {
  Card,
  ConfirmDialog,
  ErrorCard,
  LoadingCard,
  Notice,
  PUBLIC_SITE_URL,
  fetchJson,
  useLoadable,
  useMutationState,
  useMemo,
  useState,
} = Shared;

const SPONSOR_PLACEMENT = "homepage-spotlight";
const SPONSOR_DURATION_MS = 10 * 365 * 24 * 60 * 60 * 1000;

export function SponsorsPage() {
  const sponsors = useLoadable<Shared.AdminSponsorsResponse>(() => fetchJson("/admin/sponsors"), []);
  const relays = useLoadable<Shared.AdminRelaysResponse>(() => fetchJson("/admin/relays"), []);
  const [selectedRelayId, setSelectedRelayId] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Shared.AdminSponsorsResponse["rows"][number] | null>(null);
  const [mutation, setMutation] = useMutationState();

  const relayById = useMemo(() => new Map((relays.data?.rows ?? []).map((relay) => [relay.id, relay])), [relays.data?.rows]);
  const sponsorRows = sponsors.data?.rows ?? [];
  const activeRelays = (relays.data?.rows ?? []).filter((relay) => relay.catalogStatus === "active");
  const sponsoredRelayIds = new Set(sponsorRows.flatMap((row) => (row.relayId ? [row.relayId] : [])));
  const availableRelays = activeRelays.filter((relay) => !sponsoredRelayIds.has(relay.id) || relay.id === selectedRelayId);

  async function addSponsor() {
    if (!selectedRelayId) {
      setMutation({ pending: false, error: "请先选择一个 active Relay。", success: null });
      return;
    }

    const relay = relayById.get(selectedRelayId);
    if (!relay) {
      setMutation({ pending: false, error: "所选 Relay 不存在。", success: null });
      return;
    }

    if (sponsorRows.some((row) => row.relayId === relay.id)) {
      setMutation({ pending: false, error: "这个 Relay 已经在赞助列表中。", success: null });
      return;
    }

    const startAt = new Date().toISOString();
    const endAt = new Date(Date.now() + SPONSOR_DURATION_MS).toISOString();

    setMutation({ pending: true, error: null, success: null });
    try {
      await fetchJson("/admin/sponsors", {
        method: "POST",
        body: JSON.stringify({
          relayId: relay.id,
          name: relay.name,
          placement: SPONSOR_PLACEMENT,
          status: "active",
          startAt,
          endAt,
        }),
      });
      setSelectedRelayId("");
      setMutation({ pending: false, error: null, success: "赞助商已添加。" });
      await sponsors.reload();
    } catch (reason) {
      setMutation({ pending: false, error: reason instanceof Error ? reason.message : "无法添加赞助商。", success: null });
    }
  }

  async function deleteSponsor(row: Shared.AdminSponsorsResponse["rows"][number]) {
    setMutation({ pending: true, error: null, success: null });
    try {
      await fetchJson<{ ok: true }>(`/admin/sponsors/${row.id}`, {
        method: "DELETE",
      });
      setDeleteTarget(null);
      setMutation({ pending: false, error: null, success: "赞助商已移除。" });
      await sponsors.reload();
    } catch (reason) {
      setDeleteTarget(null);
      setMutation({ pending: false, error: reason instanceof Error ? reason.message : "无法移除赞助商。", success: null });
    }
  }

  if (sponsors.loading || relays.loading) {
    return <LoadingCard />;
  }

  if (sponsors.error || !sponsors.data || relays.error || !relays.data) {
    return <ErrorCard message={sponsors.error ?? relays.error ?? "无法加载赞助列表。"} />;
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
      <Card title="赞助商">
        <div className="space-y-3 border-b border-white/10 pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm text-white/72">当前共 {sponsorRows.length} 条</p>
            <InfoTip content="赞助位收敛为简单列表：从 active Relay 中挑选要展示的站点即可，不再单独维护投放状态、时间窗口或批量操作。" />
          </div>
          <p className="text-sm text-white/48">只保留当前展示所需的 Relay 选择与移除操作。</p>
        </div>

        <div className="mt-3 space-y-2">
          {sponsorRows.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-5 text-sm text-white/58">
              当前还没有赞助商。
            </div>
          ) : sponsorRows.map((row) => {
            const relay = row.relayId ? relayById.get(row.relayId) ?? null : null;
            const displayName = relay?.name ?? row.relay?.name ?? row.name;
            const displayUrl = relay?.baseUrl ?? (row.relay ? `${PUBLIC_SITE_URL}/relay/${row.relay.slug}` : null);

            return (
              <div key={row.id} className="admin-list-card border border-white/10 bg-white/5 p-3">
                <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-lg tracking-[-0.03em]">{displayName}</p>
                      <StatusBadge tone="accent">赞助展示</StatusBadge>
                    </div>
                    <p className="mt-1 text-xs uppercase tracking-[0.16em] text-white/40">{relay?.slug ?? row.relay?.slug ?? "未绑定 Relay"}</p>
                    {displayUrl ? <p className="mt-1.5 truncate text-sm text-white/62">{displayUrl}</p> : null}
                  </div>
                  <div className="flex flex-wrap gap-2 xl:flex-col xl:items-end">
                    {relay ? (
                      <a className="pill pill-idle" href={`${PUBLIC_SITE_URL}/relay/${relay.slug}`} rel="noreferrer" target="_blank">
                        前台详情
                      </a>
                    ) : null}
                    <button className="pill pill-ghost" disabled={mutation.pending} onClick={() => setDeleteTarget(row)} type="button">
                      移除
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card title="添加赞助商">
        <div className="space-y-3">
          <label className="field-label">
            选择 Relay
            <select
              className="field-input"
              value={selectedRelayId}
              onChange={(event) => {
                setSelectedRelayId(event.target.value);
                setMutation((current) => ({ ...current, error: null }));
              }}
            >
              <option value="">请选择启用中的 Relay</option>
              {availableRelays.map((relay) => (
                <option key={relay.id} value={relay.id}>{relay.name}</option>
              ))}
            </select>
          </label>
          <div className="rounded-2xl border border-white/10 bg-white/5 px-3.5 py-3 text-sm leading-6 text-white/62">
            添加后会直接进入前台赞助展示列表；如果选错了，移除后重新添加即可。
          </div>
          <div className="flex flex-wrap gap-2.5">
            <button className="pill pill-active" disabled={mutation.pending} onClick={() => void addSponsor()} type="button">
              {mutation.pending ? "保存中..." : "添加到赞助商"}
            </button>
          </div>
          <Notice state={mutation} />
        </div>
      </Card>

      <ConfirmDialog
        confirmLabel="移除赞助商"
        confirmPendingLabel="移除中..."
        message={deleteTarget ? `${deleteTarget.name} 将从赞助展示列表中移除。` : ""}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) {
            void deleteSponsor(deleteTarget);
          }
        }}
        open={Boolean(deleteTarget)}
        pending={mutation.pending}
        title={deleteTarget ? `确认移除 ${deleteTarget.name}？` : ""}
      />
    </div>
  );
}
