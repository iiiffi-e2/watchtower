import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

const connectionString = process.env.DATABASE_URL;
// #region agent log
fetch('http://127.0.0.1:7243/ingest/2bd28d29-ab02-4717-afee-a1d3013bc7f6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/db/prisma.ts:10',message:'prisma module loaded',data:{hasDatabaseUrl:!!connectionString},timestamp:Date.now(),sessionId:'debug-session',runId:'build-pre',hypothesisId:'H1'})}).catch(()=>{});
// #endregion
if (!connectionString) {
  // #region agent log
  fetch('http://127.0.0.1:7243/ingest/2bd28d29-ab02-4717-afee-a1d3013bc7f6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/db/prisma.ts:12',message:'missing DATABASE_URL',data:{hasDatabaseUrl:!!connectionString},timestamp:Date.now(),sessionId:'debug-session',runId:'build-pre',hypothesisId:'H2'})}).catch(()=>{});
  // #endregion
  throw new Error("DATABASE_URL is not set");
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
// #region agent log
fetch('http://127.0.0.1:7243/ingest/2bd28d29-ab02-4717-afee-a1d3013bc7f6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/db/prisma.ts:18',message:'prisma adapter initialized',data:{poolCreated:!!pool,adapterCreated:!!adapter},timestamp:Date.now(),sessionId:'debug-session',runId:'build-pre',hypothesisId:'H3'})}).catch(()=>{});
// #endregion

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: ["error", "warn"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
