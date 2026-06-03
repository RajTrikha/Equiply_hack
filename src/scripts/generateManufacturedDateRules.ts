import { readFile, stat, writeFile } from "node:fs/promises";

import {
  normalizeSerialForAi,
  validateAiManufacturedDateRuleProposal,
  type AiRuleValidationGroup,
} from "../enrichment/aiManufacturedDateRules.ts";
import existingAiRules from "../enrichment/manufactured_date_ai_rules.json";
import { parseEquipmentCsv } from "../enrichment/csv.ts";
import { normalizeForType } from "../enrichment/normalize.ts";
import { resolveDeterministicManufacturedDate } from "../enrichment/resolveManufacturedDate.ts";
import type {
  AcceptedAiManufacturedDateRule,
  AiManufacturedDateRuleProposal,
  Confidence,
  DeviceTypeGenerationUsage,
  ManufacturedDateAiFallbackMetadata,
  Precision,
  RawRecord,
} from "../enrichment/types.ts";

type SampledGroup = AiRuleValidationGroup & {
  sample_serials: string[];
};

type ProposalEnvelope = {
  proposals: AiManufacturedDateRuleProposal[];
};

type ResponsesUsage = {
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
  input_tokens_details?: {
    cached_tokens?: number;
  };
  output_tokens_details?: {
    reasoning_tokens?: number;
  };
};

type ResponsesApiResponse = {
  model?: string;
  output_text?: string;
  output?: Array<{
    type?: string;
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
  usage?: ResponsesUsage;
};

const AI_RULES_PATH = "src/enrichment/manufactured_date_ai_rules.json";
const AI_METADATA_PATH = "src/enrichment/manufactured_date_ai_metadata.json";
const DEFAULT_MODEL = process.env.OPENAI_MANUFACTURED_DATE_MODEL?.trim() || "gpt-5.4-mini";
const MAX_GROUP_SAMPLES = 6;
const GROUP_BATCH_SIZE = 10;

async function fileExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function loadLocalEnv(): Promise<void> {
  const candidates = [".env.local", ".env"];

  for (const candidate of candidates) {
    if (!(await fileExists(candidate))) {
      continue;
    }

    const contents = await readFile(candidate, "utf8");
    for (const line of contents.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }

      const separator = trimmed.indexOf("=");
      if (separator <= 0) {
        continue;
      }

      const key = trimmed.slice(0, separator).trim();
      let value = trimmed.slice(separator + 1).trim();

      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      if (!(key in process.env)) {
        process.env[key] = value;
      }
    }
  }
}

function toShapeSignature(serialNumber: string): string {
  return normalizeSerialForAi(serialNumber)
    .replace(/[A-Z]/g, "A")
    .replace(/\d/g, "9");
}

function toRuleKey(pairKey: string, shapeSignature: string): string {
  return `${pairKey}::${shapeSignature}`;
}

function pickRepresentativeSamples(records: RawRecord[]): string[] {
  const byShape = new Map<string, string[]>();

  for (const record of records) {
    const serial = normalizeSerialForAi(record.serial_number);
    const shape = toShapeSignature(serial);
    const existing = byShape.get(shape) ?? [];
    existing.push(serial);
    byShape.set(shape, existing);
  }

  const samples: string[] = [];
  for (const [, serials] of [...byShape.entries()].sort((left, right) => right[1].length - left[1].length)) {
    samples.push(...serials.slice().sort((left, right) => left.localeCompare(right)).slice(0, 2));
    if (samples.length >= MAX_GROUP_SAMPLES) {
      break;
    }
  }

  return [...new Set(samples)].slice(0, MAX_GROUP_SAMPLES);
}

function buildPromptPayload(groups: SampledGroup[]) {
  return {
    task:
      "Inspect grouped unresolved medical-equipment serial numbers and propose deterministic date-decoding rules only when a stable pattern is visible.",
    requirements: [
      "Do not emit per-row manufactured dates.",
      "Return rule_found=false when no reliable deterministic pattern is visible.",
      "Propose anchored regex rules against normalized serials (trimmed, uppercased, GS1 wrapper removed).",
      "You may only use month_strategy values from the allowed list: numeric, letter_a_l, code_1_9_a_c.",
      "If a pattern would require a custom letter-to-year map or any other non-standard lookup, return rule_found=false.",
      "Use month precision when only year and month are visible, day precision when year/month/day are visible, and year precision only when the year is clearly encoded.",
      "Echo manufacturer and model exactly as provided.",
      "If a stable leading two-digit or four-digit year token is visible across the representative samples, you may propose a year-precision rule even when month and day are unavailable.",
      "If the cluster mixes multiple incompatible patterns, return rule_found=false rather than overgeneralizing.",
      "Treat each rule_key as an independent cluster, even if the same manufacturer and model appear in another cluster.",
    ],
    allowed_rule_examples: [
      {
        rule_key: "EXAMPLE::SHAPE1",
        manufacturer: "Example",
        model: "Device",
        serial_shape_signature: "999999999",
        rule_found: true,
        regex: "^(20\\d{2})\\d+$",
        year_group: 1,
        month_group: null,
        day_group: null,
        month_strategy: null,
        precision: "year",
        confidence: "medium",
        reason: "The cluster shares a stable leading four-digit year token.",
      },
      {
        rule_key: "EXAMPLE::SHAPE2",
        manufacturer: "Example",
        model: "Device",
        serial_shape_signature: "AA99999999",
        rule_found: true,
        regex: "^[A-Z]{2}(\\d{4})(\\d{2})\\d+$",
        year_group: 1,
        month_group: 2,
        day_group: null,
        month_strategy: "numeric",
        precision: "month",
        confidence: "high",
        reason: "The cluster shares a stable YYYYMM token after a fixed prefix.",
      },
      {
        rule_key: "EXAMPLE::SHAPE3",
        manufacturer: "Example",
        model: "Device",
        serial_shape_signature: "AA99A9999",
        rule_found: true,
        regex: "^[A-Z]{2}(\\d{2})([A-L])\\d+$",
        year_group: 1,
        month_group: 2,
        day_group: null,
        month_strategy: "letter_a_l",
        precision: "month",
        confidence: "high",
        reason: "The cluster shares a stable YY + month-letter pattern.",
      },
    ],
    groups: groups.map((group) => ({
      rule_key: group.rule_key,
      manufacturer: group.manufacturer,
      model: group.model,
      serial_shape_signature: group.serial_shape_signature,
      unresolved_row_count: group.records.length,
      sample_serials: group.sample_serials,
    })),
  };
}

function buildResponseSchema(groups: SampledGroup[]) {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      proposals: {
        type: "array",
        minItems: groups.length,
        maxItems: groups.length,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            rule_key: {
              type: "string",
              enum: groups.map((group) => group.rule_key),
            },
            manufacturer: {
              type: "string",
              enum: groups.map((group) => group.manufacturer),
            },
            model: {
              type: "string",
              enum: groups.map((group) => group.model),
            },
            serial_shape_signature: {
              type: "string",
              enum: groups.map((group) => group.serial_shape_signature),
            },
            rule_found: {
              type: "boolean",
            },
            regex: {
              type: ["string", "null"],
            },
            year_group: {
              type: ["integer", "null"],
            },
            month_group: {
              type: ["integer", "null"],
            },
            day_group: {
              type: ["integer", "null"],
            },
            month_strategy: {
              type: ["string", "null"],
              enum: ["numeric", "letter_a_l", "code_1_9_a_c", null],
            },
            precision: {
              type: ["string", "null"],
              enum: ["day", "month", "year", null],
            },
            confidence: {
              type: "string",
              enum: ["high", "medium", "low"],
            },
            reason: {
              type: "string",
            },
          },
          required: [
            "rule_key",
            "manufacturer",
            "model",
            "serial_shape_signature",
            "rule_found",
            "regex",
            "year_group",
            "month_group",
            "day_group",
            "month_strategy",
            "precision",
            "confidence",
            "reason",
          ],
        },
      },
    },
    required: ["proposals"],
  };
}

function extractOutputText(response: ResponsesApiResponse): string {
  if (typeof response.output_text === "string" && response.output_text.trim()) {
    return response.output_text;
  }

  const fragments: string[] = [];
  for (const item of response.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.type === "output_text" && content.text) {
        fragments.push(content.text);
      }
    }
  }

  const joined = fragments.join("").trim();
  if (!joined) {
    throw new Error("OpenAI response did not contain structured output text.");
  }

  return joined;
}

function normalizeUsage(usage?: ResponsesUsage): DeviceTypeGenerationUsage | null {
  if (!usage) {
    return null;
  }

  return {
    input_tokens: usage.input_tokens ?? 0,
    output_tokens: usage.output_tokens ?? 0,
    total_tokens: usage.total_tokens ?? 0,
    cached_input_tokens: usage.input_tokens_details?.cached_tokens ?? 0,
    reasoning_tokens: usage.output_tokens_details?.reasoning_tokens ?? 0,
  };
}

function sumUsage(
  left: DeviceTypeGenerationUsage | null,
  right: DeviceTypeGenerationUsage | null,
): DeviceTypeGenerationUsage | null {
  if (!left && !right) {
    return null;
  }

  return {
    input_tokens: (left?.input_tokens ?? 0) + (right?.input_tokens ?? 0),
    output_tokens: (left?.output_tokens ?? 0) + (right?.output_tokens ?? 0),
    total_tokens: (left?.total_tokens ?? 0) + (right?.total_tokens ?? 0),
    cached_input_tokens: (left?.cached_input_tokens ?? 0) + (right?.cached_input_tokens ?? 0),
    reasoning_tokens: (left?.reasoning_tokens ?? 0) + (right?.reasoning_tokens ?? 0),
  };
}

function parseProposalEnvelope(text: string): ProposalEnvelope {
  const parsed = JSON.parse(text) as ProposalEnvelope;
  if (!parsed || !Array.isArray(parsed.proposals)) {
    throw new Error("OpenAI response JSON did not include a proposals array.");
  }

  return parsed;
}

function toGroupKey(manufacturer: string, model: string): string {
  return normalizeForType(manufacturer, model);
}

function chunkGroups(groups: SampledGroup[]): SampledGroup[][] {
  const chunks: SampledGroup[][] = [];

  for (let index = 0; index < groups.length; index += GROUP_BATCH_SIZE) {
    chunks.push(groups.slice(index, index + GROUP_BATCH_SIZE));
  }

  return chunks;
}

async function fetchProposalBatch(
  groups: SampledGroup[],
  apiKey: string,
  model: string,
): Promise<{
  model: string | null;
  usage: DeviceTypeGenerationUsage | null;
  proposals: AiManufacturedDateRuleProposal[];
}> {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      instructions:
        "You analyze groups of unresolved equipment serial numbers and propose deterministic date-decoding rules. You must return Unknown-style proposals with rule_found=false whenever a reliable date-bearing pattern is not visible. Never invent a rule to increase coverage.",
      input: JSON.stringify(buildPromptPayload(groups), null, 2),
      temperature: 0,
      prompt_cache_key: "equiply-manufactured-date-rule-proposals-v2",
      prompt_cache_retention: "24h",
      text: {
        format: {
          type: "json_schema",
          name: "equiply_manufactured_date_rule_proposals",
          strict: true,
          schema: buildResponseSchema(groups),
        },
      },
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI request failed with status ${response.status}: ${body}`);
  }

  const data = (await response.json()) as ResponsesApiResponse;
  const outputText = extractOutputText(data);
  const envelope = parseProposalEnvelope(outputText);

  if (envelope.proposals.length !== groups.length) {
    throw new Error(`Expected ${groups.length} proposals but received ${envelope.proposals.length}.`);
  }

  return {
    model: data.model ?? model,
    usage: normalizeUsage(data.usage),
    proposals: envelope.proposals,
  };
}

function buildGroups(
  rows: RawRecord[],
  existingRules: Record<string, AcceptedAiManufacturedDateRule>,
): SampledGroup[] {
  const grouped = new Map<string, AiRuleValidationGroup>();

  for (const row of rows) {
    const deterministic = resolveDeterministicManufacturedDate(row);
    if (deterministic.value) {
      continue;
    }

    const pairKey = toGroupKey(row.manufacturer, row.model);
    const serialShapeSignature = toShapeSignature(row.serial_number);
    const ruleKey = toRuleKey(pairKey, serialShapeSignature);
    if (existingRules[ruleKey]) {
      continue;
    }

    const group = grouped.get(ruleKey) ?? {
      rule_key: ruleKey,
      pair_key: pairKey,
      manufacturer: row.manufacturer,
      model: row.model,
      serial_shape_signature: serialShapeSignature,
      records: [],
    };

    group.records.push(row);
    grouped.set(ruleKey, group);
  }

  return [...grouped.values()]
    .map((group) => ({
      ...group,
      sample_serials: pickRepresentativeSamples(group.records),
    }))
    .sort((left, right) => right.records.length - left.records.length);
}

async function main(): Promise<void> {
  await loadLocalEnv();

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("Set OPENAI_API_KEY in .env.local or your shell before generating AI manufactured-date rules.");
  }

  const csvText = await readFile("challenge_data-v1.csv", "utf8");
  const parsed = parseEquipmentCsv(csvText);
  const existingRules = existingAiRules as Record<string, AcceptedAiManufacturedDateRule>;
  const groups = buildGroups(parsed.rows, existingRules);

  const deterministicBaselineResolvedCount = parsed.rows.length - groups.reduce((sum, group) => sum + group.records.length, 0);
  const deterministicBaselineUnresolvedCount = groups.reduce((sum, group) => sum + group.records.length, 0);

  if (groups.length === 0) {
    const metadata: ManufacturedDateAiFallbackMetadata = {
      generated: true,
      generated_at: new Date().toISOString(),
      model: null,
      deterministic_baseline_resolved_count: deterministicBaselineResolvedCount,
      deterministic_baseline_unresolved_count: deterministicBaselineUnresolvedCount,
      unresolved_groups_sent_to_ai: 0,
      llm_calls: 0,
      usage: null,
      ai_proposed_rules: 0,
      accepted_rules: 0,
      rejected_rules: 0,
      additional_rows_resolved_after_validation: 0,
      final_unresolved_count: deterministicBaselineUnresolvedCount,
      accepted_rule_keys: Object.keys(existingRules).sort((left, right) => left.localeCompare(right)),
      rejected_rule_summaries: [],
      notes: "No unresolved groups remained after applying deterministic parsers and previously accepted AI rules.",
    };

    await writeFile(`${AI_METADATA_PATH}`, `${JSON.stringify(metadata, null, 2)}\n`, "utf8");
    console.log(JSON.stringify(metadata, null, 2));
    return;
  }

  const model = process.env.OPENAI_MANUFACTURED_DATE_MODEL?.trim() || DEFAULT_MODEL;
  const groupsByKey = new Map(groups.map((group) => [group.rule_key, group]));
  const acceptedRules = new Map<string, AcceptedAiManufacturedDateRule>();
  const rejectedRuleSummaries: Array<{ pair_key: string; reason: string }> = [];
  let aiProposedRules = 0;
  let accumulatedUsage: DeviceTypeGenerationUsage | null = null;
  let responseModel: string | null = null;
  let llmCalls = 0;

  for (const batch of chunkGroups(groups)) {
    const batchResult = await fetchProposalBatch(batch, apiKey, model);
    responseModel = batchResult.model ?? responseModel;
    accumulatedUsage = sumUsage(accumulatedUsage, batchResult.usage);
    llmCalls += 1;

    for (const proposal of batchResult.proposals) {
      const group = groupsByKey.get(proposal.rule_key);

      if (!group) {
        throw new Error(`OpenAI returned a proposal for an unexpected group key: ${proposal.rule_key}`);
      }

      if (proposal.rule_found) {
        aiProposedRules += 1;
      }

      const { acceptedRule, rejectionReason } = validateAiManufacturedDateRuleProposal(group, proposal);
      if (acceptedRule) {
        acceptedRules.set(group.rule_key, acceptedRule);
        continue;
      }

      if (rejectionReason) {
        rejectedRuleSummaries.push({
          pair_key: group.rule_key,
          reason: rejectionReason,
        });
      }
    }
  }

  const mergedRules = {
    ...existingRules,
    ...Object.fromEntries([...acceptedRules.entries()].sort((left, right) => left[0].localeCompare(right[0]))),
  };

  const additionalRowsResolvedAfterValidation = [...acceptedRules.values()].reduce(
    (sum, rule) => sum + rule.validation.matched_rows,
    0,
  );

  const metadata: ManufacturedDateAiFallbackMetadata = {
    generated: true,
    generated_at: new Date().toISOString(),
    model: responseModel ?? model,
    deterministic_baseline_resolved_count: deterministicBaselineResolvedCount,
    deterministic_baseline_unresolved_count: deterministicBaselineUnresolvedCount,
    unresolved_groups_sent_to_ai: groups.length,
    llm_calls: llmCalls,
    usage: accumulatedUsage,
    ai_proposed_rules: aiProposedRules,
    accepted_rules: acceptedRules.size,
    rejected_rules: rejectedRuleSummaries.length,
    additional_rows_resolved_after_validation: additionalRowsResolvedAfterValidation,
    final_unresolved_count: Math.max(
      deterministicBaselineUnresolvedCount - additionalRowsResolvedAfterValidation,
      0,
    ),
    accepted_rule_keys: [...acceptedRules.keys()].sort((left, right) => left.localeCompare(right)),
    rejected_rule_summaries: rejectedRuleSummaries.sort((left, right) => left.pair_key.localeCompare(right.pair_key)),
    notes:
      "Only validated AI-proposed rules are cached. The runtime never calls the API and unresolved rows remain blank when no accepted rule exists.",
  };

  await writeFile(`${AI_RULES_PATH}`, `${JSON.stringify(mergedRules, null, 2)}\n`, "utf8");
  await writeFile(`${AI_METADATA_PATH}`, `${JSON.stringify(metadata, null, 2)}\n`, "utf8");

  console.log(
    JSON.stringify(
      {
        output_paths: {
          accepted_rules: AI_RULES_PATH,
          metadata: AI_METADATA_PATH,
        },
        ...metadata,
      },
      null,
      2,
    ),
  );
}

void main();
