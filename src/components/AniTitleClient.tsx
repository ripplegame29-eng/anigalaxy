"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchReleaseInBrowser } from "@/lib/anilibria-browser";
import { AniTitleView, type AniExtras } from "@/components/AniTitleView";
import type { AniTitleDetail } from "@/lib/anilibria-map";

/**
 * Страница тайтла AniLiberty, который сервер не увидел: AniLiberty скрывает часть
 * релизов от адресов дата-центров, а из браузера зрителя они открываются.
 * Данные и серии запрашиваем прямо здесь; раскладка та же, что у обычной страницы
 * (шапка, описание, плеер с выбором озвучек, комментарии).
 */
export function AniTitleClient({ id, alias }: { id: string; alias: string }) {
  const [detail, setDetail] = useState<AniTitleDetail | null | undefined>(undefined);

  useEffect(() => {
    const ctrl = new AbortController();
    void fetchReleaseInBrowser(alias, ctrl.signal).then((d) => {
      if (!ctrl.signal.aborted) setDetail(d);
    });
    return () => ctrl.abort();
  }, [alias]);

  if (detail === undefined) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-24 text-center text-sm text-white/60 sm:px-6" role="status">
        Загружаем тайтл…
      </div>
    );
  }
  if (!detail) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-24 text-center sm:px-6">
        <h1 className="font-display text-2xl font-extrabold text-white">Такой страницы не существует</h1>
        <p className="mt-3 text-white/60">Тайтл не найден. Загляните в каталог — там больше тридцати тысяч аниме.</p>
        <Link href="/catalog" className="mt-6 inline-flex rounded-xl bg-accent px-5 py-2.5 text-sm font-bold text-white">
          Открыть каталог
        </Link>
      </div>
    );
  }

  return <AniTitleLoaded id={id} detail={detail} />;
}

const NO_EXTRAS: AniExtras = { shots: [], trailer: null, upcoming: null, similar: [] };

/** Страница целиком; кадры, трейлер и похожие подгружаются следом — через наш сервер (Shikimori и Kodik ему доступны) */
function AniTitleLoaded({ id, detail }: { id: string; detail: AniTitleDetail }) {
  const [extras, setExtras] = useState<AniExtras>(NO_EXTRAS);
  const { card } = detail;

  useEffect(() => {
    const ctrl = new AbortController();
    const sp = new URLSearchParams({ id, title: card.title, genres: card.genres.join(",") });
    if (card.shikimoriId) sp.set("sid", String(card.shikimoriId));
    if (card.kind) sp.set("kind", card.kind);
    void fetch(`/api/anilibria/extras?${sp}`, { signal: ctrl.signal })
      .then((res) => (res.ok ? (res.json() as Promise<Partial<AniExtras>>) : null))
      .then((data) => {
        if (!data || ctrl.signal.aborted) return;
        setExtras({
          shots: data.shots ?? [],
          trailer: data.trailer ?? null,
          upcoming: data.upcoming ?? null,
          similar: data.similar ?? [],
        });
      })
      .catch(() => undefined);
    return () => ctrl.abort();
  }, [id, card.title, card.genres, card.shikimoriId, card.kind]);

  return <AniTitleView id={id} detail={detail} extras={extras} />;
}
