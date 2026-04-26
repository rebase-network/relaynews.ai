import * as Shared from "../shared";

const {
  clsx,
  Link,
  useEffect,
  useMemo,
  useSearchParams,
  useState,
  Card,
  ConfirmDialog,
  ErrorCard,
  FieldError,
  LoadingCard,
  Notice,
  PROBE_COMPATIBILITY_OPTIONS,
  PUBLIC_SITE_URL,
  buildCredentialRoute,
  buildPriceModelOptions,
  buildRelayFormState,
  buildRelaySelectOptions,
  createDefaultModelFormState,
  createDefaultPriceFormState,
  createDefaultSponsorFormState,
  createRelayPriceRowFormState,
  fetchJson,
  formatCatalogStatus,
  formatCompatibilityMode,
  formatCredentialStatus,
  formatDate,
  formatDateTime,
  formatHealthStatus,
  formatModelStatus,
  formatOverviewMetricLabel,
  formatSubmissionStatus,
  formatSponsorStatus,
  formatTime,
  getModelOptionLabel,
  getRelayOptionLabel,
  matchesSearchQuery,
  pickPreferredCredential,
  trimString,
  useLoadable,
  useMutationState,
  validateModelForm,
  validatePriceForm,
  validateProbeCredentialForm,
  validateRelayForm,
  validateSponsorForm,
  withoutFieldError,
} = Shared;

export function PricesPage() {
  const prices = useLoadable<Shared.AdminPricesResponse>(() => fetchJson("/admin/prices"), []);
  const relays = useLoadable<Shared.AdminRelaysResponse>(() => fetchJson("/admin/relays"), []);
  const models = useLoadable<Shared.AdminModelsResponse>(() => fetchJson("/admin/models"), []);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [priceDeleteTarget, setPriceDeleteTarget] = useState<Shared.AdminPricesResponse["rows"][number] | null>(null);
  const [form, setForm] = useState<Shared.PriceFormState>(createDefaultPriceFormState);
  const [fieldErrors, setFieldErrors] = useState<Shared.PriceFormErrors>({});
  const [mutation, setMutation] = useMutationState();
  const relayOptions = buildRelaySelectOptions(relays.data?.rows ?? [], form.relayId);
  const selectableModels = buildPriceModelOptions(models.data?.rows ?? [], form.modelId);

  function resetForm() {
    setEditingId(null);
    setPriceDeleteTarget(null);
    setForm(createDefaultPriceFormState());
    setFieldErrors({});
    setMutation({ pending: false, error: null, success: null });
  }

  function beginEditingPrice(row: Shared.AdminPricesResponse["rows"][number]) {
    setEditingId(row.id);
    setPriceDeleteTarget(null);
    setForm({
      relayId: row.relayId,
      modelId: row.modelId,
      currency: row.currency,
      inputPricePer1M: row.inputPricePer1M?.toString() ?? "",
      outputPricePer1M: row.outputPricePer1M?.toString() ?? "",
      effectiveFrom: row.effectiveFrom,
      source: row.source,
    });
    setFieldErrors({});
    setMutation({ pending: false, error: null, success: null });
  }

  async function submitPrice() {
    const { errors, payload } = validatePriceForm(form);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setMutation({ pending: false, error: "请先修正高亮字段，再保存价格记录。", success: null });
      return;
    }

    setMutation({ pending: true, error: null, success: null });
    try {
      await fetchJson(editingId ? `/admin/prices/${editingId}` : "/admin/prices", {
        method: editingId ? "PATCH" : "POST",
        body: JSON.stringify(payload),
      });
      setMutation({ pending: false, error: null, success: editingId ? "价格记录已更新。" : "价格记录已创建。" });
      setEditingId(null);
      setPriceDeleteTarget(null);
      setForm(createDefaultPriceFormState());
      setFieldErrors({});
      await prices.reload();
    } catch (reason) {
      setMutation({
        pending: false,
        error: reason instanceof Error ? reason.message : editingId ? "无法更新价格记录。" : "无法创建价格记录。",
        success: null,
      });
    }
  }

  async function deletePrice(row: Shared.AdminPricesResponse["rows"][number]) {
    setMutation({ pending: true, error: null, success: null });
    try {
      await fetchJson<{ ok: true }>(`/admin/prices/${row.id}`, {
        method: "DELETE",
      });
      setPriceDeleteTarget(null);
      if (editingId === row.id) {
        setEditingId(null);
        setForm(createDefaultPriceFormState());
        setFieldErrors({});
      }
      setMutation({ pending: false, error: null, success: "价格记录已删除。" });
      await prices.reload();
    } catch (reason) {
      setPriceDeleteTarget(null);
      setMutation({
        pending: false,
        error: reason instanceof Error ? reason.message : "无法删除价格记录。",
        success: null,
      });
    }
  }

  if (prices.loading || relays.loading || models.loading) return <LoadingCard />;
  if (prices.error || relays.error || models.error || !prices.data || !relays.data || !models.data) return <ErrorCard message={prices.error ?? relays.error ?? models.error ?? "无法加载价格记录。"} />;

  return (
    <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
      <Card title="价格历史" kicker="已记录的价格计划">
        <div className="space-y-2.5">
          {prices.data.rows.map((row) => (
            <div
              key={row.id}
              className={clsx(
                "admin-list-card border p-3.5",
                row.id === editingId ? "border-[#ffd06a]/70 bg-white/10" : "border-white/10 bg-white/5",
              )}
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xl tracking-[-0.03em]">{row.relay.name}</p>
                  <p className="mt-1 text-sm text-white/60">{row.modelKey}</p>
                </div>
                <p className="text-sm text-white/60">{row.inputPricePer1M ?? "-"} / {row.outputPricePer1M ?? "-"}</p>
              </div>
              <p className="mt-2 text-xs uppercase tracking-[0.16em] text-white/40">{row.source === "manual" ? "手动录入" : row.source} · {row.currency} · {formatDate(row.effectiveFrom)}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button className="pill pill-idle" onClick={() => beginEditingPrice(row)} type="button">
                  编辑价格记录
                </button>
                <button className="pill pill-ghost" disabled={mutation.pending} onClick={() => setPriceDeleteTarget(row)} type="button">
                  删除价格记录
                </button>
              </div>
            </div>
          ))}
        </div>
      </Card>
      <Card title={editingId ? "编辑价格记录" : "创建价格记录"} kicker={editingId ? "价格修正" : "价格操作"}>
        {editingId ? (
          <div className="mb-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/62">
            你正在修正一条既有价格记录。保存后会刷新公开快照；如需放弃修改，点击“取消编辑”即可恢复创建模式。
          </div>
        ) : null}
        <div className="grid gap-2.5">
          <label className="field-label">大模型API服务站<select className="field-input" value={form.relayId} onChange={(event) => { setForm((current) => ({ ...current, relayId: event.target.value })); setFieldErrors((current) => withoutFieldError(current, "relayId")); setMutation((current) => ({ ...current, error: null })); }}><option value="">请选择大模型API服务站</option>{relayOptions.map((relay) => <option key={relay.id} value={relay.id}>{getRelayOptionLabel(relay)}</option>)}</select><FieldError message={fieldErrors.relayId} /></label>
          <label className="field-label">模型<select className="field-input" value={form.modelId} onChange={(event) => { setForm((current) => ({ ...current, modelId: event.target.value })); setFieldErrors((current) => withoutFieldError(current, "modelId")); setMutation((current) => ({ ...current, error: null })); }}><option value="">请选择模型</option>{selectableModels.map((model) => <option key={model.id} value={model.id}>{getModelOptionLabel(model)}</option>)}</select><FieldError message={fieldErrors.modelId} /></label>
          <label className="field-label">货币<input className="field-input" value={form.currency} onChange={(event) => setForm((current) => ({ ...current, currency: event.target.value }))} /></label>
          <label className="field-label">来源<select className="field-input" value={form.source} onChange={(event) => setForm((current) => ({ ...current, source: event.target.value as Shared.PriceFormState["source"] }))}><option value="manual">手动录入</option><option value="scraped">scraped</option><option value="detected">detected</option><option value="api">api</option></select></label>
          <label className="field-label">输入价<input className="field-input" type="number" min="0" step="0.01" value={form.inputPricePer1M} onChange={(event) => { setForm((current) => ({ ...current, inputPricePer1M: event.target.value })); setFieldErrors((current) => withoutFieldError(current, "inputPricePer1M")); setMutation((current) => ({ ...current, error: null })); }} /><FieldError message={fieldErrors.inputPricePer1M} /></label>
          <label className="field-label">输出价<input className="field-input" type="number" min="0" step="0.01" value={form.outputPricePer1M} onChange={(event) => { setForm((current) => ({ ...current, outputPricePer1M: event.target.value })); setFieldErrors((current) => withoutFieldError(current, "outputPricePer1M")); setMutation((current) => ({ ...current, error: null })); }} /><FieldError message={fieldErrors.outputPricePer1M} /></label>
          <label className="field-label">生效时间<input className="field-input" placeholder="2026-04-16T00:00:00.000Z" value={form.effectiveFrom} onChange={(event) => { setForm((current) => ({ ...current, effectiveFrom: event.target.value })); setFieldErrors((current) => withoutFieldError(current, "effectiveFrom")); setMutation((current) => ({ ...current, error: null })); }} /><FieldError message={fieldErrors.effectiveFrom} /></label>
          <div className="flex flex-wrap gap-2.5">
            <button className="pill pill-active" disabled={mutation.pending} onClick={submitPrice} type="button">{mutation.pending ? "保存中..." : editingId ? "保存修改" : "创建价格记录"}</button>
            {editingId ? <button className="pill pill-idle" type="button" onClick={resetForm}>取消编辑</button> : null}
          </div>
          <Notice state={mutation} />
        </div>
      </Card>
      <ConfirmDialog
        confirmLabel="删除价格记录"
        confirmPendingLabel="删除中..."
        message={
          priceDeleteTarget
            ? `${priceDeleteTarget.relay.name} · ${priceDeleteTarget.modelKey} 这条价格记录将被删除。只有在确认是误录或重复记录时才执行删除。`
            : ""
        }
        onCancel={() => setPriceDeleteTarget(null)}
        onConfirm={() => {
          if (priceDeleteTarget) {
            void deletePrice(priceDeleteTarget);
          }
        }}
        open={Boolean(priceDeleteTarget)}
        pending={mutation.pending}
        title={priceDeleteTarget ? `确认删除 ${priceDeleteTarget.relay.name} 的价格记录？` : ""}
      />
    </div>
  );
}
