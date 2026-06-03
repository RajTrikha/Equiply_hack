function normalizeWhitespace(value) {
    return value.trim().replace(/\s+/g, " ");
}
function normalizeAlphaNumeric(value) {
    return normalizeWhitespace(value)
        .normalize("NFKD")
        .toUpperCase()
        .replace(/&/g, " AND ")
        .replace(/[^A-Z0-9]+/g, "");
}
function normalizeHeaderToken(value) {
    return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}
export function normalizeManufacturerForType(manufacturer) {
    return normalizeAlphaNumeric(manufacturer);
}
export function normalizeModelForType(model) {
    return normalizeAlphaNumeric(model);
}
export function normalizeForType(manufacturer, model) {
    return "".concat(normalizeManufacturerForType(manufacturer), "::").concat(normalizeModelForType(model));
}
export function normalizeInputHeader(header) {
    return normalizeHeaderToken(header);
}
export function buildRecordKey(record) {
    return [
        normalizeWhitespace(record.manufacturer).toUpperCase(),
        normalizeWhitespace(record.model).toUpperCase(),
        normalizeWhitespace(record.serial_number).toUpperCase(),
    ].join("::");
}
export function toPairLabel(record) {
    return "".concat(record.manufacturer, " / ").concat(record.model);
}
