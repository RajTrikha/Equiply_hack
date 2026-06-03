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
import { VALIDATED_DATE_PARSERS } from "./dateParsers";
import { buildRecordKey } from "./normalize";
export function resolveManufacturedDate(record, references) {
    var _a;
    var authoritative = (_a = references === null || references === void 0 ? void 0 : references.manufacturedDatesByRecordKey) === null || _a === void 0 ? void 0 : _a[buildRecordKey(record)];
    if (authoritative) {
        return __assign(__assign({}, authoritative), { source: "authoritative_manufactured_date_reference" });
    }
    for (var _i = 0, VALIDATED_DATE_PARSERS_1 = VALIDATED_DATE_PARSERS; _i < VALIDATED_DATE_PARSERS_1.length; _i++) {
        var parser = VALIDATED_DATE_PARSERS_1[_i];
        var result = parser.parse(record);
        if (result) {
            return result;
        }
    }
    return {
        value: null,
        source: "manufactured_date_unresolved",
        confidence: "low",
        explanation: "No validated manufactured-date parser matched this record.",
    };
}
