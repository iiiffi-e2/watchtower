import cheerio from "cheerio";
import type { MonitorMode, SnapshotContentType } from "@prisma/client";

export type ExtractResult = {
  contentType: SnapshotContentType;
  extracted: string;
  error?: string;
};

const DEFAULT_IGNORE_SELECTORS = [
  "[id*=\"cookie\"]",
  "[class*=\"cookie\"]",
  "[class*=\"consent\"]",
  "[id*=\"consent\"]",
  "[class*=\"modal\"]",
  "[role=\"dialog\"]",
];

function removeIgnored($: cheerio.CheerioAPI, ignoreSelectors: string[]) {
  ignoreSelectors.forEach((selector) => {
    try {
      $(selector).remove();
    } catch {
      // ignore invalid selectors
    }
  });
}

function removeNoise($: cheerio.CheerioAPI) {
  $("script, style, noscript, svg, canvas").remove();
}

export function extractContent(
  html: string,
  mode: MonitorMode,
  selector?: string | null,
  ignoreSelectors?: string[]
): ExtractResult {
  const $ = cheerio.load(html);

  removeNoise($);

  if (mode === "TEXT_ONLY") {
    const selectors = ignoreSelectors?.length
      ? ignoreSelectors
      : DEFAULT_IGNORE_SELECTORS;
    removeIgnored($, selectors);
    const text = $("body").text();
    return { contentType: "TEXT", extracted: text };
  }

  if (mode === "FULL_HTML") {
    const htmlBody = $.html("body") || "";
    return { contentType: "HTML", extracted: htmlBody };
  }

  if (mode === "SELECTOR") {
    if (!selector) {
      return { contentType: "TEXT", extracted: "", error: "Selector missing" };
    }
    if (ignoreSelectors?.length) {
      removeIgnored($, ignoreSelectors);
    }
    const nodes = $(selector);
    if (!nodes.length) {
      return {
        contentType: "TEXT",
        extracted: "",
        error: "Selector not found",
      };
    }
    const text = nodes.text();
    return { contentType: "TEXT", extracted: text };
  }

  return { contentType: "TEXT", extracted: "" };
}
