"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/**
 * Ссылка на админ-панель в подвале сайта.
 *
 * Сделано клиентским компонентом намеренно. Серверный вариант (прочитать
 * сессию прямо в подвале) переводил бы все страницы сайта из статических в
 * динамические: обращение к `cookies()` запрещает пререндер. Один лишний
 * крошечный запрос при загрузке страницы — куда меньшая цена, чем одиннадцать
 * страниц, которые перестали отдаваться с CDN.
 *
 * Показывается только тем, у кого серверная сессия действительно даёт право
 * `panel`. Это удобство интерфейса, а не защита: сам `/admin` закрыт
 * отдельно, в `requireAdmin`. Ссылка — для тех, кто уже вошёл.
 */
export function AdminFooterLink() {
  const [canPanel, setCanPanel] = useState(false);

  useEffect(() => {
    // Флаг защищает от гонки: если компонент размонтировался (переход между
    // страницами), результат уже никому не нужен, и setState бросил бы
    // предупреждение.
    let alive = true;

    fetch("/api/auth/me", { credentials: "same-origin" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { canPanel?: boolean } | null) => {
        if (alive && data?.canPanel) setCanPanel(true);
      })
      // Молча игнорируем: не показать ссылку — правильное поведение при любой
      // ошибке. Авторизацию всё равно решает сервер.
      .catch(() => undefined);

    return () => {
      alive = false;
    };
  }, []);

  if (!canPanel) return null;

  return (
    <Link
      href="/admin"
      className="btn-ghost rounded-lg bg-white/6 px-3 py-1.5 text-xs font-semibold text-muted ring-1 ring-white/10 hover:bg-accent/15 hover:text-white hover:ring-accent/40"
    >
      Панель управления
    </Link>
  );
}