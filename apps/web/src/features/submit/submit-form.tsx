import type { ReactNode } from "react";
import * as Shared from "../../shared";
import type { SubmitFormController } from "./use-submit-form";

const { formatHealthStatusLabel } = Shared;

export function SubmitForm({ controller }: { controller: SubmitFormController }) {
  const {
    addModelPriceRow,
    error,
    fieldErrors,
    handleSubmit,
    removeModelPriceRow,
    result,
    state,
    submitting,
    updateField,
    updateModelPriceRow,
  } = controller;

  return (
    <form className="panel form-shell submit-form-panel" noValidate onSubmit={handleSubmit}>
      <SubmitSection title="基础信息">
        <div className="submit-basic-grid">
          <label className="form-field submit-form-field">
            大模型API服务站名称
            <input
              className="input-shell mt-2"
              type="text"
              placeholder="北风大模型API服务站"
              required
              value={state.relayName}
              onChange={(event) => updateField("relayName", event.target.value)}
            />
            {fieldErrors.relayName ? <span className="field-error">{fieldErrors.relayName}</span> : null}
          </label>
          <label className="form-field submit-form-field">
            Base URL
            <input
              className="input-shell mt-2"
              type="url"
              placeholder="https://northwind.example.ai/v1"
              required
              value={state.baseUrl}
              onChange={(event) => updateField("baseUrl", event.target.value)}
            />
            {fieldErrors.baseUrl ? <span className="field-error">{fieldErrors.baseUrl}</span> : null}
          </label>
          <label className="form-field submit-form-field">
            站点网站
            <input
              className="input-shell mt-2"
              type="url"
              placeholder="https://northwind.example.ai"
              value={state.websiteUrl}
              onChange={(event) => updateField("websiteUrl", event.target.value)}
            />
            {fieldErrors.websiteUrl ? <span className="field-error">{fieldErrors.websiteUrl}</span> : null}
          </label>
          <label className="form-field submit-form-field">
            联系方式
            <input
              className="input-shell mt-2"
              type="text"
              placeholder="Telegram / 邮箱 / 微信"
              value={state.contactInfo}
              onChange={(event) => updateField("contactInfo", event.target.value)}
            />
            {fieldErrors.contactInfo ? <span className="field-error">{fieldErrors.contactInfo}</span> : null}
          </label>
        </div>
      </SubmitSection>

      <SubmitSection title="站点介绍">
        <div className="form-field submit-form-field">
          <textarea
            className="input-shell mt-2 min-h-32 submit-description-input"
            aria-label="大模型API服务站简介"
            placeholder="请提供大模型API服务站的介绍，支持的模型、价格信息等等，这些信息将由社区运营志愿者整理后作为站点说明和价格表"
            required
            value={state.description}
            onChange={(event) => updateField("description", event.target.value)}
          />
          {fieldErrors.description ? <span className="field-error">{fieldErrors.description}</span> : null}
        </div>
      </SubmitSection>

      <SubmitSection
        title="支持模型及价格表"
        description="每行填写一个模型及对应的 Input / Output 价格"
        actions={
          <button className="button-cream submit-inline-button" type="button" onClick={addModelPriceRow}>
            添加一行
          </button>
        }
      >
        <div className="submit-price-table">
          <div className="submit-price-head hidden grid-cols-[minmax(0,1.18fr)_repeat(2,minmax(0,0.78fr))_auto] gap-3 md:grid">
            <span>模型</span>
            <span>Input价格</span>
            <span>Output价格</span>
            <span className="text-right">操作</span>
          </div>
          {state.modelPrices.map((row, index) => (
            <div key={row.id} className="submit-price-row">
              <div className="mb-2 flex items-center justify-between gap-3 md:hidden">
                <span className="text-[0.68rem] uppercase tracking-[0.18em] text-black/48">第 {index + 1} 行</span>
                <button className="button-cream submit-inline-button submit-inline-button-mobile" type="button" onClick={() => removeModelPriceRow(row.id)}>
                  {state.modelPrices.length === 1 && index === 0 ? "清空" : "删除"}
                </button>
              </div>
              <div className="submit-price-row-grid">
                <div className="submit-price-field">
                  <span className="submit-price-mobile-label md:hidden">模型</span>
                  <input
                    aria-label="模型"
                    className="input-shell submit-price-input"
                    type="text"
                    placeholder="例如 openai-gpt-5.4"
                    value={row.modelKey}
                    onChange={(event) => updateModelPriceRow(row.id, "modelKey", event.target.value)}
                  />
                </div>
                <div className="submit-price-field">
                  <span className="submit-price-mobile-label md:hidden">Input价格</span>
                  <input
                    aria-label="Input价格"
                    className="input-shell submit-price-input"
                    type="number"
                    min="0"
                    step="0.0001"
                    placeholder="0.00"
                    value={row.inputPricePer1M}
                    onChange={(event) => updateModelPriceRow(row.id, "inputPricePer1M", event.target.value)}
                  />
                </div>
                <div className="submit-price-field">
                  <span className="submit-price-mobile-label md:hidden">Output价格</span>
                  <input
                    aria-label="Output价格"
                    className="input-shell submit-price-input"
                    type="number"
                    min="0"
                    step="0.0001"
                    placeholder="0.00"
                    value={row.outputPricePer1M}
                    onChange={(event) => updateModelPriceRow(row.id, "outputPricePer1M", event.target.value)}
                  />
                </div>
                <div className="hidden items-end justify-end md:flex">
                  <button className="button-cream submit-inline-button" type="button" onClick={() => removeModelPriceRow(row.id)}>
                    {state.modelPrices.length === 1 && index === 0 ? "清空" : "删除"}
                  </button>
                </div>
              </div>
            </div>
          ))}
          {fieldErrors.modelPrices ? <span className="field-error">{fieldErrors.modelPrices}</span> : null}
        </div>
      </SubmitSection>

      <SubmitSection title="测试API Key">
        <div className="submit-key-field">
          <input
            aria-label="测试API Key"
            className="input-shell mt-2"
            type="password"
            placeholder="sk-monitoring-or-relay-key"
            required
            value={state.testApiKey}
            onChange={(event) => updateField("testApiKey", event.target.value)}
          />
          {fieldErrors.testApiKey ? <span className="field-error">{fieldErrors.testApiKey}</span> : null}
        </div>
      </SubmitSection>

      {result ? (
        <div className="surface-card submit-feedback-card">
          <p className="text-sm form-feedback-success">提交成功，记录 ID：{result.id}</p>
          {result.probe ? (
            <>
              <p className="text-sm leading-6 text-black/72">
                初始测试：{result.probe.ok ? "已通过" : "需要复核"} · {formatHealthStatusLabel(result.probe.healthStatus)}
                {result.probe.httpStatus ? ` · ${result.probe.httpStatus}` : ""}
              </p>
              {result.probe.message ? <p className="text-sm leading-6 text-black/58">{result.probe.message}</p> : null}
            </>
          ) : null}
        </div>
      ) : null}

      {error ? <p className="text-sm form-feedback-error">{error}</p> : null}

      <div className="submit-submit-bar">
        <div className="submit-submit-grid">
          <div className="submit-submit-main">
            <p className="submit-submit-title">确认后提交</p>
            <p className="submit-submit-copy">提交后会先进入人工审核，确认无误后再正式进入 Relay 目录与后续评测流程。</p>
          </div>
          <button className="button-dark w-full sm:w-auto sm:min-w-[9rem]" disabled={submitting} type="submit">
            {submitting ? "提交中..." : "提交"}
          </button>
        </div>
      </div>
    </form>
  );
}

function SubmitSection({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="surface-card submit-section">
      <div className="submit-section-header">
        <div className="submit-section-head">
          <h2 className="submit-section-title">{title}</h2>
          {description ? <p className="submit-section-description">{description}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
      <div className="submit-section-body">{children}</div>
    </div>
  );
}
