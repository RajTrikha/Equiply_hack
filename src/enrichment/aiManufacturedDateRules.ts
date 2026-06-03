import cachedAiRules from "./manufactured_date_ai_rules.json";
import { toIsoDate, toYearMonthIso, toYearOnlyIso } from "./dateUtils.ts";
import { normalizeForType } from "./normalize.ts";
import type {
  AcceptedAiManufacturedDateRule,
  AiManufacturedDateRuleProposal,
  EnrichmentReferences,
  Precision,
  RawRecord,
  Resolution,
} from "./types.ts";

const ACCEPTED_AI_RULES = cachedAiRules as Record<string, AcceptedAiManufacturedDateRule>;
const SAFE_REGEX = /^[A-Za-z0-9^$()[\]{}+*?.\\|\- _]+$/;
const MAX_REGEX_LENGTH = 120;
const MIN_MATCH_RATIO = 0.4;
const MIN_MATCHED_ROWS = 3;

export type AiRuleValidationGroup = {
  rule_key: string;
  pair_key: string;
  manufacturer: string;
  model: string;
  serial_shape_signature: string;
  records: RawRecord[];
};

type AppliedRuleResult = {
  value: string;
  precision: Precision;
};

export function normalizeSerialForAi(serialNumber: string): string {
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

function decodeMonthToken(
  token: string | null,
  strategy: AcceptedAiManufacturedDateRule["month_strategy"] | AiManufacturedDateRuleProposal["month_strategy"],
): number | null {
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
  monthStrategy: AcceptedAiManufacturedDateRule["month_strategy"] | AiManufacturedDateRuleProposal["month_strategy"],
): AppliedRuleResult | null {
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

function buildRuleExplanation(rule: AcceptedAiManufacturedDateRule): string {
  const examples = rule.validation.representative_outputs
    .map((example) => `${example.serial_number} -> ${example.manufactured_date}`)
    .join("; ");

  return `${rule.reason} Validated AI fallback matched ${rule.validation.matched_rows}/${rule.validation.total_rows} rows for ${rule.manufacturer} / ${rule.model}.${examples ? ` Examples: ${examples}.` : ""}`;
}

export function applyAcceptedAiManufacturedDateRule(
  record: RawRecord,
  rule: AcceptedAiManufacturedDateRule,
): Resolution<string> | null {
  const regex = compileSafeRegex(rule.regex);
  if (!regex) {
    return null;
  }

  const normalizedSerial = normalizeSerialForAi(record.serial_number);
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
    source: "ai_validated_manufactured_date_rule",
    confidence: rule.confidence,
    precision: applied.precision,
    explanation: buildRuleExplanation(rule),
  };
}

export function resolveAiManufacturedDate(
  record: RawRecord,
  references?: EnrichmentReferences,
): Resolution<string> | null {
  const pairKey = normalizeForType(record.manufacturer, record.model);
  const referenceRules = Object.values(references?.manufacturedDateRulesByKey ?? {}).filter(
    (rule): rule is AcceptedAiManufacturedDateRule => Boolean(rule),
  );
  const cachedRules = Object.values(ACCEPTED_AI_RULES);

  for (const rule of [...referenceRules, ...cachedRules]) {
    if (rule.pair_key !== pairKey) {
      continue;
    }

    const resolved = applyAcceptedAiManufacturedDateRule(record, rule);
    if (resolved) {
      return resolved;
    }
  }

  return null;
}

function validateProposalShape(proposal: AiManufacturedDateRuleProposal): string | null {
  if (!proposal.rule_found) {
    return null;
  }

  if (!proposal.regex) {
    return "rule_found=true but regex was missing";
  }

  if (proposal.year_group === null) {
    return "rule_found=true but year_group was missing";
  }

  if (!proposal.precision) {
    return "rule_found=true but precision was missing";
  }

  if (proposal.precision !== "year" && proposal.month_group === null) {
    return "month precision was required but month_group was missing";
  }

  if (proposal.precision !== "year" && proposal.month_strategy === null) {
    return "month precision was required but month_strategy was missing";
  }

  if (proposal.precision === "day" && proposal.day_group === null) {
    return "day precision was required but day_group was missing";
  }

  return null;
}

export function validateAiManufacturedDateRuleProposal(
  group: AiRuleValidationGroup,
  proposal: AiManufacturedDateRuleProposal,
): { acceptedRule: AcceptedAiManufacturedDateRule | null; rejectionReason: string | null } {
  const shapeIssue = validateProposalShape(proposal);
  if (shapeIssue) {
    return {
      acceptedRule: null,
      rejectionReason: shapeIssue,
    };
  }

  if (!proposal.rule_found || !proposal.regex || !proposal.precision || proposal.year_group === null) {
    return {
      acceptedRule: null,
      rejectionReason: null,
    };
  }

  const regex = compileSafeRegex(proposal.regex);
  if (!regex) {
    return {
      acceptedRule: null,
      rejectionReason: "regex failed safety validation",
    };
  }

  const representativeOutputs: Array<{ serial_number: string; manufactured_date: string }> = [];
  let matchedRows = 0;

  for (const record of group.records) {
    const normalizedSerial = normalizeSerialForAi(record.serial_number);
    const match = normalizedSerial.match(regex);
    if (!match) {
      continue;
    }

    const yearToken = extractMatchGroup(match, proposal.year_group);
    if (!yearToken) {
      return {
        acceptedRule: null,
        rejectionReason: `matched serial ${record.serial_number} but year_group did not extract a token`,
      };
    }

    const applied = applyDecodedComponents(
      proposal.precision,
      yearToken,
      extractMatchGroup(match, proposal.month_group),
      extractMatchGroup(match, proposal.day_group),
      proposal.month_strategy,
    );

    if (!applied) {
      return {
        acceptedRule: null,
        rejectionReason: `matched serial ${record.serial_number} but extracted date components were invalid`,
      };
    }

    matchedRows += 1;
    if (representativeOutputs.length < 3) {
      representativeOutputs.push({
        serial_number: record.serial_number,
        manufactured_date: applied.value,
      });
    }
  }

  const matchedRatio = matchedRows / group.records.length;
  if (matchedRows < MIN_MATCHED_ROWS || matchedRatio < MIN_MATCH_RATIO) {
    return {
      acceptedRule: null,
      rejectionReason: `rule matched ${matchedRows}/${group.records.length} rows, below acceptance threshold`,
    };
  }

  return {
    acceptedRule: {
      rule_key: group.rule_key,
      pair_key: group.pair_key,
      manufacturer: group.manufacturer,
      model: group.model,
      serial_shape_signature: group.serial_shape_signature,
      regex: proposal.regex,
      year_group: proposal.year_group,
      month_group: proposal.month_group,
      day_group: proposal.day_group,
      month_strategy: proposal.month_strategy,
      precision: proposal.precision,
      confidence: proposal.confidence,
      reason: proposal.reason,
      validation: {
        total_rows: group.records.length,
        matched_rows: matchedRows,
        matched_ratio: Number(matchedRatio.toFixed(4)),
        representative_outputs: representativeOutputs,
      },
    },
    rejectionReason: null,
  };
}
