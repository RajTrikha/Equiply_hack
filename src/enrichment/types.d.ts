export declare const INPUT_HEADERS: readonly ["manufacturer", "model", "serial number"];
export declare const OUTPUT_HEADERS: readonly ["manufacturer", "model", "serial number", "manufactured_date", "device_type"];
export declare const AUDIT_HEADERS: readonly ["manufacturer", "model", "serial number", "manufactured_date", "device_type", "manufactured_date_source", "manufactured_date_confidence", "manufactured_date_precision", "manufactured_date_explanation", "device_type_source", "device_type_confidence", "device_type_explanation"];
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
export type EnrichmentReferences = {
    deviceTypesByPairKey?: Partial<Record<string, DeviceTypeDraftEntry>>;
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
