import Link from "next/link";
import { getServerAuthSession } from "@/lib/auth/nextauth";
import { prisma } from "@/lib/db/prisma";
import { getOrCreateDefaultProject } from "@/lib/projects";

function formatDate(date: Date | null) {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default async function MonitorsPage() {
  const session = await getServerAuthSession();
  const userId = session?.user?.id as string;

  const project = await getOrCreateDefaultProject(userId);
  const monitors = await prisma.monitor.findMany({
    where: { projectId: project.id },
    orderBy: { createdAt: "desc" },
    include: {
      changeEvents: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  return (
    <div className="stack">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h1>Monitors</h1>
        <Link className="button" href="/monitors/new">
          Add Monitor
        </Link>
      </div>
      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>URL</th>
              <th>Mode</th>
              <th>Frequency</th>
              <th>Status</th>
              <th>Last checked</th>
              <th>Last change</th>
            </tr>
          </thead>
          <tbody>
            {monitors.map((monitor) => (
              <tr key={monitor.id}>
                <td>
                  <Link href={`/monitors/${monitor.id}`}>
                    {monitor.name ?? monitor.url}
                  </Link>
                </td>
                <td className="muted">{monitor.url}</td>
                <td>{monitor.mode}</td>
                <td>{monitor.frequency}</td>
                <td>
                  <span className="pill">{monitor.status}</span>
                </td>
                <td>{formatDate(monitor.lastCheckedAt)}</td>
                <td>{formatDate(monitor.changeEvents[0]?.createdAt ?? null)}</td>
              </tr>
            ))}
            {!monitors.length && (
              <tr>
                <td colSpan={7} className="muted">
                  No monitors yet. Add your first one.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
