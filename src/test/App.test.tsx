import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { App } from "../app/App.tsx";
import { buildSubmissionCsv, parseEquipmentCsv } from "../enrichment/csv.ts";
import { enrichRecords } from "../enrichment/enrichRecords.ts";

describe("App smoke test", () => {
  const createObjectUrl = vi.fn<(blob: Blob) => string>(() => "blob:mock");
  const revokeObjectUrl = vi.fn<(url: string) => void>();
  const originalCreateObjectUrl = URL.createObjectURL;
  const originalRevokeObjectUrl = URL.revokeObjectURL;
  let anchorClickSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      writable: true,
      value: createObjectUrl,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      writable: true,
      value: revokeObjectUrl,
    });
    anchorClickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  });

  afterEach(() => {
    createObjectUrl.mockClear();
    revokeObjectUrl.mockClear();
    anchorClickSpy.mockRestore();

    if (originalCreateObjectUrl) {
      Object.defineProperty(URL, "createObjectURL", {
        configurable: true,
        writable: true,
        value: originalCreateObjectUrl,
      });
    }

    if (originalRevokeObjectUrl) {
      Object.defineProperty(URL, "revokeObjectURL", {
        configurable: true,
        writable: true,
        value: originalRevokeObjectUrl,
      });
    }
  });

  test("uploads the challenge CSV, renders the sorted table, and exports the shared CSV format", async () => {
    const csvText = await readFile(resolve(process.cwd(), "challenge_data-v1.csv"), "utf8");
    const expectedCsv = buildSubmissionCsv(enrichRecords(parseEquipmentCsv(csvText).rows));
    const file = new File([csvText], "challenge_data-v1.csv", { type: "text/csv" });
    const user = userEvent.setup();

    render(<App />);

    const input = screen.getByLabelText(/upload equipment csv/i);
    await user.upload(input, file);

    await waitFor(() => {
      const totalCard = screen.getByText(/total records/i).closest("article");
      expect(totalCard).not.toBeNull();
      expect(within(totalCard!).getByText("801")).toBeInTheDocument();
    });

    const table = screen.getByRole("table");
    expect(within(table).getAllByRole("row")).toHaveLength(802);

    const legendItems = document.querySelectorAll(".chart-legend li");
    const legendTotal = [...legendItems].reduce((sum, item) => {
      const text = item.querySelector(".chart-legend__value")?.textContent ?? "";
      const count = Number(text.split(" ")[0]);
      return sum + count;
    }, 0);
    expect(legendTotal).toBe(801);

    await user.click(screen.getByRole("button", { name: /download enriched csv/i }));
    expect(createObjectUrl).toHaveBeenCalledTimes(1);

    const exportedBlob = createObjectUrl.mock.calls[0]?.[0] as Blob;
    expect(exportedBlob.size).toBe(expectedCsv.length);
    expect(anchorClickSpy).toHaveBeenCalledTimes(1);
  });
});
