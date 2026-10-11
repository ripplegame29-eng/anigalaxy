"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { audit } from "@/lib/admin/audit";
import { destroySession, login, metaFromHeaders } from "@/lib/auth-server";

export interface LoginState {
  error: string | null;
}

export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const identifier = String(formData.get("identifier") ?? "");
  const password = String(formData.get("password") ?? "");
  const from = String(formData.get("from") ?? "/admin");

  const meta = metaFromHeaders(await headers());
  const result = await login(identifier, password, meta);

  if (!result.ok || !result.user) {
    return { error: result.error ?? "Не удалось войти" };
  }

  // Вход — тоже действие в системе: по журналу видно, когда и откуда
  // кто-то вошёл в аккаунт админа.
  await audit({
    actorId: result.user.id,
    action: "auth.login",
    targetType: "user",
    targetId: result.user.id,
    summary: `Вход: ${result.user.nickname} (${result.user.role})`,
    ip: meta.ip,
  });

  // Путь из формы берём только если он ведёт внутрь панели: иначе через
  // параметр можно увести админа на внешний сайт (open redirect).
  const target = from.startsWith("/admin") || from === "/" ? from : "/admin";
  redirect(target);
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/");
}