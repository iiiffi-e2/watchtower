import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getServerAuthSession } from "@/lib/auth/nextauth";
import { monitorCreateSchema } from "@/lib/validation/monitors";
import { validateMonitorUrl } from "@/lib/monitor/validate";
import { canCreateMonitor, getPlanLimit } from "@/lib/plans";
import { getOrCreateDefaultProject } from "@/lib/projects";

function defaultMonitorName(urlString: string) {
  try {
    const url = new URL(urlString);
    const path = url.pathname === "/" ? "" : url.pathname;
    return `${url.hostname}${path}`;
  } catch {
    return urlString;
  }
}

export async function GET() {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const project = await getOrCreateDefaultProject(session.user.id);
  const monitors = await prisma.monitor.findMany({
    where: { projectId: project.id },
    orderBy: { createdAt: "desc" },
    include: {
      changeEvents: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  const data = monitors.map((monitor) => ({
    ...monitor,
    lastChangeAt: monitor.changeEvents[0]?.createdAt ?? null,
  }));

  return NextResponse.json({ monitors: data });
}

export async function POST(request: Request) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = monitorCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid monitor data." }, { status: 400 });
  }

  const urlCheck = validateMonitorUrl(parsed.data.url);
  if (!urlCheck.ok) {
    return NextResponse.json({ error: urlCheck.error }, { status: 400 });
  }

  if (parsed.data.mode === "SELECTOR" && !parsed.data.selector) {
    return NextResponse.json(
      { error: "Selector is required for selector mode." },
      { status: 400 }
    );
  }

  const project = await getOrCreateDefaultProject(session.user.id);
  const totalMonitors = await prisma.monitor.count({
    where: { projectId: project.id },
  });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  });

  if (user && !canCreateMonitor(user.plan, totalMonitors)) {
    return NextResponse.json(
      {
        error: `Plan limit reached. Max ${getPlanLimit(user.plan)} monitors.`,
      },
      { status: 403 }
    );
  }

  const dailyCreated = await prisma.monitor.count({
    where: {
      project: { userId: session.user.id },
      createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
  });

  if (dailyCreated >= 20) {
    return NextResponse.json(
      { error: "Daily monitor creation limit reached." },
      { status: 429 }
    );
  }

  const monitor = await prisma.monitor.create({
    data: {
      projectId: project.id,
      name: parsed.data.name ?? defaultMonitorName(urlCheck.url),
      url: urlCheck.url,
      mode: parsed.data.mode ?? "TEXT_ONLY",
      selector: parsed.data.selector ?? null,
      frequency: parsed.data.frequency ?? "DAILY",
      sensitivity: parsed.data.sensitivity ?? "MEANINGFUL_ONLY",
      ignoreSelectors: parsed.data.ignoreSelectors ?? [],
      keywords: parsed.data.keywords ?? [],
      nextDueAt: new Date(),
    },
  });

  return NextResponse.json({ monitor });
}
