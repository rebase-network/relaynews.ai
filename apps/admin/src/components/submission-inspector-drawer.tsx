import * as Shared from "../shared";
import { AdminDrawer } from "./admin-drawer";
import { WorkflowDetailGrid, WorkflowPriceTable, WorkflowSection } from "./relay-workflow";

const {
  Notice,
  fetchJson,
  formatCredentialStatus,
  formatDateTime,
  formatHealthStatus,
  formatSubmissionStatus,
  useEffect,
  useMutationState,
  useState,
} = Shared;

export function SubmissionInspectorDrawer({
  open,
  submission,
  mode,
  onClose,
  onReload,
}: {
  open: boolean;
  submission: Shared.AdminSubmissionsResponse["rows"][number] | null;
  mode: "pending" | "history";
  onClose: () => void;
  onReload: () => Promise<unknown>;
}) {
  const [reviewNotes, setReviewNotes] = useState("");
  const [mutation, setMutation] = useMutationState();

  useEffect(() => {
    if (!open || !submission) {
      return;
    }

    setReviewNotes(submission.reviewNotes ?? "");
    setMutation({ pending: false, error: null, success: null });
  }, [open, setMutation, submission]);

  async function review(status: "approved" | "rejected" | "archived") {
    if (!submission) {
      return;
    }

    setMutation({ pending: true, error: null, success: null });
    try {
      await fetchJson(`/admin/submissions/${submission.id}/review`, {
        method: "POST",
        body: JSON.stringify({
          status,
          reviewNotes: reviewNotes.trim() || null,
        }),
      });
      await onReload();
      setMutation({
        pending: false,
        error: null,
        success:
          status === "approved"
            ? "提交已通过，已进入 Relay 列表与提交历史。"
            : `提交已${status === "rejected" ? "拒绝" : "归档"}。`,
      });
    } catch (reason) {
      setMutation({ pending: false, error: reason instanceof Error ? reason.message : "无法处理提交记录。", success: null });
    }
  }

  if (!submission) {
    return null;
  }

  return (
    <AdminDrawer kicker="提交抽屉" open={open} title={submission.relayName} onClose={onClose}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/10 pb-3.5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[11px] uppercase tracking-[0.18em] text-white/40">提交抽屉</p>
              <span className={submission.status === "approved" ? "pill pill-active !cursor-default" : "pill pill-idle !cursor-default"}>
                {formatSubmissionStatus(submission.status)}
              </span>
            </div>
            <p className="mt-2 text-xs uppercase tracking-[0.16em] text-white/40">提交于 {formatDateTime(submission.createdAt)}</p>
            <p className="mt-1 truncate text-sm text-white/56">{submission.baseUrl}</p>
          </div>
        </div>

        <WorkflowSection title="提交概要" tip="这里保留原始提交资料，用于确认站点信息与审批上下文。">
          <WorkflowDetailGrid
            items={[
              { label: "Base URL", value: submission.baseUrl },
              {
                label: "站点网站",
                value: submission.websiteUrl ? (
                  <a className="text-white/82 underline underline-offset-4" href={submission.websiteUrl} rel="noreferrer" target="_blank">
                    {submission.websiteUrl}
                  </a>
                ) : "未填写",
              },
              { label: "联系方式", value: submission.contactInfo ?? "未填写" },
              { label: "关联 Relay", value: submission.approvedRelay ? submission.approvedRelay.name : "未关联" },
            ]}
          />
          <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-sm leading-6 text-white/72">
            {submission.description ?? submission.notes ?? "未填写补充说明。"}
          </div>
        </WorkflowSection>

        <WorkflowSection title="支持模型及价格表" tip="保留提交时填写的原始模型与价格信息。">
          <WorkflowPriceTable rows={submission.modelPrices} />
        </WorkflowSection>

        <WorkflowSection title={mode === "pending" ? "初始测试快照" : "审核记录"} tip={mode === "pending" ? "优先看测试 Key 是否可用、健康状态是否异常。" : "这里展示历史处理结果和当时的测试快照。"}>
          <WorkflowDetailGrid
            columns={1}
            items={[
              {
                label: "测试快照",
                value: submission.probeCredential
                  ? `${submission.probeCredential.apiKeyPreview} · ${formatCredentialStatus(submission.probeCredential.status)}`
                  : "没有测试快照",
              },
              {
                label: "测试结果",
                value: submission.probeCredential
                  ? `${submission.probeCredential.testModel} · ${formatHealthStatus(submission.probeCredential.lastHealthStatus)}${submission.probeCredential.lastHttpStatus ? ` · ${submission.probeCredential.lastHttpStatus}` : ""}`
                  : "尚未执行测试",
              },
              {
                label: mode === "pending" ? "最近测试" : "处理备注",
                value:
                  mode === "pending"
                    ? submission.probeCredential?.lastVerifiedAt
                      ? formatDateTime(submission.probeCredential.lastVerifiedAt)
                      : "尚未完成验证"
                    : submission.reviewNotes ?? "未填写",
              },
              {
                label: mode === "pending" ? "测试消息" : "处理状态",
                value: mode === "pending" ? submission.probeCredential?.lastMessage ?? "暂无附加消息。" : formatSubmissionStatus(submission.status),
              },
            ]}
          />
        </WorkflowSection>

        {mode === "pending" ? (
          <WorkflowSection title="审核操作" tip="审批通过后会直接创建或激活 Relay，并从当前队列移入提交历史。">
            <label className="field-label block">
              审核备注
              <textarea
                className="field-input min-h-28"
                placeholder="记录异常、补充信息或拒绝原因"
                value={reviewNotes}
                onChange={(event) => {
                  setReviewNotes(event.target.value);
                  setMutation((current) => ({ ...current, error: null }));
                }}
              />
            </label>
            <div className="mt-3 flex flex-wrap gap-2.5">
              <button className="pill pill-active" disabled={mutation.pending} onClick={() => void review("approved")} type="button">
                批准并创建 Relay
              </button>
              <button className="pill pill-idle" disabled={mutation.pending} onClick={() => void review("rejected")} type="button">
                拒绝
              </button>
              <button className="pill pill-ghost" disabled={mutation.pending} onClick={() => void review("archived")} type="button">
                归档
              </button>
            </div>
            <div className="mt-3">
              <Notice state={mutation} />
            </div>
          </WorkflowSection>
        ) : null}
      </div>
    </AdminDrawer>
  );
}
