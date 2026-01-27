import { z } from "zod";

export const monitorModeSchema = z.enum([
  "TEXT_ONLY",
  "FULL_HTML",
  "SELECTOR",
]);

export const monitorFrequencySchema = z.enum(["DAILY", "WEEKLY"]);

export const monitorSensitivitySchema = z.enum([
  "MEANINGFUL_ONLY",
  "ANY_CHANGE",
]);

export const monitorCreateSchema = z.object({
  name: z.string().min(1).optional(),
  url: z.string().url(),
  mode: monitorModeSchema.optional(),
  selector: z.string().min(1).optional(),
  frequency: monitorFrequencySchema.optional(),
  sensitivity: monitorSensitivitySchema.optional(),
  ignoreSelectors: z.array(z.string().min(1)).optional(),
  keywords: z.array(z.string().min(1)).optional(),
});

export const monitorUpdateSchema = monitorCreateSchema.partial();
