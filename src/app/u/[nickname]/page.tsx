"use client";

import { use } from "react";
import Link from "next/link";
import { useAccount } from "@/lib/use-account";
import { usePublicProfile } from "@/lib/profiles-cloud";

/** Дата регистрации: фиксированная зона и локаль, чтобы сервер и клиент совпадали */
const formatJoined = (ms: number): string =>
  new Date(ms).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

export default function PublicProfilePage({ params }: { params: Promise<{ nickname: string }> }) {
  const { nickname } = use(params);
  const decoded = decodeURIComponent(nickname);
  const account = useAccount();
  const state = usePublicProfile(decoded);
  const isMe = account?.nickname?.toLowerCase() === decoded.toLowerCase();

  if (state.status === "loading") {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-2xl font-extrabold">{decoded}</h1>
        <p className="mt-2 text-muted">Загружаем профиль…</p>
      </div>
    );
  }

  if (state.status === "missing") {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-2xl font-extrabold">{decoded}</h1>
        <p className="mt-2 text-muted">Игрок с таким ником не найден.</p>
        <Link href="/" className="mt-4 inline-block text-accent hover:underline">
          На главную
        </Link>
      </div>
    );
  }

  const { profile } = state;
  const stats: { label: string; value: string }[] = [
    { label: "Уровень", value: String(profile.level) },
    { label: "Опыт", value: profile.xpTotal.toLocaleString("ru-RU") },
    { label: "Место в рейтинге", value: profile.rank ? `#${profile.rank}` : "—" },
  ];

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="flex items-center gap-4">
        <span className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#2AABEE] to-[#229ED9] text-2xl font-black text-white">
          {profile.nickname.slice(0, 1).toUpperCase()}
        </span>
        <div className="min-w-0">
          <h1 className="flex flex-wrap items-center gap-2 text-2xl font-extrabold">
            <span className="truncate">{profile.nickname}</span>
            {profile.clan && (
              <span className="rounded-md bg-white/8 px-2 py-0.5 text-xs font-bold text-muted">[{profile.clan.tag}]</span>
            )}
            {profile.premium && (
              <span className="rounded-md bg-accent/15 px-2 py-0.5 text-xs font-bold text-accent">Premium</span>
            )}
          </h1>
          <p className="text-sm text-muted">
            С нами с {formatJoined(profile.joinedAt)}
            {profile.clan ? ` · клан «${profile.clan.name}»` : ""}
          </p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-3 gap-3">
        {stats.map((item) => (
          <div key={item.label} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-4 text-center">
            <b className="block text-xl font-extrabold text-white">{item.value}</b>
            <span className="text-xs text-muted">{item.label}</span>
          </div>
        ))}
      </div>

      {isMe && (
        <Link href="/profile" className="mt-6 inline-block text-accent hover:underline">
          Открыть мой полный профиль
        </Link>
      )}
    </div>
  );
}
