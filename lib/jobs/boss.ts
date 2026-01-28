import pkg from "pg-boss";

const { PgBoss } = pkg as typeof import("pg-boss");

const globalForBoss = globalThis as unknown as {
  boss?: PgBoss;
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
