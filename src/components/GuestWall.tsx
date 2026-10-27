"use client";

/**
 * Мягкая регистрационная стена: после двух серий гость видит карточку
 * «Сохрани прогресс — получи 100 монет». Закрывается кнопкой «Позже».
 */

import { useEffect, useState } from "react";
import { openAuthDialog } from "@/lib/auth-dialog";
import {
  guestWallStore,
  markGuestWallShown,
  shouldShowGuestWall,
  SIGNUP_BONUS_AC,
} from "@/lib/guest-wall";
import { useAccount } from "@/lib/use-account";
import "./guest-wall.css";

export function GuestWall() {
  const account = useAccount();
  const state = guestWallStore.useStore();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (account || !shouldShowGuestWall(state, Date.now())) return;
    // Небольшая пауза: карточка не должна выскакивать в момент старта серии
    const timer = window.setTimeout(() => {
      markGuestWallShown();
      setOpen(true);
    }, 4000);
    return () => window.clearTimeout(timer);
  }, [account, state]);

  if (!open || account) return null;

  return (
    <aside className="gw" role="dialog" aria-label="Сохрани прогресс">
      <button type="button" className="gw-x" aria-label="Закрыть" onClick={() => setOpen(false)}>
        ×
      </button>
      <div className="gw-coin" aria-hidden>
        <span>+{SIGNUP_BONUS_AC}</span>
      </div>
      <div className="gw-body">
        <h3>Сохрани прогресс — получи {SIGNUP_BONUS_AC} монет</h3>
        <p>
          Уровни, история просмотра и достижения останутся с тобой на любом устройстве. Регистрация
          занимает минуту.
        </p>
        <div className="gw-act">
          <button
            type="button"
            className="gw-go"
            onClick={() => {
              setOpen(false);
              openAuthDialog("register");
            }}
          >
            Создать аккаунт
          </button>
          <button type="button" className="gw-later" onClick={() => setOpen(false)}>
            Позже
          </button>
        </div>
      </div>
    </aside>
  );
}
