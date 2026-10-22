import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ViewFrame } from "@/components/profile/ViewFrame";
import { dbAvailable, getDb } from "@/lib/server/db";
import { buildProfileView } from "@/lib/server/profile-view";
import { SESSION_COOKIE, sessionUser } from "@/lib/server/users";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ nickname: string }> }): Promise<Metadata> {
  const { nickname } = await params;
  return { title: `${decodeURIComponent(nickname)} · профиль · AniGalaxy`, robots: { index: false, follow: false } };
}

function Message({ title, text }: { title: string; text: string }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-extrabold">{title}</h1>
      <p className="mt-2 text-muted">{text}</p>
      <Link href="/leaderboard" className="mt-4 inline-block text-accent hover:underline">
        К рейтингу
      </Link>
    </div>
  );
}

/**
 * Чужой профиль — `/u/<ник>`. Обычная страница сайта: шапка, меню и чат
 * принадлежат зрителю. Сам профиль показывает вложенное окно `/view/<ник>`,
 * где данные игрока подставлены вместо данных зрителя и не смешиваются
 * с его аккаунтом.
 */
export default async function PublicProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ nickname: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { nickname } = await params;
  const decoded = decodeURIComponent(nickname);
  if (decoded.toLowerCase() === "me") redirect("/profile");

  if (!dbAvailable()) return <Message title={decoded} text="Сервер временно недоступен. Попробуйте позже." />;
  const db = getDb();
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const viewer = sessionUser(db, token);
  if (viewer && viewer.nickname.toLowerCase() === decoded.toLowerCase()) redirect("/profile");

  const view = buildProfileView(db, decoded, viewer?.id ?? null);
  if (!view.ok) {
    return view.reason === "closed" ? (
      <Message title={view.nickname} text="Профиль закрыт владельцем." />
    ) : (
      <Message title={decoded} text="Игрок с таким ником не найден." />
    );
  }

  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    if (typeof value === "string") query.set(key, value);
  }
  const qs = query.toString();
  return <ViewFrame src={`/view/${encodeURIComponent(view.nickname)}${qs ? `?${qs}` : ""}`} title={`Профиль игрока ${view.nickname}`} />;
}
