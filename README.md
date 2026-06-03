# Equiply Hackathon: Hospital Equipment Enrichment Engine

## Overview

Equiply is a system that transforms raw hospital equipment CSV records into enriched, auditable datasets. It processes manufacturer, model, and serial number data to resolve device types and manufactured dates.

## Key Metrics

- **801 records processed** with a **78.78% manufactured-date resolution rate** (631/801)
- **19/19 automated tests passing**
- Intentional blanks for 170 rows lacking defensible public decoders

## Architecture Highlights

The system employs a **two-resolver strategy**:

1. **Device Type**: Semantic classification through reviewed catalogs and offline LLM assistance
2. **Manufactured Date**: Factual decoding using deterministic parsers, authoritative references, and curated rules — never inventing dates

Both the React UI and CLI exporter share a common TypeScript enrichment core, ensuring consistency between submission files and dashboard display. The React UI also includes a visual pipeline architecture diagram showing how each record flows through the system.

## Token Optimization

Rather than processing 801 rows individually, the system deduplicates to 55 unique manufacturer-model pairs, classifies each once, and caches results. This reduces token consumption while maintaining label consistency.

## Manufactured-Date Resolution

A five-tier approach determines date recovery:

1. **Authoritative manufacturer references** — exact record-level overrides
2. **Deterministic regex parsers** — 19 manufacturer-specific serial decoders (see below)
3. **Curated web-backed rules** — sourced from official manuals, FDA records, and authorized documentation
4. **AI-validated fallback rules** — proposed offline by LLM, code-validated before acceptance
5. **Honest blanks** — with audit reasons logged for every unresolved row

### Deterministic Parsers (Tier 2)

| Parser | Manufacturer | Precision | Format |
|--------|-------------|-----------|--------|
| `zoll` | ZOLL Medical | month | `PREFIX + YY + A–L + seq` |
| `edan` | Edan Instruments | month | Trailing `M{YY}{monthCode}` core |
| `ge_apex` | GE HEALTHCARE / APEX PRO CH | year | `RT[S9]{YY}…` |
| `ge_pdm` | GE HEALTHCARE / PDM | year | `SA3{YY}` or `SPX{YY}` |
| `jiangmen` | Jiangmen Dacheng Medical | day | `WU{YYYY}{MM}{DD}{N}EN` |
| `unico` | Unico | day | `…-{YYYYMMDD}` |
| `labcorp` | LAB CORP. | day | Leading `{YY}{MM}{DD}{letters}{digits}` |
| `hillrom_legacy` | Hillrom (legacy Century) | month | `{MM}{L}{NNN}{YYYY}` |
| `stryker` | Stryker | year | Leading 4-digit year + 9 digits |
| `linet` | LINET | month | `{YYYY}{MM}{NNNNN}` |
| `welch_filac` | Welch Allyn / FILAC3000 | year | Leading `{YY}` |
| `welch_spot_vitals` | Welch Allyn / SPOT VITAL SIGNS | year | `{YYYY}{NNNNN}` |
| `welch_suretemp` | Welch Allyn / SURETEMPPLUS | year | `{YY}{WW}{NNNN}` (year + week) |
| `hillrom_bed` | HILL ROM / Hillrom P-series | **day** | `{LETTER}{DDD}{2L}{4N}` — letter A=2010…, DDD=Julian day |
| `hospira_pluma_plus` | Hospira / PLUMA+ | year | `{YY}{WW}{NNN(N)}` |
| `american_diagnostic` | American Diagnostic / CE 1434 | **day** | `{YY}{DDD}{NNN}` or `C{YY}{DDD}{NNNN}` |
| `thermo_smartvue` | THERMO SCIENTIFIC / SMARTVUE915 | year | `{YY}{WW}{8-char suffix}` |
| `cogentix` | Cogentix Medical | year | `CS{YY}{WW}{L}` |
| `biosonic` | BIOSONIC | year | `{YY}{WW}{NNNNN}` |

Parsers in rows 14–19 are pattern-inferred from serial clustering across the full dataset and carry `confidence: medium`. All others are based on documented manufacturer formats.

## Conservative AI Use

The system employs AI as a **rule-discovery assistant only** — proposing patterns for unresolved serial-shape clusters, then validating proposals offline before acceptance. Direct row-level date generation is prohibited. In this run, the LLM proposed 2 rules across 51 unresolved groups; both failed validation and 0 were accepted.

## Output & Auditability

- `equiply_submission.csv` — five required columns
- `equiply_audit.csv` — full provenance: source, confidence, precision, and explanation for every field

Each resolution includes structured metadata: `value`, `source`, `confidence`, `precision`, and `explanation`.

## Running Locally

```bash
# Install dependencies
npm install

# Run the enrichment pipeline and write output CSVs
npm run build-submission

# Launch the interactive web UI
npm run dev

# Run all tests
npm test
```

Environment variables (copy `.env.local.example` to `.env.local`):

| Variable | Purpose |
|----------|---------|
| `OPENAI_API_KEY` | Required for `generate-device-type-draft` and `generate-manufactured-date-rules` |
| `OPENAI_DEVICE_TYPE_MODEL` | Model for device-type classification (default: `gpt-5.4-mini`) |
| `OPENAI_MANUFACTURED_DATE_MODEL` | Model for date-rule proposals (default: `gpt-5.4-mini`) |

The offline AI scripts only need to be re-run if the input dataset changes. Their outputs are committed to the repo and the enrichment pipeline runs entirely offline at serve time.
