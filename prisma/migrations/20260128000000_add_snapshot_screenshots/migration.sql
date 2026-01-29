-- Add screenshot fields to Snapshot
ALTER TABLE "Snapshot"
ADD COLUMN "screenshot" BYTEA,
ADD COLUMN "screenshotMime" TEXT;
