import { prisma } from "../lib/db/prisma";
import { hashPassword } from "../lib/auth/password";

async function main() {
  const email = process.env.SEED_EMAIL ?? "demo@watchtower.dev";
  const password = process.env.SEED_PASSWORD ?? "watchtower123";

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    // eslint-disable-next-line no-console
    console.log("Seed user already exists");
    return;
  }

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: await hashPassword(password),
      name: "Demo User",
    },
  });

  const project = await prisma.project.create({
    data: {
      userId: user.id,
      name: "Default",
    },
  });

  await prisma.notificationTarget.create({
    data: {
      projectId: project.id,
      type: "EMAIL",
      value: email,
    },
  });

  // eslint-disable-next-line no-console
  console.log(`Seeded user ${email} with password ${password}`);
}

main()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error("Seed failed", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
