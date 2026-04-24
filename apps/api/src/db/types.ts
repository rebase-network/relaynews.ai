import type { ColumnType, Generated } from "kysely";

type JsonValue =
  | string
  | number
  | boolean
  | null
  | { [key: string]: JsonValue }
  | JsonValue[];

type Timestamp = ColumnType<string, string | undefined, string | undefined>;
type JsonColumn<T extends JsonValue> = ColumnType<T, T | string, T | string>;

export interface RelaysTable {
  id: Generated<string>;
  slug: string;
  name: string;
  base_url: string;
  provider_name: string | null;
  contact_info: string | null;
  description: string | null;
  website_url: string | null;
  docs_url: string | null;
  status: string;
  is_featured: boolean;
  is_sponsored: boolean;
  region_label: string | null;
  notes: string | null;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface ModelsTable {
  id: Generated<string>;
  key: string;
  vendor: string;
  name: string;
  family: string;
  input_price_unit: string | null;
  output_price_unit: string | null;
  is_active: boolean;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface RelayModelsTable {
  id: Generated<string>;
  relay_id: string;
  model_id: string;
  remote_model_name: string | null;
  supports_stream: boolean;
  supports_tools: boolean;
  supports_vision: boolean;
  supports_reasoning: boolean;
  status: string;
  last_verified_at: string | null;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface RelayPricesTable {
  id: Generated<string>;
  relay_id: string;
  model_id: string;
  currency: string;
  input_price_per_1m: number | null;
  output_price_per_1m: number | null;
  cache_read_price_per_1m: number | null;
  cache_write_price_per_1m: number | null;
  effective_from: string;
  source: string;
  captured_at: Timestamp;
}

export interface SubmissionsTable {
  id: Generated<string>;
  submitter_name: string | null;
  submitter_email: string | null;
  relay_name: string;
  base_url: string;
  website_url: string | null;
  contact_info: string | null;
  description: string | null;
  notes: string | null;
  status: string;
  review_notes: string | null;
  approved_relay_id: string | null;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface SubmissionModelPricesTable {
  id: Generated<string>;
  submission_id: string;
  model_key: string;
  input_price_per_1m: number | null;
  output_price_per_1m: number | null;
  position: number;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface ProbeCredentialsTable {
  id: Generated<string>;
  submission_id: string | null;
  relay_id: string | null;
  api_key: string;
  test_model: string;
  compatibility_mode: string;
  status: string;
  last_verified_at: string | null;
  last_probe_ok: boolean | null;
  last_health_status: string | null;
  last_http_status: number | null;
  last_message: string | null;
  last_detection_mode: string | null;
  last_used_url: string | null;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface SponsorsTable {
  id: Generated<string>;
  relay_id: string | null;
  name: string;
  placement: string;
  start_at: string;
  end_at: string;
  status: string;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface ProbeResultsRawTable {
  id: Generated<string>;
  probed_at: string;
  relay_id: string;
  model_id: string | null;
  probe_kind: string;
  probe_region: string;
  target_host: string;
  success: boolean;
  http_status: number | null;
  latency_ms: number | null;
  ttfb_ms: number | null;
  first_token_ms: number | null;
  dns_ms: number | null;
  tls_ms: number | null;
  request_tokens: number | null;
  response_tokens: number | null;
  error_code: string | null;
  error_message: string | null;
  protocol_consistency_score: number | null;
  response_model_name: string | null;
  sample_key: string | null;
  created_at: Timestamp;
}

export interface IncidentEventsTable {
  id: Generated<string>;
  relay_id: string;
  model_id: string | null;
  probe_region: string;
  severity: string;
  title: string;
  summary: string;
  started_at: string;
  ended_at: string | null;
  detected_from_bucket: string | null;
  resolved_from_bucket: string | null;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface RelayStatus5mTable {
  id: Generated<string>;
  bucket_start: string;
  relay_id: string;
  model_id: string | null;
  probe_region: string;
  sample_count: number;
  success_count: number;
  failure_count: number;
  availability_ratio: number;
  error_rate_ratio: number;
  last_success_at: string | null;
  last_failure_at: string | null;
}

export interface RelayLatency5mTable {
  id: Generated<string>;
  bucket_start: string;
  relay_id: string;
  model_id: string | null;
  probe_region: string;
  sample_count: number;
  latency_p50_ms: number | null;
  latency_p95_ms: number | null;
  latency_p99_ms: number | null;
  ttfb_p50_ms: number | null;
  ttfb_p95_ms: number | null;
}

export interface RelayScoreHourlyTable {
  id: Generated<string>;
  bucket_start: string;
  relay_id: string;
  model_id: string | null;
  probe_region: string;
  availability_score: number;
  latency_score: number;
  consistency_score: number;
  value_score: number;
  stability_score: number;
  total_score: number;
  sample_count: number;
  status_label: string;
}

export interface LeaderboardSnapshotsTable {
  id: Generated<string>;
  snapshot_key: string;
  model_id: string | null;
  probe_region: string;
  relay_id: string;
  rank: number;
  total_score: number;
  availability_24h: number;
  latency_p50_ms: number | null;
  latency_p95_ms: number | null;
  input_price_per_1m: number | null;
  output_price_per_1m: number | null;
  sample_count_24h: number;
  status_label: string;
  badges_json: JsonColumn<JsonValue[]>;
  measured_at: string;
  created_at: Timestamp;
}

export interface RelayOverviewSnapshotsTable {
  relay_id: string;
  status_label: string;
  availability_24h: number;
  latency_p50_ms: number | null;
  latency_p95_ms: number | null;
  incidents_7d: number;
  supported_models_count: number;
  starting_input_price_per_1m: number | null;
  starting_output_price_per_1m: number | null;
  score_summary_json: JsonColumn<JsonValue>;
  badges_json: JsonColumn<JsonValue[]>;
  measured_at: string;
  updated_at: Timestamp;
}

export interface HomeSummarySnapshotsTable {
  summary_key: string;
  payload_json: JsonColumn<JsonValue>;
  measured_at: string;
  updated_at: Timestamp;
}

export interface Database {
  relays: RelaysTable;
  models: ModelsTable;
  relay_models: RelayModelsTable;
  relay_prices: RelayPricesTable;
  submissions: SubmissionsTable;
  submission_model_prices: SubmissionModelPricesTable;
  probe_credentials: ProbeCredentialsTable;
  sponsors: SponsorsTable;
  probe_results_raw: ProbeResultsRawTable;
  incident_events: IncidentEventsTable;
  relay_status_5m: RelayStatus5mTable;
  relay_latency_5m: RelayLatency5mTable;
  relay_score_hourly: RelayScoreHourlyTable;
  leaderboard_snapshots: LeaderboardSnapshotsTable;
  relay_overview_snapshots: RelayOverviewSnapshotsTable;
  home_summary_snapshots: HomeSummarySnapshotsTable;
}
