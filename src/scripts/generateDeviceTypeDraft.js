var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
import { readFile } from "node:fs/promises";
import { DEVICE_TYPES } from "../enrichment/deviceTypes";
import { parseEquipmentCsv } from "../enrichment/csv";
import { normalizeForType } from "../enrichment/normalize";
function buildPrompt(pairs) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, JSON.stringify({
                    instruction: "Classify each manufacturer-model pair using the provided device_type vocabulary. If unsure, return Unknown with low confidence rather than guessing.",
                    vocabulary: DEVICE_TYPES,
                    pairs: pairs,
                    output_schema: {
                        "<normalized_pair_key>": {
                            device_type: "one value from the vocabulary",
                            confidence: "high | medium | low",
                            rationale: "single sentence",
                        },
                    },
                }, null, 2)];
        });
    });
}
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var csvText, parsed, deduped, _i, _a, row, key, prompt, apiKey, response, data;
        var _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, readFile("challenge_data-v1.csv", "utf8")];
                case 1:
                    csvText = _c.sent();
                    parsed = parseEquipmentCsv(csvText);
                    deduped = new Map();
                    for (_i = 0, _a = parsed.rows; _i < _a.length; _i++) {
                        row = _a[_i];
                        key = normalizeForType(row.manufacturer, row.model);
                        if (!deduped.has(key)) {
                            deduped.set(key, {
                                key: key,
                                manufacturer: row.manufacturer,
                                model: row.model,
                            });
                        }
                    }
                    return [4 /*yield*/, buildPrompt(__spreadArray([], deduped.values(), true).sort(function (left, right) { return left.key.localeCompare(right.key); }))];
                case 2:
                    prompt = _c.sent();
                    apiKey = process.env.OPENAI_API_KEY;
                    if (!apiKey) {
                        console.log(prompt);
                        return [2 /*return*/];
                    }
                    return [4 /*yield*/, fetch("https://api.openai.com/v1/responses", {
                            method: "POST",
                            headers: {
                                Authorization: "Bearer ".concat(apiKey),
                                "Content-Type": "application/json",
                            },
                            body: JSON.stringify({
                                model: "gpt-5.4-mini",
                                input: prompt,
                                text: {
                                    format: {
                                        type: "json_object",
                                    },
                                },
                            }),
                        })];
                case 3:
                    response = _c.sent();
                    if (!response.ok) {
                        throw new Error("OpenAI request failed with status ".concat(response.status, "."));
                    }
                    return [4 /*yield*/, response.json()];
                case 4:
                    data = (_c.sent());
                    console.log((_b = data.output_text) !== null && _b !== void 0 ? _b : "");
                    return [2 /*return*/];
            }
        });
    });
}
void main();
