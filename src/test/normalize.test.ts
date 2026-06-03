import { describe, expect, test } from "vitest";

import { normalizeForType, normalizeInputHeader } from "../enrichment/normalize.ts";

describe("normalizeForType", () => {
  test("collapses manufacturer aliases and model whitespace", () => {
    expect(normalizeForType("HILL ROM", "R Series")).toBe("HILLROM::RSERIES");
    expect(normalizeForType("Hillrom", "RSERIES")).toBe("HILLROM::RSERIES");
  });

  test("normalizes punctuation and casing consistently", () => {
    expect(normalizeForType("BAXTER HEALTHCARE CORP.", "SPECTRUM IQ")).toBe(
      "BAXTERHEALTHCARECORP::SPECTRUMIQ",
    );
    expect(normalizeForType("Philips", "M3002A")).toBe("PHILIPS::M3002A");
    expect(normalizeForType("Jiangmen Dacheng Medical Equipment Co.", "IOB-507")).toBe(
      "JIANGMENDACHENGMEDICALEQUIPMENTCO::IOB507",
    );
  });
});

describe("normalizeInputHeader", () => {
  test("keeps serial number compatible across spacing and underscores", () => {
    expect(normalizeInputHeader("serial number")).toBe("serialnumber");
    expect(normalizeInputHeader("serial_number")).toBe("serialnumber");
  });
});
