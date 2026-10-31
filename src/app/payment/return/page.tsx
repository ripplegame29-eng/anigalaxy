"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

interface OrderInfo {
  id: string;
  productId: string;
  kind: string;
  title: string;
  amount: number;
  currency: string;
  status: string;
  granted: boolean;
  failed: boolean;
  deliverAt: number;
  createdAt: number;
}

function PaymentReturnContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get("order") ?? "";
  const isFailedParam = searchParams.get("failed") === "1";

  const [order, setOrder] = useState<OrderInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orderId) {
      setLoading(false);
      setError("Номер заказа не указан");
      return;
    }

    let isMounted = true;
    let pollTimer: ReturnType<typeof setTimeout> | null = null;
    let attempts = 0;
    const maxAttempts = 15; // ~45 sec polling

    async function checkStatus() {
      try {
        const res = await fetch(`/api/payments/platega/order/${encodeURIComponent(orderId)}`);
        if (!res.ok) {
          if (res.status === 401) {
            setError("Пожалуйста, войдите в аккаунт для просмотра статуса заказа");
            setLoading(false);
            return;
          }
          if (res.status === 404) {
            setError("Заказ не найден");
            setLoading(false);
            return;
          }
          throw new Error("Не удалось получить статус заказа");
        }

        const data = await res.json();
        if (!isMounted) return;

        if (data.ok && data.order) {
          setOrder(data.order);
          if (data.order.status === "CONFIRMED" || data.order.failed) {
            setLoading(false);
            return;
          }
        }

        attempts += 1;
        if (attempts < maxAttempts) {
          pollTimer = setTimeout(checkStatus, 3000);
        } else {
          setLoading(false);
        }
      } catch (err) {
        if (!isMounted) return;
        attempts += 1;
        if (attempts < maxAttempts) {
          pollTimer = setTimeout(checkStatus, 3000);
        } else {
          setLoading(false);
          setError("Не удалось связаться с сервером. Попробуйте обновить страницу.");
        }
      }
    }

    void checkStatus();

    return () => {
      isMounted = false;
      if (pollTimer) clearTimeout(pollTimer);
    };
  }, [orderId]);

  const isConfirmed = order?.status === "CONFIRMED";
  const isFailed = isFailedParam || order?.failed || order?.status === "CANCELED" || order?.status === "FAILED";

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 py-16 text-center">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0f1422]/90 p-8 shadow-2xl backdrop-blur-xl">
        {loading && (
          <div className="space-y-4">
            <div className="mx-auto h-16 w-16 animate-spin rounded-full border-4 border-cyan-500/20 border-t-cyan-400" />
            <h2 className="text-xl font-bold text-white">Проверяем статус оплаты…</h2>
            <p className="text-sm text-white/60">
              Связываемся со шлюзом Platega, пожалуйста, подождите несколько секунд.
            </p>
          </div>
        )}

        {!loading && isConfirmed && (
          <div className="space-y-5">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/40">
              <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </div>
            <div>
              <h2 className="text-2xl font-black text-white">Оплата прошла успешно!</h2>
              <p className="mt-1 text-sm font-medium text-emerald-400/90">
                {order?.title ? `${order.title} активирован` : "Заказ успешно выполнен"}
              </p>
            </div>

            {order && (
              <div className="space-y-2 rounded-xl border border-white/5 bg-white/[0.03] p-4 text-left text-sm text-white/80">
                <div className="flex justify-between">
                  <span className="text-white/50">Товар:</span>
                  <span className="font-semibold text-white">{order.title}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/50">Сумма:</span>
                  <span className="font-semibold text-white">{order.amount.toLocaleString("ru-RU")} {order.currency}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/50">Статус:</span>
                  <span className="font-semibold text-emerald-400">Оплачено</span>
                </div>
                {order.deliverAt > Date.now() && (
                  <p className="border-t border-white/5 pt-1 text-xs text-amber-300/80">
                    Доставка запланирована на {new Date(order.deliverAt).toLocaleString("ru-RU")}.
                  </p>
                )}
              </div>
            )}

            <div className="flex flex-col gap-3 pt-2">
              <Link
                href="/profile"
                className="w-full rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-6 py-3 font-bold text-white shadow-lg shadow-cyan-500/25 transition hover:brightness-110"
              >
                В мой профиль
              </Link>
              <Link
                href="/"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-6 py-2.5 text-sm font-semibold text-white/80 hover:bg-white/10"
              >
                На главную
              </Link>
            </div>
          </div>
        )}

        {!loading && isFailed && (
          <div className="space-y-5">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-rose-500/20 text-rose-400 ring-1 ring-rose-500/40">
              <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </div>
            <div>
              <h2 className="text-2xl font-black text-white">Платёж не завершён</h2>
              <p className="mt-1 text-sm text-white/60">
                Оплата была отменена или шлюз Platega вернул ошибку. Деньги не списаны.
              </p>
            </div>

            <div className="flex flex-col gap-3 pt-2">
              <Link
                href="/premium"
                className="w-full rounded-xl bg-white/10 px-6 py-3 font-bold text-white transition hover:bg-white/15"
              >
                Попробовать снова
              </Link>
              <Link
                href="/"
                className="w-full text-sm font-semibold text-white/60 hover:text-white"
              >
                Вернуться на главную
              </Link>
            </div>
          </div>
        )}

        {!loading && !isConfirmed && !isFailed && (
          <div className="space-y-5">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/40">
              <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <div>
              <h2 className="text-2xl font-black text-white">Платёж в обработке</h2>
              <p className="mt-1 text-sm text-white/60">
                {error || "Шлюз ещё обрабатывает платёж. Как только транзакция подтвердится, покупка появится на аккаунте автоматически."}
              </p>
            </div>

            <div className="flex flex-col gap-3 pt-2">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="w-full rounded-xl bg-cyan-600 px-6 py-3 font-bold text-white transition hover:bg-cyan-500"
              >
                Обновить статус
              </button>
              <Link
                href="/profile"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-6 py-2.5 text-sm font-semibold text-white/80 hover:bg-white/10"
              >
                Перейти в профиль
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function PaymentReturnPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-cyan-500/20 border-t-cyan-400" />
        </div>
      }
    >
      <PaymentReturnContent />
    </Suspense>
  );
}
