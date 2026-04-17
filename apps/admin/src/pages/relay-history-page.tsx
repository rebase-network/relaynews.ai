import * as Shared from "../shared";
import { InfoTip } from "../components/info-tip";
import { RelayInspectorDrawer } from "../components/relay-inspector-drawer";

const {
  clsx,
  Card,
  ErrorCard,
  LoadingCard,
  formatDateTime,
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
      <Card title="Relay 历史" kicker="已归档站点">
        <div className="space-y-3 border-b border-white/10 pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm text-white/72">当前归档 Relay</p>
            <InfoTip content="归档后的 Relay 不会参与自动测试，也不会出现在公开目录和榜单中；如有需要，可以在右侧抽屉中重新激活或编辑资料。" />
            <div className="flex flex-wrap gap-2 sm:ml-2">
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/66">
                共 {archivedRelays.length} 条
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/66">
                选中 {selectedRelay ? 1 : 0}
              </span>
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <p className="text-[11px] uppercase tracking-[0.18em] text-white/40">Relay 历史</p>
              <InfoTip content="点击某条归档 Relay 的“查看 / 编辑”后，会在右侧抽屉中展示详情和编辑界面。" />
            </div>
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
                "admin-list-card border bg-white/5 p-3.5",
                relay.id === selectedRelayId ? "border-[#ffd06a]/45 bg-white/[0.07] shadow-[rgba(255,208,106,0.16)_0_0_0_1px]" : "border-white/10",
              )}
            >
              <div className="grid gap-3 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto] xl:items-center">
                <button className="min-w-0 text-left" type="button" onClick={() => openRelayDrawer(relay.id, "detail")}>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-lg tracking-[-0.03em]">{relay.name}</p>
                    <span className="pill pill-idle !cursor-default">已归档</span>
                  </div>
                  <p className="mt-1 text-xs uppercase tracking-[0.16em] text-white/40">{relay.slug}</p>
                  <p className="mt-2 truncate text-sm text-white/64">{relay.baseUrl}</p>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-white/58">
                    <span className="rounded-full border border-white/10 bg-black/10 px-2.5 py-1">模型 {relay.modelPrices.length}</span>
                    <span className="rounded-full border border-white/10 bg-black/10 px-2.5 py-1">
                      {relay.contactInfo ? "已填联系方式" : "未填联系方式"}
                    </span>
                  </div>
                </button>

                <div className="rounded-2xl border border-white/10 bg-black/10 px-3 py-2.5">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-white/38">归档信息</p>
                  <p className="mt-1.5 text-sm text-white/72">最近更新 {formatDateTime(relay.updatedAt)}</p>
                  <p className="mt-1 text-sm text-white/58">{relay.contactInfo ?? "未填写联系方式"}</p>
                  <p className="mt-1 text-xs text-white/46">可在抽屉中查看详情、编辑资料或重新激活。</p>
                </div>

                <div className="flex flex-wrap gap-2 xl:flex-col xl:items-end">
                  <button className="pill pill-active" type="button" onClick={() => openRelayDrawer(relay.id, "detail")}>
                    查看 / 编辑
                  </button>
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
