import * as Shared from "../shared";

const {
  Card,
  FieldError,
  Notice,
  PROBE_COMPATIBILITY_OPTIONS,
  formatCompatibilityMode,
  formatCredentialStatus,
  formatDateTime,
  formatHealthStatus,
} = Shared;

export function CredentialDetailPanel({
  actionMutation,
  copiedKey,
  detail,
  detailError,
  detailLoading,
  revealedKey,
  rotateErrors,
  rotateForm,
  selectedCredentialId,
  onCopyKey,
  onOpenDelete,
  onOpenRevoke,
  onReprobe,
  onRotate,
  onToggleReveal,
  onUpdateRotateField,
}: {
  actionMutation: Shared.MutationState;
  copiedKey: boolean;
  detail: Shared.AdminProbeCredentialDetail | null;
  detailError: string | null;
  detailLoading: boolean;
  revealedKey: boolean;
  rotateErrors: Shared.ProbeCredentialFormErrors;
  rotateForm: Shared.ProbeCredentialFormState;
  selectedCredentialId: string | null;
  onCopyKey: () => void;
  onOpenDelete: () => void;
  onOpenRevoke: () => void;
  onReprobe: () => void;
  onRotate: () => void;
  onToggleReveal: () => void;
  onUpdateRotateField: <Key extends keyof Shared.ProbeCredentialFormState>(
    key: Key,
    value: Shared.ProbeCredentialFormState[Key],
  ) => void;
}) {
  return (
    <Card title="监测密钥详情">
      {!selectedCredentialId ? (
        <p className="text-sm text-white/55">尚未选择密钥。</p>
      ) : detailLoading ? (
        <p className="text-sm text-white/55">正在加载密钥详情...</p>
      ) : detailError || !detail ? (
        <p className="text-sm text-[#ffb59c]">{detailError ?? "无法加载密钥详情。"}</p>
      ) : (
        <div className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3.5">
            <p className="text-xs uppercase tracking-[0.16em] text-white/45">{formatCredentialStatus(detail.status)}</p>
            <p className="mt-2 text-sm text-white/72">{detail.ownerBaseUrl}</p>
            <p className="mt-2 text-sm text-white/65">
              {detail.testModel} · {formatCompatibilityMode(detail.compatibilityMode)}
            </p>
            <p className="mt-2 break-all font-mono text-sm text-[#ffd06a]">
              {revealedKey ? detail.apiKey : detail.apiKeyPreview}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button className="pill pill-idle" type="button" onClick={onToggleReveal}>
                {revealedKey ? "隐藏密钥" : "显示密钥"}
              </button>
              <button className="pill pill-idle" type="button" onClick={onCopyKey}>
                {copiedKey ? "已复制" : "复制密钥"}
              </button>
              <button className="pill pill-active" disabled={actionMutation.pending} type="button" onClick={onReprobe}>
                {actionMutation.pending ? "执行中..." : "重新运行 Probe"}
              </button>
              {detail.status === "active" ? (
                <button
                  className="pill pill-idle"
                  disabled={actionMutation.pending}
                  type="button"
                  onClick={onOpenRevoke}
                >
                  撤销密钥
                </button>
              ) : null}
              <button
                className="pill pill-ghost"
                disabled={actionMutation.pending}
                type="button"
                onClick={onOpenDelete}
              >
                删除密钥
              </button>
            </div>
            <div className="mt-3 space-y-1 text-sm text-white/55">
              <p>
                最近一次 Probe · {formatHealthStatus(detail.lastHealthStatus)}
                {detail.lastHttpStatus ? ` · ${detail.lastHttpStatus}` : ""}
                {detail.lastVerifiedAt ? ` · ${formatDateTime(detail.lastVerifiedAt)}` : ""}
              </p>
              {detail.lastDetectionMode ? <p>检测方式 · {detail.lastDetectionMode === "manual" ? "手动指定" : detail.lastDetectionMode === "auto" ? "自动检测" : detail.lastDetectionMode}</p> : null}
              {detail.lastUsedUrl ? <p className="break-all">实际探测地址 · {detail.lastUsedUrl}</p> : null}
              {detail.lastMessage ? <p>{detail.lastMessage}</p> : null}
            </div>
          </div>

          <div className="grid gap-2.5">
            <p className="text-xs uppercase tracking-[0.16em] text-white/45">轮换密钥</p>
            <label className="field-label">
              新的 API Key
              <input
                className="field-input"
                type="password"
                placeholder="sk-new-monitoring"
                value={rotateForm.apiKey}
                onChange={(event) => onUpdateRotateField("apiKey", event.target.value)}
              />
              <FieldError message={rotateErrors.apiKey} />
            </label>
            <label className="field-label">
              新的测试模型
              <input
                className="field-input"
                value={rotateForm.testModel}
                onChange={(event) => onUpdateRotateField("testModel", event.target.value)}
              />
              <FieldError message={rotateErrors.testModel} />
            </label>
            <label className="field-label">
              新的兼容协议
              <select
                className="field-input"
                value={rotateForm.compatibilityMode}
                onChange={(event) => onUpdateRotateField("compatibilityMode", event.target.value as Shared.ProbeCompatibilityMode)}
              >
                {PROBE_COMPATIBILITY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <button className="pill pill-active" disabled={actionMutation.pending} type="button" onClick={onRotate}>
              {actionMutation.pending ? "轮换中..." : "轮换密钥"}
            </button>
            <Notice state={actionMutation} />
          </div>
        </div>
      )}
    </Card>
  );
}
