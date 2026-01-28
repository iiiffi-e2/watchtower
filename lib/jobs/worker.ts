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

  const boss = getBoss();

  for (const monitor of dueMonitors) {
    const nextDueAt = addInterval(now, monitor.frequency);
    const updated = await prisma.monitor.updateMany({
      where: { id: monitor.id, nextDueAt: { lte: now } },
      data: { nextDueAt },
    });
    if (updated.count === 1) {
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

    const fetchResult = await fetchPage(urlCheck.url);
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

    const hash = sha256(normalized);
    const snapshot = await prisma.snapshot.create({
      data: {
        monitorId: monitor.id,
        source: fetchResult.source,
        httpStatus: fetchResult.status,
        contentType: extractResult.contentType,
        content: normalized,
        rawMeta: {
          title: fetchResult.title,
          finalUrl: fetchResult.finalUrl,
          timings: fetchResult.timings,
        },
        hash,
      },
    });

    if (!monitor.lastHash || !monitor.lastContentRefId) {
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
        await prisma.changeEvent.update({
          where: { id: changeEvent.id },
          data: { notifiedAt: new Date(), notifyError: null },
        });
      } catch (error) {
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
  } catch (error) {
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

  return boss;
}
