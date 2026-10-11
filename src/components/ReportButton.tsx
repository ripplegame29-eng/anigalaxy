"use client";

import { useState } from "react";

/**
 * Кнопка «Пожаловаться» для комментария.
 *
 * Отправляет жалобу на серверную таблицу `reports`, откуда она попадает в
 * раздел «Модерация». До появления этого сервера жалобы жили только в
 * браузере автора — то есть модератор не мог узнать о них вообще.
 *
 * Комментарии пока хранятся в localStorage автора (см. lib/comments.ts), поэтому
 * в `targetId` кладём id комментария, а не ссылку на страницу: после переноса
 * комментариев в базу этот же идентификатор начнёт работать как есть.
 */

const REASONS = [
  { value: "spam", label: "Спам" },
  { value: "abuse", label: "Оскорбления" },
  { value: "adult", label: "Неприемлемый контент" },
  { value: "wrong_info", label: "Неверная информация" },
  { value: "other", label: "Другое" },
];

type State = "idle" | "open" | "sending" | "sent" | "error";

export function ReportButton({
  commentId,
  titleId,
  onClose,
}: {
  commentId: string;
  titleId: string;
  onClose: () => void;
}) {
  const [state, setState] = useState<State>("idle");
  const [reason, setReason] = useState("spam");
  const [details, setDetails] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setState("sending");
    setError(null);

    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetType: "comment",
          targetId: `${titleId}/${commentId}`,
          reason,
          details,
        }),
      });

      const data = (await res.json()) as { ok: boolean; error?: string };

      if (data.ok) {
        setState("sent");
        return;
      }

      setError(data.error ?? "Не удалось отправить");
      setState("error");
    } catch {
      setError("Сеть недоступна");
      setState("error");
    }
  }

  if (state === "idle") {
    return (
      <button
        type="button"
        title="Пожаловаться"
        onClick={() => setState("open")}
        className="text-xs text-white/30 transition hover:text-white/70"
      >
        ⋮
      </button>
    );
  }

  if (state === "sent") {
    return (
      <div className="flex items-center gap-2 text-xs text-emerald-300/80">
        <span>Жалоба отправлена</span>
        <button type="button" onClick={onClose} className="text-white/40 hover:text-white/70">
          Закрыть
        </button>
      </div>
    );
  }

  return (
    <div className="w-64 space-y-2 rounded-xl border border-white/10 bg-[#14141c] p-3 text-xs">
      <p className="font-semibold text-white/80">Пожаловаться на комментарий</p>

      <select
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        className="w-full rounded-lg border border-white/15 bg-black/40 px-2 py-1"
      >
        {REASONS.map((r) => (
          <option key={r.value} value={r.value}>
            {r.label}
          </option>
        ))}
      </select>

      <textarea
        value={details}
        onChange={(e) => setDetails(e.target.value)}
        placeholder="Подробности (необязательно)"
        maxLength={1000}
        rows={2}
        className="w-full resize-none rounded-lg border border-white/15 bg-black/40 px-2 py-1"
      />

      {error ? <p className="text-red-300">{error}</p> : null}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={state === "sending"}
          className="flex-1 rounded-lg bg-gradient-to-r from-[#1f7bff] to-[#00c8ff] px-2 py-1 font-semibold text-white disabled:opacity-50"
        >
          {state === "sending" ? "Отправляем…" : "Отправить"}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-white/15 px-2 py-1 text-white/60"
        >
          Отмена
        </button>
      </div>
    </div>
  );
}