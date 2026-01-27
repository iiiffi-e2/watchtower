import type { Diff } from "diff-match-patch";
import type { MonitorSensitivity } from "@prisma/client";

const TIMESTAMP_REGEX =
  /\b\d{1,4}[/-]\d{1,2}[/-]\d{1,4}\b|\b\d{1,2}:\d{2}(?::\d{2})?\b|\b(?:am|pm)\b/i;

function isWhitespaceOnly(prev: string, next: string) {
  return prev.replace(/\s/g, "") === next.replace(/\s/g, "");
}

function isTimestampOnlyChange(diffs: Diff[]) {
  const changed = diffs.filter(([op]) => op !== 0);
  if (!changed.length) return false;

  return changed.every(([, text]) => {
    const trimmed = text.replace(/\s/g, "");
    if (!trimmed) return true;
    return TIMESTAMP_REGEX.test(trimmed) || /^[\d:./-]+$/.test(trimmed);
  });
}

function hasKeywordMatch(diffs: Diff[], keywords: string[]) {
  if (!keywords.length) return true;
  const target = diffs
    .filter(([op]) => op !== 0)
    .map(([, text]) => text.toLowerCase())
    .join(" ");
  return keywords.some((keyword) =>
    target.includes(keyword.trim().toLowerCase())
  );
}

export function isMeaningfulChange(
  prev: string,
  next: string,
  diffs: Diff[],
  sensitivity: MonitorSensitivity,
  keywords: string[] = []
) {
  if (isWhitespaceOnly(prev, next)) return false;

  const keywordHit = hasKeywordMatch(diffs, keywords);
  if (keywords.length > 0) {
    return keywordHit;
  }

  if (sensitivity === "ANY_CHANGE") {
    return true;
  }

  if (isTimestampOnlyChange(diffs)) {
    return false;
  }

  const prevLen = prev.length || 1;
  const delta = diffs
    .filter(([op]) => op !== 0)
    .reduce((sum, [, text]) => sum + text.length, 0);

  if (delta < 40) {
    return false;
  }

  if (prevLen > 2000 && delta / prevLen < 0.005) {
    return false;
  }

  return true;
}

export function scoreImportance(diffs: Diff[]) {
  const changedText = diffs
    .filter(([op]) => op !== 0)
    .map(([, text]) => text.toLowerCase())
    .join(" ");

  let score = 0;

  if (/(pricing|plan|free|trial|\$)/i.test(changedText)) {
    score += 10;
  }
  if (/(terms|privacy|policy)/i.test(changedText)) {
    score += 5;
  }

  const hasHeadingLike = changedText
    .split("\n")
    .some((line) => /^[A-Z][A-Za-z0-9\s]{4,}$/.test(line.trim()));
  if (hasHeadingLike) {
    score += 3;
  }

  return score;
}
