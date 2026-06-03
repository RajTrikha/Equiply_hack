import { resolveAiManufacturedDate } from "./aiManufacturedDateRules.ts";
import { VALIDATED_DATE_PARSERS } from "./dateParsers.ts";
import { buildRecordKey } from "./normalize.ts";
import { resolveWebManufacturedDate } from "./webManufacturedDateRules.ts";
import type { EnrichmentReferences, RawRecord, Resolution } from "./types.ts";

export function resolveDeterministicManufacturedDate(
  record: RawRecord,
  references?: EnrichmentReferences,
): Resolution<string> {
  const authoritative = references?.manufacturedDatesByRecordKey?.[buildRecordKey(record)];
  if (authoritative) {
    return {
      ...authoritative,
      source: "authoritative_manufactured_date_reference",
    };
  }

  for (const parser of VALIDATED_DATE_PARSERS) {
    const result = parser.parse(record);
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

export function resolveManufacturedDate(
  record: RawRecord,
  references?: EnrichmentReferences,
): Resolution<string> {
  const deterministic = resolveDeterministicManufacturedDate(record, references);
  if (deterministic.value) {
    return deterministic;
  }

  const webDerived = resolveWebManufacturedDate(record, references);
  if (webDerived) {
    return webDerived;
  }

  const aiFallback = resolveAiManufacturedDate(record, references);
  if (aiFallback) {
    return aiFallback;
  }

  return deterministic;
}
