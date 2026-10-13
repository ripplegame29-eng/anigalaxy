import type { Metadata } from "next";
import Link from "next/link";

import { getSession } from "@/lib/auth-server";
import { can } from "@/lib/roles";

import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Вход — AniGalaxy",
  robots: { index: false, follow: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const { from } = await searchParams;

  // Если человек уже вошёл и ему есть доступ в панель — форма ему не нужна.
  const session = await getSession();
  if (session && can(session.user.role, "panel")) {
    return (
      <main className="flex min-h-dvh items-center justify-center px-4">
        <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center">
          <p className="text-white/70">
            Вы вошли как <span className="text-white">{session.user.nickname}</span>.
          </p>
          <Link
            href="/admin"
            className="mt-6 inline-block rounded-xl bg-gradient-to-r from-[#1f7bff] to-[#00c8ff] px-5 py-3 font-medium text-white"
          >
            Перейти в панель
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Link href="/" className="text-2xl font-semibold tracking-tight">
            Ani<span className="text-[#00c8ff]">Galaxy</span>
          </Link>
          <p className="mt-2 text-sm text-white/50">Вход для сотрудников сайта</p>
        </div>

        <LoginForm from={from ?? "/admin"} />

        <Link
          href="/"
          className="mt-6 block text-center text-sm text-white/40 hover:text-white/70"
        >
          ← Вернуться на сайт
        </Link>
      </div>
    </main>
  );
}