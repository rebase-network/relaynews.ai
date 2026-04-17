import * as Shared from "../shared";
import { InfoTip } from "../components/info-tip";
import { SubmissionInspectorDrawer } from "../components/submission-inspector-drawer";

const {
  clsx,
  Card,
  ErrorCard,
  LoadingCard,
  formatDateTime,
  formatHealthStatus,
  useEffect,
  useLoadable,
  useState,
} = Shared;

export function IntakePage() {
  const submissions = useLoadable<Shared.AdminSubmissionsResponse>(() => Shared.fetchJson("/admin/submissions"), []);
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null);

  const pendingRows = (submissions.data?.rows ?? []).filter((row) => row.status === "pending");
  const selectedSubmission = pendingRows.find((row) => row.id === selectedSubmissionId) ?? null;
  const testedCount = pendingRows.filter((row) => row.probeCredential?.lastVerifiedAt).length;
  const attentionCount = pendingRows.filter((row) => row.probeCredential?.lastProbeOk === false).length;

  useEffect(() => {
    if (!selectedSubmissionId || submissions.loading) {
      return;
    }

    if (!selectedSubmission) {
      setSelectedSubmissionId(null);
    }
  }, [selectedSubmission, selectedSubmissionId, submissions.loading]);

  if (submissions.loading) {
    return <LoadingCard />;
  }

  if (submissions.error || !submissions.data) {
    return <ErrorCard message={submissions.error ?? "无法加载提交记录。"} />;
  }

  return (
    <>
      <Card title="提交记录" kicker="当前待审核">
        <div className="space-y-3 border-b border-white/10 pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm text-white/72">共 {pendingRows.length} 条待处理</p>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/62">已初测 {testedCount}</span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/62">需关注 {attentionCount}</span>
            <InfoTip content="这里只保留待处理提交。审批通过后会进入 Relay 列表；拒绝或归档后只保留在提交历史中。" />
          </div>
          <p className="text-sm text-white/48">点击列表项即可在右侧抽屉中查看完整资料、测试快照和审核操作。</p>
        </div>

        <div className="mt-3 space-y-2">
          {pendingRows.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-5 text-sm text-white/58">
              当前没有待审核提交。
            </div>
          ) : pendingRows.map((row) => (
            <div
              key={row.id}
              className={clsx(
                "admin-list-card cursor-pointer border bg-white/5 p-3",
                row.id === selectedSubmissionId ? "border-[#ffd06a]/45 bg-white/[0.07]" : "border-white/10",
              )}
              onClick={() => setSelectedSubmissionId(row.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setSelectedSubmissionId(row.id);
                }
              }}
              role="button"
              tabIndex={0}
            >
              <div className="grid gap-3 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,0.9fr)] xl:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-lg tracking-[-0.03em]">{row.relayName}</p>
                    <span className="pill pill-idle !cursor-default">待审核</span>
                  </div>
                  <p className="mt-1 text-xs uppercase tracking-[0.16em] text-white/40">提交于 {formatDateTime(row.createdAt)}</p>
                  <p className="mt-1.5 truncate text-sm text-white/62">{row.baseUrl}</p>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-white/58">
                    <span className="rounded-full border border-white/10 bg-black/10 px-2.5 py-1">模型 {row.modelPrices.length}</span>
                    {row.contactInfo ? <span className="rounded-full border border-white/10 bg-black/10 px-2.5 py-1">已填联系方式</span> : null}
                    {row.websiteUrl ? <span className="rounded-full border border-white/10 bg-black/10 px-2.5 py-1">已填网站</span> : null}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/10 px-3 py-2.5">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-white/38">初始测试</p>
                  {row.probeCredential ? (
                    <>
                      <p className="mt-1.5 text-sm text-white/72">{formatHealthStatus(row.probeCredential.lastHealthStatus)}</p>
                      <p className="mt-1 truncate text-xs text-white/54">{row.probeCredential.testModel}</p>
                      <p className="mt-1 text-xs text-white/42">
                        {row.probeCredential.lastVerifiedAt ? formatDateTime(row.probeCredential.lastVerifiedAt) : "尚未完成验证"}
                      </p>
                    </>
                  ) : (
                    <p className="mt-1.5 text-sm text-white/54">等待测试快照</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <SubmissionInspectorDrawer
        mode="pending"
        open={Boolean(selectedSubmission)}
        submission={selectedSubmission}
        onClose={() => setSelectedSubmissionId(null)}
        onReload={submissions.reload}
      />
    </>
  );
}
