import * as Shared from "../shared";
import { InfoTip } from "../components/info-tip";
import { RelayInspectorDrawer } from "../components/relay-inspector-drawer";
import { StatusBadge } from "../components/status-badge";

const {
  clsx,
  Card,
  ErrorCard,
  LoadingCard,
  formatDateTime,
  statusToneForCatalogStatus,
  useEffect,
  useLoadable,
  useState,
} = Shared;

export function RelayHistoryPage() {
  const relays = useLoadable<Shared.AdminRelaysResponse>(() => Shared.fetchJson("/admin/relays"), []);
  const [selectedRelayId, setSelectedRelayId] = useState<string | null>(null);
  const [selectedMode, setSelectedMode] = useState<"detail" | "edit">("detail");

  const archivedRelays = (relays.data?.rows ?? []).filter((relay) => relay.catalogStatus === "archived");
  const selectedRelay = archivedRelays.find((relay) => relay.id === selectedRelayId) ?? null;

  useEffect(() => {
    if (!selectedRelayId || relays.loading) {
      return;
    }

    if (!selectedRelay) {
      setSelectedRelayId(null);
      setSelectedMode("detail");
    }
  }, [relays.loading, selectedRelay, selectedRelayId]);

  function openRelayDrawer(relayId: string, mode: "detail" | "edit") {
    setSelectedRelayId(relayId);
    setSelectedMode(mode);
  }

  function closeRelayDrawer() {
    setSelectedRelayId(null);
    setSelectedMode("detail");
  }

  if (relays.loading) return <LoadingCard />;
  if (relays.error || !relays.data) return <ErrorCard message={relays.error ?? "无法加载 Relay 历史。"} />;

  return (
    <>
      <Card title="Relay 历史">
        <div className="space-y-3 border-b border-white/10 pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex flex-wrap gap-2 sm:ml-2">
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/66">
                共 {archivedRelays.length} 条
              </span>
            </div>
            <InfoTip content="归档后的 Relay 不会参与自动测试，也不会出现在公开目录和榜单中" />
          </div>
        </div>

        <div className="mt-4 space-y-2.5">

          {archivedRelays.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-5 text-sm text-white/58">
              当前没有已归档的 Relay。
            </div>
          ) : archivedRelays.map((relay) => (
            <div
              key={relay.id}
              className={clsx(
                "admin-list-card cursor-pointer border bg-white/5 p-3.5",
                relay.id === selectedRelayId ? "border-[#ffd06a]/45 bg-white/[0.07] shadow-[rgba(255,208,106,0.16)_0_0_0_1px]" : "border-white/10",
              )}
              onClick={() => openRelayDrawer(relay.id, "detail")}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  openRelayDrawer(relay.id, "detail");
                }
              }}
              role="button"
              tabIndex={0}
            >
              <div className="grid gap-3 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto] xl:items-center">
                <div className="min-w-0 text-left">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-lg tracking-[-0.03em]">{relay.name}</p>
                    <StatusBadge tone={statusToneForCatalogStatus("archived")}>已归档</StatusBadge>
                  </div>
                  <p className="mt-1 text-xs uppercase tracking-[0.16em] text-white/40">{relay.slug}</p>
                  <p className="mt-2 truncate text-sm text-white/64">{relay.baseUrl}</p>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-white/58">
                    <span className="rounded-full border border-white/10 bg-black/10 px-2.5 py-1">模型 {relay.modelPrices.length}</span>
                    <span className="rounded-full border border-white/10 bg-black/10 px-2.5 py-1">
                      {relay.contactInfo ? "已填联系方式" : "未填联系方式"}
                    </span>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/10 px-3 py-2.5">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-white/38">归档信息</p>
                  <p className="mt-1.5 text-sm text-white/72">最近更新 {formatDateTime(relay.updatedAt)}</p>
                  <p className="mt-1 text-sm text-white/58">{relay.contactInfo ?? "未填写联系方式"}</p>
                </div>

                <div className="flex justify-end xl:justify-center">
                  <span className="text-xs text-white/42">点击查看详情</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <RelayInspectorDrawer open={Boolean(selectedRelay)} relay={selectedRelay} initialMode={selectedMode} onClose={closeRelayDrawer} onReload={relays.reload} />
    </>
  );
}
