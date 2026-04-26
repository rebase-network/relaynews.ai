import * as Shared from "../../shared";

const {
  MetricGrid,
  Panel,
  clsx,
  formatHealthStatusLabel,
  formatProbeCompatibilityMode,
  formatProbeDetectionMode,
  formatProbeHttpStatus,
  formatProbeMeasuredAt,
  formatProbeScanMode,
  formatProbeTraceStatus,
  getConnectivityCardTone,
  getProtocolCardTone,
  getTraceCardTone,
} = Shared;

export function ProbeResultPanel({
  attemptTrace,
  copyState,
  error,
  failureGuidance,
  result,
  resultTone,
  onCopyUsedUrl,
}: {
  attemptTrace: Shared.PublicProbeResponse["attemptTrace"];
  copyState: "idle" | "copied" | "failed";
  error: string | null;
  failureGuidance: ReturnType<typeof Shared.getProbeFailureGuidance>;
  result: Shared.PublicProbeResponse | null;
  resultTone: ReturnType<typeof Shared.getProbeResultTone> | null;
  onCopyUsedUrl: () => void;
}) {
  const deepScanSummary = result?.scanMode === "deep" && result.matchedModes.length > 0
    ? {
        ttfbMs: result.matchedModes.reduce<number | null>((best, matchedMode) => {
          const value = matchedMode.ttfbMs ?? matchedMode.latencyMs;
          return best === null ? value : Math.min(best, value);
        }, null),
        firstTokenMs: result.matchedModes.reduce<number | null>((best, matchedMode) => {
          if (matchedMode.firstTokenMs === null || typeof matchedMode.firstTokenMs === "undefined") {
            return best;
          }

          return best === null ? matchedMode.firstTokenMs : Math.min(best, matchedMode.firstTokenMs);
        }, null),
      }
    : null;
  const ttfbMs = deepScanSummary?.ttfbMs ?? result?.connectivity.ttfbMs ?? result?.connectivity.latencyMs ?? null;
  const firstTokenMs = deepScanSummary?.firstTokenMs ?? result?.connectivity.firstTokenMs ?? null;
  const ttfbLabel = deepScanSummary ? "最佳 TTFB" : "TTFB";
  const firstTokenLabel = deepScanSummary ? "最佳首个有效输出" : "首个有效输出";

  return (
    <Panel
      title="测试结果"
      kicker={result ? "诊断输出" : error ? "请求失败" : "等待输入"}
      className={result || error ? "probe-result-panel" : "panel-soft probe-result-panel"}
    >
      {result ? (
        <>
          <div className={clsx("mb-5 border px-4 py-4", resultTone?.className)}>
            <p className="text-2xl tracking-[-0.05em]">{resultTone?.label}</p>
            <p className="mt-2 text-sm leading-6 text-current/85">{resultTone?.description}</p>
          </div>
          <MetricGrid
            columnsClassName="sm:grid-cols-2 xl:grid-cols-5"
            items={[
              {
                label: "连通性",
                value: result.connectivity.ok ? "正常" : "失败",
                testId: "probe-connectivity-value",
                cardClassName: clsx("probe-metric-card", getConnectivityCardTone(result.connectivity.ok)),
                valueClassName: "text-[1.08rem] leading-[1]",
                valueSpacingClassName: "mt-2",
              },
              {
                label: "协议",
                value: result.protocol.ok ? formatHealthStatusLabel(result.protocol.healthStatus) : "未知",
                testId: "probe-protocol-value",
                cardClassName: clsx("probe-metric-card", getProtocolCardTone(result.protocol.healthStatus, result.protocol.ok)),
                valueClassName: "text-[1.08rem] leading-[1]",
                valueSpacingClassName: "mt-2",
              },
              {
                label: ttfbLabel,
                value: ttfbMs !== null ? `${ttfbMs} ms` : "-",
                testId: "probe-latency-value",
                cardClassName: "probe-metric-card",
                valueClassName: "text-[1.08rem] leading-[1]",
                valueSpacingClassName: "mt-2",
              },
              {
                label: firstTokenLabel,
                value: firstTokenMs !== null && typeof firstTokenMs !== "undefined"
                  ? `${firstTokenMs} ms`
                  : "-",
                testId: "probe-first-token-value",
                cardClassName: "probe-metric-card",
                valueClassName: "text-[1.08rem] leading-[1]",
                valueSpacingClassName: "mt-2",
              },
              {
                label: "HTTP 状态码",
                value: formatProbeHttpStatus(result.protocol.httpStatus),
                testId: "probe-http-status-value",
                cardClassName: "probe-metric-card",
                valueClassName: "text-[1.08rem] leading-[1]",
                valueSpacingClassName: "mt-2",
              },
            ]}
          />
          {deepScanSummary ? (
            <p className="mt-3 text-xs leading-6 text-black/58">
              深度扫描模式下，顶部 TTFB 和首个有效输出显示的是已命中兼容模式中的最快值；各模式详情见下方列表。
            </p>
          ) : firstTokenMs === null || typeof firstTokenMs === "undefined" ? (
            <p className="mt-3 text-xs leading-6 text-black/58">
              “首个有效输出”为 - 表示本次虽然收到了响应，但没有观测到可见文本输出；常见于空响应、只返回状态事件，或模型未实际产出文本。
            </p>
          ) : null}
          <div className="mt-5 space-y-4">
            <div className="surface-card p-4">
              <p className="kicker">解析结果</p>
              <div className="mt-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="kicker !text-black/52">主机</p>
                  <p
                    className="mt-1 break-all font-mono text-sm leading-6 tracking-[-0.02em] text-black/78"
                    data-testid="probe-host-value"
                    title={result.targetHost}
                  >
                    {result.targetHost}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex items-start justify-between gap-3">
                <p
                  className="min-w-0 break-all font-mono text-sm leading-6 text-black/72"
                  data-testid="probe-used-url-value"
                  title={result.usedUrl ?? undefined}
                >
                  {result.usedUrl ?? "本次没有记录到最终解析端点。"}
                </p>
                {result.usedUrl ? (
                  <button
                    className="copy-button"
                    data-testid="probe-copy-endpoint-button"
                    onClick={onCopyUsedUrl}
                    type="button"
                  >
                    {copyState === "copied" ? "已复制" : copyState === "failed" ? "复制失败" : "复制"}
                  </button>
                ) : null}
              </div>
              <dl className="mt-4 grid gap-x-4 gap-y-3 sm:grid-cols-2">
                <div>
                  <dt className="kicker !text-black/52">扫描方式</dt>
                  <dd className="mt-1 text-sm leading-6 break-words text-black/78">
                    {formatProbeScanMode(result.scanMode)}
                  </dd>
                </div>
                <div>
                  <dt className="kicker !text-black/52">兼容模式</dt>
                  <dd className="mt-1 text-sm leading-6 break-words text-black/78" data-testid="probe-mode-value">
                    {result.scanMode === "deep" && result.matchedModes.length > 0 ? (
                      <div className="space-y-1">
                        {result.matchedModes.map((matchedMode) => (
                          <div key={`${matchedMode.mode}-${matchedMode.url}`}>
                            {matchedMode.label}
                          </div>
                        ))}
                      </div>
                    ) : (
                      formatProbeCompatibilityMode(result.compatibilityMode)
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="kicker !text-black/52">识别方式</dt>
                  <dd className="mt-1 text-sm leading-6 break-words text-black/78" data-testid="probe-detection-value">
                    {formatProbeDetectionMode(result.detectionMode)}
                  </dd>
                </div>
                <div>
                  <dt className="kicker !text-black/52">模型</dt>
                  <dd className="mt-1 text-sm leading-6 break-words text-black/78" data-testid="probe-model-value" title={result.model}>
                    {result.model}
                  </dd>
                </div>
                <div>
                  <dt className="kicker !text-black/52">测量时间</dt>
                  <dd className="mt-1 text-sm leading-6 text-black/78" data-testid="probe-measured-at-value" title={result.measuredAt}>
                    {formatProbeMeasuredAt(result.measuredAt)}
                  </dd>
                </div>
              </dl>
            </div>
            {result.matchedModes.length > 0 ? (
              <div className="surface-card p-4">
                <p className="kicker">
                  {result.scanMode === "deep" ? "兼容扫描结果" : "已确认兼容模式"}
                </p>
                <p className="mt-2 text-sm leading-6 text-black/68">
                  {result.scanMode === "deep"
                    ? `共确认 ${result.matchedModes.length} 种可用兼容模式，按探测顺序展示。`
                    : "以下是本次已确认命中的兼容模式。"}
                </p>
                <div className="mt-4 space-y-3">
                  {result.matchedModes.map((matchedMode, index) => (
                    <div className="trace-card border border-emerald-700/12 bg-emerald-50/70 px-3 py-3 text-[#0b5c3b]" key={`${matchedMode.mode}-${matchedMode.url}`}>
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs uppercase tracking-[0.16em]">
                          #{index + 1} {matchedMode.label}
                        </p>
                        <p className="text-xs uppercase tracking-[0.16em]">
                          {[
                            `HTTP ${matchedMode.httpStatus}`,
                            `TTFB ${matchedMode.ttfbMs ?? matchedMode.latencyMs} ms`,
                            matchedMode.firstTokenMs !== null && typeof matchedMode.firstTokenMs !== "undefined"
                              ? `首个输出 ${matchedMode.firstTokenMs} ms`
                              : null,
                          ].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                      <p className="mt-2 break-all font-mono text-xs leading-5 opacity-80">{matchedMode.url}</p>
                      {matchedMode.credibility ? (
                        <div className="mt-3 space-y-1 text-xs leading-5 opacity-85">
                          <p>接口声明模型：{matchedMode.credibility.responseReportedModel ?? "未提供"}</p>
                          <p>模型自报模型：{matchedMode.credibility.selfReportedModel ?? "未提供"}</p>
                          <p>模型自报提供方：{matchedMode.credibility.selfReportedProvider ?? "未提供"}</p>
                          <p>可信度：{
                            matchedMode.credibility.identityConfidence === "high"
                              ? "高"
                            : matchedMode.credibility.identityConfidence === "medium"
                                ? "中"
                                : matchedMode.credibility.identityConfidence === "low"
                                  ? "低"
                                  : "未知"
                          }</p>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            {result.message && !result.ok ? (
              <div className="border border-[#b54708]/20 bg-[#fff7e8] p-4 text-sm leading-6 text-[#8a450c]">
                {result.message}
              </div>
            ) : null}
            <details className="surface-card p-4">
              <summary className="cursor-pointer font-mono text-[0.72rem] uppercase tracking-[0.16em] text-black/68">
                执行轨迹
              </summary>
              {attemptTrace.length > 0 ? (
                <div className="mt-4 space-y-3">
                  {attemptTrace.map((attempt, index) => (
                    <div
                      className={clsx("trace-card border px-3 py-3", getTraceCardTone(attempt.httpStatus, attempt.matched))}
                      key={`${attempt.url}-${index}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs uppercase tracking-[0.16em]">#{index + 1} {attempt.label}</p>
                        <p className="text-xs uppercase tracking-[0.16em]">
                          {formatProbeTraceStatus(attempt.httpStatus, attempt.matched)}
                        </p>
                      </div>
                      <p className="mt-2 break-all font-mono text-xs leading-5 opacity-80">{attempt.url}</p>
                      {attempt.message ? (
                        <p className="mt-2 text-xs leading-5 opacity-80">{attempt.message}</p>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-sm leading-6 text-black/68">本次运行没有记录到请求尝试。</p>
              )}
            </details>
            {failureGuidance ? (
              <div className="surface-card p-4">
                <p className="kicker">失败解读</p>
                <div className="space-y-3 text-sm leading-6 text-black/72">
                  <p><span className="font-medium text-black/90">来源：</span>{failureGuidance.source}</p>
                  <p><span className="font-medium text-black/90">含义：</span>{failureGuidance.meaning}</p>
                  <p><span className="font-medium text-black/90">下一步：</span>{failureGuidance.nextStep}</p>
                </div>
              </div>
            ) : null}
            {!result.ok && result.detectionMode === "auto" ? (
              <div className="border border-[#b54708]/20 bg-[#fff7e8] p-4 text-sm leading-6 text-[#8a450c]">
                如果你觉得自动识别结果不对，请在高级选项中手动指定兼容模式后重新测试。
              </div>
            ) : null}
          </div>
        </>
      ) : error ? (
        <div className="border border-[#b42318]/20 bg-[#fff2ef] px-4 py-4 text-[#8d2d17]" role="alert">
          <p className="kicker !text-current/70">测试请求失败</p>
          <p className="text-xl tracking-[-0.04em]">本次站点测试未能完成。</p>
          <p className="mt-3 text-sm leading-6 text-current/85">{error}</p>
          <p className="mt-2 text-sm leading-6 text-current/80">请重新检查基础 URL、密钥、兼容模式和上游路由后再重试。</p>
        </div>
      ) : (
        <div className="probe-empty-state">
          <p className="probe-empty-title">填写左侧信息后开始测试。</p>
          <p className="probe-empty-copy">
            结果面板会展示连通性、协议状态、兼容模式识别结果、最终解析端点，以及到达上游路由时使用的请求轨迹。
          </p>
        </div>
      )}
    </Panel>
  );
}
