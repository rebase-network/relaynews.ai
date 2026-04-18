import * as Shared from "../shared";

const {
  Card,
  FieldError,
  Notice,
  PROBE_COMPATIBILITY_OPTIONS,
  getRelayOptionLabel,
} = Shared;

type RelayOption = Shared.AdminRelaysResponse["rows"][number];

export function CredentialCreatePanel({
  createForm,
  fieldErrors,
  mutation,
  relayOwnerOptions,
  requestedOwnerId,
  requestedOwnerType,
  onSubmit,
  onUpdateField,
}: {
  createForm: Shared.ProbeCredentialFormState;
  fieldErrors: Shared.ProbeCredentialFormErrors;
  mutation: Shared.MutationState;
  relayOwnerOptions: RelayOption[];
  requestedOwnerId: string | null;
  requestedOwnerType: "relay" | null;
  onSubmit: () => void;
  onUpdateField: <Key extends keyof Shared.ProbeCredentialFormState>(
    key: Key,
    value: Shared.ProbeCredentialFormState[Key],
  ) => void;
}) {
  return (
    <Card title="绑定监测密钥">
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
            onChange={(event) => onUpdateField("ownerId", event.target.value)}
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
            onChange={(event) => onUpdateField("apiKey", event.target.value)}
          />
          <FieldError message={fieldErrors.apiKey} />
        </label>
        <label className="field-label">
          测试模型
          <input
            className="field-input"
            placeholder="gpt-5.4"
            value={createForm.testModel}
            onChange={(event) => onUpdateField("testModel", event.target.value)}
          />
          <FieldError message={fieldErrors.testModel} />
        </label>
        <label className="field-label">
          兼容协议
          <select
            className="field-input"
            value={createForm.compatibilityMode}
            onChange={(event) => onUpdateField("compatibilityMode", event.target.value as Shared.ProbeCompatibilityMode)}
          >
            {PROBE_COMPATIBILITY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <button className="pill pill-active" disabled={mutation.pending} onClick={onSubmit} type="button">
          {mutation.pending ? "绑定中..." : "绑定监测密钥"}
        </button>
        <Notice state={mutation} />
      </div>
    </Card>
  );
}
