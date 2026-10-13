-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_promo_redemptions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "promoId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "redeemedAt" BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT "promo_redemptions_promoId_fkey" FOREIGN KEY ("promoId") REFERENCES "promo_codes" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "promo_redemptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_promo_redemptions" ("id", "promoId", "redeemedAt", "userId") SELECT "id", "promoId", "redeemedAt", "userId" FROM "promo_redemptions";
DROP TABLE "promo_redemptions";
ALTER TABLE "new_promo_redemptions" RENAME TO "promo_redemptions";
CREATE INDEX "promo_redemptions_userId_idx" ON "promo_redemptions"("userId");
CREATE UNIQUE INDEX "promo_redemptions_promoId_userId_key" ON "promo_redemptions"("promoId", "userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
