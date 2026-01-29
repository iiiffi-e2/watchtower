import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getServerAuthSession } from "@/lib/auth/nextauth";

type RouteParams = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, { params }: RouteParams) {
  const { id } = await params;
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const snapshot = await prisma.snapshot.findFirst({
    where: {
      id,
      monitor: { project: { userId: session.user.id } },
    },
    select: {
      screenshot: true,
      screenshotMime: true,
    },
  });

  if (!snapshot?.screenshot || !snapshot.screenshotMime) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return new NextResponse(snapshot.screenshot, {
    status: 200,
    headers: {
      "Content-Type": snapshot.screenshotMime,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
