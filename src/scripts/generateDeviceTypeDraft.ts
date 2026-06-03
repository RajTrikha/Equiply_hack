import { readFile, stat, writeFile } from "node:fs/promises";

import {
  DEVICE_TYPES,
  MANUAL_REVIEW_PAIRS,
  type DeviceType,
  type DeviceTypeMapEntry,
} from "../enrichment/deviceTypes.ts";
import { parseEquipmentCsv } from "../enrichment/csv.ts";
import { normalizeForType } from "../enrichment/normalize.ts";
import type {
  Confidence,
  DeviceTypeGenerationMetadata,
  DeviceTypeGenerationUsage,
} from "../enrichment/types.ts";

type DraftPair = {
  key: string;
  manufacturer: string;
  model: string;
};

type StructuredClassification = {
  key: string;
  device_type: DeviceType;
  confidence: Confidence;
  rationale: string;
};

type StructuredResponse = {
  classifications: StructuredClassification[];
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

const MODEL_TYPE_MAP_PATH = "src/enrichment/model_type_map.json";
const MODEL_TYPE_GENERATION_PATH = "src/enrichment/model_type_generation.json";
const DEFAULT_MODEL = process.env.OPENAI_DEVICE_TYPE_MODEL?.trim() || "gpt-5.4-mini";

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

function buildPromptPayload(pairs: DraftPair[]) {
  return {
    task:
      "Classify each normalized manufacturer-model pair into exactly one device_type from the allowed vocabulary.",
    requirements: [
      "Return Unknown with low confidence rather than guessing.",
      "Do not invent new vocabulary terms.",
      "Use the provided normalized key exactly as given.",
      "Base the rationale on the product family implied by manufacturer and model.",
    ],
    vocabulary: DEVICE_TYPES,
    manual_review_pairs: MANUAL_REVIEW_PAIRS,
    pairs,
  };
}

function buildResponseSchema(pairs: DraftPair[]) {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      classifications: {
        type: "array",
        minItems: pairs.length,
        maxItems: pairs.length,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            key: {
              type: "string",
              enum: pairs.map((pair) => pair.key),
            },
            device_type: {
              type: "string",
              enum: [...DEVICE_TYPES],
            },
            confidence: {
              type: "string",
              enum: ["high", "medium", "low"],
            },
            rationale: {
              type: "string",
            },
          },
          required: ["key", "device_type", "confidence", "rationale"],
        },
      },
    },
    required: ["classifications"],
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

function parseStructuredResponse(text: string): StructuredResponse {
  const parsed = JSON.parse(text) as StructuredResponse;

  if (!parsed || !Array.isArray(parsed.classifications)) {
    throw new Error("OpenAI response JSON did not include a classifications array.");
  }

  return parsed;
}

function validateClassifications(
  pairs: DraftPair[],
  classifications: StructuredClassification[],
): void {
  if (classifications.length !== pairs.length) {
    throw new Error(
      `Expected ${pairs.length} classifications but received ${classifications.length}.`,
    );
  }

  const expectedKeys = new Set(pairs.map((pair) => pair.key));
  const seenKeys = new Set<string>();

  for (const classification of classifications) {
    if (!expectedKeys.has(classification.key)) {
      throw new Error(`Unexpected pair key returned by OpenAI: ${classification.key}`);
    }

    if (seenKeys.has(classification.key)) {
      throw new Error(`Duplicate pair key returned by OpenAI: ${classification.key}`);
    }

    seenKeys.add(classification.key);
  }

  const missing = pairs
    .map((pair) => pair.key)
    .filter((key) => !seenKeys.has(key));

  if (missing.length > 0) {
    throw new Error(`OpenAI response omitted ${missing.length} pair keys: ${missing.join(", ")}`);
  }
}

function buildModelTypeMap(
  classifications: StructuredClassification[],
): Record<string, DeviceTypeMapEntry> {
  return Object.fromEntries(
    classifications
      .slice()
      .sort((left, right) => left.key.localeCompare(right.key))
      .map((classification) => [
        classification.key,
        {
          device_type: classification.device_type,
          confidence: classification.confidence,
          rationale: classification.rationale.trim(),
        },
      ]),
  );
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

async function main(): Promise<void> {
  await loadLocalEnv();

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("Set OPENAI_API_KEY in .env.local or your shell before generating the device-type cache.");
  }

  const csvText = await readFile("challenge_data-v1.csv", "utf8");
  const parsed = parseEquipmentCsv(csvText);

  const deduped = new Map<string, DraftPair>();
  for (const row of parsed.rows) {
    const key = normalizeForType(row.manufacturer, row.model);
    if (!deduped.has(key)) {
      deduped.set(key, {
        key,
        manufacturer: row.manufacturer,
        model: row.model,
      });
    }
  }

  const pairs = [...deduped.values()].sort((left, right) => left.key.localeCompare(right.key));
  const promptPayload = buildPromptPayload(pairs);
  const model = process.env.OPENAI_DEVICE_TYPE_MODEL?.trim() || DEFAULT_MODEL;

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      instructions:
        "You classify hospital equipment manufacturer-model pairs into a fixed device_type vocabulary. Return exactly one classification per input pair. If evidence is weak, return Unknown with low confidence instead of guessing.",
      input: JSON.stringify(promptPayload, null, 2),
      temperature: 0,
      prompt_cache_key: "equiply-device-type-catalog-v1",
      prompt_cache_retention: "24h",
      text: {
        format: {
          type: "json_schema",
          name: "equiply_device_type_catalog",
          strict: true,
          schema: buildResponseSchema(pairs),
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
  const structured = parseStructuredResponse(outputText);
  validateClassifications(pairs, structured.classifications);

  const modelTypeMap = buildModelTypeMap(structured.classifications);
  const metadata: DeviceTypeGenerationMetadata = {
    generated: true,
    generated_at: new Date().toISOString(),
    model: data.model ?? model,
    raw_pairs_observed: new Set(parsed.rows.map((row) => `${row.manufacturer}::${row.model}`)).size,
    normalized_pairs_classified: pairs.length,
    api_calls_made: 1,
    runtime_api_calls: 0,
    usage: normalizeUsage(data.usage),
    manual_review_pairs: [...MANUAL_REVIEW_PAIRS],
    notes:
      "Generated via one batched OpenAI Responses API call over normalized manufacturer-model pairs. Review flagged pairs before final submission.",
  };

  await writeFile(`${MODEL_TYPE_MAP_PATH}`, `${JSON.stringify(modelTypeMap, null, 2)}\n`, "utf8");
  await writeFile(
    `${MODEL_TYPE_GENERATION_PATH}`,
    `${JSON.stringify(metadata, null, 2)}\n`,
    "utf8",
  );

  console.log(
    JSON.stringify(
      {
        output_paths: {
          model_type_map: MODEL_TYPE_MAP_PATH,
          generation_metadata: MODEL_TYPE_GENERATION_PATH,
        },
        generated_at: metadata.generated_at,
        model: metadata.model,
        raw_pairs_observed: metadata.raw_pairs_observed,
        normalized_pairs_classified: metadata.normalized_pairs_classified,
        api_calls_made: metadata.api_calls_made,
        runtime_api_calls: metadata.runtime_api_calls,
        usage: metadata.usage,
        manual_review_pairs: metadata.manual_review_pairs,
      },
      null,
      2,
    ),
  );
}

void main();
