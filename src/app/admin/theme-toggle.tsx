"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";

type Theme = "paper" | "space";

const STORAGE_KEY = "ag-theme";

/**
 * Тема панели.
 *
 * Хранится в data-атрибуте на <html>, а не в состоянии React: её должен видеть
 * и CSS, и скрипт до гидрации (см. ADMIN_THEME_SCRIPT), иначе при перезагрузке
 * на тёмной теме панель мигнёт светлой. Здесь этот атрибут читается как
 * внешний источник через useSyncExternalStore — так React перерисовывает
 * подпись кнопки сама, без setState внутри эффекта.
 */

function currentTheme(): Theme {
  return document.documentElement.dataset.theme === "dark" ? "space" : "paper";
}

/**
 * Подписка нужна для смены темы из другой вкладки: без неё переключатель
 * показывал бы старое состояние, пока пользователь не перезагрузит страницу.
 */
function subscribe(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  // Свои изменения атрибут не порождает, поэтому после applyTheme шлём вручную.
  window.addEventListener("ag-theme-change", onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener("ag-theme-change", onChange);
  };
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, currentTheme, () => "paper" as Theme);

  // Инлайн-скрипт в layout ставит тему только при полной загрузке страницы.
  // При переходе на /admin клиентом React его не выполняет (скрипт внутри
  // компонента), и панель мигнула бы светлой, а потом «прыгнула» в тёмную,
  // когда прочитает localStorage. Поэтому на монтировании применяем сохранённую
  // тему явно. Запись в DOM, а не setState: значение и так приедет через
  // useSyncExternalStore.
  useEffect(() => {
    const stored = currentTheme();
    const applied = document.documentElement.dataset.theme === "dark" ? "space" : "paper";

    if (stored === applied) return;

    if (stored === "space") document.documentElement.dataset.theme = "dark";
    else delete document.documentElement.dataset.theme;

    window.dispatchEvent(new Event("ag-theme-change"));
  }, []);

  const pick = useCallback((next: Theme) => {
    const root = document.documentElement;

    // Пока класс .theming висит на <html>, все элементы получают transition по
    // цвету. Без него при сорока переменных смена выглядит как вспышка.
    root.classList.add("theming");

    if (next === "space") root.dataset.theme = "dark";
    else delete root.dataset.theme;

    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Приватный режим: тема просто не переживёт перезагрузку.
    }

    window.dispatchEvent(new Event("ag-theme-change"));
    window.setTimeout(() => root.classList.remove("theming"), 700);
  }, []);

  return (
    <div className="ag-theme">
      <div className="ag-seg" role="group" aria-label="Тема оформления">
        <button
          type="button"
          className={theme === "paper" ? "on" : ""}
          onClick={() => pick("paper")}
          aria-pressed={theme === "paper"}
          title="Бумага — светлая тема"
        >
          Светлая
        </button>
        <button
          type="button"
          className={theme === "space" ? "on" : ""}
          onClick={() => pick("space")}
          aria-pressed={theme === "space"}
          title="Космос — тёмная тема"
        >
          Тёмная
        </button>
      </div>
    </div>
  );
}

/**
 * Скрипт, ставящий тему до первой отрисовки.
 *
 * Если этого куска не будет, панель на тёмной теме сначала покажется светлой
 * и только потом перекрасится — заметно на медленной загрузке.
 */
export const ADMIN_THEME_SCRIPT = `try{if(localStorage.getItem("${STORAGE_KEY}")==="space")document.documentElement.dataset.theme="dark"}catch(e){}`;