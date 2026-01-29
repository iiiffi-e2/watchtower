import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { getServerAuthSession } from "@/lib/auth/nextauth";
import { createDiff, extractSnippets } from "@/lib/monitor/diff";
import MonitorActions from "./monitor-actions";

function formatDate(date: Date | null) {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

type PageProps = {
  params: { id: string };
};

export default async function MonitorDetailPage({ params }: PageProps) {
  const session = await getServerAuthSession();
  const userId = session?.user?.id as string;

  const monitor = await prisma.monitor.findFirst({
    where: { id: params.id, project: { userId } },
    include: {
      changeEvents: {
        orderBy: { createdAt: "desc" },
        include: {
          previousSnapshot: {
            select: { id: true, content: true, screenshotMime: true },
          },
          currentSnapshot: {
            select: { id: true, content: true, screenshotMime: true },
          },
        },
      },
      snapshots: {
        orderBy: { capturedAt: "desc" },
        take: 10,
        select: {
          id: true,
          capturedAt: true,
          source: true,
          httpStatus: true,
          screenshotMime: true,
        },
      },
    },
  });

  if (!monitor) {
    notFound();
  }

  const latestSnapshot = monitor.snapshots[0];

  return (
    <div className="stack">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div>
          <h1>{monitor.name ?? monitor.url}</h1>
          <p className="muted">
            <a href={monitor.url} target="_blank" rel="noreferrer">
              {monitor.url}
            </a>
          </p>
        </div>
        <MonitorActions monitorId={monitor.id} status={monitor.status} />
      </div>

      <div className="card">
        <div className="row">
          <span className="pill">Status: {monitor.status}</span>
          <span className="pill">Mode: {monitor.mode}</span>
          <span className="pill">Frequency: {monitor.frequency}</span>
          <span className="pill">Sensitivity: {monitor.sensitivity}</span>
        </div>
        <div className="stack" style={{ marginTop: 12 }}>
          <div className="muted">Last checked: {formatDate(monitor.lastCheckedAt)}</div>
          {monitor.lastError && (
            <div className="muted">Last error: {monitor.lastError}</div>
          )}
          {monitor.selector && (
            <div className="muted">Selector: {monitor.selector}</div>
          )}
          {monitor.ignoreSelectors.length > 0 && (
            <div className="muted">
              Ignore selectors: {monitor.ignoreSelectors.join(", ")}
            </div>
          )}
          {monitor.keywords.length > 0 && (
            <div className="muted">Keywords: {monitor.keywords.join(", ")}</div>
          )}
        </div>
        <div style={{ marginTop: 16 }}>
          <Link className="button secondary" href="/monitors">
            Back to monitors
          </Link>
        </div>
      </div>

      <div className="card stack">
        <h2>Latest screenshot</h2>
        {!latestSnapshot?.screenshotMime && (
          <p className="muted">No screenshot captured yet.</p>
        )}
        {latestSnapshot?.screenshotMime && (
          <img
            src={`/api/snapshots/${latestSnapshot.id}/screenshot`}
            alt={`Latest screenshot for ${monitor.name ?? monitor.url}`}
            style={{
              width: "100%",
              maxHeight: 520,
              objectFit: "contain",
              borderRadius: 12,
              border: "1px solid #e5e7eb",
            }}
          />
        )}
      </div>

      <div className="card stack">
        <h2>Change history</h2>
        {monitor.changeEvents.length === 0 && (
          <p className="muted">No changes recorded yet.</p>
        )}
        {monitor.changeEvents.map((event) => {
          const prev = event.previousSnapshot?.content ?? "";
          const next = event.currentSnapshot?.content ?? "";
          const { diffs } = createDiff(prev, next);
          const snippets = extractSnippets(prev, next, diffs);
          const beforeScreenshot = event.previousSnapshot?.screenshotMime;
          const afterScreenshot = event.currentSnapshot?.screenshotMime;

          return (
            <div key={event.id} id={`event-${event.id}`} className="card">
              <div className="row" style={{ justifyContent: "space-between" }}>
                <div>
                  <strong>{event.summary ?? "Change detected"}</strong>
                  <div className="muted">{formatDate(event.createdAt)}</div>
                </div>
                <span className="badge">Score {event.importanceScore}</span>
              </div>
              <div
                className="diff"
                style={{ marginTop: 12, whiteSpace: "pre-wrap" }}
                dangerouslySetInnerHTML={{ __html: event.diffText }}
              />
              <div className="grid" style={{ marginTop: 16 }}>
                <div>
                  <div className="muted">Before</div>
                  <div style={{ whiteSpace: "pre-wrap" }}>{snippets.before}</div>
                </div>
                <div>
                  <div className="muted">After</div>
                  <div style={{ whiteSpace: "pre-wrap" }}>{snippets.after}</div>
                </div>
              </div>
              {(beforeScreenshot || afterScreenshot) && (
                <div className="grid" style={{ marginTop: 16 }}>
                  <div>
                    <div className="muted">Before screenshot</div>
                    {beforeScreenshot ? (
                      <img
                        src={`/api/snapshots/${event.previousSnapshot?.id}/screenshot`}
                        alt="Before change screenshot"
                        style={{
                          width: "100%",
                          maxHeight: 420,
                          objectFit: "contain",
                          borderRadius: 12,
                          border: "1px solid #e5e7eb",
                        }}
                      />
                    ) : (
                      <div className="muted">No screenshot available.</div>
                    )}
                  </div>
                  <div>
                    <div className="muted">After screenshot</div>
                    {afterScreenshot ? (
                      <img
                        src={`/api/snapshots/${event.currentSnapshot?.id}/screenshot`}
                        alt="After change screenshot"
                        style={{
                          width: "100%",
                          maxHeight: 420,
                          objectFit: "contain",
                          borderRadius: 12,
                          border: "1px solid #e5e7eb",
                        }}
                      />
                    ) : (
                      <div className="muted">No screenshot available.</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="card stack">
        <h2>Recent checks</h2>
        {monitor.snapshots.length === 0 && (
          <p className="muted">No checks yet.</p>
        )}
        <ul className="stack">
          {monitor.snapshots.map((snapshot) => (
            <li key={snapshot.id} className="muted">
              {formatDate(snapshot.capturedAt)} · {snapshot.source} ·{" "}
              {snapshot.httpStatus ?? "n/a"}{" "}
              {snapshot.screenshotMime && (
                <>
                  {" "}
                  ·{" "}
                  <a
                    href={`/api/snapshots/${snapshot.id}/screenshot`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    View screenshot
                  </a>
                </>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
