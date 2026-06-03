import { startTransition, useDeferredValue, useState } from "react";

import manufacturedDateAiMetadata from "../enrichment/manufactured_date_ai_metadata.json";
import manufacturedDateWebMetadata from "../enrichment/manufactured_date_web_metadata.json";
import modelTypeGeneration from "../enrichment/model_type_generation.json";
import { buildSubmissionCsv, parseEquipmentCsv } from "../enrichment/csv.ts";
import { enrichRecords, formatDateForUi, summarizeEnrichment } from "../enrichment/enrichRecords.ts";
import type {
  DeviceTypeGenerationMetadata,
  EnrichedAuditRecord,
  ManufacturedDateAiFallbackMetadata,
  ManufacturedDateWebResearchMetadata,
} from "../enrichment/types.ts";
import { ArchitectureDiagram } from "./ArchitectureDiagram.tsx";
import "./App.css";

const PIE_COLORS = [
  "#15616d",
  "#ff7d00",
  "#1f7a8c",
  "#3a86ff",
  "#588157",
  "#bc4749",
  "#6a4c93",
  "#2a9d8f",
  "#e76f51",
  "#5f0f40",
];

type Status = "idle" | "ready" | "processing" | "error";

function SummaryCard(props: { label: string; value: string; tone?: "default" | "accent" | "muted" }) {
  return (
    <article className={`summary-card summary-card--${props.tone ?? "default"}`}>
      <p>{props.label}</p>
      <strong>{props.value}</strong>
    </article>
  );
}

function describeArc(cx: number, cy: number, radius: number, startAngle: number, endAngle: number): string {
  const start = {
    x: cx + radius * Math.cos(startAngle),
    y: cy + radius * Math.sin(startAngle),
  };
  const end = {
    x: cx + radius * Math.cos(endAngle),
    y: cy + radius * Math.sin(endAngle),
  };
  const largeArcFlag = endAngle - startAngle > Math.PI ? 1 : 0;
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${end.x} ${end.y} Z`;
}

function PieChart(props: { records: EnrichedAuditRecord[] }) {
  const counts = new Map<string, number>();
  for (const record of props.records) {
    counts.set(record.device_type, (counts.get(record.device_type) ?? 0) + 1);
  }

  const slices = [...counts.entries()]
    .map(([deviceType, count]) => ({ deviceType, count }))
    .sort((left, right) => right.count - left.count);

  const total = props.records.length || 1;
  let cursor = -Math.PI / 2;

  return (
    <div className="chart-shell">
      <svg viewBox="0 0 220 220" className="pie-chart" aria-label="Device type distribution">
        <circle cx="110" cy="110" r="92" className="pie-chart__track" />
        {slices.map((slice, index) => {
          const angle = (slice.count / total) * Math.PI * 2;
          const path = describeArc(110, 110, 92, cursor, cursor + angle);
          const element = (
            <path
              key={slice.deviceType}
              d={path}
              fill={PIE_COLORS[index % PIE_COLORS.length]}
              stroke="#f8f4ec"
              strokeWidth="2"
            />
          );
          cursor += angle;
          return element;
        })}
        <circle cx="110" cy="110" r="50" className="pie-chart__center" />
        <text x="110" y="102" textAnchor="middle" className="pie-chart__value">
          {props.records.length}
        </text>
        <text x="110" y="124" textAnchor="middle" className="pie-chart__label">
          records
        </text>
      </svg>
      <ul className="chart-legend">
        {slices.map((slice, index) => {
          const percentage = ((slice.count / total) * 100).toFixed(1);
          return (
            <li key={slice.deviceType}>
              <span
                className="chart-legend__swatch"
                style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }}
              />
              <span className="chart-legend__label">{slice.deviceType}</span>
              <span className="chart-legend__value">
                {slice.count} ({percentage}%)
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function App() {
  const [records, setRecords] = useState<EnrichedAuditRecord[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string>("");
  const [fileName, setFileName] = useState<string>("");
  const [showAuditDetails, setShowAuditDetails] = useState(false);
  const deferredRecords = useDeferredValue(records);
  const summary = summarizeEnrichment(deferredRecords);
  const uniqueDeviceTypes = new Set(deferredRecords.map((record) => record.device_type)).size;
  const generationMetadata = modelTypeGeneration as DeviceTypeGenerationMetadata;
  const dateAiMetadata = manufacturedDateAiMetadata as ManufacturedDateAiFallbackMetadata;
  const dateWebMetadata = manufacturedDateWebMetadata as ManufacturedDateWebResearchMetadata;

  async function readFileText(file: File): Promise<string> {
    if (typeof file.text === "function") {
      return file.text();
    }

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Failed to read the uploaded file."));
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.readAsText(file);
    });
  }

  async function handleUpload(file: File | null) {
    if (!file) {
      return;
    }

    setStatus("processing");
    setError("");

    try {
      const text = await readFileText(file);
      const parsed = parseEquipmentCsv(text);
      const enriched = enrichRecords(parsed.rows);

      startTransition(() => {
        setRecords(enriched);
        setFileName(file.name);
        setStatus("ready");
      });
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : "Failed to process CSV.";
      setRecords([]);
      setFileName("");
      setStatus("error");
      setError(message);
    }
  }

  function handleDownload() {
    const csvText = buildSubmissionCsv(deferredRecords);
    const blob = new Blob([csvText], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "equiply_submission.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">Equiply Hiring Tournament</p>
          <h1>Hospital equipment enrichment with auditable rules.</h1>
          <p className="hero-copy">
            Upload the challenge CSV, enrich each row with a reviewed device type and a
            deterministic manufactured date when one can be safely decoded, then export the
            same submission format used by the CLI.
          </p>
        </div>
        <div className="upload-panel">
          <label className="upload-control">
            <span>Upload equipment CSV</span>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => void handleUpload(event.target.files?.[0] ?? null)}
            />
          </label>
          <p className="upload-note">
            Expected headers: <code>manufacturer</code>, <code>model</code>, <code>serial number</code>
          </p>
          {generationMetadata.generated ? (
            <p className="upload-note">
              Device types were preclassified with <code>{generationMetadata.model}</code>:{" "}
              {generationMetadata.normalized_pairs_classified} normalized pairs,{" "}
              {generationMetadata.api_calls_made} batched API call,{" "}
              {generationMetadata.runtime_api_calls} runtime calls.
            </p>
          ) : null}
          {dateAiMetadata.generated ? (
            <p className="upload-note">
              Manufactured-date AI fallback reviewed {dateAiMetadata.unresolved_groups_sent_to_ai} unresolved
              groups with <code>{dateAiMetadata.model}</code>, accepted {dateAiMetadata.accepted_rules} rules,
              and added {dateAiMetadata.additional_rows_resolved_after_validation} validated dates with 0 runtime
              calls.
            </p>
          ) : null}
          {dateWebMetadata.generated ? (
            <p className="upload-note">
              Web research reviewed {dateWebMetadata.groups_researched} unresolved groups, found{" "}
              {dateWebMetadata.authoritative_sources_found} authoritative sources, accepted{" "}
              {dateWebMetadata.accepted_rules} source-backed rules, and added{" "}
              {dateWebMetadata.additional_rows_resolved_after_validation} dates. Remaining unresolved rows stay blank.
            </p>
          ) : null}
          {fileName ? <p className="upload-note">Loaded file: {fileName}</p> : null}
          <div className="upload-actions">
            <button type="button" onClick={handleDownload} disabled={deferredRecords.length === 0}>
              Download enriched CSV
            </button>
            <label className="toggle">
              <input
                type="checkbox"
                checked={showAuditDetails}
                onChange={(event) => setShowAuditDetails(event.target.checked)}
              />
              <span>Show audit metadata</span>
            </label>
          </div>
          {status === "processing" ? <p className="status-message">Processing uploaded records...</p> : null}
          {status === "error" ? <p className="status-message status-message--error">{error}</p> : null}
        </div>
      </section>

      <section className="summary-grid" aria-label="Summary cards">
        <SummaryCard label="Total records" value={String(summary.total_rows)} tone="accent" />
        <SummaryCard
          label="Resolved manufactured dates"
          value={String(summary.resolved_manufactured_dates)}
        />
        <SummaryCard
          label="Unresolved manufactured dates"
          value={String(summary.unresolved_manufactured_dates)}
          tone="muted"
        />
        <SummaryCard label="Device types present" value={String(uniqueDeviceTypes)} />
      </section>

      <section className="content-grid">
        <article className="panel">
          <div className="panel-heading">
            <h2>Device type distribution</h2>
            <p>Pie chart percentages are computed from the enriched table below.</p>
          </div>
          {deferredRecords.length > 0 ? (
            <PieChart records={deferredRecords} />
          ) : (
            <p className="empty-state">Upload a CSV to visualize device-type distribution.</p>
          )}
        </article>

        <article className="panel">
          <div className="panel-heading">
            <h2>Enriched inventory</h2>
            <p>Rows are sorted ascending by manufactured date. Unresolved dates stay last.</p>
          </div>
          {summary.unknown_device_type_pairs.length > 0 ? (
            <p className="status-message status-message--warning">
              Unknown device types: {summary.unknown_device_type_pairs.join("; ")}
            </p>
          ) : null}
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>manufacturer</th>
                  <th>model</th>
                  <th>serial number</th>
                  <th>manufactured_date</th>
                  <th>device_type</th>
                  {showAuditDetails ? <th>date source</th> : null}
                  {showAuditDetails ? <th>date confidence</th> : null}
                  {showAuditDetails ? <th>type source</th> : null}
                  {showAuditDetails ? <th>type confidence</th> : null}
                </tr>
              </thead>
              <tbody>
                {deferredRecords.map((record) => (
                  <tr key={`${record.original_index}-${record.serial_number}`}>
                    <td>{record.manufacturer}</td>
                    <td>{record.model}</td>
                    <td>{record.serial_number}</td>
                    <td title={record.manufactured_date_resolution.explanation ?? ""}>
                      {formatDateForUi(
                        record.manufactured_date,
                        record.manufactured_date_resolution.precision,
                      )}
                    </td>
                    <td title={record.device_type_resolution.explanation ?? ""}>{record.device_type}</td>
                    {showAuditDetails ? <td>{record.manufactured_date_resolution.source}</td> : null}
                    {showAuditDetails ? <td>{record.manufactured_date_resolution.confidence}</td> : null}
                    {showAuditDetails ? <td>{record.device_type_resolution.source}</td> : null}
                    {showAuditDetails ? <td>{record.device_type_resolution.confidence}</td> : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      </section>

      <ArchitectureDiagram />
    </main>
  );
}
