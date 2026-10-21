import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";

import { dbAvailable, getDb } from "@/lib/server/db";
import { clientIp, setSessionCookie } from "@/lib/server/http";
import { createSession, toPublic, upsertTelegramUser } from "@/lib/server/users";

export const runtime = "nodejs";

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 10;
const attempts = new Map<string, { count: number; resetAt: number }>();

function rateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = attempts.get(ip);
  if (!entry || entry.resetAt <= now) {
    attempts.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count += 1;
  return true;
}

interface TelegramUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

function isTelegramUser(value: unknown): value is TelegramUser {
  if (!value || typeof value !== "object") return false;
  const user = value as Record<string, unknown>;
  return (
    typeof user.id === "number" &&
    Number.isFinite(user.id) &&
    typeof user.auth_date === "number" &&
    Number.isFinite(user.auth_date) &&
    typeof user.hash === "string" &&
    user.hash.length > 0
  );
}

function verifyTelegramUser(user: TelegramUser, botToken: string): boolean {
  const { hash, ...rest } = user;
  if (!hash || !rest.auth_date) return false;

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
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!rateLimit(ip)) {
    return NextResponse.json({ ok: false, error: "Too many requests" }, { status: 429 });
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    return NextResponse.json({ ok: false, error: "Telegram bot token is not configured" }, { status: 500 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }

  if (!isTelegramUser(body)) {
    return NextResponse.json({ ok: false, error: "Incomplete Telegram data" }, { status: 400 });
  }

  if (!verifyTelegramUser(body, botToken)) {
    return NextResponse.json({ ok: false, error: "Invalid Telegram signature" }, { status: 403 });
  }

  let nickname = (body.username || body.first_name || `tg_${body.id}`).trim();
  let account: ReturnType<typeof toPublic> | null = null;
  let token: string | null = null;

  /* Если база подключена — заводим (или находим) игрока и выдаём сессию:
     тогда прогресс и кланы привязаны к Telegram-аккаунту на любом устройстве. */
  if (dbAvailable()) {
    try {
      const db = getDb();
      const upserted = upsertTelegramUser(db, { telegramId: String(body.id), nickname });
      if (upserted.ok) {
        nickname = upserted.value.nickname;
        account = toPublic(upserted.value);
        token = createSession(db, upserted.value.id, {
          userAgent: request.headers.get("user-agent") ?? "",
          ip: clientIp(request),
        }).token;
      }
    } catch {
      /* база недоступна — остаёмся с локальным входом */
    }
  }

  const response = NextResponse.json({
    ok: true,
    telegram: {
      id: body.id,
      username: body.username ?? null,
      firstName: body.first_name ?? null,
      lastName: body.last_name ?? null,
      photoUrl: body.photo_url ?? null,
    },
    nickname,
    account,
  });
  if (token) setSessionCookie(response, request, token);
  return response;
}
