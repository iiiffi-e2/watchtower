import { getBoss } from "../lib/jobs/boss.ts";
import { runScheduler } from "../lib/jobs/worker.ts";

async function main() {
  const boss = getBoss();
  await boss.start();
  await boss.schedule("scheduler", "*/10 * * * *");
  await boss.work("scheduler", {}, runScheduler);

  // eslint-disable-next-line no-console
  console.log("Watchtower scheduler started");

  const shutdown = async () => {
    // eslint-disable-next-line no-console
    console.log("Shutting down scheduler...");
    await boss.stop();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("Scheduler failed to start", error);
  process.exit(1);
});
