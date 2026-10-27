"use client";

import Link from "next/link";
import { useEffect } from "react";
import { ErrorState } from "@/components/ui/EmptyState";

/** Ошибка внутри страницы: шапка и подвал остаются, предлагаем повторить */
export default function RouteError({
  error,
  retry,
  reset,
}: {
  error: Error & { digest?: string };
  retry?: () => void;
  reset?: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  const again = retry ?? reset;
  return (
    <ErrorState
      title="Страница споткнулась"
      text="Что-то пошло не так при загрузке. Мы уже знаем о проблеме. Попробуйте ещё раз, а если не помогло — вернитесь на главную."
      code={error.digest}
      actions={
        <>
          {again && (
            <button type="button" onClick={() => again()} className="btn-primary rounded-xl px-6 py-3 text-sm font-bold text-white">
              Повторить
            </button>
          )}
          <Link href="/" className="btn-ghost rounded-xl bg-white/8 px-6 py-3 text-sm font-semibold text-white ring-1 ring-white/12 hover:bg-white/14">
            На главную
          </Link>
        </>
      }
    />
  );
}
