import { startWorker } from "../lib/jobs/worker.js";

async function main() {
  const boss = await startWorker();
  // eslint-disable-next-line no-console
  console.log("Watchtower worker started");

  const shutdown = async () => {
    // eslint-disable-next-line no-console
    console.log("Shutting down worker...");
    await boss.stop();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("Worker failed to start", error);
  process.exit(1);
});
