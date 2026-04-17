import * as Shared from "../shared";
import { InfoTip } from "../components/info-tip";
import { StatusBadge } from "../components/status-badge";

const {
  clsx,
  Card,
  ConfirmDialog,
  ErrorCard,
  FieldError,
  LoadingCard,
  Notice,
  fetchJson,
  formatDateTime,
  formatModelStatus,
  inferModelFamily,
  inferModelVendor,
  statusToneForModelStatus,
  useLoadable,
  useMutationState,
  useState,
  validateModelForm,
  createDefaultModelFormState,
  withoutFieldError,
} = Shared;

export function ModelsPage() {
  const models = useLoadable<Shared.AdminModelsResponse>(() => fetchJson("/admin/models"), []);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Shared.AdminModel | null>(null);
  const [form, setForm] = useState<Shared.AdminModelUpsert>(createDefaultModelFormState);
  const [fieldErrors, setFieldErrors] = useState<Shared.ModelFormErrors>({});
  const [mutation, setMutation] = useMutationState();

  function resetForm() {
    setEditingId(null);
    setDeleteTarget(null);
    setForm(createDefaultModelFormState());
    setFieldErrors({});
    setMutation({ pending: false, error: null, success: null });
  }

  function beginEditingModel(model: Shared.AdminModel) {
    setEditingId(model.id);
    setForm({
      key: model.key,
      vendor: model.vendor,
      name: model.name,
      family: model.family,
      inputPriceUnit: model.inputPriceUnit,
      outputPriceUnit: model.outputPriceUnit,
      isActive: model.isActive,
    });
    setFieldErrors({});
    setMutation({ pending: false, error: null, success: null });
  }

  async function submitModel() {
    const { errors, payload } = validateModelForm(form);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setMutation({ pending: false, error: "请先修正高亮字段，再保存模型。", success: null });
      return;
    }

    setMutation({ pending: true, error: null, success: null });
    try {
      await fetchJson(editingId ? `/admin/models/${editingId}` : "/admin/models", {
        method: editingId ? "PATCH" : "POST",
        body: JSON.stringify(payload),
      });
      setMutation({ pending: false, error: null, success: editingId ? "模型已更新。" : "模型已创建。" });
      resetForm();
      await models.reload();
    } catch (reason) {
      setMutation({
        pending: false,
        error: reason instanceof Error ? reason.message : editingId ? "无法更新模型。" : "无法创建模型。",
        success: null,
      });
    }
  }

  async function deleteModel(model: Shared.AdminModel) {
    setMutation({ pending: true, error: null, success: null });
    try {
      await fetchJson<{ ok: true }>(`/admin/models/${model.id}`, {
        method: "DELETE",
      });
      if (editingId === model.id) {
        resetForm();
      }
      setDeleteTarget(null);
      setMutation({ pending: false, error: null, success: "模型已删除。" });
      await models.reload();
    } catch (reason) {
      setDeleteTarget(null);
      setMutation({ pending: false, error: reason instanceof Error ? reason.message : "无法删除模型。", success: null });
    }
  }

  if (models.loading) {
    return <LoadingCard />;
  }

  if (models.error || !models.data) {
    return <ErrorCard message={models.error ?? "无法加载模型列表。"} />;
  }

  const activeCount = models.data.rows.filter((model) => model.isActive).length;
  const inferredVendor = inferModelVendor(form.key);
  const inferredFamily = inferModelFamily(form.key);

  return (
    <>
      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card title="模型列表">
          <div className="space-y-3 border-b border-white/10 pb-3">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm text-white/72">共 {models.data.rows.length} 条</p>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/62">启用 {activeCount}</span>
              <InfoTip content="列表只保留模型键值、推导出的提供方和价格单位等关键信息；模型名称与分类不再重复展示。" />
            </div>
            <p className="text-sm text-white/48">模型键值是主信息，名称与分类由键值自动推导，不再单独维护。</p>
          </div>

          <div className="mt-3 space-y-2">
            {models.data.rows.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-5 text-sm text-white/58">
                当前还没有模型记录。
              </div>
            ) : models.data.rows.map((model) => (
              <div
                key={model.id}
                className={clsx(
                  "admin-list-card border bg-white/5 p-3",
                  model.id === editingId ? "border-[#ffd06a]/45 bg-white/[0.07]" : "border-white/10",
                )}
              >
                <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-lg tracking-[-0.03em]">{model.key}</p>
                      <StatusBadge tone={statusToneForModelStatus(model.isActive)}>
                        {formatModelStatus(model.isActive)}
                      </StatusBadge>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-white/58">
                      <span className="rounded-full border border-white/10 bg-black/10 px-2.5 py-1">{model.vendor}</span>
                      <span className="rounded-full border border-white/10 bg-black/10 px-2.5 py-1">输入 {model.inputPriceUnit ?? "未设置"}</span>
                      <span className="rounded-full border border-white/10 bg-black/10 px-2.5 py-1">输出 {model.outputPriceUnit ?? "未设置"}</span>
                    </div>
                    <p className="mt-2 text-xs text-white/42">最近更新 {formatDateTime(model.updatedAt)}</p>
                  </div>
                  <div className="flex flex-wrap gap-2 xl:flex-col xl:items-end">
                    <button className="pill pill-active" onClick={() => beginEditingModel(model)} type="button">
                      编辑
                    </button>
                    <button className="pill pill-ghost" disabled={mutation.pending} onClick={() => setDeleteTarget(model)} type="button">
                      删除
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card title={editingId ? "编辑模型" : "添加模型"}>
          <div className="grid gap-3">
            <label className="field-label">
              模型键值
              <input
                className="field-input"
                placeholder="openai-gpt-5.4"
                type="text"
                value={form.key}
                onChange={(event) => {
                  setForm((current) => ({ ...current, key: event.target.value }));
                  setFieldErrors((current) => withoutFieldError(current, "key"));
                  setMutation((current) => ({ ...current, error: null }));
                }}
              />
              <FieldError message={fieldErrors.key} />
            </label>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-3.5 py-3 text-sm leading-6 text-white/62">
              <p>提供方将自动推导为：{inferredVendor || "-"}</p>
              <p>模型分类将自动推导为：{inferredFamily || "-"}</p>
            </div>
            <label className="field-label">
              输入价格单位
              <input
                className="field-input"
                placeholder="USD / 1M tokens"
                type="text"
                value={form.inputPriceUnit ?? ""}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  setForm((current) => ({ ...current, inputPriceUnit: nextValue || null }));
                  setMutation((current) => ({ ...current, error: null }));
                }}
              />
            </label>
            <label className="field-label">
              输出价格单位
              <input
                className="field-input"
                placeholder="USD / 1M tokens"
                type="text"
                value={form.outputPriceUnit ?? ""}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  setForm((current) => ({ ...current, outputPriceUnit: nextValue || null }));
                  setMutation((current) => ({ ...current, error: null }));
                }}
              />
            </label>
            <label className="inline-flex items-center gap-3 text-sm text-white/70">
              <input
                checked={form.isActive}
                onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))}
                type="checkbox"
              />
              在价格录入与站点资料中启用
            </label>
            <div className="flex flex-wrap gap-2.5">
              <button className="pill pill-active" disabled={mutation.pending} onClick={() => void submitModel()} type="button">
                {mutation.pending ? "保存中..." : editingId ? "保存修改" : "创建模型"}
              </button>
              {editingId ? <button className="pill pill-idle" onClick={resetForm} type="button">取消编辑</button> : null}
            </div>
            <Notice state={mutation} />
          </div>
        </Card>
      </div>

      <ConfirmDialog
        confirmLabel="删除模型"
        confirmPendingLabel="删除中..."
        message={deleteTarget ? `${deleteTarget.key} 及其关联价格/历史记录会一起移除。` : ""}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) {
            void deleteModel(deleteTarget);
          }
        }}
        open={Boolean(deleteTarget)}
        pending={mutation.pending}
        title={deleteTarget ? `确认删除 ${deleteTarget.key}？` : ""}
      />
    </>
  );
}
