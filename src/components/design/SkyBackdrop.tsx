"use client";

/**
 * Звёздное небо и градиентный фон страниц макетов.
 *
 * Стоит один раз в layout: шесть страниц делят один фон, иначе на каждой
 * свой — плюс лишний слой отрисовки и рассинхрон между переходами.
 * Показывается CSS'ом только там, где внизу есть .ag-root (см. ag-theme.css),
 * поэтому остальной сайт не меняется.
 *
 * Позиции звёзд считает детерминированный генератор, а не Math.random:
 * иначе сервер и браузер нарисовали бы разное и React ругался бы на
 * гидратацию. Math.random в теле рендера запрещён и правилом react-hooks/purity.
 *
 * Количество звёзд и падающие метеоры приходят из настроек сайта: снимок
 * берётся через useSyncExternalStore, поэтому на сервере и в первом
 * клиентском рендере значение одно и то же (по умолчанию 70) и расхождения
 * при гидрации не возникает.
 */

import { useEffect } from "react";
import { applyPrefs, usePrefs } from "@/lib/prefs";

/** mulberry32: маленький быстрый генератор с одним и тем же результатом
 *  при одинаковом зерне на любой машине. */
function makeRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Star {
  left: number;
  top: number;
  size: number;
  delay: number;
}

/** Зерно фиксировано: при смене оформления неба позиции не должны прыгать */
const SEED = 20260912;

function makeStars(count: number): Star[] {
  const rnd = makeRandom(SEED);
  return Array.from({ length: count }, () => ({
    left: rnd() * 100,
    top: rnd() * 100,
    size: 1 + rnd() * 2,
    delay: rnd() * 6,
  }));
}

/** Максимум звёзд — потолок ползунка в настройках */
const MAX_STARS = 320;

/**
 * Набор считается один раз на модуль: и сервер, и браузер получают одно и
 * то же. Считаем сразу максимум и режем по настройке — иначе пересчёт на
 * каждом движении ползунка менял бы позиции оставшихся звёзд.
 */
const STARS = makeStars(MAX_STARS);

export function SkyBackdrop() {
  const prefs = usePrefs();

  // Настройки внешнего вида живут в атрибутах <html>: тема, акцент, небо
  useEffect(() => {
    applyPrefs(prefs);
  }, [prefs]);

  return (
    <>
      <div className="sky" aria-hidden />
      {STARS.slice(0, Math.min(MAX_STARS, prefs.stars)).map((star, i) => (
        <i
          // Ключ по позиции, а не по индексу из map: набор не меняется в жизни,
          // и индекс здесь устойчив
          key={i}
          className="stars"
          style={{
            left: `${star.left}vw`,
            top: `${star.top}vh`,
            width: `${star.size}px`,
            height: `${star.size}px`,
            animationDelay: `${star.delay}s`,
          }}
          aria-hidden
        />
      ))}
    </>
  );
}