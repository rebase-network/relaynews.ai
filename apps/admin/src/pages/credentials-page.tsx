import * as Shared from "../shared";

const {
  clsx,
  Link,
  useEffect,
  useMemo,
  useSearchParams,
  useState,
  Card,
  ConfirmDialog,
  ErrorCard,
  FieldError,
  LoadingCard,
  Notice,
  PROBE_COMPATIBILITY_OPTIONS,
  PUBLIC_SITE_URL,
  buildCredentialRoute,
  buildPriceModelOptions,
  buildRelayFormState,
  buildRelaySelectOptions,
  createDefaultModelFormState,
  createDefaultPriceFormState,
  createDefaultSponsorFormState,
  createRelayPriceRowFormState,
  fetchJson,
  formatCatalogStatus,
  formatCompatibilityMode,
  formatCredentialStatus,
  formatDate,
  formatDateTime,
  formatHealthStatus,
  formatModelStatus,
  formatOverviewMetricLabel,
  formatSubmissionStatus,
  formatSponsorStatus,
  formatTime,
  getModelOptionLabel,
  getRelayOptionLabel,
  pickPreferredCredential,
  useLoadable,
  useMutationState,
  validateModelForm,
  validatePriceForm,
  validateProbeCredentialForm,
  validateRelayForm,
  validateSponsorForm,
  withoutFieldError,
} = Shared;

export function CredentialsPage() {
  const credentials = useLoadable<Shared.AdminProbeCredentialsResponse>(() => fetchJson("/admin/probe-credentials"), []);
  const relays = useLoadable<Shared.AdminRelaysResponse>(() => fetchJson("/admin/relays"), []);
  const [searchParams] = useSearchParams();
  const [statusFilter, setStatusFilter] = useState<Shared.AdminProbeCredential["status"] | "all">("all");
  const [selectedCredentialIds, setSelectedCredentialIds] = useState<string[]>([]);
  const [selectedCredentialId, setSelectedCredentialId] = useState<string | null>(null);
  const [credentialDeleteTarget, setCredentialDeleteTarget] = useState<Shared.AdminProbeCredentialDetail | null>(null);
  const [credentialRevokeTarget, setCredentialRevokeTarget] = useState<Shared.AdminProbeCredentialDetail | null>(null);
  const detail = useLoadable<Shared.AdminProbeCredentialDetail | null>(
    () => (selectedCredentialId ? fetchJson(`/admin/probe-credentials/${selectedCredentialId}`) : Promise.resolve(null)),
    [selectedCredentialId],
  );
  const [createForm, setCreateForm] = useState<Shared.ProbeCredentialFormState>({
    ownerType: "relay",
    ownerId: "",
    apiKey: "",
    testModel: "gpt-5.4",
    compatibilityMode: "auto",
  });
  const [rotateForm, setRotateForm] = useState<Shared.ProbeCredentialFormState>({
    ownerType: "relay",
    ownerId: "",
    apiKey: "",
    testModel: "gpt-5.4",
    compatibilityMode: "auto",
  });
  const [fieldErrors, setFieldErrors] = useState<Shared.ProbeCredentialFormErrors>({});
  const [rotateErrors, setRotateErrors] = useState<Shared.ProbeCredentialFormErrors>({});
  const [createMutation, setCreateMutation] = useMutationState();
  const [actionMutation, setActionMutation] = useMutationState();
  const [revealedKey, setRevealedKey] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const requestedCredentialId = searchParams.get("credential");
  const requestedOwnerType = searchParams.get("ownerType") === "relay" ? "relay" : null;
  const requestedOwnerId = searchParams.get("ownerId");
  const relayCredentials = useMemo(
    () => (credentials.data?.rows ?? []).filter((row) => row.ownerType === "relay"),
    [credentials.data],
  );
  const filterActive = statusFilter !== "all";
  const filteredRelayCredentials = useMemo(
    () => relayCredentials.filter((row) => statusFilter === "all" || row.status === statusFilter),
    [relayCredentials, statusFilter],
  );

  useEffect(() => {
    const selectionRows = filterActive ? filteredRelayCredentials : relayCredentials;

    if (!relayCredentials.length) {
      setSelectedCredentialId(null);
      return;
    }

    if (requestedCredentialId && selectionRows.some((row) => row.id === requestedCredentialId)) {
      if (requestedCredentialId !== selectedCredentialId) {
        setSelectedCredentialId(requestedCredentialId);
      }
      return;
    }

    if (requestedOwnerId && requestedOwnerType === "relay") {
      const ownerCredential = selectionRows.find((row) =>
        row.ownerId === requestedOwnerId && row.ownerType === "relay",
      );

      if (ownerCredential) {
        if (ownerCredential.id !== selectedCredentialId) {
          setSelectedCredentialId(ownerCredential.id);
        }
        return;
      }

      if (selectedCredentialId !== null) {
        setSelectedCredentialId(null);
      }
      return;
    }

    if (!selectionRows.length) {
      if (selectedCredentialId !== null) {
        setSelectedCredentialId(null);
      }
      return;
    }

    if (!selectedCredentialId || !selectionRows.some((row) => row.id === selectedCredentialId)) {
      setSelectedCredentialId(selectionRows[0]?.id ?? null);
    }
  }, [
    filterActive,
    filteredRelayCredentials,
    relayCredentials,
    requestedCredentialId,
    requestedOwnerId,
    requestedOwnerType,
    selectedCredentialId,
  ]);

  useEffect(() => {
    if (!detail.data) {
      setRevealedKey(false);
      setCopiedKey(false);
      return;
    }

    setRotateForm({
      ownerType: detail.data.ownerType,
      ownerId: detail.data.ownerId,
      apiKey: "",
      testModel: detail.data.testModel,
      compatibilityMode: detail.data.compatibilityMode,
    });
    setRotateErrors({});
    setRevealedKey(false);
    setCopiedKey(false);
  }, [detail.data]);

  useEffect(() => {
    if (!requestedOwnerId || requestedOwnerType !== "relay") {
      return;
    }

    setCreateForm((current) => ({
      ...current,
      ownerType: "relay",
      ownerId: requestedOwnerId,
    }));
  }, [requestedOwnerId, requestedOwnerType]);

  const relayOwnerOptions = buildRelaySelectOptions(relays.data?.rows ?? [], createForm.ownerId);

  async function reloadCredentialViews(nextSelectedId?: string | null) {
    await credentials.reload();

    if (nextSelectedId && nextSelectedId !== selectedCredentialId) {
      setSelectedCredentialId(nextSelectedId);
      return;
    }

    if (selectedCredentialId) {
      await detail.reload();
    }
  }

  async function createCredential() {
    const { errors, payload } = validateProbeCredentialForm(createForm);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setCreateMutation({ pending: false, error: "请先修正高亮字段，再保存监测密钥。", success: null });
      return;
    }

    setCreateMutation({ pending: true, error: null, success: null });
    try {
      const response = await fetchJson<Shared.AdminProbeCredentialMutationResponse>("/admin/probe-credentials", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setCreateMutation({
        pending: false,
        error: null,
        success: response.probe
          ? `监测密钥已绑定。初始 Probe ${response.probe.ok ? "通过" : "需要人工复核"}。`
          : "监测密钥已绑定。",
      });
      setCreateForm((current) => ({ ...current, ownerId: "", apiKey: "" }));
      setFieldErrors({});
      setSelectedCredentialId(response.id);
      await reloadCredentialViews(response.id);
    } catch (reason) {
      setCreateMutation({ pending: false, error: reason instanceof Error ? reason.message : "无法绑定监测密钥。", success: null });
    }
  }

  function toggleCredentialSelection(id: string, checked: boolean) {
    setSelectedCredentialIds((current) => {
      if (checked) {
        return current.includes(id) ? current : [...current, id];
      }

      return current.filter((value) => value !== id);
    });
  }

  async function reprobeSelected() {
    if (!detail.data) {
      return;
    }

    setActionMutation({ pending: true, error: null, success: null });
    try {
      const response = await fetchJson<Shared.AdminProbeCredentialMutationResponse>(`/admin/probe-credentials/${detail.data.id}/reprobe`, {
        method: "POST",
      });
      setActionMutation({
        pending: false,
        error: null,
        success: response.probe
          ? `Probe 重跑完成：${formatHealthStatus(response.probe.healthStatus)}${response.probe.httpStatus ? ` · ${response.probe.httpStatus}` : ""}。`
          : "Probe 重跑完成。",
      });
      await reloadCredentialViews(detail.data.id);
    } catch (reason) {
      setActionMutation({ pending: false, error: reason instanceof Error ? reason.message : "无法重新执行 Probe。", success: null });
    }
  }

  async function bulkReprobeCredentials() {
    const selectedRows = relayCredentials.filter(
      (row) => selectedCredentialIds.includes(row.id) && row.status === "active",
    );

    if (selectedRows.length === 0) {
      setActionMutation({ pending: false, error: "所选密钥中没有可重新运行的生效记录。", success: null });
      return;
    }

    setActionMutation({ pending: true, error: null, success: null });
    try {
      for (const row of selectedRows) {
        await fetchJson<Shared.AdminProbeCredentialMutationResponse>(`/admin/probe-credentials/${row.id}/reprobe`, {
          method: "POST",
        });
      }

      setSelectedCredentialIds([]);
      setActionMutation({
        pending: false,
        error: null,
        success: `已批量重跑 ${selectedRows.length} 条监测密钥。`,
      });
      await reloadCredentialViews(selectedCredentialId && selectedRows.some((row) => row.id === selectedCredentialId)
        ? selectedCredentialId
        : undefined);
    } catch (reason) {
      setActionMutation({
        pending: false,
        error: reason instanceof Error ? reason.message : "无法批量重新执行 Probe。",
        success: null,
      });
    }
  }

  async function rotateSelected() {
    if (!detail.data) {
      return;
    }

    const { errors, payload } = validateProbeCredentialForm(rotateForm);
    setRotateErrors(errors);
    if (Object.keys(errors).length > 0) {
      setActionMutation({ pending: false, error: "请先修正高亮字段，再保存轮换信息。", success: null });
      return;
    }

    setActionMutation({ pending: true, error: null, success: null });
    try {
      const response = await fetchJson<Shared.AdminProbeCredentialMutationResponse>(`/admin/probe-credentials/${detail.data.id}/rotate`, {
        method: "POST",
        body: JSON.stringify({
          apiKey: payload.apiKey,
          testModel: payload.testModel,
          compatibilityMode: payload.compatibilityMode,
        }),
      });
      setActionMutation({
        pending: false,
        error: null,
        success: response.probe
          ? `监测密钥已轮换。新的 Probe ${response.probe.ok ? "通过" : "需要人工复核"}。`
          : "监测密钥已轮换。",
      });
      setSelectedCredentialId(response.id);
      await reloadCredentialViews(response.id);
    } catch (reason) {
      setActionMutation({ pending: false, error: reason instanceof Error ? reason.message : "无法轮换监测密钥。", success: null });
    }
  }

  async function deleteSelectedCredential(credential: Shared.AdminProbeCredentialDetail) {
    setActionMutation({ pending: true, error: null, success: null });
    try {
      await fetchJson<{ ok: true }>(`/admin/probe-credentials/${credential.id}`, {
        method: "DELETE",
      });
      setCredentialDeleteTarget(null);
      setSelectedCredentialId(null);
      setActionMutation({ pending: false, error: null, success: "监测密钥已删除。" });
      await credentials.reload();
    } catch (reason) {
      setCredentialDeleteTarget(null);
      setActionMutation({
        pending: false,
        error: reason instanceof Error ? reason.message : "无法删除监测密钥。",
        success: null,
      });
    }
  }

  async function revokeSelectedCredential(credential: Shared.AdminProbeCredentialDetail) {
    setActionMutation({ pending: true, error: null, success: null });
    try {
      await fetchJson<Shared.AdminProbeCredentialMutationResponse>(`/admin/probe-credentials/${credential.id}/revoke`, {
        method: "POST",
      });
      setCredentialRevokeTarget(null);
      setActionMutation({ pending: false, error: null, success: "监测密钥已撤销。" });
      await reloadCredentialViews(credential.id);
    } catch (reason) {
      setCredentialRevokeTarget(null);
      setActionMutation({
        pending: false,
        error: reason instanceof Error ? reason.message : "无法撤销监测密钥。",
        success: null,
      });
    }
  }

  async function bulkRevokeCredentials() {
    const selectedRows = relayCredentials.filter(
      (row) => selectedCredentialIds.includes(row.id) && row.status === "active",
    );

    if (selectedRows.length === 0) {
      setActionMutation({ pending: false, error: "所选密钥中没有可撤销的生效记录。", success: null });
      return;
    }

    setActionMutation({ pending: true, error: null, success: null });
    try {
      for (const row of selectedRows) {
        await fetchJson<Shared.AdminProbeCredentialMutationResponse>(`/admin/probe-credentials/${row.id}/revoke`, {
          method: "POST",
        });
      }

      setSelectedCredentialIds([]);
      setActionMutation({
        pending: false,
        error: null,
        success: `已批量撤销 ${selectedRows.length} 条监测密钥。`,
      });
      await reloadCredentialViews(selectedCredentialId && selectedRows.some((row) => row.id === selectedCredentialId)
        ? selectedCredentialId
        : undefined);
    } catch (reason) {
      setActionMutation({
        pending: false,
        error: reason instanceof Error ? reason.message : "无法批量撤销监测密钥。",
        success: null,
      });
    }
  }

  async function copySelectedKey() {
    if (!detail.data) {
      return;
    }

    await navigator.clipboard.writeText(detail.data.apiKey);
    setCopiedKey(true);
    setActionMutation((current) => ({ ...current, success: "密钥已复制。" }));
  }

  if (credentials.loading || relays.loading) return <LoadingCard />;
  if (credentials.error || relays.error || !credentials.data || !relays.data) {
    return <ErrorCard message={credentials.error ?? relays.error ?? "无法加载监测密钥。"} />;
  }

  const allFilteredSelected = filteredRelayCredentials.length > 0
    && filteredRelayCredentials.every((row) => selectedCredentialIds.includes(row.id));

  return (
    <div className="grid gap-4 xl:grid-cols-[1.08fr_0.92fr]">
      <Card title="Relay 监测密钥" kicker="监测操作">
        <div className="mb-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/62">
          这里仅展示 Relay 自有的监测密钥。待审核提交中的测试密钥会保留在审核队列，不会出现在这里。
        </div>
        <div className="mb-4 grid gap-2.5 md:grid-cols-[0.8fr_auto]">
          <label className="field-label">
            状态筛选
            <select
              className="field-input"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as Shared.AdminProbeCredential["status"] | "all")}
            >
              <option value="all">全部状态</option>
              <option value="active">生效中</option>
              <option value="rotated">已轮换</option>
              <option value="revoked">已撤销</option>
            </select>
          </label>
          {filterActive ? <button className="pill pill-idle self-end" type="button" onClick={() => setStatusFilter("all")}>清空筛选</button> : null}
        </div>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-white/40">批量操作</p>
            <p className="mt-1 text-sm text-white/62">
              已选择 {selectedCredentialIds.length} 条
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <label className="inline-flex items-center gap-2 text-sm text-white/70">
              <input
                checked={allFilteredSelected}
                onChange={(event) =>
                  setSelectedCredentialIds((current) => {
                    const filteredIds = filteredRelayCredentials.map((row) => row.id);
                    if (event.target.checked) {
                      return Array.from(new Set([...current, ...filteredIds]));
                    }

                    return current.filter((value) => !filteredIds.includes(value));
                  })
                }
                type="checkbox"
              />
              全选当前结果
            </label>
            <button
              className="pill pill-idle"
              disabled={actionMutation.pending || selectedCredentialIds.length === 0}
              onClick={() => {
                void bulkReprobeCredentials();
              }}
              type="button"
            >
              批量重跑 Probe
            </button>
            <button
              className="pill pill-idle"
              disabled={actionMutation.pending || selectedCredentialIds.length === 0}
              onClick={() => {
                void bulkRevokeCredentials();
              }}
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
                    onChange={(event) => toggleCredentialSelection(row.id, event.target.checked)}
                    type="checkbox"
                  />
                  <span className="sr-only">{row.ownerName}</span>
                </label>
                <button
                  className="flex-1 text-left"
                  onClick={() => setSelectedCredentialId(row.id)}
                  type="button"
                >
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

      <div className="space-y-4">
        <Card title="绑定监测密钥" kicker="Relay 自有凭据">
          {requestedOwnerId && requestedOwnerType === "relay" ? (
            <div className="mb-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/62">
              表单已从上一页带入 Relay 信息，你可以直接绑定监测密钥，无需再次选择。
            </div>
          ) : null}
          <div className="mb-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/62">
            仅在已批准的 Relay 当前没有可用监测密钥时使用该表单。
          </div>
          <div className="grid gap-2.5">
            <label className="field-label">
              中转站
              <select
                className="field-input"
                value={createForm.ownerId}
                onChange={(event) => {
                  setCreateForm((current) => ({ ...current, ownerType: "relay", ownerId: event.target.value }));
                  setFieldErrors((current) => withoutFieldError(current, "ownerId"));
                  setCreateMutation((current) => ({ ...current, error: null }));
                }}
              >
                <option value="">请选择中转站</option>
                {relayOwnerOptions.map((owner) => (
                  <option key={owner.id} value={owner.id}>
                    {getRelayOptionLabel(owner)}
                  </option>
                ))}
              </select>
              <FieldError message={fieldErrors.ownerId} />
            </label>
            <label className="field-label">
              API Key
              <input
                className="field-input"
                type="password"
                placeholder="sk-monitoring"
                value={createForm.apiKey}
                onChange={(event) => {
                  setCreateForm((current) => ({ ...current, apiKey: event.target.value }));
                  setFieldErrors((current) => withoutFieldError(current, "apiKey"));
                  setCreateMutation((current) => ({ ...current, error: null }));
                }}
              />
              <FieldError message={fieldErrors.apiKey} />
            </label>
            <label className="field-label">
              测试模型
              <input
                className="field-input"
                placeholder="gpt-5.4"
                value={createForm.testModel}
                onChange={(event) => {
                  setCreateForm((current) => ({ ...current, testModel: event.target.value }));
                  setFieldErrors((current) => withoutFieldError(current, "testModel"));
                  setCreateMutation((current) => ({ ...current, error: null }));
                }}
              />
              <FieldError message={fieldErrors.testModel} />
            </label>
            <label className="field-label">
              兼容协议
              <select
                className="field-input"
                value={createForm.compatibilityMode}
                onChange={(event) => setCreateForm((current) => ({ ...current, compatibilityMode: event.target.value as Shared.ProbeCompatibilityMode }))}
              >
                <option value="auto">自动检测</option>
                <option value="openai-responses">openai-responses</option>
                <option value="openai-chat-completions">openai-chat-completions</option>
                <option value="anthropic-messages">anthropic-messages</option>
              </select>
            </label>
            <button className="pill pill-active" disabled={createMutation.pending} onClick={createCredential} type="button">
              {createMutation.pending ? "绑定中..." : "绑定监测密钥"}
            </button>
            <Notice state={createMutation} />
          </div>
        </Card>

        <Card title="监测密钥详情" kicker={detail.data ? detail.data.ownerName : "请选择一条密钥"}>
          {!selectedCredentialId ? (
            <p className="text-sm text-white/55">尚未选择密钥。</p>
          ) : detail.loading ? (
            <p className="text-sm text-white/55">正在加载密钥详情...</p>
          ) : detail.error || !detail.data ? (
            <p className="text-sm text-[#ffb59c]">{detail.error ?? "无法加载密钥详情。"}</p>
          ) : (
            <div className="space-y-4">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3.5">
                <p className="text-xs uppercase tracking-[0.16em] text-white/45">{formatCredentialStatus(detail.data.status)}</p>
                <p className="mt-2 text-sm text-white/72">{detail.data.ownerBaseUrl}</p>
                <p className="mt-2 text-sm text-white/65">
                  {detail.data.testModel} · {formatCompatibilityMode(detail.data.compatibilityMode)}
                </p>
                <p className="mt-2 break-all font-mono text-sm text-[#ffd06a]">
                  {revealedKey ? detail.data.apiKey : detail.data.apiKeyPreview}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button className="pill pill-idle" type="button" onClick={() => setRevealedKey((current) => !current)}>
                    {revealedKey ? "隐藏密钥" : "显示密钥"}
                  </button>
                  <button className="pill pill-idle" type="button" onClick={copySelectedKey}>
                    {copiedKey ? "已复制" : "复制密钥"}
                  </button>
                  <button className="pill pill-active" disabled={actionMutation.pending} type="button" onClick={reprobeSelected}>
                    {actionMutation.pending ? "执行中..." : "重新运行 Probe"}
                  </button>
                  {detail.data.status === "active" ? (
                    <button
                      className="pill pill-idle"
                      disabled={actionMutation.pending}
                      type="button"
                      onClick={() => setCredentialRevokeTarget(detail.data)}
                    >
                      撤销密钥
                    </button>
                  ) : null}
                  <button
                    className="pill pill-ghost"
                    disabled={actionMutation.pending}
                    type="button"
                    onClick={() => setCredentialDeleteTarget(detail.data)}
                  >
                    删除密钥
                  </button>
                </div>
                <div className="mt-3 space-y-1 text-sm text-white/55">
                  <p>
                    最近一次 Probe · {formatHealthStatus(detail.data.lastHealthStatus)}
                    {detail.data.lastHttpStatus ? ` · ${detail.data.lastHttpStatus}` : ""}
                    {detail.data.lastVerifiedAt ? ` · ${formatDateTime(detail.data.lastVerifiedAt)}` : ""}
                  </p>
                  {detail.data.lastDetectionMode ? <p>检测方式 · {detail.data.lastDetectionMode === "manual" ? "手动指定" : detail.data.lastDetectionMode === "auto" ? "自动检测" : detail.data.lastDetectionMode}</p> : null}
                  {detail.data.lastUsedUrl ? <p className="break-all">实际探测地址 · {detail.data.lastUsedUrl}</p> : null}
                  {detail.data.lastMessage ? <p>{detail.data.lastMessage}</p> : null}
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
                    onChange={(event) => {
                      setRotateForm((current) => ({ ...current, apiKey: event.target.value }));
                      setRotateErrors((current) => withoutFieldError(current, "apiKey"));
                      setActionMutation((current) => ({ ...current, error: null }));
                    }}
                  />
                  <FieldError message={rotateErrors.apiKey} />
                </label>
                <label className="field-label">
                  新的测试模型
                  <input
                    className="field-input"
                    value={rotateForm.testModel}
                    onChange={(event) => {
                      setRotateForm((current) => ({ ...current, testModel: event.target.value }));
                      setRotateErrors((current) => withoutFieldError(current, "testModel"));
                      setActionMutation((current) => ({ ...current, error: null }));
                    }}
                  />
                  <FieldError message={rotateErrors.testModel} />
                </label>
                <label className="field-label">
                  新的兼容协议
                  <select
                    className="field-input"
                    value={rotateForm.compatibilityMode}
                    onChange={(event) => setRotateForm((current) => ({ ...current, compatibilityMode: event.target.value as Shared.ProbeCompatibilityMode }))}
                  >
                    <option value="auto">自动检测</option>
                    <option value="openai-responses">openai-responses</option>
                    <option value="openai-chat-completions">openai-chat-completions</option>
                    <option value="anthropic-messages">anthropic-messages</option>
                  </select>
                </label>
                <button className="pill pill-active" disabled={actionMutation.pending} type="button" onClick={rotateSelected}>
                  {actionMutation.pending ? "轮换中..." : "轮换密钥"}
                </button>
                <Notice state={actionMutation} />
              </div>
            </div>
          )}
        </Card>
      </div>
      <ConfirmDialog
        confirmLabel="删除密钥"
        confirmPendingLabel="删除中..."
        message={
          credentialDeleteTarget
            ? `${credentialDeleteTarget.ownerName} 将失去这条监测密钥记录。只有在确定要从系统中移除该密钥时才执行删除。`
            : ""
        }
        onCancel={() => setCredentialDeleteTarget(null)}
        onConfirm={() => {
          if (credentialDeleteTarget) {
            void deleteSelectedCredential(credentialDeleteTarget);
          }
        }}
        open={Boolean(credentialDeleteTarget)}
        pending={actionMutation.pending}
        title={credentialDeleteTarget ? `确认删除 ${credentialDeleteTarget.ownerName} 的密钥？` : ""}
      />
      <ConfirmDialog
        confirmLabel="撤销密钥"
        confirmPendingLabel="撤销中..."
        message={
          credentialRevokeTarget
            ? `${credentialRevokeTarget.ownerName} 的这条监测密钥会被标记为已撤销，但记录仍会保留，便于后续追踪和轮换。`
            : ""
        }
        onCancel={() => setCredentialRevokeTarget(null)}
        onConfirm={() => {
          if (credentialRevokeTarget) {
            void revokeSelectedCredential(credentialRevokeTarget);
          }
        }}
        open={Boolean(credentialRevokeTarget)}
        pending={actionMutation.pending}
        title={credentialRevokeTarget ? `确认撤销 ${credentialRevokeTarget.ownerName} 的密钥？` : ""}
      />
    </div>
  );
}
