"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

/**
 * Всплывающее уведомление панели.
 *
 * Существует ради одной вещи: сообщить, что действие сработало, не уводя
 * взгляд с таблицы. Серверные ошибки форм показываются рядом с полями —
 * там, где человек их ждёт. Сюда попадает то, что происходит вдали от формы:
 * переход по «/», клик по быстрому действию, смена темы.
 *
 * Провайдер держит текст в состоянии, но таймер — в ref: на каждый вызов
 * show нужен свой, а useEffect с зависимостью от текста перезапускал бы
 * анимацию при повторе того же сообщения.
 */

type ToastFn = (message: string) => void;

const ToastContext = createContext<ToastFn | null>(null);

/** 2.4 с — как в макете; дольше раздражает, короче не успевают прочесть. */
const VISIBLE_MS = 2400;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback<ToastFn>((next) => {
    if (timer.current) clearTimeout(timer.current);
    setMessage(next);
    timer.current = setTimeout(() => setMessage(null), VISIBLE_MS);
  }, []);

  const value = useMemo(() => show, [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className={`ag-toast${message ? " show" : ""}`}
        role="status"
        aria-live="polite"
      >
        {message}
      </div>
    </ToastContext.Provider>
  );
}

/**
 * Вне провайдера отдаём no-op, а не бросаем: сломанный тост не должен
 * ронять раздел, который сам по себе работает.
 */
export function useToast(): ToastFn {
  return useContext(ToastContext) ?? (() => {});
}