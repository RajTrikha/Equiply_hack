import { type EnrichedAuditRecord, type ParsedEquipmentCsv } from "./types";
type CsvRow = string[];
export declare function parseEquipmentCsv(text: string): ParsedEquipmentCsv;
export declare function serializeCsv(headers: readonly string[], rows: CsvRow[]): string;
export declare function buildSubmissionCsv(records: EnrichedAuditRecord[]): string;
export declare function buildAuditCsv(records: EnrichedAuditRecord[]): string;
export {};
