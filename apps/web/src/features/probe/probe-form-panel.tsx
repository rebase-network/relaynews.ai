import * as Shared from "../../shared";

const {
  ProbeFormFields,
  PROBE_COMPATIBILITY_OPTIONS,
} = Shared;

export function ProbeFormPanel({
  state,
  setState,
  submitting,
  onDeepScan,
  onSubmit,
}: {
  state: Shared.ProbeFormState;
  setState: React.Dispatch<React.SetStateAction<Shared.ProbeFormState>>;
  submitting: boolean;
  onDeepScan: () => Promise<void> | void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  const deepScanEnabled = state.compatibilityMode === "auto";

  return (
    <section className="panel probe-form-panel">
      <p className="kicker">自助测试</p>
      <h1 className="text-[2.35rem] leading-[0.94] tracking-[-0.05em] md:text-[3.15rem]">运行测试</h1>
      <p className="form-note mt-4 text-sm leading-6">
        请填写Base URL、API Key 和 模型。除非你已经明确知道所需协议族，否则建议从自动模式开始。
      </p>
      <p className="probe-privacy-note">
        自助测试的API Key等信息不会留存，如果担心泄漏可以使用单独的Key进行测试。
      </p>
      <form className="form-shell mt-4" onSubmit={onSubmit}>
        <ProbeFormFields setState={setState} showHelpers={false} state={state} />
        <details className="surface-card probe-advanced-card p-4">
          <summary className="cursor-pointer font-mono text-sm uppercase tracking-[0.16em] text-black/70">高级选项 / 接口类型</summary>
          <div className="probe-advanced-grid">
            <label className="form-field">
              兼容模式
              <select
                className="input-shell mt-2"
                value={state.compatibilityMode}
                onChange={(event) =>
                  setState((current) => ({
                    ...current,
                    compatibilityMode: event.target.value as Shared.ProbeCompatibilityMode,
                  }))
                }
              >
                {PROBE_COMPATIBILITY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <p className="probe-advanced-copy">
              自动模式会根据模型推断适配顺序；手动模式则会把测试锁定在单一兼容协议形态上。
            </p>
          </div>
        </details>
        <div className="mt-1 flex flex-wrap gap-3">
          <button className="button-dark" disabled={submitting} type="submit">
            {submitting ? "测试中..." : "开始测试"}
          </button>
          <button
            className="button-cream"
            disabled={submitting || !deepScanEnabled}
            onClick={() => {
              void onDeepScan();
            }}
            type="button"
          >
            {submitting ? "扫描中..." : "深度兼容扫描"}
          </button>
        </div>
        <p className="text-xs leading-6 text-black/58">
          {deepScanEnabled
            ? "深度兼容扫描只会在当前固定候选协议里继续测试，适合确认一个站点是否同时兼容多种模式。"
            : "深度兼容扫描仅在自动识别模式下可用；如果你手动锁定了某个协议，请先切回自动识别。"}
        </p>
      </form>
    </section>
  );
}
