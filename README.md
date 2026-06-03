Equiply Hackathon — Hospital Equipment Enrichment Engine

A hospital-equipment enrichment system that converts raw inventory records into a cleaner, auditable dataset.

The input CSV contains:

manufacturer, model, serial number

The system enriches each row with:

manufactured_date, device_type

It then sorts the records by manufacturing date, displays the results in a React dashboard, and exports both a submission-ready CSV and a detailed audit file.

⸻

Demo Results

Metric	Value
Total records processed	801
Device types resolved	801
Manufactured dates resolved	466
Manufactured dates intentionally left unresolved	335
Date coverage	58.18%
Automated tests passed	19 / 19

The unresolved manufactured dates are intentional. These rows represent serial-number formats where no defensible public decoder, authoritative mapping, or validated rule was available.

⸻

Architecture Overview

flowchart TB
    A((Hospital Equipment CSV))
    A --> B[Parse and Normalize]
    B --> C[Shared TypeScript Enrichment Core]
    C --> D[Device Type Resolver]
    C --> E[Manufactured Date Resolver]
    D --> D1[Reviewed Catalog Lookup]
    D1 --> D2[Offline LLM Classification<br/>for unseen manufacturer-model pairs]
    D2 --> D3[Validated and Cached Device Type]
    E --> E1[Authoritative References]
    E1 --> E2[Deterministic Serial Parsers]
    E2 --> E3[Curated Web-Verified Rules]
    E3 --> E4[Offline AI Rule Discovery]
    E4 --> E5[Code-Side Validation]
    E5 --> E6[Resolved Date or Honest Blank]
    D3 --> F[Merge Enriched Fields]
    E6 --> F
    F --> G[Sort by manufactured date<br/>unresolved values last]
    G --> H[React Dashboard]
    G --> I[CLI Exporter]
    H --> H1[Upload CSV]
    H --> H2[Summary Cards]
    H --> H3[Sorted Table]
    H --> H4[Device-Type Pie Chart]
    H --> H5[Download Enriched CSV]
    I --> I1[equiply_submission.csv]
    I --> I2[equiply_audit.csv]
    I2 -. improves governed catalog .-> C

⸻

Why the Problem Is Split Into Two Resolvers

The two enrichment fields require different strategies.

device_type

This is a semantic classification problem.

A manufacturer-model pair such as:

Philips + SureSigns VS4

can be categorized as:

Patient Monitor

The system resolves device types through a reviewed catalog generated with an offline LLM-assisted workflow.

manufactured_date

This is a factual decoding problem.

Some serial numbers contain recoverable date patterns:

X19G176549

For a supported ZOLL serial format:

19 → 2019
G  → July

The result becomes:

2019-07-01

The system never asks an LLM to invent a date for an individual row. Dates are populated only when they come from authoritative mappings or validated deterministic rules.

⸻

Two Entry Points, One Shared Core

flowchart LR
    A[React Web UI<br/>src/app/App.tsx]
    B[Shared TypeScript Library<br/>src/enrichment/]
    C[CLI Exporter<br/>src/scripts/buildSubmission.ts]
    A --> B
    C --> B
    A --> A1[Upload CSV]
    A --> A2[Table and Pie Chart]
    A --> A3[Download CSV]
    C --> C1[equiply_submission.csv]
    C --> C2[equiply_audit.csv]
    C --> C3[Validation Summary]

The React app and CLI exporter import the same enrichment code.

This ensures that:

* the UI and submission CSV stay consistent;
* parser logic is implemented once;
* tests validate the same runtime behavior used in production.

⸻

Enrichment Pipeline

Raw CSV Row
   ↓
Normalize manufacturer and model
   ↓
Resolve device_type
   ↓
Resolve manufactured_date
   ↓
Attach provenance, confidence, and precision metadata
   ↓
Sort by manufactured_date
   ↓
Place unresolved dates last
   ↓
Export submission CSV and audit CSV

⸻

Device-Type Resolution

The device-type resolver uses a normalized catalog key:

normalizeForType(manufacturer, model)

Example:

ZOLL Medical + AED 3
   ↓
ZOLLMEDICAL::AED3

Resolution order:

1. Runtime authoritative override
2. Reviewed model_type_map.json lookup
3. Unknown fallback

Token Optimization

The system treats device classification as a catalog problem rather than a row-by-row inference problem.

Instead of sending all 801 rows to the LLM:

801 records
   ↓
normalize and deduplicate
   ↓
55 unique manufacturer-model pairs
   ↓
classify each unique pair once
   ↓
cache and reuse results

This minimizes token usage and keeps category labels consistent.

⸻

Manufactured-Date Resolution

Manufacturing dates are resolved through multiple layers.

flowchart TD
    A[Raw Serial Number]
    A --> B{Authoritative mapping available?}
    B -->|Yes| C[Use exact reference value]
    B -->|No| D[Run deterministic parsers]
    D --> E{Date resolved?}
    E -->|Yes| F[Store date, precision, and provenance]
    E -->|No| G[Check curated web-backed rules]
    G --> H{Web rule matches?}
    H -->|Yes| F
    H -->|No| I[Check AI-validated fallback rules]
    I --> J{Validated rule matches?}
    J -->|Yes| F
    J -->|No| K[Leave date blank and record reason]

Resolution Tiers

Tier	Source	Behavior
1	Authoritative reference	Exact manufacturer-model-serial lookup
2	Deterministic parser	Narrow manufacturer- or model-gated regex rule
3	Curated web-backed rule	Rule extracted from official documentation or trusted references
4	AI-validated fallback rule	Offline AI-proposed rule accepted only after code-side validation
5	Unresolved	Leave blank and preserve an audit reason

⸻

AI-Assisted Rule Discovery

The system uses AI carefully.

AI is allowed to propose a rule for unresolved serial-shape clusters, but it is not allowed to directly generate dates for rows.

Unresolved rows
   ↓
group by manufacturer + model + serial shape
   ↓
send representative samples only
   ↓
AI proposes a controlled rule
   ↓
validate rule against the full cluster
   ↓
accept and cache only if validation passes

Example:

Welch Allyn + SPOT VITAL SIGNS
   ↓
AI proposes leading-year rule
   ↓
code validates the rule across the cluster
   ↓
3 additional dates safely resolved

AI Fallback Metrics

Metric	Value
Unresolved clusters reviewed	53
LLM calls	6
AI-proposed rules	3
Accepted rules	1
Rejected rules	2
Additional rows safely resolved	3

The model is used as a rule-discovery assistant, not as a source of unverified facts.

⸻

Curated Web-Research Layer

The system also supports evidence-backed rules sourced from:

* official manufacturer manuals;
* FDA records;
* manufacturer lookup tools;
* product documentation;
* event-provided reference files.

A rule is accepted only when:

* the source matches the exact product family;
* the serial shape matches the records in the dataset;
* the parser passes code-side validation;
* the resulting dates are plausible;
* the provenance is stored in the audit trail.

The current curated web cache is intentionally conservative. Public documentation was reviewed for priority unresolved groups, but rules were not accepted where the evidence described a different serial family or treated manufacturing date as a separate label field.

⸻

Supported Deterministic Parsers

<details>
<summary>View supported manufactured-date parsers</summary>

Parser	Manufacturer or Model Group	Precision	Example Pattern
zoll	ZOLL Medical	Month	PREFIX + YY + A-L month + digits
edan	Edan Instruments	Month	M + YY + month code
ge_apex	GE Healthcare / Apex Pro CH	Year	RT[S9] + YY + ...
ge_pdm	GE Healthcare / Patient Data Module	Year	SA3 + YY or SPX + YY
jiangmen	Jiangmen Dacheng Medical	Day	WU + YYYY + MM + DD + suffix
unico	Unico	Day	Embedded YYYYMMDD
labcorp	LAB CORP.	Day	Leading YYMMDD
hillrom_legacy	Hillrom	Month	MM + letter + digits + YYYY
stryker	Stryker	Year	Leading four-digit year
linet	LINET	Month	YYYY + MM + digits
welch_filac	Welch Allyn / FILAC3000	Year	Leading YY
welch_spot_vitals	Welch Allyn / SPOT VITAL SIGNS	Year	Leading YYYY
welch_suretemp	Welch Allyn / SURETEMPPLUS	Year	YY + WW + digits

</details>

⸻

Auditability

Every resolver returns structured metadata rather than a bare value.

type Resolution<T> = {
  value: T | null;
  source: string;
  confidence: "high" | "medium" | "low";
  precision?: "day" | "month" | "year";
  explanation?: string;
};

This makes every enrichment decision traceable.

Example:

{
  "value": "2019-07-01",
  "source": "zoll_serial_parser",
  "confidence": "high",
  "precision": "month",
  "explanation": "Decoded from year digits and A-L month letter."
}

If only a year or month is known, the CSV remains machine-readable:

Month precision → YYYY-MM-01
Year precision  → YYYY-01-01
Unknown         → blank

The audit file preserves the true precision so the UI can display:

July 2019

instead of pretending the exact day is known.

⸻

Output Files

output/
├── equiply_submission.csv
└── equiply_audit.csv

equiply_submission.csv

Contains the five required columns:

manufacturer
model
serial number
manufactured_date
device_type

The original CSV headers are preserved exactly.

equiply_audit.csv

Contains additional metadata such as:

manufactured_date_source
manufactured_date_confidence
manufactured_date_precision
manufactured_date_explanation
device_type_source
device_type_confidence
device_type_explanation

This file is intended for review and debugging.

⸻

React Dashboard

The React app provides:

* CSV upload;
* automatic enrichment;
* summary metrics;
* sorted equipment table;
* device-type pie chart;
* enriched CSV download;
* unresolved-date visibility.

Summary cards include:

Total records
Resolved manufactured dates
Unresolved manufactured dates
Device types present

⸻

Project Structure

src/
├── app/
│   ├── App.tsx
│   └── ...
├── enrichment/
│   ├── aiManufacturedDateRules.ts
│   ├── csv.ts
│   ├── dateParsers.ts
│   ├── dateUtils.ts
│   ├── deviceTypes.ts
│   ├── enrichRecords.ts
│   ├── model_type_map.json
│   ├── manufactured_date_ai_rules.json
│   ├── manufactured_date_ai_metadata.json
│   ├── manufactured_date_web_rules.json
│   ├── manufactured_date_web_metadata.json
│   ├── normalize.ts
│   ├── resolveDeviceType.ts
│   ├── resolveManufacturedDate.ts
│   ├── types.ts
│   └── webManufacturedDateRules.ts
├── scripts/
│   ├── buildSubmission.ts
│   ├── generateDeviceTypeDraft.ts
│   └── generateManufacturedDateRules.ts
└── test/
    ├── aiManufacturedDateRules.test.ts
    ├── App.test.tsx
    ├── csvBehavior.test.ts
    ├── dateParsers.test.ts
    ├── normalize.test.ts
    └── webManufacturedDateRules.test.ts

⸻

Running the Project

Install dependencies:

npm install

Generate the submission and audit CSVs:

npm run build-submission

Start the React dashboard:

npm run dev

Run tests:

npm test

Build the production bundle:

npm run build

⸻

Key Design Decisions

Deterministic First, AI Second

Manufacturer-specific parsers run before AI-backed rules.

AI-generated rules are validated offline and cached before use.

Shared Core

The CLI and browser use the same TypeScript enrichment engine.

This avoids inconsistent behavior between the submission file and the UI.

Conservative Date Resolution

Unsupported serial formats remain blank.

The system never silently fabricates a manufactured date.

Token-Efficient LLM Usage

The LLM processes only deduplicated manufacturer-model pairs or unresolved serial-shape clusters.

Repeated rows do not trigger repeated calls.

Separate Submission and Audit Outputs

The submission CSV contains only the required fields.

The audit CSV preserves provenance, confidence, precision, and explanations.

⸻

Future Improvements

With more time, the system could support:

1. authenticated manufacturer-support portals for unpublished decoder rules;
2. uploaded manuals, PDFs, and equipment-label photos;
3. page-level source citations for extracted rules;
4. human approval of newly discovered parser rules;
5. persistent catalog growth across future uploads;
6. backend classification for unseen manufacturer-model pairs;
7. token-usage metrics in the dashboard;
8. exact serial-number lookups from event-provided or hospital-side reference files.

⸻

Design Principle

The goal is not to maximize the number of populated cells.

The goal is to maximize the number of trustworthy enrichments.

The system uses AI where semantic reasoning helps, deterministic parsers where exact values matter, and explicit blanks where the available evidence is insufficient.
