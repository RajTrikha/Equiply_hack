import cachedWebRules from "./manufactured_date_web_rules.json";
import { toIsoDate, toYearMonthIso, toYearOnlyIso } from "./dateUtils.ts";
import { normalizeForType } from "./normalize.ts";
import type {
  EnrichmentReferences,
  MonthStrategy,
  Precision,
  RawRecord,
  Resolution,
  WebVerifiedManufacturedDateRule,
} from "./types.ts";

const CACHED_WEB_RULES = cachedWebRules as Record<string, WebVerifiedManufacturedDateRule>;
const SAFE_REGEX = /^[A-Za-z0-9^$()[\]{}+*?.\\|\- _]+$/;
const MAX_REGEX_LENGTH = 120;

function normalizeSerialForRules(serialNumber: string): string {
  return serialNumber.trim().toUpperCase().replace(/^\(\d+\)\s*/, "");
}

function hasSafeRegexShape(pattern: string): boolean {
  return (
    pattern.length > 0 &&
    pattern.length <= MAX_REGEX_LENGTH &&
    pattern.startsWith("^") &&
    pattern.endsWith("$") &&
    SAFE_REGEX.test(pattern) &&
    !pattern.includes("(?") &&
    !/\\[1-9]/.test(pattern)
  );
}

function compileSafeRegex(pattern: string): RegExp | null {
  if (!hasSafeRegexShape(pattern)) {
    return null;
  }

  try {
    return new RegExp(pattern);
  } catch {
    return null;
  }
}

function extractMatchGroup(match: RegExpMatchArray, groupIndex: number | null): string | null {
  if (groupIndex === null || groupIndex < 1 || groupIndex >= match.length) {
    return null;
  }

  return match[groupIndex] ?? null;
}

function decodeYearToken(token: string): number | null {
  const currentYear = new Date().getFullYear();

  if (/^\d{4}$/.test(token)) {
    const year = Number(token);
    return year >= 1900 && year <= currentYear ? year : null;
  }

  if (/^\d{2}$/.test(token)) {
    const year = 2000 + Number(token);
    return year <= currentYear ? year : null;
  }

  return null;
}

function decodeMonthToken(token: string | null, strategy: MonthStrategy | null): number | null {
  if (!token || !strategy) {
    return null;
  }

  const normalized = token.toUpperCase();

  if (strategy === "numeric") {
    if (!/^\d{1,2}$/.test(normalized)) {
      return null;
    }

    return Number(normalized);
  }

  if (strategy === "letter_a_l") {
    if (!/^[A-L]$/.test(normalized)) {
      return null;
    }

    return normalized.charCodeAt(0) - "A".charCodeAt(0) + 1;
  }

  if (strategy === "code_1_9_a_c") {
    if (/^[1-9]$/.test(normalized)) {
      return Number(normalized);
    }

    const mapped = { A: 10, B: 11, C: 12 }[normalized as "A" | "B" | "C"];
    return mapped ?? null;
  }

  return null;
}

function applyDecodedComponents(
  precision: Precision,
  yearToken: string,
  monthToken: string | null,
  dayToken: string | null,
  monthStrategy: MonthStrategy | null,
): { value: string; precision: Precision } | null {
  const year = decodeYearToken(yearToken);
  if (!year) {
    return null;
  }

  if (precision === "year") {
    const value = toYearOnlyIso(year, 1900);
    return value ? { value, precision } : null;
  }

  const month = decodeMonthToken(monthToken, monthStrategy);
  if (!month) {
    return null;
  }

  if (precision === "month") {
    const value = toYearMonthIso(year, month, 1900);
    return value ? { value, precision } : null;
  }

  if (!dayToken || !/^\d{1,2}$/.test(dayToken)) {
    return null;
  }

  const day = Number(dayToken);
  const value = toIsoDate(year, month, day);
  return value ? { value, precision } : null;
}

function buildRuleExplanation(rule: WebVerifiedManufacturedDateRule): string {
  const examples = rule.validation.representative_outputs
    .map((example) => `${example.serial_number} -> ${example.manufactured_date}`)
    .join("; ");

  return `${rule.evidence_summary} Source: ${rule.source_title} (${rule.source_url}). Validated rule matched ${rule.validation.matched_rows}/${rule.validation.total_rows_checked} rows when curated.${examples ? ` Examples: ${examples}.` : ""}`;
}

function applyWebRule(
  record: RawRecord,
  rule: WebVerifiedManufacturedDateRule,
): Resolution<string> | null {
  const normalizedSerial = normalizeSerialForRules(record.serial_number);

  if (rule.kind === "exact_serial_map") {
    const mapped = rule.serial_map[normalizedSerial];
    if (!mapped) {
      return null;
    }

    return {
      value: mapped.manufactured_date,
      source: "web_verified_manufactured_date_rule",
      confidence: rule.confidence,
      precision: mapped.precision,
      explanation: buildRuleExplanation(rule),
    };
  }

  if (rule.kind === "prefix_letter_year_map") {
    const regex = compileSafeRegex(rule.serial_regex);
    if (!regex) {
      return null;
    }

    const match = normalizedSerial.match(regex);
    if (!match) {
      return null;
    }

    const prefix = extractMatchGroup(match, rule.prefix_group)?.toUpperCase();
    if (!prefix) {
      return null;
    }

    const year = rule.year_map[prefix];
    if (!year) {
      return null;
    }

    const value = toYearOnlyIso(year, 1900);
    if (!value) {
      return null;
    }

    return {
      value,
      source: "web_verified_manufactured_date_rule",
      confidence: rule.confidence,
      precision: "year",
      explanation: buildRuleExplanation(rule),
    };
  }

  const regex = compileSafeRegex(rule.regex);
  if (!regex) {
    return null;
  }

  const match = normalizedSerial.match(regex);
  if (!match) {
    return null;
  }

  const yearToken = extractMatchGroup(match, rule.year_group);
  if (!yearToken) {
    return null;
  }

  const applied = applyDecodedComponents(
    rule.precision,
    yearToken,
    extractMatchGroup(match, rule.month_group),
    extractMatchGroup(match, rule.day_group),
    rule.month_strategy,
  );

  if (!applied) {
    return null;
  }

  return {
    value: applied.value,
    source: "web_verified_manufactured_date_rule",
    confidence: rule.confidence,
    precision: applied.precision,
    explanation: buildRuleExplanation(rule),
  };
}

export function resolveWebManufacturedDate(
  record: RawRecord,
  references?: EnrichmentReferences,
): Resolution<string> | null {
  const pairKey = normalizeForType(record.manufacturer, record.model);
  const referenceRules = Object.values(references?.webManufacturedDateRulesByKey ?? {}).filter(
    (rule): rule is WebVerifiedManufacturedDateRule => Boolean(rule),
  );
  const cachedRules = Object.values(CACHED_WEB_RULES);

  for (const rule of [...referenceRules, ...cachedRules]) {
    if (rule.pair_key !== pairKey) {
      continue;
    }

    const resolved = applyWebRule(record, rule);
    if (resolved) {
      return resolved;
    }
  }

  return null;
}
