import type { Metadata } from "next";
import Link from "next/link";

import { logoutAction } from "@/app/login/actions";
import { requireAdmin } from "@/lib/require-admin";
import { ROLE_LABELS, can } from "@/lib/roles";

import { AdminNav } from "./admin-nav";
import { ADMIN_SECTIONS } from "./sections";

export const metadata: Metadata = {
  title: "Панель управления — AniGalaxy",
  // Панель не должна попадать в индекс поисковиков даже по прямой ссылке.
  robots: { index: false, follow: false },
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Проверка в layout, а не в каждой странице: забыть про неё в новой
  // странице невозможно, потому что layout оборачивает их все.
  const session = await requireAdmin();

  const visible = ADMIN_SECTIONS.filter((section) =>
    can(session.user.role, section.permission),
  );

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#07070c]/90 backdrop-blur">
        <div className="mx-auto max-w-6xl px-6">
          <div className="flex items-center justify-between py-3">
            <div className="flex items-center gap-4">
              <Link href="/admin" className="font-semibold">
                Ani<span className="text-[#00c8ff]">Galaxy</span>
                <span className="ml-2 text-xs font-normal text-white/40">панель</span>
              </Link>
            </div>

            <div className="flex items-center gap-3 text-sm">
              <span className="hidden text-white/50 sm:inline">
                {session.user.displayName ?? session.user.nickname}
                <span className="ml-2 rounded-md bg-white/10 px-2 py-0.5 text-xs">
                  {ROLE_LABELS[session.user.role]}
                </span>
              </span>
              <form action={logoutAction}>
                <button
                  type="submit"
                  className="rounded-lg border border-white/10 px-3 py-1.5 text-white/60 transition hover:border-white/25 hover:text-white"
                >
                  Выйти
                </button>
              </form>
            </div>
          </div>

          <div className="pb-2">
            <AdminNav sections={visible} />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}