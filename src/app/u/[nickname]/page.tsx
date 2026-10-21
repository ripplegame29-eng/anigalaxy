"use client";

import { use } from "react";
import Link from "next/link";
import { useAccount } from "@/lib/use-account";
import { useProfile } from "@/lib/profile";
import { DEMO_PERSONAS } from "@/lib/comments";
import { PROGRESSION_CONFIG } from "@/lib/progression/progression.config";
import { AgTag } from "@/components/progression/AgTag";
import { FRAMES } from "@/lib/cosmetics";
import { AvatarFrame } from "@/components/profile/AvatarFrame";
import { isPremiumActive } from "@/lib/auth";
import type { TagDef } from "@/lib/progression/types";

const TAG_BY_ID = new Map(PROGRESSION_CONFIG.tags.map((tag) => [tag.id, tag]));

export default function PublicProfilePage({ params }: { params: Promise<{ nickname: string }> }) {
  const { nickname } = use(params);
  const decoded = decodeURIComponent(nickname);
  const account = useAccount();
  const profile = useProfile();

  const isMe = account?.nickname?.toLowerCase() === decoded.toLowerCase();
  const persona = DEMO_PERSONAS.find((item) => item.name.toLowerCase() === decoded.toLowerCase());

  if (isMe) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-2xl font-extrabold">{account?.nickname}</h1>
        <p className="mt-2 text-muted">Это ваш профиль.</p>
        <Link href="/u/me" className="mt-4 inline-block text-accent hover:underline">
          Открыть полный профиль
        </Link>
      </div>
    );
  }

  if (!persona) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-2xl font-extrabold">{decoded}</h1>
        <p className="mt-2 text-muted">Профиль пользователя пока недоступен.</p>
        <Link href="/" className="mt-4 inline-block text-accent hover:underline">
          На главную
        </Link>
      </div>
    );
  }

  const tag = TAG_BY_ID.get(persona.tagId) as TagDef | undefined;
  const frame = FRAMES.find((item) => item.id === profile.frameId);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="flex items-center gap-4">
        <AvatarFrame nickname={decoded} avatar={undefined} frame={frame} size="md" />
        <div>
          <h1 className="text-2xl font-extrabold">{decoded}</h1>
          <p className="text-sm text-muted">Уровень {persona.level} · {persona.premium ? "Premium" : "Без Premium"}</p>
          {tag && <AgTag tag={tag} size="sm" />}
        </div>
      </div>
      <p className="mt-6 text-muted">
        Это демо-профиль. Полные данные профиля доступны только владельцу аккаунта.
      </p>
    </div>
  );
}
