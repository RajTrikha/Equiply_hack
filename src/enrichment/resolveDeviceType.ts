import modelTypeMap from "./model_type_map.json";
import modelTypeGeneration from "./model_type_generation.json";
import { DEVICE_TYPES, type DeviceType, type DeviceTypeMapEntry } from "./deviceTypes.ts";
import { normalizeForType } from "./normalize.ts";
import type {
  DeviceTypeGenerationMetadata,
  EnrichmentReferences,
  RawRecord,
  Resolution,
} from "./types.ts";

function isKnownDeviceType(value: string): value is DeviceType {
  return (DEVICE_TYPES as readonly string[]).includes(value);
}

function getEntry(
  pairKey: string,
  references?: EnrichmentReferences,
): DeviceTypeMapEntry | null {
  const referenced = references?.deviceTypesByPairKey?.[pairKey];
  if (referenced && isKnownDeviceType(referenced.device_type)) {
    return {
      device_type: referenced.device_type,
      confidence: referenced.confidence,
      rationale: referenced.rationale,
    };
  }

  const mapped = (modelTypeMap as Record<string, DeviceTypeMapEntry>)[pairKey];
  return mapped ?? null;
}

const generationMetadata = modelTypeGeneration as DeviceTypeGenerationMetadata;

export function resolveDeviceType(
  record: RawRecord,
  references?: EnrichmentReferences,
): Resolution<string> {
  const pairKey = normalizeForType(record.manufacturer, record.model);
  const authoritative = references?.deviceTypesByPairKey?.[pairKey];

  if (authoritative && isKnownDeviceType(authoritative.device_type)) {
    return {
      value: authoritative.device_type,
      source: "authoritative_device_type_reference",
      confidence: authoritative.confidence,
      explanation: authoritative.rationale,
    };
  }

  const entry = getEntry(pairKey, references);
  if (!entry) {
    return {
      value: "Unknown",
      source: "device_type_unresolved",
      confidence: "low",
      explanation: `No reviewed device-type mapping exists for ${pairKey}.`,
    };
  }

  return {
    value: entry.device_type,
    source: generationMetadata.generated
      ? "openai_generated_model_type_map"
      : "static_model_type_map",
    confidence: entry.confidence,
    explanation: entry.rationale,
  };
}
