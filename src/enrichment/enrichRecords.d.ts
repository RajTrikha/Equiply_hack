import type { DatasetSummary, EnrichedAuditRecord, EnrichmentReferences, EnrichmentSummary, ParsedEquipmentCsv, RawRecord } from "./types";
export declare function enrichRecords(records: RawRecord[], references?: EnrichmentReferences): EnrichedAuditRecord[];
export declare function summarizeDataset(parsed: ParsedEquipmentCsv): DatasetSummary;
export declare function summarizeEnrichment(records: EnrichedAuditRecord[]): EnrichmentSummary;
export declare function formatDateForUi(isoDate: string, precision?: "day" | "month" | "year"): string;
