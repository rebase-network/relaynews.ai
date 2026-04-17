import type { ReactNode } from "react";
import * as Shared from "../shared";
import { WorkflowSection } from "./relay-workflow";

const { FieldError, Notice, PROBE_COMPATIBILITY_OPTIONS } = Shared;

export function RelayEditorForm({
  mode,
  form,
  fieldErrors,
  mutation,
  headerNotice,
  submitLabel,
  submittingLabel,
  resetLabel,
  extraActions,
  onSubmit,
  onReset,
  onUpdateForm,
  onUpdatePriceRow,
  onAddPriceRow,
  onRemovePriceRow,
}: {
  mode: "create" | "edit";
  form: Shared.RelayFormState;
  fieldErrors: Shared.RelayFormErrors;
  mutation: Shared.MutationState;
  headerNotice?: ReactNode;
  submitLabel: string;
  submittingLabel: string;
  resetLabel?: string;
  extraActions?: ReactNode;
  onSubmit: () => void;
  onReset?: () => void;
  onUpdateForm: <Key extends keyof Shared.RelayFormState>(key: Key, value: Shared.RelayFormState[Key]) => void;
  onUpdatePriceRow: (rowId: string, key: keyof Shared.RelayPriceRowFormState, value: string) => void;
  onAddPriceRow: () => void;
  onRemovePriceRow: (rowId: string) => void;
}) {
  return (
    <div className="space-y-3">
      {headerNotice ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 px-3.5 py-3 text-sm leading-6 text-white/62">
          {headerNotice}
        </div>
      ) : null}

      <WorkflowSection title="站点资料" tip="这些字段会同步到目录展示、Relay 详情与运营审核记录中。">
        <div className="grid gap-3 md:grid-cols-2">
          <label className="field-label">
            站点名字
            <input className="field-input" placeholder="北风中转站" value={form.name} onChange={(event) => onUpdateForm("name", event.target.value)} />
            <FieldError message={fieldErrors.name} />
          </label>
          <label className="field-label">
            Base URL
            <input className="field-input" placeholder="https://northwind.example.ai/v1" value={form.baseUrl} onChange={(event) => onUpdateForm("baseUrl", event.target.value)} />
            <FieldError message={fieldErrors.baseUrl} />
          </label>
          <label className="field-label">
            站点网站
            <input className="field-input" placeholder="https://northwind.example.ai" value={form.websiteUrl} onChange={(event) => onUpdateForm("websiteUrl", event.target.value)} />
            <FieldError message={fieldErrors.websiteUrl} />
          </label>
          <label className="field-label">
            联系方式
            <input className="field-input" placeholder="Telegram / 邮箱 / 微信" value={form.contactInfo} onChange={(event) => onUpdateForm("contactInfo", event.target.value)} />
            <FieldError message={fieldErrors.contactInfo} />
          </label>
        </div>
        <label className="field-label mt-3 block">
          站点简介
          <textarea className="field-input min-h-28" placeholder="请介绍站点适合的场景、主要模型、价格策略和服务特点。" value={form.description} onChange={(event) => onUpdateForm("description", event.target.value)} />
          <FieldError message={fieldErrors.description} />
        </label>
      </WorkflowSection>

      <WorkflowSection title="运营设置" tip="active 会进入自动测试、目录与排行榜；paused 与 archived 不会公开展示。">
        <label className="field-label">
          Relay 状态
          <select className="field-input" value={form.catalogStatus} onChange={(event) => onUpdateForm("catalogStatus", event.target.value as Shared.RelayFormState["catalogStatus"])}>
            <option value="active">active</option>
            <option value="paused">paused</option>
            <option value="archived">archived</option>
          </select>
        </label>
      </WorkflowSection>

      <WorkflowSection
        title="支持模型及价格表"
        tip="每行填写 模型 / Input价格 / Output价格。桌面端为紧凑表格，移动端会自动折叠成纵向输入。"
        actions={<button className="pill pill-idle" type="button" onClick={onAddPriceRow}>添加一行</button>}
      >
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
          <div className="hidden grid-cols-[4.2rem_minmax(0,1.18fr)_repeat(2,minmax(0,0.76fr))_auto] gap-3 border-b border-white/10 bg-black/10 px-3 py-2 text-[11px] uppercase tracking-[0.18em] text-white/38 md:grid">
            <span>行</span>
            <span>模型</span>
            <span>Input价格</span>
            <span>Output价格</span>
            <span className="text-right">操作</span>
          </div>
          <div className="divide-y divide-white/10">
            {form.modelPrices.map((row, index) => (
              <div key={row.id} className="grid gap-2.5 px-3 py-3 md:grid-cols-[4.2rem_minmax(0,1.18fr)_repeat(2,minmax(0,0.76fr))_auto] md:items-center md:gap-3">
                <div className="hidden md:flex">
                  <span className="inline-flex min-w-[2.3rem] items-center justify-center rounded-full border border-white/10 bg-black/10 px-2 py-1 text-[11px] font-medium tracking-[0.14em] text-white/48">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                </div>
                <div>
                  <p className="mb-1 text-[11px] uppercase tracking-[0.18em] text-white/38 md:hidden">第 {index + 1} 行</p>
                  <label className="field-label">
                    <span className="md:hidden">模型</span>
                    <input aria-label={`第 ${index + 1} 行模型`} className="field-input field-input-compact" placeholder="openai-gpt-5.4" value={row.modelKey} onChange={(event) => onUpdatePriceRow(row.id, "modelKey", event.target.value)} />
                  </label>
                </div>
                <div>
                  <label className="field-label">
                    <span className="md:hidden">Input价格</span>
                    <input aria-label={`第 ${index + 1} 行 Input价格`} className="field-input field-input-compact" type="number" min="0" step="0.0001" placeholder="4.6" value={row.inputPricePer1M} onChange={(event) => onUpdatePriceRow(row.id, "inputPricePer1M", event.target.value)} />
                  </label>
                </div>
                <div>
                  <label className="field-label">
                    <span className="md:hidden">Output价格</span>
                    <input aria-label={`第 ${index + 1} 行 Output价格`} className="field-input field-input-compact" type="number" min="0" step="0.0001" placeholder="13.2" value={row.outputPricePer1M} onChange={(event) => onUpdatePriceRow(row.id, "outputPricePer1M", event.target.value)} />
                  </label>
                </div>
                <div className="flex items-end justify-end md:justify-center">
                  <button className="pill pill-ghost" type="button" onClick={() => onRemovePriceRow(row.id)}>
                    {form.modelPrices.length === 1 && index === 0 ? "清空" : "删除"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
        <FieldError message={fieldErrors.modelPrices} />
      </WorkflowSection>

      <WorkflowSection title="测试信息" tip={mode === "create" ? "手动新增时需要提供测试API Key，方便系统立即接入自动测试。" : "留空新的测试API Key 时，会继续沿用当前已绑定的 Key。"}>
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_12rem]">
          <label className="field-label">
            测试API Key
            <input className="field-input" type="password" placeholder={mode === "edit" ? "留空则保持当前 Key 不变" : "sk-monitoring-or-relay-key"} value={form.testApiKey} onChange={(event) => onUpdateForm("testApiKey", event.target.value)} />
            <FieldError message={fieldErrors.testApiKey} />
          </label>
          <label className="field-label">
            兼容模式
            <select className="field-input" value={form.compatibilityMode} onChange={(event) => onUpdateForm("compatibilityMode", event.target.value as Shared.ProbeCompatibilityMode)}>
              {PROBE_COMPATIBILITY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
        </div>
      </WorkflowSection>

      <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3.5">
        <div className="flex flex-wrap gap-2.5">
          <button className="pill pill-active" disabled={mutation.pending} onClick={onSubmit} type="button">
            {mutation.pending ? submittingLabel : submitLabel}
          </button>
          {onReset ? (
            <button className="pill pill-idle" disabled={mutation.pending} onClick={onReset} type="button">
              {resetLabel ?? "恢复默认"}
            </button>
          ) : null}
          {extraActions}
        </div>
        <div className="mt-3">
          <Notice state={mutation} />
        </div>
      </div>
    </div>
  );
}
