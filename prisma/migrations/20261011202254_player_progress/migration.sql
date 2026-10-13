-- CreateTable
CREATE TABLE "player_progress" (
    "userId" TEXT NOT NULL PRIMARY KEY,
    "doc" TEXT NOT NULL,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "touched_by_admin" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" BIGINT NOT NULL DEFAULT 0,
    "updated_at" BIGINT NOT NULL DEFAULT 0,
    "revision" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "player_progress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "player_progress_updated_at_idx" ON "player_progress"("updated_at");
