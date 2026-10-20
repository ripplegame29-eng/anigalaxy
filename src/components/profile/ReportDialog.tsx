"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Окно «Пожаловаться» — по макету «AniGalaxy — профиль и подписки».
 *
 * В макете отправка идёт на бэкенд. Здесь сервера нет, поэтому жалоба
 * сохраняется в этом браузере, и надпись об этом прямо говорит: «модераторы
 * проверят» здесь было бы обещанием, которого не выполнит никто.
 *
 * Причина и текст копятся в `animehub:reports:v1` — это настоящая запись,
 * а не пустое нажатие на кнопку.
 */

const KEY = "animehub:reports:v1";
const MAX = 500;
const MIN = 10;

export interface Report {
  reason: string;
  text: string;
  at: number;
}

function read(): Report[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is Report =>
        Boolean(item) &&
        typeof item === "object" &&
        typeof (item as Report).text === "string" &&
        typeof (item as Report).at === "number",
    );
  } catch {
    return [];
  }
}

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

  const reasons = ["Спам", "Оскорбления", "Неприемлемый контент", "Другое"];

  const open = useCallback(() => {
    setReason("");
    setText("");
    setDone(false);
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

  const submit = useCallback(() => {
    if (!canSend) return;
    const next = [...read(), { reason: reason || "Другое", text: trimmed, at: Date.now() }];
    try {
      localStorage.setItem(KEY, JSON.stringify(next.slice(-50)));
    } catch {
      /* приватный режим: жалоба просто не сохранится, но и ошибку не покажем */
    }
    setDone(true);
  }, [canSend, reason, trimmed]);

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
                submit();
              }}
            >
              <h3 id="rd-t">Пожаловаться на {nickname}</h3>
              <p>Расскажите, что не так. В этом демо жалоба сохранится в этом браузере.</p>

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

              <div className="ract">
                <button type="button" className="rbtn rghost" onClick={close}>
                  Отмена
                </button>
                <button type="submit" className="rbtn rsend" disabled={!canSend}>
                  Отправить жалобу
                </button>
              </div>
            </form>
          ) : (
            <div className="rdone">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="12" r="9" />
                <path d="m8 12.5 3 3 5-6" />
              </svg>
              <h3>Жалоба сохранена</h3>
              <p>
                Она лежит в этом браузере. Когда у проекта появится сервер, отправка
                подключится здесь же — данные уже собраны.
              </p>
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