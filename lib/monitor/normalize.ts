import cheerio from "cheerio";
import type { MonitorMode } from "@prisma/client";

const ZERO_WIDTH = /[\u200B-\u200D\uFEFF]/g;

function baseNormalize(input: string) {
  return input
    .replace(/\r\n/g, "\n")
    .replace(ZERO_WIDTH, "")
    .normalize("NFKC")
    .trim();
}

function collapseWhitespace(input: string) {
  return input.replace(/\s+/g, " ").trim();
}

export function normalizeExtracted(input: string, mode: MonitorMode) {
  const base = baseNormalize(input);

  if (mode === "FULL_HTML") {
    const $ = cheerio.load(base);
    $("script, style").remove();
    $("*")
      .contents()
      .filter((_, el) => el.type === "comment")
      .remove();

    const attrsToRemove = new Set([
      "data-reactroot",
      "data-reactid",
      "data-testid",
      "nonce",
      "integrity",
    ]);

    $("*").each((_, element) => {
      const attribs = element.attribs ?? {};
      Object.keys(attribs).forEach((attr) => {
        if (attrsToRemove.has(attr)) {
          $(element).removeAttr(attr);
        }
      });
    });

    const html = $.html("body") || "";
    return collapseWhitespace(html);
  }

  return collapseWhitespace(base);
}
