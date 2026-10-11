-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nickname" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'user',
    "status" TEXT NOT NULL DEFAULT 'active',
    "bannedUntil" BIGINT,
    "banReason" TEXT,
    "bannedById" TEXT,
    "bannedAt" BIGINT,
    "premiumUntil" BIGINT NOT NULL DEFAULT 0,
    "displayName" TEXT,
    "avatarUrl" TEXT,
    "bio" TEXT,
    "signature" TEXT,
    "createdAt" BIGINT NOT NULL DEFAULT 0,
    "updatedAt" BIGINT NOT NULL DEFAULT 0,
    "lastSeenAt" BIGINT
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" BIGINT NOT NULL,
    "expiresAt" BIGINT NOT NULL,
    "lastUsedAt" BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT,
    "summary" TEXT,
    "before" TEXT,
    "after" TEXT,
    "ip" TEXT,
    "createdAt" BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT "audit_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "reports" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "authorId" TEXT,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "details" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "resolvedById" TEXT,
    "resolution" TEXT,
    "resolvedAt" BIGINT,
    "createdAt" BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT "reports_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "reports_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "content_blocks" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL,
    "title" TEXT,
    "payload" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "startsAt" BIGINT,
    "endsAt" BIGINT,
    "createdAt" BIGINT NOT NULL DEFAULT 0,
    "updatedAt" BIGINT NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "seasons" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startsAt" BIGINT NOT NULL,
    "endsAt" BIGINT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "resetOnClose" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" BIGINT NOT NULL DEFAULT 0,
    "updatedAt" BIGINT NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "promo_codes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,
    "maxUses" INTEGER,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "perUserLimit" INTEGER NOT NULL DEFAULT 1,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "startsAt" BIGINT,
    "endsAt" BIGINT,
    "createdAt" BIGINT NOT NULL DEFAULT 0,
    "updatedAt" BIGINT NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "promo_redemptions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "promoId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "redeemedAt" BIGINT NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "settings" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "updatedAt" BIGINT NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "feature_flags" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "updatedAt" BIGINT NOT NULL DEFAULT 0,
    "updatedById" TEXT
);

-- CreateTable
CREATE TABLE "error_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "level" TEXT NOT NULL DEFAULT 'error',
    "source" TEXT NOT NULL,
    "operation" TEXT,
    "message" TEXT NOT NULL,
    "stack" TEXT,
    "context" TEXT,
    "fingerprint" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "userId" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "firstSeenAt" BIGINT NOT NULL DEFAULT 0,
    "lastSeenAt" BIGINT NOT NULL DEFAULT 0,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedById" TEXT
);

-- CreateTable
CREATE TABLE "api_health" (
    "service" TEXT NOT NULL PRIMARY KEY,
    "ok" BOOLEAN NOT NULL DEFAULT false,
    "latencyMs" INTEGER,
    "error" TEXT,
    "checkedAt" BIGINT NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "announcements" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "placement" TEXT NOT NULL DEFAULT 'banner',
    "premiumOnly" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "startsAt" BIGINT,
    "endsAt" BIGINT,
    "publishedAt" BIGINT NOT NULL DEFAULT 0,
    "createdAt" BIGINT NOT NULL DEFAULT 0,
    "updatedAt" BIGINT NOT NULL DEFAULT 0
);

-- CreateIndex
CREATE UNIQUE INDEX "users_nickname_key" ON "users"("nickname");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_status_idx" ON "users"("status");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_tokenHash_key" ON "sessions"("tokenHash");

-- CreateIndex
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");

-- CreateIndex
CREATE INDEX "sessions_expiresAt_idx" ON "sessions"("expiresAt");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_actorId_idx" ON "audit_logs"("actorId");

-- CreateIndex
CREATE INDEX "audit_logs_targetType_targetId_idx" ON "audit_logs"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "reports_status_idx" ON "reports"("status");

-- CreateIndex
CREATE INDEX "reports_targetType_targetId_idx" ON "reports"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "content_blocks_kind_enabled_idx" ON "content_blocks"("kind", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "seasons_slug_key" ON "seasons"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "promo_codes_code_key" ON "promo_codes"("code");

-- CreateIndex
CREATE INDEX "promo_codes_active_idx" ON "promo_codes"("active");

-- CreateIndex
CREATE INDEX "promo_redemptions_userId_idx" ON "promo_redemptions"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "promo_redemptions_promoId_userId_key" ON "promo_redemptions"("promoId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "error_logs_fingerprint_key" ON "error_logs"("fingerprint");

-- CreateIndex
CREATE INDEX "error_logs_resolved_lastSeenAt_idx" ON "error_logs"("resolved", "lastSeenAt");

-- CreateIndex
CREATE INDEX "error_logs_fingerprint_idx" ON "error_logs"("fingerprint");

-- CreateIndex
CREATE INDEX "error_logs_source_level_idx" ON "error_logs"("source", "level");
