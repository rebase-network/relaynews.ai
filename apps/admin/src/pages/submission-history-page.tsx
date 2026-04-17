import * as Shared from "../shared";
import { InfoTip } from "../components/info-tip";
import { SubmissionInspectorDrawer } from "../components/submission-inspector-drawer";

const {
  clsx,
  Card,
  ErrorCard,
  LoadingCard,
  formatDateTime,
  formatSubmissionStatus,
  useEffect,
  useLoadable,
  useState,
} = Shared;

export function SubmissionHistoryPage() {
  const submissions = useLoadable<Shared.AdminSubmissionsResponse>(() => Shared.fetchJson("/admin/submissions"), []);
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null);

  const historyRows = (submissions.data?.rows ?? []).filter((row) => row.status !== "pending");
  const approvedCount = historyRows.filter((row) => row.status === "approved").length;
  const rejectedCount = historyRows.filter((row) => row.status === "rejected").length;
  const archivedCount = historyRows.filter((row) => row.status === "archived").length;
  const selectedSubmission = historyRows.find((row) => row.id === selectedSubmissionId) ?? null;

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
    return <ErrorCard message={submissions.error ?? "无法加载提交历史。"} />;
  }

  return (
    <>
      <Card title="提交历史" kicker="已处理记录">
        <div className="space-y-3 border-b border-white/10 pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm text-white/72">共 {historyRows.length} 条</p>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/62">通过 {approvedCount}</span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/62">拒绝 {rejectedCount}</span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/62">归档 {archivedCount}</span>
            <InfoTip content="列表只展示概要信息。需要查看提交资料、测试快照或审批备注时，在右侧抽屉中展开。" />
          </div>
          <p className="text-sm text-white/48">列表收敛为概览，详细信息统一放到右侧抽屉。</p>
        </div>

        <div className="mt-3 space-y-2">
          {historyRows.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-5 text-sm text-white/58">
              当前还没有历史提交记录。
            </div>
          ) : historyRows.map((row) => (
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
                    <span className={row.status === "approved" ? "pill pill-active !cursor-default" : "pill pill-idle !cursor-default"}>
                      {formatSubmissionStatus(row.status)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs uppercase tracking-[0.16em] text-white/40">提交于 {formatDateTime(row.createdAt)}</p>
                  <p className="mt-1.5 truncate text-sm text-white/62">{row.baseUrl}</p>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-white/58">
                    <span className="rounded-full border border-white/10 bg-black/10 px-2.5 py-1">模型 {row.modelPrices.length}</span>
                    {row.approvedRelay ? <span className="rounded-full border border-white/10 bg-black/10 px-2.5 py-1">已关联 Relay</span> : null}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/10 px-3 py-2.5">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-white/38">处理概览</p>
                  <p className="mt-1.5 text-sm text-white/72">{formatSubmissionStatus(row.status)}</p>
                  <p className="mt-1 line-clamp-2 text-xs text-white/54">{row.reviewNotes ?? "未填写审批备注"}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <SubmissionInspectorDrawer
        mode="history"
        open={Boolean(selectedSubmission)}
        submission={selectedSubmission}
        onClose={() => setSelectedSubmissionId(null)}
        onReload={submissions.reload}
      />
    </>
  );
}
