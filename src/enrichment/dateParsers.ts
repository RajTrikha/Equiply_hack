import { toIsoDate, toYearMonthIso, toYearOnlyIso } from "./dateUtils.ts";
import type { RawRecord, Resolution } from "./types.ts";

export type DateParser = {
  name: string;
  parse: (record: RawRecord) => Resolution<string> | null;
};

function decodeMonthCode(code: string): number | null {
  if (/^[1-9]$/.test(code)) {
    return Number(code);
  }

  const month = { A: 10, B: 11, C: 12 }[code as "A" | "B" | "C"];
  return month ?? null;
}

export function decodeZollDate(serialNumber: string): Resolution<string> | null {
  const normalized = serialNumber.trim().toUpperCase().replace(/^\(\d+\)\s*/, "");
  const match = normalized.match(/^([A-Z0-9]{1,2})(\d{2})([A-L])(\d+)$/);

  if (!match) {
    return null;
  }

  const [, prefix, yy, monthLetter] = match;
  const year = 2000 + Number(yy);
  const currentYear = new Date().getFullYear();

  if (year < 2000 || year > currentYear) {
    return null;
  }

  const month = monthLetter.charCodeAt(0) - "A".charCodeAt(0) + 1;
  const value = toYearMonthIso(year, month);

  if (!value) {
    return null;
  }

  return {
    value,
    source: "zoll_serial_parser",
    confidence: "high",
    precision: "month",
    explanation: `Decoded ZOLL serial format after normalization: prefix=${prefix}, year=${yy}, month=${monthLetter}.`,
  };
}

export function decodeEdanDate(serialNumber: string): Resolution<string> | null {
  const normalized = serialNumber.trim().toUpperCase();
  const coreMatch = normalized.match(/(?:^|[- ])(M[0-9A-Z]+)$/);

  if (!coreMatch) {
    return null;
  }

  const match = coreMatch[1].match(/^M(\d{2})([1-9A-C]).+$/);
  if (!match) {
    return null;
  }

  const [, yy, monthCode] = match;
  const year = 2000 + Number(yy);
  const month = decodeMonthCode(monthCode);
  if (!month) {
    return null;
  }

  const value = toYearMonthIso(year, month);
  if (!value) {
    return null;
  }

  return {
    value,
    source: "edan_serial_parser",
    confidence: "high",
    precision: "month",
    explanation: `Decoded trailing Edan serial core ${coreMatch[1]} as year=${yy} and month_code=${monthCode}.`,
  };
}

export function decodeGeApexDate(serialNumber: string): Resolution<string> | null {
  const normalized = serialNumber.trim().toUpperCase();
  const match = normalized.match(/^RT(?:S|9)(\d{2})\d+[A-Z]{2}$/);

  if (!match) {
    return null;
  }

  const year = 2000 + Number(match[1]);
  const value = toYearOnlyIso(year);

  if (!value) {
    return null;
  }

  return {
    value,
    source: "ge_apex_year_parser",
    confidence: "medium",
    precision: "year",
    explanation: `Decoded GE Apex Pro CH serial family from the embedded year token ${match[1]}.`,
  };
}

export function decodeGePdmDate(serialNumber: string): Resolution<string> | null {
  const normalized = serialNumber.trim().toUpperCase();
  const match = normalized.match(/^(?:SA3(\d{2})\d+(?:[A-Z]{2})?|SPX(\d{2})\d+[A-Z]{2})$/);

  if (!match) {
    return null;
  }

  const yearToken = match[1] ?? match[2];
  const value = toYearOnlyIso(2000 + Number(yearToken));

  if (!value) {
    return null;
  }

  return {
    value,
    source: "ge_pdm_year_parser",
    confidence: "medium",
    precision: "year",
    explanation: `Decoded GE PDM serial family using year token ${yearToken}.`,
  };
}

export function decodeJiangmenDate(serialNumber: string): Resolution<string> | null {
  const normalized = serialNumber.trim().toUpperCase();
  const match = normalized.match(/^WU(\d{4})(\d{2})(\d{2})\d?EN$/);

  if (!match) {
    return null;
  }

  const [, yyyy, mm, dd] = match;
  const value = toIsoDate(Number(yyyy), Number(mm), Number(dd));

  if (!value) {
    return null;
  }

  return {
    value,
    source: "jiangmen_serial_parser",
    confidence: "high",
    precision: "day",
    explanation: `Decoded Jiangmen serial prefix WU${yyyy}${mm}${dd}.`,
  };
}

export function decodeUnicoDate(serialNumber: string): Resolution<string> | null {
  const normalized = serialNumber.trim().toUpperCase();
  const match = normalized.match(/^[A-Z0-9]+-(\d{4})(\d{2})(\d{2})$/);

  if (!match) {
    return null;
  }

  const [, yyyy, mm, dd] = match;
  const value = toIsoDate(Number(yyyy), Number(mm), Number(dd));

  if (!value) {
    return null;
  }

  return {
    value,
    source: "unico_serial_parser",
    confidence: "high",
    precision: "day",
    explanation: `Decoded embedded Unico date token ${yyyy}${mm}${dd}.`,
  };
}

export function decodeLabCorpDate(serialNumber: string): Resolution<string> | null {
  const normalized = serialNumber.trim().toUpperCase();
  const match = normalized.match(/^(\d{2})(\d{2})(\d{2})[A-Z]{2}\d+$/);

  if (!match) {
    return null;
  }

  const year = 2000 + Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const value = toIsoDate(year, month, day);

  if (!value) {
    return null;
  }

  return {
    value,
    source: "labcorp_serial_parser",
    confidence: "high",
    precision: "day",
    explanation: `Decoded leading YYMMDD token ${match[1]}${match[2]}${match[3]}.`,
  };
}

export function decodeHillromLegacyDate(serialNumber: string): Resolution<string> | null {
  const normalized = serialNumber.trim().toUpperCase();
  const match = normalized.match(/^(0[1-9]|1[0-2])[A-Z]\d{3}((?:19|20)\d{2})$/);

  if (!match) {
    return null;
  }

  const month = Number(match[1]);
  const year = Number(match[2]);
  const value = toYearMonthIso(year, month, 1900);

  if (!value) {
    return null;
  }

  return {
    value,
    source: "hillrom_legacy_serial_parser",
    confidence: "high",
    precision: "month",
    explanation: `Decoded legacy Hillrom serial using leading month ${match[1]} and trailing year ${match[2]}.`,
  };
}

export function decodeStrykerDate(serialNumber: string): Resolution<string> | null {
  const normalized = serialNumber.trim().toUpperCase();
  const match = normalized.match(/^(20\d{2})\d{9}$/);

  if (!match) {
    return null;
  }

  const value = toYearOnlyIso(Number(match[1]));
  if (!value) {
    return null;
  }

  return {
    value,
    source: "stryker_year_parser",
    confidence: "high",
    precision: "year",
    explanation: `Decoded Stryker serial from leading four-digit year ${match[1]}.`,
  };
}

export function decodeLinetDate(serialNumber: string): Resolution<string> | null {
  const normalized = serialNumber.trim().toUpperCase();
  const match = normalized.match(/^(20\d{2})(0[1-9]|1[0-2])\d{5}$/);

  if (!match) {
    return null;
  }

  const value = toYearMonthIso(Number(match[1]), Number(match[2]));
  if (!value) {
    return null;
  }

  return {
    value,
    source: "linet_serial_parser",
    confidence: "high",
    precision: "month",
    explanation: `Decoded LINET serial from leading year-month token ${match[1]}${match[2]}.`,
  };
}

export function decodeWelchFilacDate(serialNumber: string): Resolution<string> | null {
  const normalized = serialNumber.trim().toUpperCase();
  const match = normalized.match(/^(?:A)?(\d{2})\d+[A-Z]?$/);

  if (!match) {
    return null;
  }

  const value = toYearOnlyIso(2000 + Number(match[1]));
  if (!value) {
    return null;
  }

  return {
    value,
    source: "welch_filac_year_parser",
    confidence: "medium",
    precision: "year",
    explanation: `Decoded FILAC 3000 serial family from the leading year token ${match[1]}.`,
  };
}

export function decodeWelchSpotVitalsDate(serialNumber: string): Resolution<string> | null {
  const normalized = serialNumber.trim().toUpperCase();
  const match = normalized.match(/^(20\d{2})\d{5}$/);

  if (!match) {
    return null;
  }

  const value = toYearOnlyIso(Number(match[1]));
  if (!value) {
    return null;
  }

  return {
    value,
    source: "welch_spot_year_parser",
    confidence: "high",
    precision: "year",
    explanation:
      `Decoded Welch Allyn Spot Vital Signs 9-digit serial format from the leading manufacture year ${match[1]}.`,
  };
}

export function decodeWelchSureTempDate(serialNumber: string): Resolution<string> | null {
  const normalized = serialNumber.trim().toUpperCase().replace(/^\(\d+\)\s*/, "");
  const match = normalized.match(/^(\d{2})(0[1-9]|[1-4]\d|5[0-3])\d{4}$/);

  if (!match) {
    return null;
  }

  const year = 2000 + Number(match[1]);
  const value = toYearOnlyIso(year);
  if (!value) {
    return null;
  }

  return {
    value,
    source: "welch_suretemp_yearweek_parser",
    confidence: "high",
    precision: "year",
    explanation:
      `Decoded Welch Allyn SureTemp Plus serial in documented YYWWXXXX format using year=${match[1]} and week=${match[2]}.`,
  };
}

export const VALIDATED_DATE_PARSERS: DateParser[] = [
  {
    name: "zoll",
    parse: (record) =>
      record.manufacturer === "ZOLL Medical" ? decodeZollDate(record.serial_number) : null,
  },
  {
    name: "edan",
    parse: (record) =>
      record.manufacturer === "Edan Instruments" ? decodeEdanDate(record.serial_number) : null,
  },
  {
    name: "ge_apex",
    parse: (record) =>
      record.manufacturer === "GE HEALTHCARE" && record.model === "APEX PRO CH"
        ? decodeGeApexDate(record.serial_number)
        : null,
  },
  {
    name: "ge_pdm",
    parse: (record) =>
      record.manufacturer === "GE HEALTHCARE" && record.model === "PATIENT DATA MODULE (PDM)"
        ? decodeGePdmDate(record.serial_number)
        : null,
  },
  {
    name: "jiangmen",
    parse: (record) =>
      record.manufacturer === "Jiangmen Dacheng Medical Equipment Co."
        ? decodeJiangmenDate(record.serial_number)
        : null,
  },
  {
    name: "unico",
    parse: (record) => (record.manufacturer === "Unico" ? decodeUnicoDate(record.serial_number) : null),
  },
  {
    name: "labcorp",
    parse: (record) => (record.manufacturer === "LAB CORP." ? decodeLabCorpDate(record.serial_number) : null),
  },
  {
    name: "hillrom_legacy",
    parse: (record) => (record.manufacturer === "Hillrom" ? decodeHillromLegacyDate(record.serial_number) : null),
  },
  {
    name: "stryker",
    parse: (record) => (record.manufacturer === "Stryker" ? decodeStrykerDate(record.serial_number) : null),
  },
  {
    name: "linet",
    parse: (record) => (record.manufacturer === "LINET" ? decodeLinetDate(record.serial_number) : null),
  },
  {
    name: "welch_filac",
    parse: (record) =>
      record.manufacturer === "Welch Allyn" && record.model === "FILAC3000"
        ? decodeWelchFilacDate(record.serial_number)
        : null,
  },
  {
    name: "welch_spot_vitals",
    parse: (record) =>
      record.manufacturer === "Welch Allyn" && record.model === "SPOT VITAL SIGNS"
        ? decodeWelchSpotVitalsDate(record.serial_number)
        : null,
  },
  {
    name: "welch_suretemp",
    parse: (record) =>
      record.manufacturer === "Welch Allyn" && record.model === "SURETEMPPLUS"
        ? decodeWelchSureTempDate(record.serial_number)
        : null,
  },
];
