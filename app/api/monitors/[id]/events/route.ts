import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getServerAuthSession } from "@/lib/auth/nextauth";

type RouteParams = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const monitor = await prisma.monitor.findFirst({
    where: { id, project: { userId: session.user.id } },
    select: { id: true },
  });

  if (!monitor) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const events = await prisma.changeEvent.findMany({
    where: { monitorId: monitor.id },
    orderBy: { createdAt: "desc" },
    include: {
      previousSnapshot: true,
      currentSnapshot: true,
    },
  });

  return NextResponse.json({ events });
}
