import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { AdminView } from "@/components/admin/AdminView";
import { dbAvailable, getDb } from "@/lib/server/db";
import { SESSION_COOKIE, sessionUser } from "@/lib/server/users";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Админ-панель · AniGalaxy", robots: { index: false, follow: false } };

/** Только для админов: остальным страница не существует (404) */
export default async function AdminPage() {
  if (!dbAvailable()) notFound();
  const user = sessionUser(getDb(), (await cookies()).get(SESSION_COOKIE)?.value);
  if (user?.role !== "admin") notFound();
  return <AdminView me={user.nickname} />;
}
