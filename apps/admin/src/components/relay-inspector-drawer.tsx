import * as Shared from "../shared";
import { AdminDrawer } from "./admin-drawer";
import { InfoTip } from "./info-tip";
import { RelayEditorForm } from "./relay-editor-form";
import { WorkflowDetailGrid, WorkflowPriceTable, WorkflowSection } from "./relay-workflow";

const {
  PUBLIC_SITE_URL,
  buildRelayFormState,
  createRelayPriceRowFormState,
  fetchJson,
  formatCatalogStatus,
  formatCredentialStatus,
  formatDateTime,
  formatHealthStatus,
  useEffect,
  useMutationState,
  useState,
  validateRelayForm,
  withoutFieldError,
} = Shared;

export function RelayInspectorDrawer({
  open,
  relay,
  initialMode = "detail",
  onClose,
  onReload,
}: {
  open: boolean;
  relay: Shared.AdminRelaysResponse["rows"][number] | null;
  initialMode?: "detail" | "edit";
  onClose: () => void;
  onReload: () => Promise<unknown>;
}) {
  const [mode, setMode] = useState<"detail" | "edit">(initialMode);
  const [form, setForm] = useState<Shared.RelayFormState>(() => buildRelayFormState());
  const [fieldErrors, setFieldErrors] = useState<Shared.RelayFormErrors>({});
  const [mutation, setMutation] = useMutationState();

  useEffect(() => {
    if (!open || !relay) {
      return;
    }

    setMode(initialMode);
    setForm(buildRelayFormState(relay));
    setFieldErrors({});
    setMutation({ pending: false, error: null, success: null });
  }, [initialMode, open, relay]);

  function updateForm<Key extends keyof Shared.RelayFormState>(key: Key, value: Shared.RelayFormState[Key]) {
    setForm((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => ({ ...current, [key]: undefined }));
    setMutation((current) => ({ ...current, error: null }));
  }

  function updatePriceRow(rowId: string, key: keyof Shared.RelayPriceRowFormState, value: string) {
    setForm((current) => ({
      ...current,
      modelPrices: current.modelPrices.map((row) => (row.id === rowId ? { ...row, [key]: value } : row)),
    }));
    setFieldErrors((current) => withoutFieldError(current, "modelPrices"));
    setMutation((current) => ({ ...current, error: null }));
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

  function resetForm() {
    if (!relay) {
      return;
    }

    setForm(buildRelayFormState(relay));
    setFieldErrors({});
    setMutation({ pending: false, error: null, success: null });
  }

  async function submitRelay() {
    if (!relay) {
      return;
    }

    const { errors, payload } = validateRelayForm(form, { editing: true });
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setMutation({ pending: false, error: "请先修正高亮字段，再保存 Relay。", success: null });
      return;
    }

    setMutation({ pending: true, error: null, success: null });
    try {
      await fetchJson(`/admin/relays/${relay.id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      await onReload();
      setMutation({ pending: false, error: null, success: "Relay 已更新。" });
    } catch (reason) {
      setMutation({ pending: false, error: reason instanceof Error ? reason.message : "无法保存 Relay。", success: null });
    }
  }

  async function updateRelayStatus(status: Shared.RelayFormState["catalogStatus"]) {
    if (!relay) {
      return;
    }

    const nextForm = buildRelayFormState(relay);
    nextForm.catalogStatus = status;
    const { payload } = validateRelayForm(nextForm, { editing: true });

    setMutation({ pending: true, error: null, success: null });
    try {
      await fetchJson(`/admin/relays/${relay.id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      await onReload();
      setMutation({
        pending: false,
        error: null,
        success:
          status === "archived"
            ? `${relay.name} 已归档。`
            : status === "paused"
              ? `${relay.name} 已暂停。`
              : `${relay.name} 已重新激活。`,
      });
    } catch (reason) {
      setMutation({ pending: false, error: reason instanceof Error ? reason.message : "无法更新 Relay 状态。", success: null });
    }
  }

  if (!relay) {
    return null;
  }

  return (
    <AdminDrawer open={open} title={relay.name} onClose={onClose}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/10 pb-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[11px] uppercase tracking-[0.18em] text-white/40">Relay 抽屉</p>
              <InfoTip content="右侧抽屉用于集中查看详情和编辑，不再跳转到独立页面。" />
              <span className={relay.catalogStatus === "active" ? "pill pill-active !cursor-default" : "pill pill-idle !cursor-default"}>
                {formatCatalogStatus(relay.catalogStatus)}
              </span>
            </div>
            <p className="mt-2 text-xs uppercase tracking-[0.16em] text-white/40">{relay.slug}</p>
            <p className="mt-1 truncate text-sm text-white/56">{relay.baseUrl}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className={mode === "detail" ? "pill pill-active" : "pill pill-idle"} onClick={() => setMode("detail")} type="button">
              概览
            </button>
            <button className={mode === "edit" ? "pill pill-active" : "pill pill-idle"} onClick={() => setMode("edit")} type="button">
              编辑
            </button>
            <a className="pill pill-ghost" href={`${PUBLIC_SITE_URL}/relay/${relay.slug}`} rel="noreferrer" target="_blank">
              前台详情页
            </a>
          </div>
        </div>

        {mode === "detail" ? (
          <div className="space-y-3">
            <WorkflowSection title="概要信息" tip="这里保留站点最关键的运营信息，便于先判断是否需要继续编辑。">
              <WorkflowDetailGrid
                items={[
                  { label: "Base URL", value: relay.baseUrl },
                  {
                    label: "站点网站",
                    value: relay.websiteUrl ? (
                      <a className="underline underline-offset-4 text-white/82" href={relay.websiteUrl} rel="noreferrer" target="_blank">
                        {relay.websiteUrl}
                      </a>
                    ) : "未填写",
                  },
                  { label: "联系方式", value: relay.contactInfo ?? "未填写" },
                  { label: "模型数量", value: `${relay.modelPrices.length} 个` },
                ]}
              />
              <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-sm leading-6 text-white/72">
                {relay.description ?? "暂未填写站点简介。"}
              </div>
            </WorkflowSection>

            <WorkflowSection title="测试状态" tip="只有 active 且存在可用测试 Key 的 Relay 才会继续自动测试。">
              {relay.probeCredential ? (
                <WorkflowDetailGrid
                  columns={1}
                  items={[
                    {
                      label: "测试凭据",
                      value: `${relay.probeCredential.apiKeyPreview} · ${formatCredentialStatus(relay.probeCredential.status)}`,
                    },
                    {
                      label: "测试模型",
                      value: `${relay.probeCredential.testModel} · ${formatHealthStatus(relay.probeCredential.lastHealthStatus)}${relay.probeCredential.lastHttpStatus ? ` · ${relay.probeCredential.lastHttpStatus}` : ""}`,
                    },
                    {
                      label: "最近验证",
                      value: relay.probeCredential.lastVerifiedAt ? formatDateTime(relay.probeCredential.lastVerifiedAt) : "尚未完成验证",
                    },
                  ]}
                />
              ) : (
                <div className="rounded-2xl border border-[#ffd06a]/24 bg-[#ffd06a]/8 px-3 py-3 text-sm leading-6 text-[#ffd892]">
                  当前没有可用的测试 Key，Relay 无法参与自动测试。
                </div>
              )}
            </WorkflowSection>

            <WorkflowSection title="支持模型及价格表" tip="这里只展示当前价格信息；需要调整时切到“编辑”即可。">
              <WorkflowPriceTable rows={relay.modelPrices} />
            </WorkflowSection>

            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3.5">
              <div className="flex flex-wrap gap-2.5">
                <button className="pill pill-active" onClick={() => setMode("edit")} type="button">
                  编辑 Relay
                </button>
                {relay.catalogStatus === "active" ? (
                  <button className="pill pill-idle" disabled={mutation.pending} onClick={() => void updateRelayStatus("paused")} type="button">
                    暂停
                  </button>
                ) : (
                  <button className="pill pill-idle" disabled={mutation.pending} onClick={() => void updateRelayStatus("active")} type="button">
                    重新激活
                  </button>
                )}
                <button className="pill pill-ghost" disabled={mutation.pending} onClick={() => void updateRelayStatus("archived")} type="button">
                  归档
                </button>
              </div>
              <div className="mt-3">
                <Shared.Notice state={mutation} />
              </div>
            </div>
          </div>
        ) : (
          <RelayEditorForm
            mode="edit"
            form={form}
            fieldErrors={fieldErrors}
            mutation={mutation}
            submitLabel="保存修改"
            submittingLabel="保存中..."
            resetLabel="恢复原始内容"
            extraActions={
              <button className="pill pill-ghost" onClick={() => setMode("detail")} type="button">
                返回概览
              </button>
            }
            onSubmit={() => void submitRelay()}
            onReset={resetForm}
            onUpdateForm={updateForm}
            onUpdatePriceRow={updatePriceRow}
            onAddPriceRow={addPriceRow}
            onRemovePriceRow={removePriceRow}
          />
        )}
      </div>
    </AdminDrawer>
  );
}
