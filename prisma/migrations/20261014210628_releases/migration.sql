-- CreateTable
CREATE TABLE "releases" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "studio" TEXT,
    "day" INTEGER NOT NULL,
    "time" TEXT NOT NULL,
    "episodes" INTEGER,
    "rating" REAL,
    "isNew" BOOLEAN NOT NULL DEFAULT false,
    "genres" TEXT,
    "poster" TEXT,
    "banner" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" BIGINT NOT NULL DEFAULT 0,
    "updatedAt" BIGINT NOT NULL DEFAULT 0
);

-- CreateIndex
CREATE INDEX "releases_enabled_day_time_idx" ON "releases"("enabled", "day", "time");
