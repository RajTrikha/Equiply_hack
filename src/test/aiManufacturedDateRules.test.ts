import { describe, expect, test } from "vitest";

import {
  applyAcceptedAiManufacturedDateRule,
  normalizeSerialForAi,
  validateAiManufacturedDateRuleProposal,
  type AiRuleValidationGroup,
} from "../enrichment/aiManufacturedDateRules.ts";

describe("AI manufactured-date rule validation", () => {
  test("accepts a safe month-precision rule that matches a meaningful portion of the group", () => {
    const group: AiRuleValidationGroup = {
      rule_key: "TESTCO::MONITORX::AA999999AAA",
      pair_key: "TESTCO::MONITORX",
      manufacturer: "TestCo",
      model: "Monitor X",
      serial_shape_signature: "AA999999AAA",
      records: [
        { manufacturer: "TestCo", model: "Monitor X", serial_number: "SN202401AAA" },
        { manufacturer: "TestCo", model: "Monitor X", serial_number: "SN202402BBB" },
        { manufacturer: "TestCo", model: "Monitor X", serial_number: "SN202403CCC" },
        { manufacturer: "TestCo", model: "Monitor X", serial_number: "LEGACY0001" },
      ],
    };

    const result = validateAiManufacturedDateRuleProposal(group, {
      rule_key: group.rule_key,
      manufacturer: "TestCo",
      model: "Monitor X",
      serial_shape_signature: group.serial_shape_signature,
      rule_found: true,
      regex: "^SN(\\d{4})(\\d{2})[A-Z]+$",
      year_group: 1,
      month_group: 2,
      day_group: null,
      month_strategy: "numeric",
      precision: "month",
      confidence: "medium",
      reason: "Serials beginning with SNYYYYMM appear date-bearing.",
    });

    expect(result.rejectionReason).toBeNull();
    expect(result.acceptedRule?.validation.matched_rows).toBe(3);
    expect(result.acceptedRule?.validation.total_rows).toBe(4);
    expect(result.acceptedRule?.validation.representative_outputs[0]?.manufactured_date).toBe("2024-01-01");
  });

  test("rejects a rule when extracted components are invalid", () => {
    const group: AiRuleValidationGroup = {
      rule_key: "TESTCO::PUMPY::AA999999",
      pair_key: "TESTCO::PUMPY",
      manufacturer: "TestCo",
      model: "Pump Y",
      serial_shape_signature: "AA999999",
      records: [
        { manufacturer: "TestCo", model: "Pump Y", serial_number: "AB241399" },
        { manufacturer: "TestCo", model: "Pump Y", serial_number: "AB241499" },
        { manufacturer: "TestCo", model: "Pump Y", serial_number: "AB241599" },
      ],
    };

    const result = validateAiManufacturedDateRuleProposal(group, {
      rule_key: group.rule_key,
      manufacturer: "TestCo",
      model: "Pump Y",
      serial_shape_signature: group.serial_shape_signature,
      rule_found: true,
      regex: "^AB(\\d{2})(\\d{2})99$",
      year_group: 1,
      month_group: 2,
      day_group: null,
      month_strategy: "numeric",
      precision: "month",
      confidence: "low",
      reason: "Possible YYMM pattern.",
    });

    expect(result.acceptedRule).toBeNull();
    expect(result.rejectionReason).toContain("invalid");
  });

  test("applies an accepted rule to a single record with normalized serial handling", () => {
    const applied = applyAcceptedAiManufacturedDateRule(
      {
        manufacturer: "Example",
        model: "Device",
        serial_number: "(21) ab202412zz",
      },
      {
        rule_key: "EXAMPLE::DEVICE::AA999999AA",
        pair_key: "EXAMPLE::DEVICE",
        manufacturer: "Example",
        model: "Device",
        serial_shape_signature: "AA999999AA",
        regex: "^AB(\\d{4})(\\d{2})[A-Z]+$",
        year_group: 1,
        month_group: 2,
        day_group: null,
        month_strategy: "numeric",
        precision: "month",
        confidence: "high",
        reason: "Normalized serial contains YYYYMM.",
        validation: {
          total_rows: 4,
          matched_rows: 3,
          matched_ratio: 0.75,
          representative_outputs: [
            {
              serial_number: "AB202412ZZ",
              manufactured_date: "2024-12-01",
            },
          ],
        },
      },
    );

    expect(normalizeSerialForAi("(21) ab202412zz")).toBe("AB202412ZZ");
    expect(applied?.value).toBe("2024-12-01");
    expect(applied?.source).toBe("ai_validated_manufactured_date_rule");
  });
});
