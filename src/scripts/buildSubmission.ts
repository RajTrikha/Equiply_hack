import { mkdir, readFile, writeFile } from "node:fs/promises";

import manufacturedDateAiMetadata from "../enrichment/manufactured_date_ai_metadata.json";
import manufacturedDateWebMetadata from "../enrichment/manufactured_date_web_metadata.json";
import modelTypeGeneration from "../enrichment/model_type_generation.json";
import { buildAuditCsv, buildSubmissionCsv, parseEquipmentCsv } from "../enrichment/csv.ts";
import { enrichRecords, summarizeDataset, summarizeEnrichment } from "../enrichment/enrichRecords.ts";
import type {
  DeviceTypeGenerationMetadata,
  ManufacturedDateAiFallbackMetadata,
  ManufacturedDateWebResearchMetadata,
} from "../enrichment/types.ts";

async function main(): Promise<void> {
  const inputPath = "challenge_data-v1.csv";
  const outputDirectory = "output";
  const submissionPath = `${outputDirectory}/equiply_submission.csv`;
  const auditPath = `${outputDirectory}/equiply_audit.csv`;

  const csvText = await readFile(inputPath, "utf8");
  const parsed = parseEquipmentCsv(csvText);
  const datasetSummary = summarizeDataset(parsed);
  const enriched = enrichRecords(parsed.rows);
  const enrichmentSummary = summarizeEnrichment(enriched);

  await mkdir(outputDirectory, { recursive: true });
  await writeFile(submissionPath, buildSubmissionCsv(enriched), "utf8");
  await writeFile(auditPath, buildAuditCsv(enriched), "utf8");

  const resolvedPercentage = ((enrichmentSummary.resolved_manufactured_dates / enrichmentSummary.total_rows) * 100).toFixed(2);
  const unresolvedPercentage = ((enrichmentSummary.unresolved_manufactured_dates / enrichmentSummary.total_rows) * 100).toFixed(2);
  const deviceTypeGeneration = modelTypeGeneration as DeviceTypeGenerationMetadata;
  const manufacturedDateAiFallback = manufacturedDateAiMetadata as ManufacturedDateAiFallbackMetadata;
  const manufacturedDateWebResearch =
    manufacturedDateWebMetadata as ManufacturedDateWebResearchMetadata;

  console.log(JSON.stringify({
    input_path: inputPath,
    output_paths: {
      submission: submissionPath,
      audit: auditPath,
    },
    dataset_summary: datasetSummary,
    enrichment_summary: {
      ...enrichmentSummary,
      resolved_manufactured_dates_percentage: Number(resolvedPercentage),
      unresolved_manufactured_dates_percentage: Number(unresolvedPercentage),
    },
    device_type_generation: deviceTypeGeneration,
    manufactured_date_web_research: manufacturedDateWebResearch,
    manufactured_date_ai_fallback: manufacturedDateAiFallback,
  }, null, 2));
}

void main();
