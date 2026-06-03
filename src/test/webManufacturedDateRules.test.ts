import { describe, expect, test } from "vitest";

import { resolveManufacturedDate } from "../enrichment/resolveManufacturedDate.ts";
import type { EnrichmentReferences } from "../enrichment/types.ts";

describe("web-backed manufactured-date rules", () => {
  test("applies an exact serial mapping before the AI fallback", () => {
    const references: EnrichmentReferences = {
      webManufacturedDateRulesByKey: {
        "PHILIPS::INTELLIVUEMX40::EXACT": {
          kind: "exact_serial_map",
          rule_key: "PHILIPS::INTELLIVUEMX40::EXACT",
          pair_key: "PHILIPS::INTELLIVUEMX40",
          manufacturer: "Philips",
          model: "INTELLIVUE MX40",
          source_type: "official_lookup",
          source_title: "Example Lookup",
          source_url: "https://example.com/lookup",
          evidence_summary: "Lookup returned an exact serial-level manufacture date.",
          confidence: "high",
          serial_map: {
            "3569208": {
              manufactured_date: "2023-01-01",
              precision: "year",
            },
          },
          validation: {
            total_rows_checked: 1,
            matched_rows: 1,
            matched_ratio: 1,
            representative_outputs: [
              {
                serial_number: "3569208",
                manufactured_date: "2023-01-01",
              },
            ],
          },
        },
      },
    };

    const resolved = resolveManufacturedDate(
      {
        manufacturer: "Philips",
        model: "INTELLIVUE MX40",
        serial_number: "3569208",
      },
      references,
    );

    expect(resolved.value).toBe("2023-01-01");
    expect(resolved.source).toBe("web_verified_manufactured_date_rule");
  });

  test("applies a source-backed prefix letter year map", () => {
    // Uses Stryker (no letter-year deterministic parser) so the web rule fires unobstructed.
    const references: EnrichmentReferences = {
      webManufacturedDateRulesByKey: {
        "STRYKER::SRBED3200::FDA_RECALL": {
          kind: "prefix_letter_year_map",
          rule_key: "STRYKER::SRBED3200::FDA_RECALL",
          pair_key: "STRYKER::SRBED3200",
          manufacturer: "Stryker",
          model: "SRBED3200",
          source_type: "fda_record",
          source_title: "FDA VersaCare Recall",
          source_url: "https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfres/res.cfm?id=53251",
          evidence_summary: "FDA recall documents E/F/G/H as year codes for a specific serial family.",
          confidence: "high",
          serial_regex: "^([EFGH])\\d{3}AD\\d{4}$",
          prefix_group: 1,
          year_map: {
            E: 2003,
            F: 2004,
            G: 2005,
            H: 2006,
          },
          precision: "year",
          validation: {
            total_rows_checked: 4,
            matched_rows: 4,
            matched_ratio: 1,
            representative_outputs: [
              {
                serial_number: "G192AD4641",
                manufactured_date: "2005-01-01",
              },
            ],
          },
        },
      },
    };

    const resolved = resolveManufacturedDate(
      {
        manufacturer: "Stryker",
        model: "SRBED3200",
        serial_number: "G192AD4641",
      },
      references,
    );

    expect(resolved.value).toBe("2005-01-01");
    expect(resolved.source).toBe("web_verified_manufactured_date_rule");
  });

  test("ignores web-backed rules when the current serial family does not match", () => {
    // Uses Stryker so no deterministic parser fires; the M-prefix serial doesn't match
    // the E/F/G/H web rule regex, so the result stays unresolved.
    const references: EnrichmentReferences = {
      webManufacturedDateRulesByKey: {
        "STRYKER::SRBED3200::FDA_RECALL": {
          kind: "prefix_letter_year_map",
          rule_key: "STRYKER::SRBED3200::FDA_RECALL",
          pair_key: "STRYKER::SRBED3200",
          manufacturer: "Stryker",
          model: "SRBED3200",
          source_type: "fda_record",
          source_title: "FDA VersaCare Recall",
          source_url: "https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfres/res.cfm?id=53251",
          evidence_summary: "FDA recall documents E/F/G/H as year codes for a specific serial family.",
          confidence: "high",
          serial_regex: "^([EFGH])\\d{3}AD\\d{4}$",
          prefix_group: 1,
          year_map: {
            E: 2003,
            F: 2004,
            G: 2005,
            H: 2006,
          },
          precision: "year",
          validation: {
            total_rows_checked: 4,
            matched_rows: 4,
            matched_ratio: 1,
            representative_outputs: [],
          },
        },
      },
    };

    const resolved = resolveManufacturedDate(
      {
        manufacturer: "Stryker",
        model: "SRBED3200",
        serial_number: "M154AD1453",
      },
      references,
    );

    expect(resolved.value).toBeNull();
    expect(resolved.source).toBe("manufactured_date_unresolved");
  });
});
