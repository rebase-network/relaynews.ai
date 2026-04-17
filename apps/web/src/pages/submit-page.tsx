import type { ReactNode } from "react";
import * as Shared from "../shared";

const {
  createSubmitModelPriceRow,
  fetchJson,
  formatHealthStatusLabel,
  usePageMetadata,
  useState,
  validateSubmitForm,
} = Shared;

export function SubmitPage() {
  const [state, setState] = useState<Shared.SubmitFormState>({
    relayName: "",
    baseUrl: "",
    websiteUrl: "",
    contactInfo: "",
    description: "",
    testApiKey: "",
    compatibilityMode: "auto",
    modelPrices: [createSubmitModelPriceRow()],
  });
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<Shared.PublicSubmissionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Shared.SubmitFormErrors>({});

  usePageMetadata({
    title: "提交站点信息｜relaynew.ai",
    description: "提交站点基础信息、联系方式、支持模型与价格信息进入审核队列，完成初始测试；赞助流程与评测排名逻辑分离。",
    canonicalPath: "/submit",
  });

  function updateField<Key extends keyof Shared.SubmitFormState>(key: Key, value: Shared.SubmitFormState[Key]) {
    setState((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => ({ ...current, [key]: undefined }));
    setError(null);
  }

  function updateModelPriceRow(rowId: string, key: "modelKey" | "inputPricePer1M" | "outputPricePer1M", value: string) {
    setState((current) => ({
      ...current,
      modelPrices: current.modelPrices.map((row) => (row.id === rowId ? { ...row, [key]: value } : row)),
    }));
    setFieldErrors((current) => {
      const next = { ...current };
      delete next.modelPrices;
      return next;
    });
    setError(null);
  }

  function addModelPriceRow() {
    setState((current) => ({
      ...current,
      modelPrices: [...current.modelPrices, createSubmitModelPriceRow(current.modelPrices.length)],
    }));
    setFieldErrors((current) => {
      const next = { ...current };
      delete next.modelPrices;
      return next;
    });
  }

  function removeModelPriceRow(rowId: string) {
    setState((current) => ({
      ...current,
      modelPrices:
        current.modelPrices.length > 1
          ? current.modelPrices.filter((row) => row.id !== rowId)
          : [createSubmitModelPriceRow()],
    }));
    setFieldErrors((current) => {
      const next = { ...current };
      delete next.modelPrices;
      return next;
    });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setResult(null);
    const { errors, payload } = validateSubmitForm(state);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setError("请先修正高亮字段后再提交。");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetchJson<Shared.PublicSubmissionResponse>("/public/submissions", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setResult(response);
      setState({
        relayName: "",
        baseUrl: "",
        websiteUrl: "",
        contactInfo: "",
        description: "",
        testApiKey: "",
        compatibilityMode: "auto",
        modelPrices: [createSubmitModelPriceRow()],
      });
      setFieldErrors({});
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "提交失败。");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="grid gap-4 lg:grid-cols-[minmax(0,0.88fr)_minmax(0,1.12fr)]">
      <div className="panel hero-panel min-h-0">
        <p className="kicker">提交站点</p>
        <h1 className="text-[2.2rem] leading-[0.92] tracking-[-0.06em] md:text-[3rem]">把你的Relay站点信息提交，收录到站点目录中，有机会进入榜单排行，获得更多用户的认可</h1>
        <p className="mt-3.5 max-w-xl text-black/70">请提供中转站点的介绍，支持的模型、价格信息等等，这些信息将由社区运营志愿者整理后作为站点说明和价格表。</p>
        <div className="mt-5 grid gap-2 sm:grid-cols-3">
          <div className="surface-card p-3">
            <p className="kicker !text-black/52">先审核</p>
            <p className="text-sm leading-6 text-black/72">每个站点都会先进入运营审核队列，确认后才会出现在公开页面。</p>
          </div>
          <div className="surface-card p-3">
            <p className="kicker !text-black/52">整理信息</p>
            <p className="text-sm leading-6 text-black/72">请尽量把站点介绍、支持模型和价格信息填写完整，方便志愿者整理站点说明和价格表。</p>
          </div>
          <div className="surface-card p-3">
            <p className="kicker !text-black/52">初始测试</p>
            <p className="text-sm leading-6 text-black/72">提交后会立即执行一次自动测试，后续会持续测试，请确保测试Key可用性。</p>
          </div>
        </div>
      </div>

      <form className="panel form-shell" noValidate onSubmit={handleSubmit}>
        <SubmitSection title="基础信息" description="这些资料会作为站点目录与运营审核的基础信息。">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="form-field">
              中转站名称
              <input
                className="input-shell mt-2"
                type="text"
                placeholder="北风中转站"
                required
                value={state.relayName}
                onChange={(event) => updateField("relayName", event.target.value)}
              />
              {fieldErrors.relayName ? <span className="field-error">{fieldErrors.relayName}</span> : null}
            </label>
            <label className="form-field">
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
            <label className="form-field">
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
            <label className="form-field">
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

        <SubmitSection title="站点介绍" description="尽量写清楚站点定位、适合场景、支持模型与价格策略，方便社区整理资料。">
          <label className="form-field">
            中转站简介
            <textarea
              className="input-shell mt-2 min-h-32"
              placeholder="请提供中转站点的介绍，支持的模型、价格信息等等，这些信息将由社区运营志愿者整理后作为站点说明和价格表"
              required
              value={state.description}
              onChange={(event) => updateField("description", event.target.value)}
            />
            {fieldErrors.description ? <span className="field-error">{fieldErrors.description}</span> : null}
          </label>
        </SubmitSection>

        <SubmitSection
          title="支持模型及价格表"
          description="每行填写一个模型及对应的 Input / Output 价格"
          actions={<button className="button-cream !px-4 !py-2" type="button" onClick={addModelPriceRow}>添加一行</button>}
        >
          <div className="space-y-2.5">
            <div className="hidden grid-cols-[minmax(0,1.18fr)_repeat(2,minmax(0,0.78fr))_auto] gap-3 px-3 text-[0.68rem] uppercase tracking-[0.18em] text-black/48 md:grid">
              <span>模型</span>
              <span>Input价格</span>
              <span>Output价格</span>
              <span className="text-right">操作</span>
            </div>
            {state.modelPrices.map((row, index) => (
              <div key={row.id} className="rounded-[1.4rem] border border-black/8 bg-white/80 p-3">
                <div className="mb-2 flex items-center justify-between gap-3 md:hidden">
                  <span className="text-[0.68rem] uppercase tracking-[0.18em] text-black/48">第 {index + 1} 行</span>
                  <button className="button-cream !px-3.5 !py-1.5" type="button" onClick={() => removeModelPriceRow(row.id)}>
                    {state.modelPrices.length === 1 && index === 0 ? "清空" : "删除"}
                  </button>
                </div>
                <div className="grid gap-2.5 md:grid-cols-[minmax(0,1.18fr)_repeat(2,minmax(0,0.78fr))_auto] md:items-end">
                  <input
                    aria-label="模型"
                    className="input-shell"
                    type="text"
                    placeholder="模型，例如 openai-gpt-5.4"
                    value={row.modelKey}
                    onChange={(event) => updateModelPriceRow(row.id, "modelKey", event.target.value)}
                  />
                  <input
                    aria-label="Input价格"
                    className="input-shell"
                    type="number"
                    min="0"
                    step="0.0001"
                    placeholder="Input价格"
                    value={row.inputPricePer1M}
                    onChange={(event) => updateModelPriceRow(row.id, "inputPricePer1M", event.target.value)}
                  />
                  <input
                    aria-label="Output价格"
                    className="input-shell"
                    type="number"
                    min="0"
                    step="0.0001"
                    placeholder="Output价格"
                    value={row.outputPricePer1M}
                    onChange={(event) => updateModelPriceRow(row.id, "outputPricePer1M", event.target.value)}
                  />
                  <div className="hidden items-end justify-end md:flex">
                    <button className="button-cream !px-4 !py-2" type="button" onClick={() => removeModelPriceRow(row.id)}>
                      {state.modelPrices.length === 1 && index === 0 ? "清空" : "删除"}
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {fieldErrors.modelPrices ? <span className="field-error">{fieldErrors.modelPrices}</span> : null}
          </div>
        </SubmitSection>

        <SubmitSection title="测试信息" description="提交后系统会立刻做一次自动测试，请确保测试 Key 有效。">
          <label className="form-field">
            测试API Key
            <input
              className="input-shell mt-2"
              type="password"
              placeholder="sk-monitoring-or-relay-key"
              required
              value={state.testApiKey}
              onChange={(event) => updateField("testApiKey", event.target.value)}
            />
            {fieldErrors.testApiKey ? <span className="field-error">{fieldErrors.testApiKey}</span> : null}
          </label>
          <p className="mt-3 rounded-[1.35rem] border border-black/8 bg-white/70 px-4 py-3 text-sm leading-6 text-black/62">
            审核通过后，社区运营志愿者会根据你填写的信息整理站点说明与价格表；后续持续测试会基于这里提供的测试 Key。
          </p>
        </SubmitSection>

        {result ? (
          <div className="surface-card space-y-2 p-4">
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

        <div className="rounded-[1.6rem] border border-black/8 bg-white/72 px-4 py-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm leading-6 text-black/58">提交后会先进入人工审核，确认无误后再正式进入 Relay 目录与后续评测流程。</p>
            <button className="button-dark w-full sm:w-auto sm:min-w-[9rem]" disabled={submitting} type="submit">{submitting ? "提交中..." : "提交"}</button>
          </div>
        </div>
      </form>
    </section>
  );
}

function SubmitSection({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="surface-card p-3.5">
      <div className="flex flex-col gap-2.5 border-b border-black/8 pb-2.5 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="kicker !mb-0">{title}</p>
          <p className="mt-1 text-sm leading-6 text-black/62">{description}</p>
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
      <div className="mt-3.5">{children}</div>
    </div>
  );
}
