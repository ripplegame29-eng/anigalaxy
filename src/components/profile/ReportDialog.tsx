"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { postToParent } from "@/lib/view-mode";

/**
 * Окно «Пожаловаться» — по макету «AniGalaxy — профиль и подписки».
 * Жалоба уходит на сервер (`/api/reports`) и попадает в очередь модерации;
 * без входа отправить её нельзя.
 */

const MAX = 500;
const MIN = 10;

export interface ReportDialogProps {
  className?: string;
  nickname: string;
  label: React.ReactNode;
}

export function ReportDialog({ className, nickname, label }: ReportDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  const [reason, setReason] = useState("");
  const [text, setText] = useState("");
  const [done, setDone] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reasons = ["Спам", "Оскорбления", "Неприемлемый контент", "Другое"];

  const open = useCallback(() => {
    setReason("");
    setText("");
    setDone(false);
    setError(null);
    dialogRef.current?.showModal();
    textRef.current?.focus();
  }, []);

  const close = useCallback(() => dialogRef.current?.close(), []);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    const onBackdrop = (e: MouseEvent) => {
      if (e.target === el) el.close();
    };
    el.addEventListener("click", onBackdrop);
    return () => el.removeEventListener("click", onBackdrop);
  }, []);

  const trimmed = text.trim();
  const canSend = trimmed.length >= MIN;

  const submit = useCallback(async () => {
    if (!canSend || sending) return;
    setSending(true);
    setError(null);
    try {
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ nickname, reason: reason || "Другое", text: trimmed }),
      });
      const body = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (response.ok && body.ok) setDone(true);
      else if (response.status === 401) setError("Войдите в аккаунт, чтобы отправить жалобу");
      else setError(body.error ?? "Не удалось отправить жалобу");
    } catch {
      setError("Нет связи с сервером. Попробуйте ещё раз");
    }
    setSending(false);
  }, [canSend, sending, nickname, reason, trimmed]);

  return (
    <>
      <button type="button" className={className} onClick={open}>
        {label}
      </button>

      <dialog ref={dialogRef} className="rd" aria-labelledby="rd-t">
        <div className="rbox">
          {!done ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void submit();
              }}
            >
              <h3 id="rd-t">Пожаловаться на {nickname}</h3>
              <p>Расскажите, что не так. Жалобу получат модераторы AniGalaxy.</p>

              <div className="rchips" role="group" aria-label="Причина">
                {reasons.map((item) => (
                  <button
                    key={item}
                    type="button"
                    aria-pressed={reason === item}
                    onClick={() => setReason(reason === item ? "" : item)}
                  >
                    {item}
                  </button>
                ))}
              </div>

              <textarea
                ref={textRef}
                maxLength={MAX}
                placeholder="Опишите жалобу: что произошло и где вы это увидели"
                aria-label="Текст жалобы"
                value={text}
                onChange={(e) => setText(e.target.value)}
              />

              <div className="rcnt">
                <span>{canSend ? `Можно отправлять` : `Минимум ${MIN} символов`}</span>
                <span>
                  {text.length} / {MAX}
                </span>
              </div>

              {error ? (
                <p role="alert" style={{ color: "#fca5a5", fontSize: 13, margin: "8px 0 0" }}>
                  {error}{" "}
                  {error.startsWith("Войдите") ? (
                    <button type="button" className="underline" onClick={() => { close(); postToParent({ type: "ag-auth" }); }}>
                      Войти
                    </button>
                  ) : null}
                </p>
              ) : null}

              <div className="ract">
                <button type="button" className="rbtn rghost" onClick={close}>
                  Отмена
                </button>
                <button type="submit" className="rbtn rsend" disabled={!canSend || sending}>
                  {sending ? "Отправляем…" : "Отправить жалобу"}
                </button>
              </div>
            </form>
          ) : (
            <div className="rdone">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="12" r="9" />
                <path d="m8 12.5 3 3 5-6" />
              </svg>
              <h3>Жалоба отправлена</h3>
              <p>Спасибо. Модераторы проверят её и примут меры, если нарушение подтвердится.</p>
              <button type="button" className="rbtn rsend rfull" onClick={close}>
                Закрыть
              </button>
            </div>
          )}
        </div>
      </dialog>
    </>
  );
}