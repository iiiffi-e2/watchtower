import * as PgBossModule from "pg-boss";

const PgBoss = (PgBossModule as { default?: typeof PgBossModule.PgBoss; PgBoss: typeof PgBossModule.PgBoss }).default ?? PgBossModule.PgBoss;

const globalForBoss = globalThis as unknown as {
  boss?: InstanceType<typeof PgBoss>;
};

export function getBoss() {
  if (globalForBoss.boss) {
    return globalForBoss.boss;
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  const boss = new PgBoss(connectionString);

  globalForBoss.boss = boss;
  return boss;
}
