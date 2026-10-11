"use client";

import { useState } from "react";
import Link from "next/link";

/**
 * Кнопки поддержки внизу страницы `/donate`. Паттерн как в магазине:
 * кнопка активна, оплаты пока нет — после нажатия выводим статус в
 * aria-live-поле (без модальных окон).
 */
export function DonateCta() {
  const [note, setNote] = useState("");

  return (
    <div className="mx-auto max-w-4xl px-4 pt-8 text-center">
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={() =>
            setNote("Спасибо за поддержку! Оплата подключится позже — пока она недоступна.")
          }
          className="btn-primary rounded-xl px-6 py-3 text-sm font-bold text-white"
        >
          ✨ Поддержать проект →
        </button>
        <Link
          href="/profile"
          className="btn-ghost rounded-xl border border-line bg-card/70 px-6 py-3 text-sm font-bold text-white hover:border-accent/40 hover:text-accent-2"
        >
          Мой профиль →
        </Link>
      </div>

      <p aria-live="polite" className="mt-3 min-h-4 text-xs font-bold text-mint">
        {note}
      </p>
    </div>
  );
}
