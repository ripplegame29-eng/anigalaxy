import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";

export const runtime = "nodejs";

interface TelegramUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

function verifyTelegramUser(user: TelegramUser, botToken: string): boolean {
  const { hash, ...rest } = user;
  if (!hash || !rest.auth_date) return false;

  // Защита от старых/поддельных ответов: не старше суток
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - rest.auth_date) > 86400) return false;

  const dataCheckString = Object.keys(rest)
    .sort()
    .map((key) => `${key}=${rest[key as keyof typeof rest]}`)
    .join("\n");

  const secretKey = crypto.createHash("sha256").update(botToken).digest();
  const hmac = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

  try {
    return crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(hash));
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    return NextResponse.json({ ok: false, error: "Telegram bot token is not configured" }, { status: 500 });
  }

  let user: TelegramUser;
  try {
    user = (await request.json()) as TelegramUser;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }

  if (!user?.id || !user?.hash || !user?.auth_date) {
    return NextResponse.json({ ok: false, error: "Incomplete Telegram data" }, { status: 400 });
  }

  if (!verifyTelegramUser(user, botToken)) {
    return NextResponse.json({ ok: false, error: "Invalid Telegram signature" }, { status: 403 });
  }

  const nickname = (user.username || user.first_name || `tg_${user.id}`).trim();
  return NextResponse.json({
    ok: true,
    telegram: {
      id: user.id,
      username: user.username ?? null,
      firstName: user.first_name ?? null,
      lastName: user.last_name ?? null,
      photoUrl: user.photo_url ?? null,
    },
    nickname,
  });
}
