"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { loginAction, type LoginState } from "./actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-xl bg-gradient-to-r from-[#1f7bff] to-[#00c8ff] px-4 py-3 font-medium text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Проверяем…" : "Войти"}
    </button>
  );
}

export function LoginForm({ from }: { from: string }) {
  const [state, action] = useActionState<LoginState, FormData>(loginAction, {
    error: null,
  });

  return (
    <form
      action={action}
      className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-8"
    >
      <input type="hidden" name="from" value={from} />

      <label className="block">
        <span className="mb-1.5 block text-sm text-white/60">Логин или почта</span>
        <input
          name="identifier"
          type="text"
          autoComplete="username"
          required
          autoFocus
          className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-[#1f7bff]"
        />
      </label>

      <label className="block">
        <span className="mb-1.5 block text-sm text-white/60">Пароль</span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-[#1f7bff]"
        />
      </label>

      {state.error ? (
        <p
          role="alert"
          className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300"
        >
          {state.error}
        </p>
      ) : null}

      <Submit />
    </form>
  );
}