import { normalizeForType, toPairLabel } from "./normalize.ts";
import { resolveDeviceType } from "./resolveDeviceType.ts";
import { resolveManufacturedDate } from "./resolveManufacturedDate.ts";
import type {
  DatasetSummary,
  EnrichedAuditRecord,
  EnrichmentReferences,
  EnrichmentSummary,
  ParsedEquipmentCsv,
  RawRecord,
} from "./types.ts";

function compareIsoDates(left: string, right: string): number {
  if (!left && !right) {
    return 0;
  }

  if (!left) {
    return 1;
  }

  if (!right) {
    return -1;
  }

  return left.localeCompare(right);
}

export function enrichRecords(
  records: RawRecord[],
  references?: EnrichmentReferences,
): EnrichedAuditRecord[] {
  return records
    .map((record, original_index) => {
      const manufactured_date_resolution = resolveManufacturedDate(record, references);
      const device_type_resolution = resolveDeviceType(record, references);

      return {
        ...record,
        original_index,
        manufactured_date_resolution,
        device_type_resolution,
        manufactured_date: manufactured_date_resolution.value ?? "",
        device_type: device_type_resolution.value ?? "Unknown",
      };
    })
    .sort((left, right) => {
      const dateOrder = compareIsoDates(left.manufactured_date, right.manufactured_date);
      if (dateOrder !== 0) {
        return dateOrder;
      }

      return left.original_index - right.original_index;
    });
}

export function summarizeDataset(parsed: ParsedEquipmentCsv): DatasetSummary {
  const duplicateCounts = new Map<string, number>();
  const normalizedPairs = new Set<string>();

  for (const row of parsed.rows) {
    duplicateCounts.set(row.serial_number, (duplicateCounts.get(row.serial_number) ?? 0) + 1);
    normalizedPairs.add(normalizeForType(row.manufacturer, row.model));
  }

  const rawPairs = new Set(parsed.rows.map((row) => `${row.manufacturer}::${row.model}`));

  return {
    total_rows: parsed.rows.length,
    unique_serial_numbers: duplicateCounts.size,
    duplicate_serial_numbers: [...duplicateCounts.entries()]
      .filter(([, count]) => count > 1)
      .map(([serial]) => serial),
    unique_manufacturers: new Set(parsed.rows.map((row) => row.manufacturer)).size,
    unique_models: new Set(parsed.rows.map((row) => row.model)).size,
    unique_raw_pairs: rawPairs.size,
    unique_normalized_pairs: normalizedPairs.size,
  };
}

export function summarizeEnrichment(records: EnrichedAuditRecord[]): EnrichmentSummary {
  const duplicateCounts = new Map<string, number>();
  const unknownPairs = new Set<string>();
  const parserCoverage = new Map<string, number>();

  let mappedDeviceTypes = 0;
  let resolvedDates = 0;

  for (const record of records) {
    duplicateCounts.set(record.serial_number, (duplicateCounts.get(record.serial_number) ?? 0) + 1);

    if (record.device_type !== "Unknown") {
      mappedDeviceTypes += 1;
    } else {
      unknownPairs.add(toPairLabel(record));
    }

    if (record.manufactured_date) {
      resolvedDates += 1;
      parserCoverage.set(
        record.manufactured_date_resolution.source,
        (parserCoverage.get(record.manufactured_date_resolution.source) ?? 0) + 1,
      );
    }
  }

  return {
    total_rows: records.length,
    mapped_device_types: mappedDeviceTypes,
    unknown_device_types: records.length - mappedDeviceTypes,
    unknown_device_type_pairs: [...unknownPairs].sort((left, right) => left.localeCompare(right)),
    resolved_manufactured_dates: resolvedDates,
    unresolved_manufactured_dates: records.length - resolvedDates,
    duplicate_serial_rows_preserved: [...duplicateCounts.values()].some((count) => count > 1),
    duplicate_serial_numbers: [...duplicateCounts.entries()]
      .filter(([, count]) => count > 1)
      .map(([serial]) => serial),
    parser_coverage_by_source: Object.fromEntries(
      [...parserCoverage.entries()].sort((left, right) => right[1] - left[1]),
    ),
  };
}

export function formatDateForUi(isoDate: string, precision?: "day" | "month" | "year"): string {
  if (!isoDate) {
    return "Unknown";
  }

  if (precision === "year") {
    return isoDate.slice(0, 4);
  }

  if (precision === "month") {
    const [year, month] = isoDate.split("-");
    const date = new Date(Date.UTC(Number(year), Number(month) - 1, 1));
    return date.toLocaleString("en-US", {
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    });
  }

  const [year, month, day] = isoDate.split("-");
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}
