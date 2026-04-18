import * as Shared from "../shared-base";

const {
  PROBE_FIELD_META,
  clsx,
  formatProbeCompatibilityMode,
  formatProbeHttpStatus,
} = Shared;

export function ProbeFormFields({
  state,
  setState,
  compact = false,
  showHelpers = true,
}: {
  state: Shared.ProbeFormState;
  setState: React.Dispatch<React.SetStateAction<Shared.ProbeFormState>>;
  compact?: boolean;
  showHelpers?: boolean;
}) {
  const fields = [
    ["Base URL", "baseUrl"],
    ["API Key", "apiKey"],
    ["模型", "model"],
  ] as const;

  return (
    <>
      {fields.map(([label, key]) => (
        <label key={key} className={clsx("form-field", compact ? "form-field-inline quick-probe-field" : "block")}>
          <span>{label}</span>
          <div>
            <input
              className={clsx("input-shell", compact ? "quick-probe-input" : "mt-2")}
              type={key === "apiKey" ? "password" : "text"}
              placeholder={PROBE_FIELD_META[key].placeholder}
              value={state[key]}
              onChange={(event) => setState((current) => ({ ...current, [key]: event.target.value }))}
              autoComplete={PROBE_FIELD_META[key].autoComplete}
              inputMode={PROBE_FIELD_META[key].inputMode}
              spellCheck={false}
              required
            />
            {showHelpers ? (
              <>
                <span className="input-helper input-helper-mobile">{PROBE_FIELD_META[key].helperCompact}</span>
                <span className="input-helper input-helper-desktop">{PROBE_FIELD_META[key].helper}</span>
              </>
            ) : null}
          </div>
        </label>
      ))}
    </>
  );
}

export function InlineProbeSummary({
  result,
  error,
  resultTone,
}: {
  result: Shared.PublicProbeResponse | null;
  error: string | null;
  resultTone: ReturnType<typeof Shared.getProbeResultTone> | null;
}) {
  if (error) {
    return <p className="quick-probe-inline-summary quick-probe-inline-summary-error" role="alert">测试失败：{error}</p>;
  }

  if (!result || !resultTone) {
    return <p className="quick-probe-inline-summary">测试完成后，这里会显示状态、延迟、HTTP 状态码与接口兼容类型。</p>;
  }

  const latencyText = result.connectivity.latencyMs ? `${result.connectivity.latencyMs} ms` : "延迟无数据";
  const httpText = `HTTP ${formatProbeHttpStatus(result.protocol.httpStatus)}`;
  const compatibilityText = formatProbeCompatibilityMode(result.compatibilityMode);

  return <p className={clsx("quick-probe-inline-summary", resultTone.className)}>{resultTone.label} · {latencyText} · {httpText} · {compatibilityText}</p>;
}
