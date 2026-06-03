import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

import { buildAuditCsv, buildSubmissionCsv, parseEquipmentCsv } from "../enrichment/csv.ts";
import { enrichRecords, summarizeDataset, summarizeEnrichment } from "../enrichment/enrichRecords.ts";

async function loadChallengeData() {
  const csvText = await readFile(resolve(process.cwd(), "challenge_data-v1.csv"), "utf8");
  const parsed = parseEquipmentCsv(csvText);
  const enriched = enrichRecords(parsed.rows);
  return { csvText, parsed, enriched };
}

describe("CSV behavior", () => {
  test("preserves row count, duplicate rows, and exact submission headers", async () => {
    const { parsed, enriched } = await loadChallengeData();
    const submissionCsv = buildSubmissionCsv(enriched);

    expect(parsed.headers.join(",")).toBe("manufacturer,model,serial number");
    expect(submissionCsv.split("\n")[0]).toBe(
      "manufacturer,model,serial number,manufactured_date,device_type",
    );
    expect(enriched).toHaveLength(801);
    expect(parsed.rows).toHaveLength(801);
    expect(enriched.filter((row) => row.serial_number === "M19413130058")).toHaveLength(2);
  });

  test("sorts ascending by manufactured_date with blanks last and stays stable across runs", async () => {
    const { parsed, enriched } = await loadChallengeData();
    const dates = enriched.map((record) => record.manufactured_date);
    let seenBlank = false;

    for (let index = 0; index < dates.length; index += 1) {
      const current = dates[index];
      if (!current) {
        seenBlank = true;
        continue;
      }

      expect(seenBlank).toBe(false);
      if (index > 0 && dates[index - 1]) {
        expect(dates[index - 1] <= current).toBe(true);
      }
    }

    expect(buildSubmissionCsv(enriched)).toBe(buildSubmissionCsv(enrichRecords(parsed.rows)));
  });

  test("produces the expected dataset and enrichment summaries", async () => {
    const { parsed, enriched } = await loadChallengeData();
    const datasetSummary = summarizeDataset(parsed);
    const enrichmentSummary = summarizeEnrichment(enriched);
    const auditCsv = buildAuditCsv(enriched);

    expect(datasetSummary.total_rows).toBe(801);
    expect(datasetSummary.unique_serial_numbers).toBe(800);
    expect(parsed.rows.filter((row) => row.serial_number === "M19413130058")).toHaveLength(2);
    expect(enrichmentSummary.mapped_device_types).toBe(801);
    expect(enrichmentSummary.unknown_device_types).toBe(0);
    expect(enrichmentSummary.resolved_manufactured_dates).toBe(631);
    expect(enrichmentSummary.unresolved_manufactured_dates).toBe(170);
    expect(enrichmentSummary.resolved_manufactured_dates / enrichmentSummary.total_rows).toBeGreaterThan(0.75);
    expect(enrichmentSummary.resolved_manufactured_dates / enrichmentSummary.total_rows).toBeLessThan(0.85);
    expect(auditCsv.split("\n")[0]).toContain("manufactured_date_source");
    expect(auditCsv.trimEnd().split("\n")).toHaveLength(802);
  });
});
