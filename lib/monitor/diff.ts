import * as DiffModule from "diff-match-patch";

type DiffModuleType = typeof import("diff-match-patch");
const mod = DiffModule as DiffModuleType & { default?: DiffModuleType };
const { diff_match_patch } = mod.default ?? mod;
type Diff = DiffModuleType["Diff"];

const dmp = new diff_match_patch();

function escapeHtml(input: string) {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function toWordDiff(prev: string, next: string): Diff[] {
  const tokensA = prev.split(" ").filter(Boolean);
  const tokensB = next.split(" ").filter(Boolean);
  const diff = dmp.diff_main(tokensA.join("\n"), tokensB.join("\n"), false);
  dmp.diff_cleanupSemantic(diff);
  return diff.map(([op, text]) => [op, text.split("\n").join(" ")] as Diff);
}

export function createDiff(prev: string, next: string) {
  const diffs = toWordDiff(prev, next);
  dmp.diff_cleanupSemantic(diffs);

  const diffHtml = diffs
    .map(([op, text]) => {
      const safe = escapeHtml(text);
      if (op === 1) return `<ins>${safe}</ins>`;
      if (op === -1) return `<del>${safe}</del>`;
      return safe;
    })
    .join("");

  const diffText = diffs
    .map(([op, text]) => {
      if (op === 1) return `[[+${text}]]`;
      if (op === -1) return `[[-${text}]]`;
      return text;
    })
    .join("");

  return { diffs, diffHtml, diffText };
}

export function extractSnippets(
  prev: string,
  next: string,
  diffs: Diff[],
  limit = 800
) {
  let prevIndex = 0;
  let nextIndex = 0;
  let found = false;

  for (const [op, text] of diffs) {
    if (op === 0) {
      prevIndex += text.length;
      nextIndex += text.length;
      continue;
    }
    found = true;
    break;
  }

  if (!found) {
    return {
      before: prev.slice(0, limit),
      after: next.slice(0, limit),
    };
  }

  const context = Math.floor(limit / 2);
  const beforeStart = Math.max(0, prevIndex - context);
  const beforeEnd = Math.min(prev.length, prevIndex + context);
  const afterStart = Math.max(0, nextIndex - context);
  const afterEnd = Math.min(next.length, nextIndex + context);

  return {
    before: prev.slice(beforeStart, beforeEnd),
    after: next.slice(afterStart, afterEnd),
  };
}

export function getChangedText(diffs: Diff[]) {
  return diffs
    .filter(([op]) => op !== 0)
    .map(([, text]) => text)
    .join(" ");
}
