import * as Shared from "../shared";
import { AdminDrawer } from "../components/admin-drawer";
import { RelayEditorForm } from "../components/relay-editor-form";
import { RelayInspectorDrawer } from "../components/relay-inspector-drawer";
import { StatusBadge } from "../components/status-badge";

const {
  clsx,
  Card,
  ConfirmDialog,
  ErrorCard,
  LoadingCard,
  buildRelayFormState,
  createRelayPriceRowFormState,
  fetchJson,
  formatCatalogStatus,
  formatCredentialStatus,
  formatDateTime,
  formatHealthStatus,
  statusToneForCatalogStatus,
  useEffect,
  useLoadable,
  useMutationState,
  useState,
  validateRelayForm,
  withoutFieldError,
} = Shared;

export function RelaysPage() {
  const relays = useLoadable<Shared.AdminRelaysResponse>(() => fetchJson("/admin/relays"), []);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedRelayId, setSelectedRelayId] = useState<string | null>(null);
  const [selectedMode, setSelectedMode] = useState<"detail" | "edit">("detail");
  const [archiveTarget, setArchiveTarget] = useState<Shared.AdminRelaysResponse["rows"][number] | null>(null);
  const [actionMutation, setActionMutation] = useMutationState();
  const [createMutation, setCreateMutation] = useMutationState();
  const [form, setForm] = useState<Shared.RelayFormState>(() => buildRelayFormState());
  const [fieldErrors, setFieldErrors] = useState<Shared.RelayFormErrors>({});
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "paused">("all");
  const [highlightedRelayId, setHighlightedRelayId] = useState<string | null>(null);

  const currentRelays = (relays.data?.rows ?? []).filter((relay) => relay.catalogStatus === "active" || relay.catalogStatus === "paused");
  const selectedRelay = currentRelays.find((relay) => relay.id === selectedRelayId) ?? null;
  const activeCount = currentRelays.filter((relay) => relay.catalogStatus === "active").length;
  const pausedCount = currentRelays.filter((relay) => relay.catalogStatus === "paused").length;
  const filteredRelays = currentRelays.filter((relay) => statusFilter === "all" || relay.catalogStatus === statusFilter);

  useEffect(() => {
    if (!selectedRelayId || relays.loading) {
      return;
    }

    if (!selectedRelay) {
      setSelectedRelayId(null);
    }
  }, [relays.loading, selectedRelay, selectedRelayId]);

  function resetCreateForm() {
    setForm(buildRelayFormState());
    setFieldErrors({});
    setCreateMutation({ pending: false, error: null, success: null });
  }

  function openCreateDrawer() {
    resetCreateForm();
    setCreateOpen(true);
  }

  function closeCreateDrawer() {
    setCreateOpen(false);
    resetCreateForm();
  }

  function openRelayDrawer(relayId: string, mode: "detail" | "edit") {
    setSelectedRelayId(relayId);
    setSelectedMode(mode);
  }

  function closeRelayDrawer() {
    setSelectedRelayId(null);
    setSelectedMode("detail");
  }

  function updateForm<Key extends keyof Shared.RelayFormState>(key: Key, value: Shared.RelayFormState[Key]) {
    setForm((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => ({ ...current, [key]: undefined }));
    setCreateMutation((current) => ({ ...current, error: null }));
  }

  function updatePriceRow(rowId: string, key: keyof Shared.RelayPriceRowFormState, value: string) {
    setForm((current) => ({
      ...current,
      modelPrices: current.modelPrices.map((row) => (row.id === rowId ? { ...row, [key]: value } : row)),
    }));
    setFieldErrors((current) => withoutFieldError(current, "modelPrices"));
    setCreateMutation((current) => ({ ...current, error: null }));
  }

  function addPriceRow() {
    setForm((current) => ({
      ...current,
      modelPrices: [...current.modelPrices, createRelayPriceRowFormState(current.modelPrices.length)],
    }));
    setFieldErrors((current) => withoutFieldError(current, "modelPrices"));
  }

  function removePriceRow(rowId: string) {
    setForm((current) => ({
      ...current,
      modelPrices:
        current.modelPrices.length > 1
          ? current.modelPrices.filter((row) => row.id !== rowId)
          : [createRelayPriceRowFormState()],
    }));
    setFieldErrors((current) => withoutFieldError(current, "modelPrices"));
  }

  async function createRelay() {
    const { errors, payload } = validateRelayForm(form, { editing: false });
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setCreateMutation({ pending: false, error: "请先修正高亮字段，再创建 Relay。", success: null });
      return;
    }

    setCreateMutation({ pending: true, error: null, success: null });
    try {
      const response = await fetchJson<{ ok: true; id: string }>("/admin/relays", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setStatusFilter("all");
      setHighlightedRelayId(response.id);
      await relays.reload();
      closeCreateDrawer();
      setActionMutation({ pending: false, error: null, success: "Relay 已创建并加入当前列表。" });
    } catch (reason) {
      setCreateMutation({ pending: false, error: reason instanceof Error ? reason.message : "无法创建 Relay。", success: null });
    }
  }

  async function updateRelayStatus(relay: Shared.AdminRelaysResponse["rows"][number], status: Shared.RelayFormState["catalogStatus"]) {
    const nextForm = buildRelayFormState(relay);
    nextForm.catalogStatus = status;
    const { payload } = validateRelayForm(nextForm, { editing: true });

    setActionMutation({ pending: true, error: null, success: null });
    try {
      await fetchJson(`/admin/relays/${relay.id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      setArchiveTarget(null);
      await relays.reload();
      setActionMutation({
        pending: false,
        error: null,
        success:
          status === "archived"
            ? `${relay.name} 已归档到 Relay 历史。`
            : status === "paused"
              ? `${relay.name} 已暂停。`
              : `${relay.name} 已重新激活。`,
      });
    } catch (reason) {
      setArchiveTarget(null);
      setActionMutation({ pending: false, error: reason instanceof Error ? reason.message : "无法更新 Relay 状态。", success: null });
    }
  }

  if (relays.loading) {
    return <LoadingCard />;
  }

  if (relays.error || !relays.data) {
    return <ErrorCard message={relays.error ?? "无法加载 Relay 列表。"} />;
  }

  return (
    <>
      <Card title="Relay 列表">
        <div className="space-y-3 border-b border-white/10 pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm text-white/72">共 {currentRelays.length} 条</p>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/62">启用中 {activeCount}</span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/62">已暂停 {pausedCount}</span>
            </div>
            <div className="flex flex-wrap items-end gap-2.5">
              <label className="field-label w-[8.5rem]">
                状态
                <select className="field-input" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as "all" | "active" | "paused")}>
                  <option value="all">全部</option>
                  <option value="active">启用中</option>
                  <option value="paused">已暂停</option>
                </select>
              </label>
              <button className="pill pill-active" type="button" onClick={openCreateDrawer}>
                手动添加 Relay
              </button>
            </div>
          </div>
          <p className="text-sm text-white/48">
            {statusFilter !== "all" ? `当前显示 ${filteredRelays.length} / ${currentRelays.length} 条` : "点击列表项即可展开右侧抽屉查看详情。"}
          </p>
        </div>

        <div className="mt-3 space-y-2">
          {currentRelays.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-5 text-sm text-white/58">
              当前还没有 Relay。你可以先手动添加 Relay，或去提交记录中批准一个待审核站点。
            </div>
          ) : filteredRelays.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 px-4 py-5 text-sm text-white/56">
              当前筛选条件下没有匹配的 Relay。
            </div>
          ) : filteredRelays.map((relay) => (
            <div
              key={relay.id}
              className={clsx(
                "admin-list-card cursor-pointer border bg-white/5 p-3",
                relay.id === highlightedRelayId
                  ? "border-[#ffd06a]/45 bg-white/[0.07] shadow-[rgba(255,208,106,0.16)_0_0_0_1px]"
                  : "border-white/10",
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
              <div className="grid gap-3 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,0.88fr)_auto] xl:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-lg tracking-[-0.03em]">{relay.name}</p>
                    <StatusBadge tone={statusToneForCatalogStatus(relay.catalogStatus)}>
                      {formatCatalogStatus(relay.catalogStatus)}
                    </StatusBadge>
                    {relay.id === highlightedRelayId ? <span className="pill pill-ghost !bg-[#ffd06a]/14 !text-[#ffe6a7]">刚创建</span> : null}
                  </div>
                  <p className="mt-1 text-xs uppercase tracking-[0.16em] text-white/40">{relay.slug}</p>
                  <p className="mt-1.5 truncate text-sm text-white/62">{relay.baseUrl}</p>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-white/58">
                    <span className="rounded-full border border-white/10 bg-black/10 px-2.5 py-1">模型 {relay.modelPrices.length}</span>
                    {relay.contactInfo ? <span className="rounded-full border border-white/10 bg-black/10 px-2.5 py-1">{relay.contactInfo}</span> : null}
                    {relay.websiteUrl ? <span className="rounded-full border border-white/10 bg-black/10 px-2.5 py-1">已填写网站</span> : null}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/10 px-3 py-2.5">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-white/38">测试状态</p>
                  {relay.probeCredential ? (
                    <>
                      <p className="mt-1.5 text-sm text-white/72">
                        {formatCredentialStatus(relay.probeCredential.status)} · {formatHealthStatus(relay.probeCredential.lastHealthStatus)}
                      </p>
                      <p className="mt-1 truncate text-xs text-white/54">{relay.probeCredential.testModel}</p>
                      <p className="mt-1 text-xs text-white/42">
                        {relay.probeCredential.lastVerifiedAt ? formatDateTime(relay.probeCredential.lastVerifiedAt) : "尚未完成验证"}
                      </p>
                    </>
                  ) : (
                    <p className="mt-1.5 text-sm text-[#ffd892]">没有可用测试 Key</p>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 xl:flex-col xl:items-end">
                  <button
                    className="pill pill-active"
                    onClick={(event) => {
                      event.stopPropagation();
                      openRelayDrawer(relay.id, "edit");
                    }}
                    type="button"
                  >
                    编辑
                  </button>
                  {relay.catalogStatus === "active" ? (
                    <button
                      className="pill pill-idle"
                      disabled={actionMutation.pending}
                      onClick={(event) => {
                        event.stopPropagation();
                        void updateRelayStatus(relay, "paused");
                      }}
                      type="button"
                    >
                      暂停
                    </button>
                  ) : (
                    <button
                      className="pill pill-idle"
                      disabled={actionMutation.pending}
                      onClick={(event) => {
                        event.stopPropagation();
                        void updateRelayStatus(relay, "active");
                      }}
                      type="button"
                    >
                      重新激活
                    </button>
                  )}
                  <button
                    className="pill pill-ghost"
                    disabled={actionMutation.pending}
                    onClick={(event) => {
                      event.stopPropagation();
                      setArchiveTarget(relay);
                    }}
                    type="button"
                  >
                    归档
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-3">
          <Shared.Notice state={actionMutation} />
        </div>
      </Card>

      <ConfirmDialog
        confirmLabel="归档 Relay"
        confirmPendingLabel="归档中..."
        message={archiveTarget ? `${archiveTarget.name} 将移出当前 Relay 列表，只保留在 Relay 历史中。` : ""}
        onCancel={() => setArchiveTarget(null)}
        onConfirm={() => {
          if (archiveTarget) {
            void updateRelayStatus(archiveTarget, "archived");
          }
        }}
        open={Boolean(archiveTarget)}
        pending={actionMutation.pending}
        title={archiveTarget ? `确认归档 ${archiveTarget.name}？` : ""}
      />

      <AdminDrawer open={createOpen} title="手动添加 Relay" onClose={closeCreateDrawer}>
        <RelayEditorForm
          mode="create"
          form={form}
          fieldErrors={fieldErrors}
          mutation={createMutation}
          submitLabel="创建 Relay"
          submittingLabel="创建中..."
          resetLabel="清空表单"
          onSubmit={() => void createRelay()}
          onReset={resetCreateForm}
          onUpdateForm={updateForm}
          onUpdatePriceRow={updatePriceRow}
          onAddPriceRow={addPriceRow}
          onRemovePriceRow={removePriceRow}
        />
      </AdminDrawer>

      <RelayInspectorDrawer open={Boolean(selectedRelay)} relay={selectedRelay} initialMode={selectedMode} onClose={closeRelayDrawer} onReload={relays.reload} />
    </>
  );
}
