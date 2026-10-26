"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";

type Theme = "paper" | "space";

/**
 * Ключ сменился с `ag-theme` на `ag-theme-v2` осознанно.
 *
 * Прежний переключатель не применял тёмную тему: CSS ждал атрибут на
 * .ag-app, а код ставил его на <html>. Сохранённый `paper` у большинства
 * означал не выбор, а сломанный дефолт. Новый ключ даёт всем тёмную по
 * умолчанию, а явный выбор света продолжает сохраняться уже в v2.
 */
const STORAGE_KEY = "ag-theme-v2";

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
  return document.documentElement.dataset.theme === "light" ? "paper" : "space";
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
  // По умолчанию — тёмная тема: атрибута `light` на <html> нет.
  const theme = useSyncExternalStore(subscribe, currentTheme, () => "space" as Theme);

  // Инлайн-скрипт в layout ставит тему только при полной загрузке страницы.
  // При переходе на /admin клиентом React его не выполняет (скрипт внутри
  // компонента), и панель могла бы остаться светлой до ручного переключения.
  // Поэтому на монтировании применяем сохранённую тему явно. Запись в DOM,
  // а не setState: значение и так приедет через useSyncExternalStore.
  useEffect(() => {
    let stored: Theme | null = null;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      stored = raw === "paper" || raw === "space" ? raw : null;
    } catch {
      // Приватный режим: работаем с темой по умолчанию.
    }

    // Нет сохранённого выбора — тёмная. Светлую включают только осознанно.
    const next: Theme = stored === "paper" ? "paper" : "space";
    const applied: Theme = currentTheme();

    if (next === applied) return;

    if (next === "paper") document.documentElement.dataset.theme = "light";
    else document.documentElement.dataset.theme = "dark";

    window.dispatchEvent(new Event("ag-theme-change"));
  }, []);

  const pick = useCallback((next: Theme) => {
    const root = document.documentElement;

    // Пока класс .theming висит на <html>, все элементы получают transition по
    // цвету. Без него при сорока переменных смена выглядит как вспышка.
    root.classList.add("theming");

    // Светлая — явный атрибут `light`; тёмная — значение по умолчанию,
    // поэтому атрибут можно просто снять.
    if (next === "paper") root.dataset.theme = "light";
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
 * По умолчанию — тёмная: светлую включают только явным выбором, и тогда
 * на <html> появляется `data-theme="light"`. Если сохранён выбор «тёмная»
 * или выбора ещё нет, атрибут снимается.
 *
 * Если этого куска не будет, панель на светлой теме сначала покажется
 * тёмной и только потом перекрасится — заметно на медленной загрузке.
 */
export const ADMIN_THEME_SCRIPT = `try{if(localStorage.getItem("${STORAGE_KEY}")==="paper")document.documentElement.setAttribute("data-theme","light");else document.documentElement.removeAttribute("data-theme")}catch(e){}`;