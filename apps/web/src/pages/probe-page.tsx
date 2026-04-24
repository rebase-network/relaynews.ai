import * as Shared from "../shared";
import { ProbeFormPanel } from "../features/probe/probe-form-panel";
import { ProbeResultPanel } from "../features/probe/probe-result-panel";

const {
  getProbeStateFromSearchParams,
  usePageMetadata,
  useProbeController,
  useSearchParams,
} = Shared;

export function ProbePage() {
  const [searchParams] = useSearchParams();
  const {
    attemptTrace,
    copyState,
    error,
    failureGuidance,
    handleDeepScan,
    handleCopyUsedUrl,
    handleSubmit,
    result,
    resultTone,
    setState,
    state,
    submitting,
  } = useProbeController(getProbeStateFromSearchParams(searchParams));

  usePageMetadata({
    title: "站点测试｜relaynew.ai",
    description: "在线测试站点连通性、协议兼容模式、HTTP 状态与请求轨迹，快速定位接入问题。",
    canonicalPath: "/probe",
  });

  return (
    <div className="space-y-5">
      <section className="grid gap-4 xl:grid-cols-[29rem_minmax(0,1fr)] xl:items-start">
        <ProbeFormPanel
          state={state}
          setState={setState}
          submitting={submitting}
          onDeepScan={handleDeepScan}
          onSubmit={handleSubmit}
        />
        <ProbeResultPanel
          attemptTrace={attemptTrace}
          copyState={copyState}
          error={error}
          failureGuidance={failureGuidance}
          result={result}
          resultTone={resultTone}
          onCopyUsedUrl={() => {
            void handleCopyUsedUrl();
          }}
        />
      </section>
    </div>
  );
}
