import type { RawRecord } from "./types";
export declare function normalizeManufacturerForType(manufacturer: string): string;
export declare function normalizeModelForType(model: string): string;
export declare function normalizeForType(manufacturer: string, model: string): string;
export declare function normalizeInputHeader(header: string): string;
export declare function buildRecordKey(record: RawRecord): string;
export declare function toPairLabel(record: Pick<RawRecord, "manufacturer" | "model">): string;
