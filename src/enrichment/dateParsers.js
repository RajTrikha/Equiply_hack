function toIsoDate(year, month, day) {
    var candidate = new Date(Date.UTC(year, month - 1, day));
    if (candidate.getUTCFullYear() !== year ||
        candidate.getUTCMonth() !== month - 1 ||
        candidate.getUTCDate() !== day) {
        return null;
    }
    return "".concat(year, "-").concat(String(month).padStart(2, "0"), "-").concat(String(day).padStart(2, "0"));
}
function toYearOnlyIso(year, minimumYear) {
    if (minimumYear === void 0) { minimumYear = 2000; }
    var currentYear = new Date().getFullYear();
    if (year < minimumYear || year > currentYear) {
        return null;
    }
    return "".concat(year, "-01-01");
}
function toYearMonthIso(year, month, minimumYear) {
    if (minimumYear === void 0) { minimumYear = 2000; }
    if (month < 1 || month > 12) {
        return null;
    }
    var yearOnly = toYearOnlyIso(year, minimumYear);
    if (!yearOnly) {
        return null;
    }
    return "".concat(year, "-").concat(String(month).padStart(2, "0"), "-01");
}
function decodeMonthCode(code) {
    if (/^[1-9]$/.test(code)) {
        return Number(code);
    }
    var month = { A: 10, B: 11, C: 12 }[code];
    return month !== null && month !== void 0 ? month : null;
}
export function decodeZollDate(serialNumber) {
    var normalized = serialNumber.trim().toUpperCase().replace(/^\(\d+\)\s*/, "");
    var match = normalized.match(/^([A-Z0-9]{1,2})(\d{2})([A-L])(\d+)$/);
    if (!match) {
        return null;
    }
    var prefix = match[1], yy = match[2], monthLetter = match[3];
    var year = 2000 + Number(yy);
    var currentYear = new Date().getFullYear();
    if (year < 2000 || year > currentYear) {
        return null;
    }
    var month = monthLetter.charCodeAt(0) - "A".charCodeAt(0) + 1;
    var value = toYearMonthIso(year, month);
    if (!value) {
        return null;
    }
    return {
        value: value,
        source: "zoll_serial_parser",
        confidence: "high",
        precision: "month",
        explanation: "Decoded ZOLL serial format after normalization: prefix=".concat(prefix, ", year=").concat(yy, ", month=").concat(monthLetter, "."),
    };
}
export function decodeEdanDate(serialNumber) {
    var normalized = serialNumber.trim().toUpperCase();
    var coreMatch = normalized.match(/(?:^|[- ])(M[0-9A-Z]+)$/);
    if (!coreMatch) {
        return null;
    }
    var match = coreMatch[1].match(/^M(\d{2})([1-9A-C]).+$/);
    if (!match) {
        return null;
    }
    var yy = match[1], monthCode = match[2];
    var year = 2000 + Number(yy);
    var month = decodeMonthCode(monthCode);
    if (!month) {
        return null;
    }
    var value = toYearMonthIso(year, month);
    if (!value) {
        return null;
    }
    return {
        value: value,
        source: "edan_serial_parser",
        confidence: "high",
        precision: "month",
        explanation: "Decoded trailing Edan serial core ".concat(coreMatch[1], " as year=").concat(yy, " and month_code=").concat(monthCode, "."),
    };
}
export function decodeGeApexDate(serialNumber) {
    var normalized = serialNumber.trim().toUpperCase();
    var match = normalized.match(/^RT(?:S|9)(\d{2})\d+[A-Z]{2}$/);
    if (!match) {
        return null;
    }
    var year = 2000 + Number(match[1]);
    var value = toYearOnlyIso(year);
    if (!value) {
        return null;
    }
    return {
        value: value,
        source: "ge_apex_year_parser",
        confidence: "medium",
        precision: "year",
        explanation: "Decoded GE Apex Pro CH serial family from the embedded year token ".concat(match[1], "."),
    };
}
export function decodeGePdmDate(serialNumber) {
    var _a;
    var normalized = serialNumber.trim().toUpperCase();
    var match = normalized.match(/^(?:SA3(\d{2})\d+(?:[A-Z]{2})?|SPX(\d{2})\d+[A-Z]{2})$/);
    if (!match) {
        return null;
    }
    var yearToken = (_a = match[1]) !== null && _a !== void 0 ? _a : match[2];
    var value = toYearOnlyIso(2000 + Number(yearToken));
    if (!value) {
        return null;
    }
    return {
        value: value,
        source: "ge_pdm_year_parser",
        confidence: "medium",
        precision: "year",
        explanation: "Decoded GE PDM serial family using year token ".concat(yearToken, "."),
    };
}
export function decodeJiangmenDate(serialNumber) {
    var normalized = serialNumber.trim().toUpperCase();
    var match = normalized.match(/^WU(\d{4})(\d{2})(\d{2})\d?EN$/);
    if (!match) {
        return null;
    }
    var yyyy = match[1], mm = match[2], dd = match[3];
    var value = toIsoDate(Number(yyyy), Number(mm), Number(dd));
    if (!value) {
        return null;
    }
    return {
        value: value,
        source: "jiangmen_serial_parser",
        confidence: "high",
        precision: "day",
        explanation: "Decoded Jiangmen serial prefix WU".concat(yyyy).concat(mm).concat(dd, "."),
    };
}
export function decodeUnicoDate(serialNumber) {
    var normalized = serialNumber.trim().toUpperCase();
    var match = normalized.match(/^[A-Z0-9]+-(\d{4})(\d{2})(\d{2})$/);
    if (!match) {
        return null;
    }
    var yyyy = match[1], mm = match[2], dd = match[3];
    var value = toIsoDate(Number(yyyy), Number(mm), Number(dd));
    if (!value) {
        return null;
    }
    return {
        value: value,
        source: "unico_serial_parser",
        confidence: "high",
        precision: "day",
        explanation: "Decoded embedded Unico date token ".concat(yyyy).concat(mm).concat(dd, "."),
    };
}
export function decodeLabCorpDate(serialNumber) {
    var normalized = serialNumber.trim().toUpperCase();
    var match = normalized.match(/^(\d{2})(\d{2})(\d{2})[A-Z]{2}\d+$/);
    if (!match) {
        return null;
    }
    var year = 2000 + Number(match[1]);
    var month = Number(match[2]);
    var day = Number(match[3]);
    var value = toIsoDate(year, month, day);
    if (!value) {
        return null;
    }
    return {
        value: value,
        source: "labcorp_serial_parser",
        confidence: "high",
        precision: "day",
        explanation: "Decoded leading YYMMDD token ".concat(match[1]).concat(match[2]).concat(match[3], "."),
    };
}
export function decodeHillromLegacyDate(serialNumber) {
    var normalized = serialNumber.trim().toUpperCase();
    var match = normalized.match(/^(0[1-9]|1[0-2])[A-Z]\d{3}((?:19|20)\d{2})$/);
    if (!match) {
        return null;
    }
    var month = Number(match[1]);
    var year = Number(match[2]);
    var value = toYearMonthIso(year, month, 1900);
    if (!value) {
        return null;
    }
    return {
        value: value,
        source: "hillrom_legacy_serial_parser",
        confidence: "high",
        precision: "month",
        explanation: "Decoded legacy Hillrom serial using leading month ".concat(match[1], " and trailing year ").concat(match[2], "."),
    };
}
export function decodeStrykerDate(serialNumber) {
    var normalized = serialNumber.trim().toUpperCase();
    var match = normalized.match(/^(20\d{2})\d{9}$/);
    if (!match) {
        return null;
    }
    var value = toYearOnlyIso(Number(match[1]));
    if (!value) {
        return null;
    }
    return {
        value: value,
        source: "stryker_year_parser",
        confidence: "high",
        precision: "year",
        explanation: "Decoded Stryker serial from leading four-digit year ".concat(match[1], "."),
    };
}
export function decodeLinetDate(serialNumber) {
    var normalized = serialNumber.trim().toUpperCase();
    var match = normalized.match(/^(20\d{2})(0[1-9]|1[0-2])\d{5}$/);
    if (!match) {
        return null;
    }
    var value = toYearMonthIso(Number(match[1]), Number(match[2]));
    if (!value) {
        return null;
    }
    return {
        value: value,
        source: "linet_serial_parser",
        confidence: "high",
        precision: "month",
        explanation: "Decoded LINET serial from leading year-month token ".concat(match[1]).concat(match[2], "."),
    };
}
export function decodeWelchFilacDate(serialNumber) {
    var normalized = serialNumber.trim().toUpperCase();
    var match = normalized.match(/^(?:A)?(\d{2})\d+[A-Z]?$/);
    if (!match) {
        return null;
    }
    var value = toYearOnlyIso(2000 + Number(match[1]));
    if (!value) {
        return null;
    }
    return {
        value: value,
        source: "welch_filac_year_parser",
        confidence: "medium",
        precision: "year",
        explanation: "Decoded FILAC 3000 serial family from the leading year token ".concat(match[1], "."),
    };
}
export var VALIDATED_DATE_PARSERS = [
    {
        name: "zoll",
        parse: function (record) {
            return record.manufacturer === "ZOLL Medical" ? decodeZollDate(record.serial_number) : null;
        },
    },
    {
        name: "edan",
        parse: function (record) {
            return record.manufacturer === "Edan Instruments" ? decodeEdanDate(record.serial_number) : null;
        },
    },
    {
        name: "ge_apex",
        parse: function (record) {
            return record.manufacturer === "GE HEALTHCARE" && record.model === "APEX PRO CH"
                ? decodeGeApexDate(record.serial_number)
                : null;
        },
    },
    {
        name: "ge_pdm",
        parse: function (record) {
            return record.manufacturer === "GE HEALTHCARE" && record.model === "PATIENT DATA MODULE (PDM)"
                ? decodeGePdmDate(record.serial_number)
                : null;
        },
    },
    {
        name: "jiangmen",
        parse: function (record) {
            return record.manufacturer === "Jiangmen Dacheng Medical Equipment Co."
                ? decodeJiangmenDate(record.serial_number)
                : null;
        },
    },
    {
        name: "unico",
        parse: function (record) { return (record.manufacturer === "Unico" ? decodeUnicoDate(record.serial_number) : null); },
    },
    {
        name: "labcorp",
        parse: function (record) { return (record.manufacturer === "LAB CORP." ? decodeLabCorpDate(record.serial_number) : null); },
    },
    {
        name: "hillrom_legacy",
        parse: function (record) { return (record.manufacturer === "Hillrom" ? decodeHillromLegacyDate(record.serial_number) : null); },
    },
    {
        name: "stryker",
        parse: function (record) { return (record.manufacturer === "Stryker" ? decodeStrykerDate(record.serial_number) : null); },
    },
    {
        name: "linet",
        parse: function (record) { return (record.manufacturer === "LINET" ? decodeLinetDate(record.serial_number) : null); },
    },
    {
        name: "welch_filac",
        parse: function (record) {
            return record.manufacturer === "Welch Allyn" && record.model === "FILAC3000"
                ? decodeWelchFilacDate(record.serial_number)
                : null;
        },
    },
];
