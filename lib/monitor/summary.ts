import type { MonitorMode } from "@prisma/client";

export function generateSummary(
  mode: MonitorMode,
  diffText: string
) {
  const lower = diffText.toLowerCase();
  if (/(pricing|plan|free|trial|\$)/i.test(lower)) {
    return "Pricing-related content changed.";
  }
  if (mode === "SELECTOR") {
    return "Tracked section changed.";
  }
  return "Page content changed.";
}
