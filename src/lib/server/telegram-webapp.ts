import { createHmac, timingSafeEqual } from "node:crypto";

const MAX_AGE_S = 24 * 60 * 60;

export interface WebAppUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
}

/** Проверка подписи initData мини-приложения: https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app */
export function verifyInitData(initData: string, botToken: string, now = Date.now()): WebAppUser | null {
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return null;
  params.delete("hash");
  const check = [...params.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");
  const secret = createHmac("sha256", "WebAppData").update(botToken).digest();
  const expected = createHmac("sha256", secret).update(check).digest("hex");
  try {
    if (!timingSafeEqual(Buffer.from(expected), Buffer.from(hash))) return null;
  } catch {
    return null;
  }
  const authDate = Number(params.get("auth_date"));
  if (!Number.isFinite(authDate) || Math.abs(now / 1000 - authDate) > MAX_AGE_S) return null;
  try {
    const user = JSON.parse(params.get("user") ?? "") as WebAppUser;
    return typeof user.id === "number" ? user : null;
  } catch {
    return null;
  }
}

