import type { Confidence } from "./types.ts";

export const DEVICE_TYPES = [
  "Defibrillator",
  "Infusion Pump",
  "Hospital Bed",
  "Stretcher",
  "Patient Monitor",
  "Patient Monitoring Module",
  "Telemetry Transmitter",
  "Fetal Monitor",
  "ECG Machine",
  "Thermometer",
  "Pulse Oximeter",
  "Blood Pressure Monitor",
  "Endoscopy Processor",
  "Cystoscope",
  "Ultrasonic Cleaner",
  "Patient Warming Unit",
  "Compression Therapy Pump",
  "Smoke Evacuation System",
  "Clinical Centrifuge",
  "Microscope",
  "Environmental Temperature Monitor",
  "Other",
  "Unknown",
] as const;

export type DeviceType = (typeof DEVICE_TYPES)[number];

export type DeviceTypeMapEntry = {
  device_type: DeviceType;
  confidence: Confidence;
  rationale: string;
};

export const MANUAL_REVIEW_PAIRS = [
  "AMERICANDIAGNOSTIC::CE1434",
  "COGENTIXMEDICAL::CST4000",
  "COGENTIXMEDICAL::CST5000",
  "GEHEALTHCARE::PATIENTDATAMODULEPDM",
  "LABCORP::642E",
  "PHILIPS::M3002A",
  "THERMOSCIENTIFIC::SMARTVUE915",
  "UNICO::G380PLLED",
] as const;
