var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
import { normalizeForType, toPairLabel } from "./normalize";
import { resolveDeviceType } from "./resolveDeviceType";
import { resolveManufacturedDate } from "./resolveManufacturedDate";
function compareIsoDates(left, right) {
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
export function enrichRecords(records, references) {
    return records
        .map(function (record, original_index) {
        var _a, _b;
        var manufactured_date_resolution = resolveManufacturedDate(record, references);
        var device_type_resolution = resolveDeviceType(record, references);
        return __assign(__assign({}, record), { original_index: original_index, manufactured_date_resolution: manufactured_date_resolution, device_type_resolution: device_type_resolution, manufactured_date: (_a = manufactured_date_resolution.value) !== null && _a !== void 0 ? _a : "", device_type: (_b = device_type_resolution.value) !== null && _b !== void 0 ? _b : "Unknown" });
    })
        .sort(function (left, right) {
        var dateOrder = compareIsoDates(left.manufactured_date, right.manufactured_date);
        if (dateOrder !== 0) {
            return dateOrder;
        }
        return left.original_index - right.original_index;
    });
}
export function summarizeDataset(parsed) {
    var _a;
    var duplicateCounts = new Map();
    var normalizedPairs = new Set();
    for (var _i = 0, _b = parsed.rows; _i < _b.length; _i++) {
        var row = _b[_i];
        duplicateCounts.set(row.serial_number, ((_a = duplicateCounts.get(row.serial_number)) !== null && _a !== void 0 ? _a : 0) + 1);
        normalizedPairs.add(normalizeForType(row.manufacturer, row.model));
    }
    var rawPairs = new Set(parsed.rows.map(function (row) { return "".concat(row.manufacturer, "::").concat(row.model); }));
    return {
        total_rows: parsed.rows.length,
        unique_serial_numbers: duplicateCounts.size,
        duplicate_serial_numbers: __spreadArray([], duplicateCounts.entries(), true).filter(function (_a) {
            var count = _a[1];
            return count > 1;
        })
            .map(function (_a) {
            var serial = _a[0];
            return serial;
        }),
        unique_manufacturers: new Set(parsed.rows.map(function (row) { return row.manufacturer; })).size,
        unique_models: new Set(parsed.rows.map(function (row) { return row.model; })).size,
        unique_raw_pairs: rawPairs.size,
        unique_normalized_pairs: normalizedPairs.size,
    };
}
export function summarizeEnrichment(records) {
    var _a, _b;
    var duplicateCounts = new Map();
    var unknownPairs = new Set();
    var parserCoverage = new Map();
    var mappedDeviceTypes = 0;
    var resolvedDates = 0;
    for (var _i = 0, records_1 = records; _i < records_1.length; _i++) {
        var record = records_1[_i];
        duplicateCounts.set(record.serial_number, ((_a = duplicateCounts.get(record.serial_number)) !== null && _a !== void 0 ? _a : 0) + 1);
        if (record.device_type !== "Unknown") {
            mappedDeviceTypes += 1;
        }
        else {
            unknownPairs.add(toPairLabel(record));
        }
        if (record.manufactured_date) {
            resolvedDates += 1;
            parserCoverage.set(record.manufactured_date_resolution.source, ((_b = parserCoverage.get(record.manufactured_date_resolution.source)) !== null && _b !== void 0 ? _b : 0) + 1);
        }
    }
    return {
        total_rows: records.length,
        mapped_device_types: mappedDeviceTypes,
        unknown_device_types: records.length - mappedDeviceTypes,
        unknown_device_type_pairs: __spreadArray([], unknownPairs, true).sort(function (left, right) { return left.localeCompare(right); }),
        resolved_manufactured_dates: resolvedDates,
        unresolved_manufactured_dates: records.length - resolvedDates,
        duplicate_serial_rows_preserved: __spreadArray([], duplicateCounts.values(), true).some(function (count) { return count > 1; }),
        duplicate_serial_numbers: __spreadArray([], duplicateCounts.entries(), true).filter(function (_a) {
            var count = _a[1];
            return count > 1;
        })
            .map(function (_a) {
            var serial = _a[0];
            return serial;
        }),
        parser_coverage_by_source: Object.fromEntries(__spreadArray([], parserCoverage.entries(), true).sort(function (left, right) { return right[1] - left[1]; })),
    };
}
export function formatDateForUi(isoDate, precision) {
    if (!isoDate) {
        return "Unknown";
    }
    if (precision === "year") {
        return isoDate.slice(0, 4);
    }
    if (precision === "month") {
        var _a = isoDate.split("-"), year_1 = _a[0], month_1 = _a[1];
        var date_1 = new Date(Date.UTC(Number(year_1), Number(month_1) - 1, 1));
        return date_1.toLocaleString("en-US", {
            month: "short",
            year: "numeric",
            timeZone: "UTC",
        });
    }
    var _b = isoDate.split("-"), year = _b[0], month = _b[1], day = _b[2];
    var date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    return date.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
    });
}
