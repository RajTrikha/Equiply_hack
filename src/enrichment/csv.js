import { AUDIT_HEADERS, OUTPUT_HEADERS } from "./types";
import { normalizeInputHeader } from "./normalize";
function parseCsvRows(text) {
    var rows = [];
    var row = [];
    var field = "";
    var index = 0;
    var inQuotes = false;
    while (index < text.length) {
        var char = text[index];
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
    return rows.filter(function (currentRow) { return currentRow.some(function (value) { return value.length > 0; }); });
}
function escapeCsvField(value) {
    if (/[",\n\r]/.test(value)) {
        return "\"".concat(value.replace(/"/g, "\"\""), "\"");
    }
    return value;
}
function findRequiredHeaderIndexes(headers) {
    var normalized = new Map(headers.map(function (header, index) { return [normalizeInputHeader(header), index]; }));
    var manufacturerIndex = normalized.get("manufacturer");
    var modelIndex = normalized.get("model");
    var serialNumberIndex = normalized.get("serialnumber");
    if (manufacturerIndex === undefined ||
        modelIndex === undefined ||
        serialNumberIndex === undefined) {
        throw new Error("CSV must contain manufacturer, model, and serial number headers. Received: ".concat(headers.join(", ")));
    }
    return {
        manufacturer: manufacturerIndex,
        model: modelIndex,
        "serial number": serialNumberIndex,
    };
}
export function parseEquipmentCsv(text) {
    var rows = parseCsvRows(text);
    if (rows.length < 2) {
        throw new Error("CSV must include a header row and at least one data row.");
    }
    var headers = rows[0];
    var indexes = findRequiredHeaderIndexes(headers);
    var parsedRows = rows.slice(1).map(function (row) {
        var _a, _b, _c;
        return ({
            manufacturer: (_a = row[indexes.manufacturer]) !== null && _a !== void 0 ? _a : "",
            model: (_b = row[indexes.model]) !== null && _b !== void 0 ? _b : "",
            serial_number: (_c = row[indexes["serial number"]]) !== null && _c !== void 0 ? _c : "",
        });
    });
    return {
        headers: headers,
        rows: parsedRows,
    };
}
export function serializeCsv(headers, rows) {
    var lines = [headers.join(",")];
    for (var _i = 0, rows_1 = rows; _i < rows_1.length; _i++) {
        var row = rows_1[_i];
        lines.push(row.map(function (field) { return escapeCsvField(field !== null && field !== void 0 ? field : ""); }).join(","));
    }
    return "".concat(lines.join("\n"), "\n");
}
export function buildSubmissionCsv(records) {
    var rows = records.map(function (record) { return [
        record.manufacturer,
        record.model,
        record.serial_number,
        record.manufactured_date,
        record.device_type,
    ]; });
    return serializeCsv(OUTPUT_HEADERS, rows);
}
export function buildAuditCsv(records) {
    var rows = records.map(function (record) {
        var _a, _b, _c;
        return [
            record.manufacturer,
            record.model,
            record.serial_number,
            record.manufactured_date,
            record.device_type,
            record.manufactured_date_resolution.source,
            record.manufactured_date_resolution.confidence,
            (_a = record.manufactured_date_resolution.precision) !== null && _a !== void 0 ? _a : "",
            (_b = record.manufactured_date_resolution.explanation) !== null && _b !== void 0 ? _b : "",
            record.device_type_resolution.source,
            record.device_type_resolution.confidence,
            (_c = record.device_type_resolution.explanation) !== null && _c !== void 0 ? _c : "",
        ];
    });
    return serializeCsv(AUDIT_HEADERS, rows);
}
