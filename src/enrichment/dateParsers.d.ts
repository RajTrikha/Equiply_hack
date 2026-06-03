import type { RawRecord, Resolution } from "./types";
type DateParser = {
    name: string;
    parse: (record: RawRecord) => Resolution<string> | null;
};
export declare function decodeZollDate(serialNumber: string): Resolution<string> | null;
export declare function decodeEdanDate(serialNumber: string): Resolution<string> | null;
export declare function decodeGeApexDate(serialNumber: string): Resolution<string> | null;
export declare function decodeGePdmDate(serialNumber: string): Resolution<string> | null;
export declare function decodeJiangmenDate(serialNumber: string): Resolution<string> | null;
export declare function decodeUnicoDate(serialNumber: string): Resolution<string> | null;
export declare function decodeLabCorpDate(serialNumber: string): Resolution<string> | null;
export declare function decodeHillromLegacyDate(serialNumber: string): Resolution<string> | null;
export declare function decodeStrykerDate(serialNumber: string): Resolution<string> | null;
export declare function decodeLinetDate(serialNumber: string): Resolution<string> | null;
export declare function decodeWelchFilacDate(serialNumber: string): Resolution<string> | null;
export declare const VALIDATED_DATE_PARSERS: DateParser[];
export {};
