import modelTypeMap from "./model_type_map.json";
import { DEVICE_TYPES } from "./deviceTypes";
import { normalizeForType } from "./normalize";
function isKnownDeviceType(value) {
    return DEVICE_TYPES.includes(value);
}
function getEntry(pairKey, references) {
    var _a;
    var referenced = (_a = references === null || references === void 0 ? void 0 : references.deviceTypesByPairKey) === null || _a === void 0 ? void 0 : _a[pairKey];
    if (referenced && isKnownDeviceType(referenced.device_type)) {
        return {
            device_type: referenced.device_type,
            confidence: referenced.confidence,
            rationale: referenced.rationale,
        };
    }
    var mapped = modelTypeMap[pairKey];
    return mapped !== null && mapped !== void 0 ? mapped : null;
}
export function resolveDeviceType(record, references) {
    var _a;
    var pairKey = normalizeForType(record.manufacturer, record.model);
    var authoritative = (_a = references === null || references === void 0 ? void 0 : references.deviceTypesByPairKey) === null || _a === void 0 ? void 0 : _a[pairKey];
    if (authoritative && isKnownDeviceType(authoritative.device_type)) {
        return {
            value: authoritative.device_type,
            source: "authoritative_device_type_reference",
            confidence: authoritative.confidence,
            explanation: authoritative.rationale,
        };
    }
    var entry = getEntry(pairKey, references);
    if (!entry) {
        return {
            value: "Unknown",
            source: "device_type_unresolved",
            confidence: "low",
            explanation: "No reviewed device-type mapping exists for ".concat(pairKey, "."),
        };
    }
    return {
        value: entry.device_type,
        source: "static_model_type_map",
        confidence: entry.confidence,
        explanation: entry.rationale,
    };
}
