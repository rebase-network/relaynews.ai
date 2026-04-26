import { type AdminModelUpsert, type AdminProbeCredentialCreate, type AdminPriceCreate, type AdminRelayUpsert, type AdminRelaysResponse } from "@relaynews/shared";
import {
  type ModelFormErrors,
  type PriceFormErrors,
  type PriceFormState,
  type ProbeCredentialFormErrors,
  type ProbeCredentialFormState,
  type RelayFormErrors,
  type RelayFormState,
  type RelayPriceRowFormState,
  type SponsorFormErrors,
  type SponsorFormState,
} from "./types";
import { emptyToNull, isValidHttpUrl, isValidTimestamp, parseOptionalNumber, trimString } from "./utils";

export function createRelayPriceRowFormState(index = 0): RelayPriceRowFormState {
  return {
    id: `relay-price-${Date.now()}-${index}`,
    modelKey: "",
    inputPricePer1M: "",
    outputPricePer1M: "",
  };
}

export function buildRelayFormState(relay?: AdminRelaysResponse["rows"][number]) {
  return {
    name: relay?.name ?? "",
    baseUrl: relay?.baseUrl ?? "",
    websiteUrl: relay?.websiteUrl ?? "",
    contactInfo: relay?.contactInfo ?? "",
    description: relay?.description ?? "",
    catalogStatus:
      relay?.catalogStatus === "active" || relay?.catalogStatus === "paused" || relay?.catalogStatus === "archived"
        ? relay.catalogStatus
        : "paused",
    testApiKey: "",
    compatibilityMode: relay?.probeCredential?.compatibilityMode ?? "auto",
    modelPrices:
      relay?.modelPrices.map((row, index) => ({
        id: `${relay.id}-${row.modelKey}-${index}`,
        modelKey: row.modelKey,
        inputPricePer1M: row.inputPricePer1M === null ? "" : String(row.inputPricePer1M),
        outputPricePer1M: row.outputPricePer1M === null ? "" : String(row.outputPricePer1M),
      })) ?? [createRelayPriceRowFormState()],
  } satisfies RelayFormState;
}

export function validateRelayForm(form: RelayFormState, options?: { editing: boolean }) {
  const payload: AdminRelayUpsert = {
    name: trimString(form.name),
    baseUrl: trimString(form.baseUrl),
    websiteUrl: emptyToNull(form.websiteUrl),
    contactInfo: emptyToNull(form.contactInfo),
    catalogStatus: form.catalogStatus,
    description: emptyToNull(form.description),
    testApiKey: emptyToNull(form.testApiKey),
    compatibilityMode: form.compatibilityMode,
    modelPrices: form.modelPrices.map((row) => ({
      modelKey: trimString(row.modelKey),
      inputPricePer1M: parseOptionalNumber(row.inputPricePer1M),
      outputPricePer1M: parseOptionalNumber(row.outputPricePer1M),
    })),
  };
  const errors: RelayFormErrors = {};

  if (!payload.name) {
    errors.name = "请输入站点名字。";
  }

  if (!payload.baseUrl) {
    errors.baseUrl = "请输入 Base URL。";
  } else if (!isValidHttpUrl(payload.baseUrl)) {
    errors.baseUrl = "请输入完整的 Base URL，例如 https://relay.example.ai/v1。";
  }

  if (payload.websiteUrl && !isValidHttpUrl(payload.websiteUrl)) {
    errors.websiteUrl = "请输入有效的网站地址，例如 https://relay.example.ai。";
  }

  if (!payload.contactInfo) {
    errors.contactInfo = "请填写联系方式。";
  }

  if (!payload.description) {
    errors.description = "请填写站点简介。";
  }

  if (!options?.editing && !payload.testApiKey) {
    errors.testApiKey = "手动新增 Relay 时需要提供测试API Key。";
  }

  if (payload.modelPrices.length === 0) {
    errors.modelPrices = "请至少添加一条模型价格信息。";
  } else {
    for (const row of payload.modelPrices) {
      if (!row.modelKey) {
        errors.modelPrices = "每条模型价格信息都需要填写模型。";
        break;
      }

      if (row.inputPricePer1M !== null && (Number.isNaN(row.inputPricePer1M) || row.inputPricePer1M < 0)) {
        errors.modelPrices = "Input 价格必须是大于或等于 0 的数字。";
        break;
      }

      if (row.outputPricePer1M !== null && (Number.isNaN(row.outputPricePer1M) || row.outputPricePer1M < 0)) {
        errors.modelPrices = "Output 价格必须是大于或等于 0 的数字。";
        break;
      }

      if (row.inputPricePer1M === null && row.outputPricePer1M === null) {
        errors.modelPrices = "每条模型价格信息至少填写一个价格字段。";
        break;
      }
    }
  }

  return { errors, payload };
}

export function validateSponsorForm(form: SponsorFormState) {
  const payload = {
    relayId: form.relayId || null,
    name: trimString(form.name),
    placement: trimString(form.placement),
    status: form.status,
    startAt: trimString(form.startAt),
    endAt: trimString(form.endAt),
  };
  const errors: SponsorFormErrors = {};

  if (!payload.name) {
    errors.name = "请输入赞助名称。";
  }

  if (!payload.placement) {
    errors.placement = "请输入投放位标识。";
  }

  if (!payload.startAt) {
    errors.startAt = "请输入开始时间。";
  } else if (!isValidTimestamp(payload.startAt)) {
    errors.startAt = "请输入有效的 ISO 时间。";
  }

  if (!payload.endAt) {
    errors.endAt = "请输入结束时间。";
  } else if (!isValidTimestamp(payload.endAt)) {
    errors.endAt = "请输入有效的 ISO 时间。";
  }

  if (!errors.startAt && !errors.endAt && new Date(payload.endAt) <= new Date(payload.startAt)) {
    errors.endAt = "结束时间必须晚于开始时间。";
  }

  return { errors, payload };
}

export function validatePriceForm(form: PriceFormState) {
  const parsedInputPricePer1M = parseOptionalNumber(form.inputPricePer1M);
  const parsedOutputPricePer1M = parseOptionalNumber(form.outputPricePer1M);
  const payload: AdminPriceCreate = {
    relayId: form.relayId,
    modelId: form.modelId,
    currency: trimString(form.currency) || "USD",
    inputPricePer1M: parsedInputPricePer1M,
    outputPricePer1M: parsedOutputPricePer1M,
    effectiveFrom: trimString(form.effectiveFrom),
    source: form.source,
  };
  const errors: PriceFormErrors = {};

  if (!payload.relayId) {
    errors.relayId = "请选择大模型API服务站。";
  }

  if (!payload.modelId) {
    errors.modelId = "请选择模型。";
  }

  if (parsedInputPricePer1M !== null && (Number.isNaN(parsedInputPricePer1M) || parsedInputPricePer1M < 0)) {
    errors.inputPricePer1M = "输入价必须是大于或等于 0 的数字。";
  }

  if (parsedOutputPricePer1M !== null && (Number.isNaN(parsedOutputPricePer1M) || parsedOutputPricePer1M < 0)) {
    errors.outputPricePer1M = "输出价必须是大于或等于 0 的数字。";
  }

  if (parsedInputPricePer1M === null && parsedOutputPricePer1M === null) {
    errors.inputPricePer1M = "至少填写一个价格字段。";
    errors.outputPricePer1M = "至少填写一个价格字段。";
  }

  if (!payload.effectiveFrom) {
    errors.effectiveFrom = "请输入生效时间。";
  } else if (!isValidTimestamp(payload.effectiveFrom)) {
    errors.effectiveFrom = "请输入有效的 ISO 时间。";
  }

  return { errors, payload };
}

function slugifyModelKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

export function inferModelVendor(modelKey: string) {
  const normalized = slugifyModelKey(modelKey);
  const [vendor] = normalized.split("-");
  return vendor || "relay";
}

export function inferModelFamily(modelKey: string) {
  const normalized = slugifyModelKey(modelKey);
  const parts = normalized.split("-");

  if (parts.length <= 1) {
    return normalized || "custom";
  }

  return parts.slice(1).join("-") || normalized;
}

export function validateModelForm(form: AdminModelUpsert) {
  const key = trimString(form.key);
  const payload: AdminModelUpsert = {
    key,
    vendor: inferModelVendor(key),
    family: inferModelFamily(key),
    inputPriceUnit: emptyToNull(form.inputPriceUnit),
    outputPriceUnit: emptyToNull(form.outputPriceUnit),
    isActive: form.isActive,
  };
  const errors: ModelFormErrors = {};

  if (!payload.key) {
    errors.key = "请输入模型键值。";
  }

  return { errors, payload };
}

export function validateProbeCredentialForm(form: ProbeCredentialFormState) {
  const payload: AdminProbeCredentialCreate = {
    ownerType: form.ownerType,
    ownerId: trimString(form.ownerId),
    apiKey: trimString(form.apiKey),
    testModel: trimString(form.testModel),
    compatibilityMode: form.compatibilityMode,
  };
  const errors: ProbeCredentialFormErrors = {};

  if (!payload.ownerId) {
    errors.ownerId = payload.ownerType === "relay" ? "请选择大模型API服务站。" : "请选择归属对象。";
  }

  if (!payload.apiKey) {
    errors.apiKey = "请输入 API Key。";
  }

  if (!payload.testModel) {
    errors.testModel = "请输入测试模型。";
  }

  return { errors, payload };
}

export function createDefaultSponsorFormState(): SponsorFormState {
  return {
    relayId: "",
    name: "",
    placement: "homepage-spotlight",
    status: "active",
    startAt: new Date().toISOString(),
    endAt: new Date(Date.now() + 30 * 86400000).toISOString(),
  };
}

export function createDefaultPriceFormState(): PriceFormState {
  return {
    relayId: "",
    modelId: "",
    currency: "USD",
    inputPricePer1M: "0.1",
    outputPricePer1M: "0.5",
    effectiveFrom: new Date().toISOString(),
    source: "manual",
  };
}

export function createDefaultModelFormState(): AdminModelUpsert {
  return {
    key: "",
    vendor: "",
    family: "",
    inputPriceUnit: "USD / 1M tokens",
    outputPriceUnit: "USD / 1M tokens",
    isActive: true,
  };
}
