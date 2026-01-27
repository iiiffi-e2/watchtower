import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getServerAuthSession } from "@/lib/auth/nextauth";

type RouteParams = {
  params: { id: string };
};

export async function POST(_request: Request, { params }: RouteParams) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const monitor = await prisma.monitor.findFirst({
    where: { id: params.id, project: { userId: session.user.id } },
  });

  if (!monitor) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updated = await prisma.monitor.update({
    where: { id: monitor.id },
    data: { status: "ACTIVE", consecutiveErrors: 0, lastError: null },
  });

  return NextResponse.json({ monitor: updated });
}
