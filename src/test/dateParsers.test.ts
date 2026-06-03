import { describe, expect, test } from "vitest";

import {
  decodeEdanDate,
  decodeGePdmDate,
  decodeHillromLegacyDate,
  decodeJiangmenDate,
  decodeWelchFilacDate,
  decodeWelchSpotVitalsDate,
  decodeWelchSureTempDate,
  decodeZollDate,
} from "../enrichment/dateParsers.ts";
import { resolveManufacturedDate } from "../enrichment/resolveManufacturedDate.ts";

describe("decodeZollDate", () => {
  test("decodes supported ZOLL serials including GS1-wrapped values", () => {
    expect(decodeZollDate("AF17D065064")?.value).toBe("2017-04-01");
    expect(decodeZollDate("(21) X19G176549")?.value).toBe("2019-07-01");
  });

  test("rejects malformed or unsupported ZOLL serials", () => {
    expect(decodeZollDate("t1k132871")).toBeNull();
    expect(decodeZollDate("T08103497")).toBeNull();
    expect(decodeZollDate("T098109977")).toBeNull();
    expect(decodeZollDate("T0787302")).toBeNull();
  });
});

describe("other validated date parsers", () => {
  test("decodes Edan month-precision serials", () => {
    expect(decodeEdanDate("560039-M21C11330002")?.value).toBe("2021-12-01");
    expect(decodeEdanDate("M24408380006")?.value).toBe("2024-04-01");
  });

  test("decodes GE, Jiangmen, Hillrom, and Welch examples", () => {
    expect(decodeGePdmDate("SA315219009")?.value).toBe("2015-01-01");
    expect(decodeJiangmenDate("WU202406267EN")?.value).toBe("2024-06-26");
    expect(decodeHillromLegacyDate("02R2981999")?.value).toBe("1999-02-01");
    expect(decodeWelchFilacDate("1863046X")?.value).toBe("2018-01-01");
    expect(decodeWelchSpotVitalsDate("201507871")?.value).toBe("2015-01-01");
    expect(decodeWelchSureTempDate("(21) 23038261")?.value).toBe("2023-01-01");
    expect(decodeWelchSureTempDate("24519376")?.value).toBe("2024-01-01");
    expect(decodeWelchSureTempDate("7432348")?.value).toBe("2007-01-01");
    expect(decodeWelchSureTempDate("074321PO")).toBeNull();
  });
});

describe("resolveManufacturedDate routing", () => {
  test("resolves uppercase HILL ROM P-series via letter+Julian-day parser", () => {
    const result = resolveManufacturedDate({
      manufacturer: "HILL ROM",
      model: "P1440",
      serial_number: "P216ME5983",
    });
    expect(result.value).toBe("2025-08-04");
    expect(result.source).toBe("hillrom_bed_serial_parser");
    expect(result.confidence).toBe("medium");
  });

  test("accepts lowercase Hillrom legacy routing only", () => {
    expect(
      resolveManufacturedDate({
        manufacturer: "Hillrom",
        model: "CENTURY",
        serial_number: "12M1281998",
      }).value,
    ).toBe("1998-12-01");
  });
});
