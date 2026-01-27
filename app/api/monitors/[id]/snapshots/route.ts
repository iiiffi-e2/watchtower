import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getServerAuthSession } from "@/lib/auth/nextauth";

type RouteParams = {
  params: { id: string };
};

export async function GET(request: Request, { params }: RouteParams) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const monitor = await prisma.monitor.findFirst({
    where: { id: params.id, project: { userId: session.user.id } },
    select: { id: true },
  });

  if (!monitor) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const limitParam = searchParams.get("limit");
  const limit = limitParam ? Number(limitParam) : 10;
  if (!Number.isFinite(limit) || !Number.isInteger(limit) || limit <= 0) {
    return NextResponse.json(
      { error: "Invalid limit. Use a positive integer." },
      { status: 400 }
    );
  }

  const snapshots = await prisma.snapshot.findMany({
    where: { monitorId: monitor.id },
    orderBy: { capturedAt: "desc" },
    take: Math.min(limit, 50),
  });

  return NextResponse.json({ snapshots });
}
