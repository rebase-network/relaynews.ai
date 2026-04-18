import * as Shared from "../shared";

const {
  Card,
  clsx,
  formatCompatibilityMode,
  formatCredentialStatus,
  formatHealthStatus,
} = Shared;

type CredentialRow = Shared.AdminProbeCredentialsResponse["rows"][number];

export function CredentialListPanel({
  actionPending,
  filteredRelayCredentials,
  relayCredentials,
  selectedCredentialId,
  selectedCredentialIds,
  statusFilter,
  onBulkReprobe,
  onBulkRevoke,
  onSelectCredential,
  onStatusFilterChange,
  onToggleCredentialSelection,
  onToggleSelectAll,
}: {
  actionPending: boolean;
  filteredRelayCredentials: CredentialRow[];
  relayCredentials: CredentialRow[];
  selectedCredentialId: string | null;
  selectedCredentialIds: string[];
  statusFilter: Shared.AdminProbeCredential["status"] | "all";
  onBulkReprobe: () => void;
  onBulkRevoke: () => void;
  onSelectCredential: (id: string) => void;
  onStatusFilterChange: (status: Shared.AdminProbeCredential["status"] | "all") => void;
  onToggleCredentialSelection: (id: string, checked: boolean) => void;
  onToggleSelectAll: (checked: boolean) => void;
}) {
  const filterActive = statusFilter !== "all";
  const allFilteredSelected = filteredRelayCredentials.length > 0
    && filteredRelayCredentials.every((row) => selectedCredentialIds.includes(row.id));

  return (
    <Card title="Relay 监测密钥">
      <div className="mb-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/62">
        这里仅展示 Relay 自有的监测密钥。待审核提交中的测试密钥会保留在审核队列，不会出现在这里。
      </div>
      <div className="mb-4 grid gap-2.5 md:grid-cols-[0.8fr_auto]">
        <label className="field-label">
          状态筛选
          <select
            className="field-input"
            value={statusFilter}
            onChange={(event) => onStatusFilterChange(event.target.value as Shared.AdminProbeCredential["status"] | "all")}
          >
            <option value="all">全部状态</option>
            <option value="active">生效中</option>
            <option value="rotated">已轮换</option>
            <option value="revoked">已撤销</option>
          </select>
        </label>
        {filterActive ? (
          <button className="pill pill-idle self-end" type="button" onClick={() => onStatusFilterChange("all")}>
            清空筛选
          </button>
        ) : null}
      </div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-white/40">批量操作</p>
          <p className="mt-1 text-sm text-white/62">已选择 {selectedCredentialIds.length} 条</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="inline-flex items-center gap-2 text-sm text-white/70">
            <input
              checked={allFilteredSelected}
              onChange={(event) => onToggleSelectAll(event.target.checked)}
              type="checkbox"
            />
            全选当前结果
          </label>
          <button
            className="pill pill-idle"
            disabled={actionPending || selectedCredentialIds.length === 0}
            onClick={onBulkReprobe}
            type="button"
          >
            批量重跑 Probe
          </button>
          <button
            className="pill pill-idle"
            disabled={actionPending || selectedCredentialIds.length === 0}
            onClick={onBulkRevoke}
            type="button"
          >
            批量撤销
          </button>
        </div>
      </div>
      <div className="space-y-2.5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-white/40">监测密钥列表</p>
            <p className="mt-1 text-lg tracking-[-0.03em]">按 Relay 与运行状态快速定位</p>
          </div>
          <p className="text-sm text-white/48">
            {filterActive ? `筛选后 ${filteredRelayCredentials.length} / 共 ${relayCredentials.length}` : `共 ${relayCredentials.length} 条`}
          </p>
        </div>
        {relayCredentials.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-5 text-sm text-white/58">
            当前还没有 Relay 监测密钥。
          </div>
        ) : filteredRelayCredentials.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-5 text-sm text-white/58">
            没有符合筛选条件的监测密钥。
          </div>
        ) : filteredRelayCredentials.map((row) => (
          <div
            key={row.id}
            className={clsx(
              "admin-list-card flex items-start gap-3 border p-3.5 text-left transition",
              row.id === selectedCredentialId
                ? "border-[#ffd06a]/70 bg-white/10"
                : "border-white/10 bg-white/5 hover:bg-white/8",
            )}
          >
            <label className="inline-flex items-center gap-2 pt-1 text-sm text-white/70">
              <input
                aria-label={`选择监测密钥 ${row.ownerName}`}
                checked={selectedCredentialIds.includes(row.id)}
                onChange={(event) => onToggleCredentialSelection(row.id, event.target.checked)}
                type="checkbox"
              />
              <span className="sr-only">{row.ownerName}</span>
            </label>
            <button className="flex-1 text-left" onClick={() => onSelectCredential(row.id)} type="button">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-lg tracking-[-0.03em]">{row.ownerName}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.16em] text-white/45">
                    {formatCredentialStatus(row.status)} · {row.apiKeyPreview}
                  </p>
                </div>
                <p className="text-xs uppercase tracking-[0.14em] text-white/45">{formatCompatibilityMode(row.compatibilityMode)}</p>
              </div>
              <p className="mt-2 text-sm text-white/62">{row.ownerBaseUrl}</p>
              <p className="mt-2 text-sm text-white/70">
                {row.testModel} · {formatHealthStatus(row.lastHealthStatus)}
                {row.lastHttpStatus ? ` · ${row.lastHttpStatus}` : ""}
              </p>
              {row.lastMessage ? <p className="mt-2 text-sm text-white/45">{row.lastMessage}</p> : null}
            </button>
          </div>
        ))}
      </div>
    </Card>
  );
}
