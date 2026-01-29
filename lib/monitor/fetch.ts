import { chromium } from "playwright";
import { fetch } from "undici";

export type FetchSource = "PLAYWRIGHT" | "FETCH";

export type FetchResult = {
  source: FetchSource;
  html: string;
  finalUrl: string;
  status: number | null;
  title: string | null;
  timings: {
    startedAt: string;
    durationMs: number;
  };
  screenshot: Buffer | null;
  screenshotType: string | null;
};

export type FetchOptions = {
  captureScreenshot?: boolean;
};

const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";

export async function fetchPage(
  url: string,
  options: FetchOptions = {}
): Promise<FetchResult> {
  const startedAt = new Date();
  const startedTime = Date.now();
  const captureScreenshot = options.captureScreenshot ?? false;

  let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({
      userAgent: DEFAULT_USER_AGENT,
      locale: "en-US",
    });

    await page.route("**/*", (route) => {
      const type = route.request().resourceType();
      if (!captureScreenshot && ["image", "media", "font"].includes(type)) {
        route.abort();
      } else {
        route.continue();
      }
    });

    const response = await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    try {
      await page.waitForLoadState("networkidle", { timeout: 5000 });
    } catch {
      // best effort only
    }

    const html = await page.content();
    const title = await page.title();
    const finalUrl = page.url();
    let screenshot: Buffer | null = null;
    let screenshotType: string | null = null;
    if (captureScreenshot) {
      try {
        screenshot = await page.screenshot({ fullPage: true, type: "png" });
        screenshotType = "image/png";
      } catch {
        screenshot = null;
        screenshotType = null;
      }
    }
    await browser.close();
    browser = null;

    return {
      source: "PLAYWRIGHT",
      html,
      finalUrl,
      status: response?.status() ?? null,
      title,
      screenshot,
      screenshotType,
      timings: {
        startedAt: startedAt.toISOString(),
        durationMs: Date.now() - startedTime,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    // eslint-disable-next-line no-console
    console.warn("Playwright fetch failed; falling back to HTTP", {
      url,
      message,
    });
    if (browser) {
      await browser.close();
    }
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": DEFAULT_USER_AGENT,
          "Accept-Language": "en-US,en;q=0.9",
        },
      });
      const html = await response.text();
      return {
        source: "FETCH",
        html,
        finalUrl: response.url ?? url,
        status: response.status,
        title: null,
        screenshot: null,
        screenshotType: null,
        timings: {
          startedAt: startedAt.toISOString(),
          durationMs: Date.now() - startedTime,
        },
      };
    } catch (fallbackError) {
      const fallbackMessage =
        fallbackError instanceof Error
          ? fallbackError.message
          : "Fetch failed";
      throw new Error(fallbackMessage);
    }
  }
}
