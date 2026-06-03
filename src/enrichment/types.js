var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
export var INPUT_HEADERS = ["manufacturer", "model", "serial number"];
export var OUTPUT_HEADERS = [
    "manufacturer",
    "model",
    "serial number",
    "manufactured_date",
    "device_type",
];
export var AUDIT_HEADERS = __spreadArray(__spreadArray([], OUTPUT_HEADERS, true), [
    "manufactured_date_source",
    "manufactured_date_confidence",
    "manufactured_date_precision",
    "manufactured_date_explanation",
    "device_type_source",
    "device_type_confidence",
    "device_type_explanation",
], false);
