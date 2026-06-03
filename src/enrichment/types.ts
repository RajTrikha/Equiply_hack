export const INPUT_HEADERS = ["manufacturer", "model", "serial number"] as const;
export const OUTPUT_HEADERS = [
  "manufacturer",
  "model",
  "serial number",
  "manufactured_date",
  "device_type",
] as const;
export const AUDIT_HEADERS = [
  ...OUTPUT_HEADERS,
  "manufactured_date_source",
  "manufactured_date_confidence",
  "manufactured_date_precision",
  "manufactured_date_explanation",
  "device_type_source",
  "device_type_confidence",
  "device_type_explanation",
] as const;

export type InputHeader = (typeof INPUT_HEADERS)[number];
export type OutputHeader = (typeof OUTPUT_HEADERS)[number];
export type AuditHeader = (typeof AUDIT_HEADERS)[number];

export type RawRecord = {
  manufacturer: string;
  model: string;
  serial_number: string;
};

export type Confidence = "high" | "medium" | "low";
export type Precision = "day" | "month" | "year";
export type MonthStrategy = "numeric" | "letter_a_l" | "code_1_9_a_c";

export type Resolution<T> = {
  value: T | null;
  source: string;
  confidence: Confidence;
  explanation?: string;
  precision?: Precision;
};

export type EnrichedRecord = RawRecord & {
  manufactured_date: string;
  device_type: string;
};

export type EnrichedAuditRecord = EnrichedRecord & {
  original_index: number;
  manufactured_date_resolution: Resolution<string>;
  device_type_resolution: Resolution<string>;
};

export type DeviceTypeDraftEntry = {
  device_type: string;
  confidence: Confidence;
  rationale: string;
};

export type DeviceTypeGenerationUsage = {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  cached_input_tokens: number;
  reasoning_tokens: number;
};

export type DeviceTypeGenerationMetadata = {
  generated: boolean;
  generated_at: string | null;
  model: string | null;
  raw_pairs_observed: number;
  normalized_pairs_classified: number;
  api_calls_made: number;
  runtime_api_calls: number;
  usage: DeviceTypeGenerationUsage | null;
  manual_review_pairs: string[];
  notes: string;
};

export type AcceptedAiManufacturedDateRule = {
  rule_key: string;
  pair_key: string;
  manufacturer: string;
  model: string;
  serial_shape_signature: string;
  regex: string;
  year_group: number;
  month_group: number | null;
  day_group: number | null;
  month_strategy: MonthStrategy | null;
  precision: Precision;
  confidence: Confidence;
  reason: string;
  validation: {
    total_rows: number;
    matched_rows: number;
    matched_ratio: number;
    representative_outputs: Array<{
      serial_number: string;
      manufactured_date: string;
    }>;
  };
};

export type AiManufacturedDateRuleProposal = {
  rule_key: string;
  manufacturer: string;
  model: string;
  serial_shape_signature: string;
  rule_found: boolean;
  regex: string | null;
  year_group: number | null;
  month_group: number | null;
  day_group: number | null;
  month_strategy: MonthStrategy | null;
  precision: Precision | null;
  confidence: Confidence;
  reason: string;
};

type WebManufacturedDateRuleBase = {
  rule_key: string;
  pair_key: string;
  manufacturer: string;
  model: string;
  source_type: "official_lookup" | "official_manual" | "fda_record" | "authorized_documentation";
  source_title: string;
  source_url: string;
  evidence_summary: string;
  confidence: Confidence;
  validation: {
    total_rows_checked: number;
    matched_rows: number;
    matched_ratio: number;
    representative_outputs: Array<{
      serial_number: string;
      manufactured_date: string;
    }>;
  };
};

export type WebRegexManufacturedDateRule = WebManufacturedDateRuleBase & {
  kind: "regex_extract";
  regex: string;
  year_group: number;
  month_group: number | null;
  day_group: number | null;
  month_strategy: MonthStrategy | null;
  precision: Precision;
};

export type WebPrefixYearMapManufacturedDateRule = WebManufacturedDateRuleBase & {
  kind: "prefix_letter_year_map";
  serial_regex: string;
  prefix_group: number;
  year_map: Record<string, number>;
  precision: "year";
};

export type WebExactSerialManufacturedDateRule = WebManufacturedDateRuleBase & {
  kind: "exact_serial_map";
  serial_map: Record<string, { manufactured_date: string; precision: Precision }>;
};

export type WebVerifiedManufacturedDateRule =
  | WebRegexManufacturedDateRule
  | WebPrefixYearMapManufacturedDateRule
  | WebExactSerialManufacturedDateRule;

export type ManufacturedDateAiFallbackMetadata = {
  generated: boolean;
  generated_at: string | null;
  model: string | null;
  deterministic_baseline_resolved_count: number;
  deterministic_baseline_unresolved_count: number;
  unresolved_groups_sent_to_ai: number;
  llm_calls: number;
  usage: DeviceTypeGenerationUsage | null;
  ai_proposed_rules: number;
  accepted_rules: number;
  rejected_rules: number;
  additional_rows_resolved_after_validation: number;
  final_unresolved_count: number;
  accepted_rule_keys: string[];
  rejected_rule_summaries: Array<{
    pair_key: string;
    reason: string;
  }>;
  notes: string;
};

export type ManufacturedDateWebResearchMetadata = {
  generated: boolean;
  generated_at: string | null;
  groups_researched: number;
  authoritative_sources_found: number;
  candidate_rules_extracted: number;
  accepted_rules: number;
  rejected_rules: number;
  additional_rows_resolved_after_validation: number;
  final_unresolved_count: number;
  attempted_pair_keys: string[];
  accepted_rule_keys: string[];
  rejected_rule_summaries: Array<{
    pair_key: string;
    reason: string;
  }>;
  notes: string;
};

export type EnrichmentReferences = {
  deviceTypesByPairKey?: Partial<Record<string, DeviceTypeDraftEntry>>;
  manufacturedDateRulesByKey?: Partial<Record<string, AcceptedAiManufacturedDateRule>>;
  webManufacturedDateRulesByKey?: Partial<Record<string, WebVerifiedManufacturedDateRule>>;
  manufacturedDatesByRecordKey?: Partial<Record<string, Resolution<string>>>;
};

export type ParsedEquipmentCsv = {
  headers: string[];
  rows: RawRecord[];
};

export type DatasetSummary = {
  total_rows: number;
  unique_serial_numbers: number;
  duplicate_serial_numbers: string[];
  unique_manufacturers: number;
  unique_models: number;
  unique_raw_pairs: number;
  unique_normalized_pairs: number;
};

export type EnrichmentSummary = {
  total_rows: number;
  mapped_device_types: number;
  unknown_device_types: number;
  unknown_device_type_pairs: string[];
  resolved_manufactured_dates: number;
  unresolved_manufactured_dates: number;
  duplicate_serial_rows_preserved: boolean;
  duplicate_serial_numbers: string[];
  parser_coverage_by_source: Record<string, number>;
};
