import { type AdminModelUpsert, type AdminPriceCreate, type ProbeCompatibilityMode, type ProbeCredentialOwnerType } from "@relaynews/shared";

export type MutationState = {
  pending: boolean;
  error: string | null;
  success: string | null;
};

export type StatusTone = "neutral" | "accent" | "success" | "warning" | "danger";

export type RelayFormErrors = Partial<Record<"name" | "baseUrl" | "websiteUrl" | "contactInfo" | "description" | "testApiKey" | "modelPrices", string>>;
export type RelayPriceRowFormState = {
  id: string;
  modelKey: string;
  inputPricePer1M: string;
  outputPricePer1M: string;
};
export type RelayFormState = {
  name: string;
  baseUrl: string;
  websiteUrl: string;
  contactInfo: string;
  description: string;
  catalogStatus: "active" | "paused" | "archived";
  testApiKey: string;
  compatibilityMode: ProbeCompatibilityMode;
  modelPrices: RelayPriceRowFormState[];
};
export type SponsorFormState = {
  relayId: string;
  name: string;
  placement: string;
  status: "draft" | "active" | "paused" | "ended";
  startAt: string;
  endAt: string;
};
export type SponsorFormErrors = Partial<Record<"name" | "placement" | "startAt" | "endAt", string>>;
export type PriceFormState = {
  relayId: string;
  modelId: string;
  currency: string;
  inputPricePer1M: string;
  outputPricePer1M: string;
  effectiveFrom: string;
  source: AdminPriceCreate["source"];
};
export type PriceFormErrors = Partial<Record<"relayId" | "modelId" | "inputPricePer1M" | "outputPricePer1M" | "effectiveFrom", string>>;
export type ModelFormErrors = Partial<Record<"key" | "vendor" | "family", string>>;
export type ProbeCredentialFormState = {
  ownerType: ProbeCredentialOwnerType;
  ownerId: string;
  apiKey: string;
  testModel: string;
  compatibilityMode: ProbeCompatibilityMode;
};
export type ProbeCredentialFormErrors = Partial<Record<keyof ProbeCredentialFormState, string>>;

export type AdminAccessState =
  | { status: "checking" }
  | { status: "login" }
  | { status: "ready"; showLogout: boolean }
  | { status: "error"; message: string };

export type LoadableState<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void | T>;
};

export type ModelUpsertPayload = AdminModelUpsert;
