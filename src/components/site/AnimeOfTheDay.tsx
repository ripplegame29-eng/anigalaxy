"use client";

/**
 * Плитка «Аниме дня» в мега-меню каталога.
 *
 * Показывает закреплённый редакцией тайл, а не случайный: случайный из всей
 * базы — это заведомо средний результат (на первом прогоне вышел тайл с «★ 0.0»).
 * Данные настоящие — с Kodik; сам тайл в коде не зашит, берётся по id.
 * Кнопка «Ещё» листает по топу с сервера, не ходя за ним каждый раз.
 *
 * Постер кладём фоном под затемнением: он и есть причина открыть меню, а
 * название и рейтинг должны читаться поверх.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Icon } from "./icons";
import { formatRating, kindLabel } from "@/lib/anime";
import type { AnimeCard } from "@/lib/types";

/**
 * Тайл плитки — «Блич: Тысячелетняя кровавая война» (выбор редакции).
 * Постер у него тёмный и с крупным логотипом, из-за чего кадр пришлось
 * сдвинуть вверх: логотип не должен лезть под название в углу плитки.
 */
const PICKED_ID = "serial-46220";

/** Оттенок подложки плитки: зависит от жанра, чтобы карточки не были серыми */
const HUES: Record<string, number> = {
  "боевой": 12,
  "приключения": 28,
  "комедия": 48,
  "романтика": 320,
  "фэнтези": 215,
  "ужасы": 350,
  "детектив": 190,
  "триллер": 275,
  "спорт": 150,
  "меха": 200,
  "сэйнэн": 340,
  "повседневность": 100,
  "сёнэн": 20,
  "дзёси": 300,
  "взрослый": 30,
  "детский": 130,
};

/** Оттенок по первой подходящей подстроке жанра */
function hueFor(card: AnimeCard): number {
  const genres = card.genres ?? [];
  for (const [name, hue] of Object.entries(HUES)) {
    if (genres.some((genre) => genre.toLowerCase().includes(name))) return hue;
  }
  return 215;
}

/** «Экшен · ТВ сериал · 24 серии» — одна строка о тайле */
function describe(card: AnimeCard): string {
  const bits: string[] = [];
  const kind = kindLabel(card.kind);
  if (kind) bits.push(kind);
  const episodes = card.episodesTotal ?? card.lastEpisode;
  if (episodes) bits.push(`${episodes} серий`);
  return bits.join(" · ") || card.genres?.[0] || "Аниме";
}

interface TopResponse {
  cards: AnimeCard[];
}

interface TitleResponse {
  detail?: { card?: AnimeCard };
}

export function AnimeOfTheDay() {
  /** Закреплённый тайл: показан, пока пользователь не нажал «Ещё» */
  const [picked, setPicked] = useState<AnimeCard | null>(null);
  const [cards, setCards] = useState<AnimeCard[] | null>(null);
  /** −1 — показан закреплённый тайл, иначе индекс в топе */
  const [index, setIndex] = useState(-1);
  // Сразу «занято»: автозагрузка стартует на монтировании, и мигать
  // «не грузится → грузится» при открытии меню незачем
  const [busy, setBusy] = useState(true);
  const [failed, setFailed] = useState(false);

  /**
   * Догружаем топ, если он ещё не взят. Живёт в useCallback, а не в
   * обработчике, поэтому автозагрузка и повторная попытка идут одним кодом.
   */
  const load = useCallback(async () => {
    if (cards) return;
    setBusy(true);
    setFailed(false);
    try {
      const res = await fetch("/api/kodik/top");
      if (!res.ok) throw new Error("top failed");
      const data = (await res.json()) as TopResponse;
      if (!data?.cards?.length) throw new Error("empty");
      setCards(data.cards);
    } catch {
      // Каталог недоступен — плитка остаётся с приглашением, а не с ошибкой
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }, [cards]);

  // Закреплённый тайл и топ берём сразу при монтировании: пустая плитка в меню
  // выглядит поломкой. Отменяем запросы при размонтировании, иначе setState
  // попадёт на мёртвый компонент, если меню закрылось раньше ответа Kodik.
  useEffect(() => {
    let alive = true;
    fetch(`/api/kodik/title?id=${PICKED_ID}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("title failed"))))
      .then((data: TitleResponse) => {
        const card = data?.detail?.card;
        if (!alive) return;
        if (card) setPicked(card);
        else setFailed(true);
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    fetch("/api/kodik/top")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("top failed"))))
      .then((data: TopResponse) => {
        if (alive && data?.cards?.length) setCards(data.cards);
      })
      .catch(() => {
        /* топ нужен только кнопке «Ещё» — молча пропускаем */
      })
      .finally(() => {
        if (alive) setBusy(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  // Если закреплённый тайл не пришёл, показываем топ — пустой угол хуже
  const pickedShown = picked !== null && index === -1;
  const card = pickedShown ? picked : (cards?.[index] ?? cards?.[0] ?? null);
  const rating = card ? formatRating(card.rating) : undefined;

  /** «Ещё» — следующий тайл топа по кругу; ходить на сервер незачем */
  const next = () => {
    if (!cards?.length) {
      void load();
      return;
    }
    setIndex((value) => (value + 1) % cards.length);
  };

  /** Наклон плитки и параллакс постера — как в макете */
  const featRef = useRef<HTMLElement | null>(null);

  const onMove = (event: React.PointerEvent<HTMLElement>) => {
    const el = featRef.current;
    if (!el) return;
    const box = el.getBoundingClientRect();
    const x = (event.clientX - box.left) / box.width - 0.5;
    const y = (event.clientY - box.top) / box.height - 0.5;
    el.style.setProperty("--rx", `${(-y * 7).toFixed(2)}deg`);
    el.style.setProperty("--ry", `${(x * 9).toFixed(2)}deg`);
    el.style.setProperty("--tx", `${(-x * 16).toFixed(1)}px`);
    el.style.setProperty("--ty", `${(-y * 12).toFixed(1)}px`);
  };

  const onLeave = () => {
    const el = featRef.current;
    if (!el) return;
    for (const prop of ["--rx", "--ry", "--tx", "--ty"]) el.style.removeProperty(prop);
  };

  const tilt = typeof window === "undefined" ? false : window.matchMedia("(hover:hover)").matches;

  return (
    <article
      className="agh-feat"
      ref={featRef}
      style={{ "--h": card ? hueFor(card) : 215 } as React.CSSProperties}
      onPointerMove={tilt ? onMove : undefined}
      onPointerLeave={tilt ? onLeave : undefined}
    >
      {/* Постер фоном: он и есть причина открыть меню. Пока грузится или если
          CDN не отдал — снизу остаётся цветной градиент по жанру. */}
      {card?.poster && (
        <Image
          src={card.poster}
          alt=""
          aria-hidden
          fill
          sizes="380px"
          className="agh-feat-poster"
        />
      )}

      <span className="agh-feat-badge">
        {pickedShown ? "Аниме дня" : card ? "Ещё из топа" : "Аниме дня"}
      </span>
      {rating && <span className="agh-feat-rate">★ {rating}</span>}

      <h3>{card ? card.title : "Откройте что-то новое"}</h3>
      <p>
        {card
          ? describe(card)
          : failed
            ? "Каталог сейчас недоступен"
            : busy
              ? "Собираем топ…"
              : "Показываем лучшее по рейтингу"}
      </p>

      {card ? (
        <Link href={`/title/${card.id}`} className="agh-feat-go">
          <Icon name="arrow" />
          Открыть
        </Link>
      ) : (
        <button type="button" className="agh-feat-go" onClick={next} disabled={busy}>
          <Icon name="trophy" className={busy ? "spinning" : undefined} />
          {busy ? "Загружаем…" : "Показать топ"}
        </button>
      )}

      {card && (
        <button
          type="button"
          className="agh-feat-again"
          onClick={next}
          aria-label="Следующий тайл из топа"
        >
          <Icon name="refresh" />
          Ещё
        </button>
      )}
    </article>
  );
}
