import type { RawRecord } from "./types.ts";

function normalizeWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeAlphaNumeric(value: string): string {
  return normalizeWhitespace(value)
    .normalize("NFKD")
    .toUpperCase()
    .replace(/&/g, " AND ")
    .replace(/[^A-Z0-9]+/g, "");
}

function normalizeHeaderToken(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export function normalizeManufacturerForType(manufacturer: string): string {
  return normalizeAlphaNumeric(manufacturer);
}

export function normalizeModelForType(model: string): string {
  return normalizeAlphaNumeric(model);
}

export function normalizeForType(manufacturer: string, model: string): string {
  return `${normalizeManufacturerForType(manufacturer)}::${normalizeModelForType(model)}`;
}

export function normalizeInputHeader(header: string): string {
  return normalizeHeaderToken(header);
}

export function buildRecordKey(record: RawRecord): string {
  return [
    normalizeWhitespace(record.manufacturer).toUpperCase(),
    normalizeWhitespace(record.model).toUpperCase(),
    normalizeWhitespace(record.serial_number).toUpperCase(),
  ].join("::");
}

export function toPairLabel(record: Pick<RawRecord, "manufacturer" | "model">): string {
  return `${record.manufacturer} / ${record.model}`;
}
