import type { MonitorFrequency } from "@prisma/client";
import { prisma } from "../db/prisma.ts";
import { getBoss } from "./boss.ts";
import { fetchPage } from "../monitor/fetch.ts";
import { extractContent } from "../monitor/extract.ts";
import { normalizeExtracted } from "../monitor/normalize.ts";
import { sha256 } from "../monitor/hash.ts";
import { createDiff, extractSnippets } from "../monitor/diff.ts";
import { isMeaningfulChange, scoreImportance } from "../monitor/meaningful.ts";
import { generateSummary } from "../monitor/summary.ts";
import { buildChangeEmail } from "../email/templates.ts";
import { sendEmail } from "../email/send.ts";
import { validateMonitorUrl } from "../monitor/validate.ts";

const RUN_MONITOR_JOB = "run-monitor";
const SCHEDULER_JOB = "scheduler";

type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const LOG_LEVEL = (
  process.env.WATCHTOWER_LOG_LEVEL ?? "info"
).toLowerCase() as LogLevel;

const HEARTBEAT_MINUTES = Number(
  process.env.WATCHTOWER_WORKER_HEARTBEAT_MINUTES ??
    (LOG_LEVEL === "debug" ? "5" : "0")
);

function shouldLog(level: LogLevel) {
  const current = LOG_LEVELS[LOG_LEVEL] ?? LOG_LEVELS.info;
  return LOG_LEVELS[level] >= current;
}

function log(level: LogLevel, message: string, meta?: Record<string, unknown>) {
  if (!shouldLog(level)) return;
  const line = meta ? `${message} ${JSON.stringify(meta)}` : message;
  if (level === "error") {
    // eslint-disable-next-line no-console
    console.error(line);
    return;
  }
  if (level === "warn") {
    // eslint-disable-next-line no-console
    console.warn(line);
    return;
  }
  // eslint-disable-next-line no-console
  console.log(line);
}

function addInterval(from: Date, frequency: MonitorFrequency) {
  const dayMs = 24 * 60 * 60 * 1000;
  if (frequency === "WEEKLY") {
    return new Date(from.getTime() + dayMs * 7);
  }
  return new Date(from.getTime() + dayMs);
}

export async function runScheduler() {
  const now = new Date();
  const dueMonitors = await prisma.monitor.findMany({
    where: {
      status: "ACTIVE",
      nextDueAt: { lte: now },
    },
    select: { id: true, frequency: true },
  });

  log("info", "Scheduler tick", { dueMonitors: dueMonitors.length });

  const boss = getBoss();

  for (const monitor of dueMonitors) {
    const nextDueAt = addInterval(now, monitor.frequency);
    const updated = await prisma.monitor.updateMany({
      where: { id: monitor.id, nextDueAt: { lte: now } },
      data: { nextDueAt },
    });
    if (updated.count === 1) {
      log("debug", "Scheduling monitor run", {
        monitorId: monitor.id,
        nextDueAt: nextDueAt.toISOString(),
      });
      await boss.send(RUN_MONITOR_JOB, { monitorId: monitor.id });
    }
  }
}

async function handleError(
  monitorId: string,
  error: unknown,
  jobRunId: string | null
) {
  const message =
    error instanceof Error ? error.message : "Unexpected error";

  const monitor = await prisma.monitor.findUnique({
    where: { id: monitorId },
    select: { consecutiveErrors: true },
  });

  if (!monitor) {
    if (jobRunId) {
      await prisma.jobRun.update({
        where: { id: jobRunId },
        data: {
          finishedAt: new Date(),
          success: false,
          error: message,
        },
      });
    }
    return;
  }

  const nextErrors = (monitor.consecutiveErrors ?? 0) + 1;

  const updateData: {
    consecutiveErrors: number;
    lastError: string;
    lastCheckedAt: Date;
    status?: "ERROR";
  } = {
    consecutiveErrors: nextErrors,
    lastError: message,
    lastCheckedAt: new Date(),
  };

  if (nextErrors > 3 || message.toLowerCase().includes("selector")) {
    updateData.status = "ERROR";
  }

  await prisma.monitor.update({
    where: { id: monitorId },
    data: updateData,
  });

  if (jobRunId) {
    await prisma.jobRun.update({
      where: { id: jobRunId },
      data: {
        finishedAt: new Date(),
        success: false,
        error: message,
      },
    });
  }
}

export async function runMonitor(monitorId: string) {
  const jobRun = await prisma.jobRun.create({
    data: { monitorId },
  });

  try {
    log("info", "Monitor run started", { monitorId, jobRunId: jobRun.id });
    const monitor = await prisma.monitor.findUnique({
      where: { id: monitorId },
      include: {
        project: {
          include: { user: true, notificationTargets: true },
        },
        lastContentRef: true,
      },
    });

    if (!monitor) {
      throw new Error("Monitor not found");
    }

    if (monitor.status !== "ACTIVE") {
      log("info", "Monitor skipped (inactive)", {
        monitorId,
        status: monitor.status,
      });
      await prisma.jobRun.update({
        where: { id: jobRun.id },
        data: { finishedAt: new Date(), success: true },
      });
      return;
    }

    const urlCheck = validateMonitorUrl(monitor.url);
    if (!urlCheck.ok || !urlCheck.url) {
      throw new Error(urlCheck.error ?? "Invalid monitor URL.");
    }

    const fetchResult = await fetchPage(urlCheck.url, {
      captureScreenshot: true,
    });
    log("debug", "Fetched page", {
      monitorId,
      source: fetchResult.source,
      status: fetchResult.status,
      finalUrl: fetchResult.finalUrl,
      durationMs: fetchResult.timings.durationMs,
    });
    const extractResult = extractContent(
      fetchResult.html,
      monitor.mode,
      monitor.selector,
      monitor.ignoreSelectors
    );

    if (extractResult.error) {
      throw new Error(extractResult.error);
    }

    const normalized = normalizeExtracted(
      extractResult.extracted,
      monitor.mode
    );
    log("debug", "Content normalized", {
      monitorId,
      contentLength: normalized.length,
      contentType: extractResult.contentType,
    });

    const hash = sha256(normalized);
    const screenshotBytes = fetchResult.screenshot
      ? new Uint8Array(fetchResult.screenshot)
      : null;
    const snapshot = await prisma.snapshot.create({
      data: {
        monitorId: monitor.id,
        source: fetchResult.source,
        httpStatus: fetchResult.status,
        contentType: extractResult.contentType,
        content: normalized,
        screenshot: screenshotBytes,
        screenshotMime: fetchResult.screenshotType,
        rawMeta: {
          title: fetchResult.title,
          finalUrl: fetchResult.finalUrl,
          timings: fetchResult.timings,
        },
        hash,
      },
    });
    log("debug", "Snapshot saved", { monitorId, snapshotId: snapshot.id });

    if (!monitor.lastHash || !monitor.lastContentRefId) {
      log("info", "Baseline snapshot stored", { monitorId });
      await prisma.monitor.update({
        where: { id: monitor.id },
        data: {
          lastHash: hash,
          lastContentRefId: snapshot.id,
          lastCheckedAt: new Date(),
          consecutiveErrors: 0,
          lastError: null,
        },
      });
      await prisma.jobRun.update({
        where: { id: jobRun.id },
        data: { finishedAt: new Date(), success: true },
      });
      return;
    }

    const previousSnapshot = monitor.lastContentRef;
    if (!previousSnapshot) {
      log("info", "Previous snapshot missing; resetting baseline", {
        monitorId,
      });
      await prisma.monitor.update({
        where: { id: monitor.id },
        data: {
          lastHash: hash,
          lastContentRefId: snapshot.id,
          lastCheckedAt: new Date(),
          consecutiveErrors: 0,
          lastError: null,
        },
      });
      await prisma.jobRun.update({
        where: { id: jobRun.id },
        data: { finishedAt: new Date(), success: true },
      });
      return;
    }
    const prevContent = previousSnapshot.content;

    if (monitor.lastHash === hash) {
      log("info", "No change detected (hash match)", { monitorId });
      await prisma.monitor.update({
        where: { id: monitor.id },
        data: {
          lastHash: hash,
          lastContentRefId: snapshot.id,
          lastCheckedAt: new Date(),
          consecutiveErrors: 0,
          lastError: null,
        },
      });
      await prisma.jobRun.update({
        where: { id: jobRun.id },
        data: { finishedAt: new Date(), success: true },
      });
      return;
    }
    const { diffs, diffHtml, diffText } = createDiff(prevContent, normalized);
    const meaningful = isMeaningfulChange(
      prevContent,
      normalized,
      diffs,
      monitor.sensitivity,
      monitor.keywords
    );

    if (!meaningful) {
      log("info", "Change ignored (not meaningful)", { monitorId });
      await prisma.monitor.update({
        where: { id: monitor.id },
        data: {
          lastHash: hash,
          lastContentRefId: snapshot.id,
          lastCheckedAt: new Date(),
          consecutiveErrors: 0,
          lastError: null,
        },
      });
      await prisma.jobRun.update({
        where: { id: jobRun.id },
        data: { finishedAt: new Date(), success: true },
      });
      return;
    }

    const importanceScore = scoreImportance(diffs);
    const summary = generateSummary(monitor.mode, diffText);
    const changeEvent = await prisma.changeEvent.create({
      data: {
        monitorId: monitor.id,
        previousSnapshotId: previousSnapshot?.id ?? snapshot.id,
        currentSnapshotId: snapshot.id,
        diffText: diffHtml,
        summary,
        importanceScore,
      },
    });
    log("info", "Change event created", {
      monitorId,
      eventId: changeEvent.id,
      importanceScore,
    });

    const { before, after } = extractSnippets(prevContent, normalized, diffs);
    const recipients = monitor.project.notificationTargets
      .filter((target) => target.isEnabled && target.type === "EMAIL")
      .map((target) => target.value);
    if (!recipients.length && monitor.project.user.email) {
      recipients.push(monitor.project.user.email);
    }

    if (recipients.length) {
      const appUrl = process.env.APP_URL ?? "http://localhost:3000";
      const email = buildChangeEmail({
        monitorName: monitor.name ?? monitor.url,
        url: monitor.url,
        summary,
        diffHtml,
        beforeSnippet: before,
        afterSnippet: after,
        appUrl,
        monitorId: monitor.id,
        eventId: changeEvent.id,
      });

      try {
        await sendEmail({ to: recipients, ...email });
        log("info", "Change notification sent", {
          monitorId,
          eventId: changeEvent.id,
          recipientCount: recipients.length,
        });
        await prisma.changeEvent.update({
          where: { id: changeEvent.id },
          data: { notifiedAt: new Date(), notifyError: null },
        });
      } catch (error) {
        log("warn", "Change notification failed", {
          monitorId,
          eventId: changeEvent.id,
          message: error instanceof Error ? error.message : "Email failed",
        });
        await prisma.changeEvent.update({
          where: { id: changeEvent.id },
          data: {
            notifyError:
              error instanceof Error ? error.message : "Email failed",
          },
        });
      }
    }

    await prisma.monitor.update({
      where: { id: monitor.id },
      data: {
        lastHash: hash,
        lastContentRefId: snapshot.id,
        lastCheckedAt: new Date(),
        consecutiveErrors: 0,
        lastError: null,
        status: "ACTIVE",
      },
    });

    await prisma.jobRun.update({
      where: { id: jobRun.id },
      data: { finishedAt: new Date(), success: true },
    });
    log("info", "Monitor run finished", { monitorId, jobRunId: jobRun.id });
  } catch (error) {
    log("error", "Monitor run failed", {
      monitorId,
      jobRunId: jobRun.id,
      message: error instanceof Error ? error.message : "Unexpected error",
    });
    await handleError(monitorId, error, jobRun.id);
  }
}

export async function startWorker() {
  const boss = getBoss();
  await boss.start();

  await boss.createQueue(SCHEDULER_JOB);
  await boss.createQueue(RUN_MONITOR_JOB);

  await boss.schedule(SCHEDULER_JOB, "*/10 * * * *");

  await boss.work(SCHEDULER_JOB, {}, runScheduler);
  await boss.work(RUN_MONITOR_JOB, {}, async (job) => {
    const jobs = Array.isArray(job) ? job : [job];
    for (const item of jobs) {
      const monitorId = (item as { data?: { monitorId?: string } }).data
        ?.monitorId;
      if (monitorId) {
        await runMonitor(monitorId);
      }
    }
  });

  log("info", "Worker ready", {
    pid: process.pid,
    logLevel: LOG_LEVEL,
    heartbeatMinutes: Number.isFinite(HEARTBEAT_MINUTES)
      ? HEARTBEAT_MINUTES
      : 0,
  });

  if (Number.isFinite(HEARTBEAT_MINUTES) && HEARTBEAT_MINUTES > 0) {
    const intervalMs = HEARTBEAT_MINUTES * 60 * 1000;
    const heartbeat = setInterval(() => {
      log("debug", "Worker heartbeat", {
        timestamp: new Date().toISOString(),
      });
    }, intervalMs);
    heartbeat.unref?.();
  }

  return boss;
}
