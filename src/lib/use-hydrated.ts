"use client";

import { useSyncExternalStore } from "react";

/**
 * true после монтирования на клиенте, false на сервере и при гидрации.
 *
 * Нужен там, где значение зависит от времени или браузера: обратные
 * отсчёты, `Date.now()`, ширина окна. На сервере и на первом рендере
 * клиента хук возвращает одно и то же значение, поэтому разметка
 * совпадает и React не сообщает о расхождении гидрации. Сразу после
 * монтирования React перерисовывает компонент уже с настоящими данными.
 *
 * Отличие от `useState` + `useEffect`: здесь нет setState в эффекте,
 * поэтому не срабатывает правило react-hooks/set-state-in-effect.
 *
 * @example
 * const mounted = useHydrated();
 * return <strong>{mounted ? dealClock(now, endsAt) : "--:--:--"}</strong>;
 */
export function useHydrated() {
  return useSyncExternalStore(
    // Подписка не нужна: значение меняется ровно один раз — при монтировании,
    // и React делает это сам, перечитывая getSnapshot.
    () => () => {},
    () => true,
    () => false,
  );
}