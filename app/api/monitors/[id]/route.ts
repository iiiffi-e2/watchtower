import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getServerAuthSession } from "@/lib/auth/nextauth";
import { monitorUpdateSchema } from "@/lib/validation/monitors";
import { validateMonitorUrl } from "@/lib/monitor/validate";

type RouteParams = {
  params: { id: string };
};

export async function GET(_request: Request, { params }: RouteParams) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const monitor = await prisma.monitor.findFirst({
    where: { id: params.id, project: { userId: session.user.id } },
    include: {
      changeEvents: {
        orderBy: { createdAt: "desc" },
        include: {
          previousSnapshot: true,
          currentSnapshot: true,
        },
      },
    },
  });

  if (!monitor) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ monitor });
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = monitorUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid monitor data." }, { status: 400 });
  }

  if (parsed.data.mode === "SELECTOR" && !parsed.data.selector) {
    return NextResponse.json(
      { error: "Selector is required for selector mode." },
      { status: 400 }
    );
  }

  let updatedUrl = parsed.data.url;
  if (updatedUrl) {
    const urlCheck = validateMonitorUrl(updatedUrl);
    if (!urlCheck.ok) {
      return NextResponse.json({ error: urlCheck.error }, { status: 400 });
    }
    updatedUrl = urlCheck.url;
  }

  const monitor = await prisma.monitor.findFirst({
    where: { id: params.id, project: { userId: session.user.id } },
  });

  if (!monitor) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updateData: {
    name?: string;
    url?: string;
    mode?: "TEXT_ONLY" | "FULL_HTML" | "SELECTOR";
    selector?: string | null;
    frequency?: "DAILY" | "WEEKLY";
    sensitivity?: "MEANINGFUL_ONLY" | "ANY_CHANGE";
    ignoreSelectors?: string[];
    keywords?: string[];
  } = {
    name: parsed.data.name ?? undefined,
    url: updatedUrl ?? undefined,
    mode: parsed.data.mode ?? undefined,
    frequency: parsed.data.frequency ?? undefined,
    sensitivity: parsed.data.sensitivity ?? undefined,
    ignoreSelectors: parsed.data.ignoreSelectors ?? undefined,
    keywords: parsed.data.keywords ?? undefined,
  };

  if (parsed.data.mode && parsed.data.mode !== "SELECTOR") {
    updateData.selector = null;
  } else if (parsed.data.selector !== undefined) {
    updateData.selector = parsed.data.selector;
  }

  const updated = await prisma.monitor.update({
    where: { id: monitor.id },
    data: updateData,
  });

  return NextResponse.json({ monitor: updated });
}
