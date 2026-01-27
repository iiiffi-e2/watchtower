import { getServerAuthSession } from "@/lib/auth/nextauth";
import { prisma } from "@/lib/db/prisma";
import { getOrCreateDefaultProject } from "@/lib/projects";

export default async function DashboardPage() {
  const session = await getServerAuthSession();
  const userId = session?.user?.id as string;

  const project = await getOrCreateDefaultProject(userId);
  const projectId = project.id;
  const [totalMonitors, activeMonitors, recentChanges] = await Promise.all([
    prisma.monitor.count({ where: { projectId } }),
    prisma.monitor.count({ where: { projectId, status: "ACTIVE" } }),
    prisma.changeEvent.count({
      where: {
        monitor: { projectId },
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    }),
  ]);

  return (
    <div className="stack">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h1>Dashboard</h1>
        <a className="button" href="/monitors/new">
          Add Monitor
        </a>
      </div>
      <div className="grid grid-3">
        <div className="card">
          <div className="muted">Total monitors</div>
          <h2>{totalMonitors}</h2>
        </div>
        <div className="card">
          <div className="muted">Active monitors</div>
          <h2>{activeMonitors}</h2>
        </div>
        <div className="card">
          <div className="muted">Changes in last 24h</div>
          <h2>{recentChanges}</h2>
        </div>
      </div>
    </div>
  );
}
