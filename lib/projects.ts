import { prisma } from "@/lib/db/prisma";

export async function getOrCreateDefaultProject(userId: string) {
  const existing = await prisma.project.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });

  if (existing) return existing;

  return prisma.project.create({
    data: {
      userId,
      name: "Default",
    },
  });
}
