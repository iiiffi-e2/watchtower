import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getServerAuthSession } from "@/lib/auth/nextauth";
import { getBoss } from "@/lib/jobs/boss";

type RouteParams = {
  params: Promise<{ id: string }>;
};

const RUN_MONITOR_JOB = "run-monitor";

export async function POST(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const monitor = await prisma.monitor.findFirst({
    where: { id, project: { userId: session.user.id } },
    select: { id: true, status: true },
  });

  if (!monitor) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (monitor.status !== "ACTIVE") {
    return NextResponse.json(
      { error: "Monitor must be active to run." },
      { status: 409 }
    );
  }

  const boss = getBoss();
  const jobId = await boss.send(RUN_MONITOR_JOB, { monitorId: monitor.id });

  return NextResponse.json({ jobId });
}
