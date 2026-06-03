import { AUDIT_HEADERS, INPUT_HEADERS, OUTPUT_HEADERS, type EnrichedAuditRecord, type ParsedEquipmentCsv, type RawRecord } from "./types.ts";
import { normalizeInputHeader } from "./normalize.ts";

type CsvRow = string[];

function parseCsvRows(text: string): CsvRow[] {
  const rows: CsvRow[] = [];
  let row: string[] = [];
  let field = "";
  let index = 0;
  let inQuotes = false;

  while (index < text.length) {
    const char = text[index];

    if (inQuotes) {
      if (char === "\"") {
        if (text[index + 1] === "\"") {
          field += "\"";
          index += 2;
          continue;
        }

        inQuotes = false;
        index += 1;
        continue;
      }

      field += char;
      index += 1;
      continue;
    }

    if (char === "\"") {
      inQuotes = true;
      index += 1;
      continue;
    }

    if (char === ",") {
      row.push(field);
      field = "";
      index += 1;
      continue;
    }

    if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      index += 1;
      continue;
    }

    if (char === "\r") {
      index += 1;
      continue;
    }

    field += char;
    index += 1;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((currentRow) => currentRow.some((value) => value.length > 0));
}

function escapeCsvField(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, "\"\"")}"`;
  }

  return value;
}

function findRequiredHeaderIndexes(headers: string[]): Record<(typeof INPUT_HEADERS)[number], number> {
  const normalized = new Map(headers.map((header, index) => [normalizeInputHeader(header), index]));
  const manufacturerIndex = normalized.get("manufacturer");
  const modelIndex = normalized.get("model");
  const serialNumberIndex = normalized.get("serialnumber");

  if (
    manufacturerIndex === undefined ||
    modelIndex === undefined ||
    serialNumberIndex === undefined
  ) {
    throw new Error(
      `CSV must contain manufacturer, model, and serial number headers. Received: ${headers.join(", ")}`,
    );
  }

  return {
    manufacturer: manufacturerIndex,
    model: modelIndex,
    "serial number": serialNumberIndex,
  };
}

export function parseEquipmentCsv(text: string): ParsedEquipmentCsv {
  const rows = parseCsvRows(text);
  if (rows.length < 2) {
    throw new Error("CSV must include a header row and at least one data row.");
  }

  const headers = rows[0];
  const indexes = findRequiredHeaderIndexes(headers);
  const parsedRows: RawRecord[] = rows.slice(1).map((row) => ({
    manufacturer: row[indexes.manufacturer] ?? "",
    model: row[indexes.model] ?? "",
    serial_number: row[indexes["serial number"]] ?? "",
  }));

  return {
    headers,
    rows: parsedRows,
  };
}

export function serializeCsv(headers: readonly string[], rows: CsvRow[]): string {
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(row.map((field) => escapeCsvField(field ?? "")).join(","));
  }

  return `${lines.join("\n")}\n`;
}

export function buildSubmissionCsv(records: EnrichedAuditRecord[]): string {
  const rows = records.map((record) => [
    record.manufacturer,
    record.model,
    record.serial_number,
    record.manufactured_date,
    record.device_type,
  ]);

  return serializeCsv(OUTPUT_HEADERS, rows);
}

export function buildAuditCsv(records: EnrichedAuditRecord[]): string {
  const rows = records.map((record) => [
    record.manufacturer,
    record.model,
    record.serial_number,
    record.manufactured_date,
    record.device_type,
    record.manufactured_date_resolution.source,
    record.manufactured_date_resolution.confidence,
    record.manufactured_date_resolution.precision ?? "",
    record.manufactured_date_resolution.explanation ?? "",
    record.device_type_resolution.source,
    record.device_type_resolution.confidence,
    record.device_type_resolution.explanation ?? "",
  ]);

  return serializeCsv(AUDIT_HEADERS, rows);
}
