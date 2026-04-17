import * as Shared from "../shared";
import { AdminDrawer } from "./admin-drawer";
import { StatusBadge } from "./status-badge";
import { WorkflowDetailGrid, WorkflowPriceTable, WorkflowSection } from "./relay-workflow";

const {
  Notice,
  fetchJson,
  formatCredentialStatus,
  formatDateTime,
  formatHealthStatus,
  formatSubmissionStatus,
  statusToneForSubmissionStatus,
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
  const [presentedSubmission, setPresentedSubmission] = useState<Shared.AdminSubmissionsResponse["rows"][number] | null>(submission);
  const [reviewNotes, setReviewNotes] = useState("");
  const [mutation, setMutation] = useMutationState();

  useEffect(() => {
    if (submission) {
      setPresentedSubmission(submission);
    }
  }, [submission]);

  useEffect(() => {
    if (open || !presentedSubmission) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setPresentedSubmission(null);
    }, 240);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [open, presentedSubmission]);

  useEffect(() => {
    if (!open || !submission) {
      return;
    }

    setReviewNotes(submission.reviewNotes ?? "");
    setMutation({ pending: false, error: null, success: null });
  }, [open, setMutation, submission]);

  async function review(status: "approved" | "rejected" | "archived") {
    if (!presentedSubmission) {
      return;
    }

    setMutation({ pending: true, error: null, success: null });
    try {
      await fetchJson(`/admin/submissions/${presentedSubmission.id}/review`, {
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

  if (!presentedSubmission) {
    return null;
  }

  return (
    <AdminDrawer open={open} title={presentedSubmission.relayName} onClose={onClose}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/10 pb-3.5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge tone={statusToneForSubmissionStatus(presentedSubmission.status)}>
                {formatSubmissionStatus(presentedSubmission.status)}
              </StatusBadge>
            </div>
            <p className="mt-2 text-xs uppercase tracking-[0.16em] text-white/40">提交于 {formatDateTime(presentedSubmission.createdAt)}</p>
            <p className="mt-1 truncate text-sm text-white/56">{presentedSubmission.baseUrl}</p>
          </div>
        </div>

        <WorkflowSection title="提交概要" tip="这里保留原始提交资料，用于确认站点信息与审批上下文。">
          <WorkflowDetailGrid
            items={[
              { label: "Base URL", value: presentedSubmission.baseUrl },
              {
                label: "站点网站",
                value: presentedSubmission.websiteUrl ? (
                  <a className="text-white/82 underline underline-offset-4" href={presentedSubmission.websiteUrl} rel="noreferrer" target="_blank">
                    {presentedSubmission.websiteUrl}
                  </a>
                ) : "未填写",
              },
              { label: "联系方式", value: presentedSubmission.contactInfo ?? "未填写" },
              { label: "关联 Relay", value: presentedSubmission.approvedRelay ? presentedSubmission.approvedRelay.name : "未关联" },
            ]}
          />
          <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-sm leading-6 text-white/72">
            {presentedSubmission.description ?? presentedSubmission.notes ?? "未填写补充说明。"}
          </div>
        </WorkflowSection>

        <WorkflowSection title="支持模型及价格表" tip="保留提交时填写的原始模型与价格信息。">
          <WorkflowPriceTable rows={presentedSubmission.modelPrices} />
        </WorkflowSection>

        <WorkflowSection title={mode === "pending" ? "初始测试快照" : "审核记录"} tip={mode === "pending" ? "优先看测试 Key 是否可用、健康状态是否异常。" : "这里展示历史处理结果和当时的测试快照。"}>
          <WorkflowDetailGrid
            columns={1}
            items={[
              {
                label: "测试快照",
                value: presentedSubmission.probeCredential
                  ? `${presentedSubmission.probeCredential.apiKeyPreview} · ${formatCredentialStatus(presentedSubmission.probeCredential.status)}`
                  : "没有测试快照",
              },
              {
                label: "测试结果",
                value: presentedSubmission.probeCredential
                  ? `${presentedSubmission.probeCredential.testModel} · ${formatHealthStatus(presentedSubmission.probeCredential.lastHealthStatus)}${presentedSubmission.probeCredential.lastHttpStatus ? ` · ${presentedSubmission.probeCredential.lastHttpStatus}` : ""}`
                  : "尚未执行测试",
              },
              {
                label: mode === "pending" ? "最近测试" : "处理备注",
                value:
                  mode === "pending"
                    ? presentedSubmission.probeCredential?.lastVerifiedAt
                      ? formatDateTime(presentedSubmission.probeCredential.lastVerifiedAt)
                      : "尚未完成验证"
                    : presentedSubmission.reviewNotes ?? "未填写",
              },
              {
                label: mode === "pending" ? "测试消息" : "处理状态",
                value: mode === "pending" ? presentedSubmission.probeCredential?.lastMessage ?? "暂无附加消息。" : formatSubmissionStatus(presentedSubmission.status),
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
