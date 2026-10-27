"use client";

/**
 * Мягкая регистрационная стена: после двух серий гость видит карточку
 * «Создай аккаунт — получи 100 монет». Закрывается кнопкой «Позже».
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
    <aside className="gw" role="dialog" aria-label="Создай аккаунт">
      <button type="button" className="gw-x" aria-label="Закрыть" onClick={() => setOpen(false)}>
        ×
      </button>
      <div className="gw-coin" aria-hidden>
        <i className="gw-halo" />
        <svg viewBox="0 0 80 80" fill="none">
          <defs>
            <linearGradient id="gw-rim" x1="12" y1="6" x2="68" y2="74" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#fff3c4" />
              <stop offset=".35" stopColor="#ffc23a" />
              <stop offset=".7" stopColor="#c47a14" />
              <stop offset="1" stopColor="#ffd98a" />
            </linearGradient>
            <radialGradient id="gw-face" cx=".32" cy=".24" r=".95">
              <stop offset="0" stopColor="#fff0b0" />
              <stop offset=".5" stopColor="#f7b93f" />
              <stop offset="1" stopColor="#c9801a" />
            </radialGradient>
          </defs>
          <circle cx="40" cy="40" r="38" fill="url(#gw-rim)" />
          <circle cx="40" cy="40" r="33" fill="url(#gw-face)" stroke="rgba(120,60,0,.35)" strokeWidth="1" />
          <circle cx="40" cy="40" r="29.5" stroke="rgba(110,55,0,.38)" strokeWidth="1.2" strokeDasharray="1.2 3.1" strokeLinecap="round" />
          <path d="M40 8.5l1.7 4.1 4.1 1.7-4.1 1.7L40 20l-1.7-4-4.1-1.7 4.1-1.7z" fill="#fff" fillOpacity=".85" />
        </svg>
        <span className="gw-amt">
          <b>+{SIGNUP_BONUS_AC}</b>
          <small>AC</small>
        </span>
        <u className="gw-sp gw-sp1" />
        <u className="gw-sp gw-sp2" />
        <u className="gw-sp gw-sp3" />
      </div>
      <div className="gw-body">
        <h3>Создай аккаунт — получи {SIGNUP_BONUS_AC} монет</h3>
        <p>
          С аккаунтом уровни, история просмотра и достижения сохраняются на любом устройстве.
          Регистрация занимает минуту.
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
