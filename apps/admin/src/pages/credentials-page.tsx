import * as Shared from "../shared";
import { CredentialCreatePanel } from "../components/credential-create-panel";
import { CredentialDetailPanel } from "../components/credential-detail-panel";
import { CredentialListPanel } from "../components/credential-list-panel";

const {
  ConfirmDialog,
  ErrorCard,
  LoadingCard,
  buildRelaySelectOptions,
  fetchJson,
  formatHealthStatus,
  useEffect,
  useLoadable,
  useMemo,
  useMutationState,
  useSearchParams,
  useState,
  validateProbeCredentialForm,
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

  function updateCreateField<Key extends keyof Shared.ProbeCredentialFormState>(
    key: Key,
    value: Shared.ProbeCredentialFormState[Key],
  ) {
    setCreateForm((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => withoutFieldError(current, key));
    setCreateMutation((current) => ({ ...current, error: null }));
  }

  function updateRotateField<Key extends keyof Shared.ProbeCredentialFormState>(
    key: Key,
    value: Shared.ProbeCredentialFormState[Key],
  ) {
    setRotateForm((current) => ({ ...current, [key]: value }));
    setRotateErrors((current) => withoutFieldError(current, key));
    setActionMutation((current) => ({ ...current, error: null }));
  }

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

  function toggleSelectAll(checked: boolean) {
    setSelectedCredentialIds((current) => {
      const filteredIds = filteredRelayCredentials.map((row) => row.id);
      if (checked) {
        return Array.from(new Set([...current, ...filteredIds]));
      }

      return current.filter((value) => !filteredIds.includes(value));
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
      await reloadCredentialViews(
        selectedCredentialId && selectedRows.some((row) => row.id === selectedCredentialId)
          ? selectedCredentialId
          : undefined,
      );
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
      await reloadCredentialViews(
        selectedCredentialId && selectedRows.some((row) => row.id === selectedCredentialId)
          ? selectedCredentialId
          : undefined,
      );
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

  return (
    <div className="grid gap-4 xl:grid-cols-[1.08fr_0.92fr]">
      <CredentialListPanel
        actionPending={actionMutation.pending}
        filteredRelayCredentials={filteredRelayCredentials}
        relayCredentials={relayCredentials}
        selectedCredentialId={selectedCredentialId}
        selectedCredentialIds={selectedCredentialIds}
        statusFilter={statusFilter}
        onBulkReprobe={() => {
          void bulkReprobeCredentials();
        }}
        onBulkRevoke={() => {
          void bulkRevokeCredentials();
        }}
        onSelectCredential={setSelectedCredentialId}
        onStatusFilterChange={setStatusFilter}
        onToggleCredentialSelection={toggleCredentialSelection}
        onToggleSelectAll={toggleSelectAll}
      />

      <div className="space-y-4">
        <CredentialCreatePanel
          createForm={createForm}
          fieldErrors={fieldErrors}
          mutation={createMutation}
          relayOwnerOptions={relayOwnerOptions}
          requestedOwnerId={requestedOwnerId}
          requestedOwnerType={requestedOwnerType}
          onSubmit={() => {
            void createCredential();
          }}
          onUpdateField={updateCreateField}
        />

        <CredentialDetailPanel
          actionMutation={actionMutation}
          copiedKey={copiedKey}
          detail={detail.data}
          detailError={detail.error}
          detailLoading={detail.loading}
          revealedKey={revealedKey}
          rotateErrors={rotateErrors}
          rotateForm={rotateForm}
          selectedCredentialId={selectedCredentialId}
          onCopyKey={() => {
            void copySelectedKey();
          }}
          onOpenDelete={() => {
            if (detail.data) {
              setCredentialDeleteTarget(detail.data);
            }
          }}
          onOpenRevoke={() => {
            if (detail.data) {
              setCredentialRevokeTarget(detail.data);
            }
          }}
          onReprobe={() => {
            void reprobeSelected();
          }}
          onRotate={() => {
            void rotateSelected();
          }}
          onToggleReveal={() => setRevealedKey((current) => !current)}
          onUpdateRotateField={updateRotateField}
        />
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
