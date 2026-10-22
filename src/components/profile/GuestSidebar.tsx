"use client";

import { useEffect, useMemo, useState } from "react";

import { watchStore } from "@/lib/history";
import { STATUS_LABEL, STATUS_ORDER, loadStatuses, type WatchStatus } from "@/lib/statuses";
import { followPlayer, unfollowPlayer, useProfileSocial, type Relation } from "@/lib/profile-social";
import { postToParent } from "@/lib/view-mode";
import { PlayerSocialDialog } from "./PlayerSocialDialog";
import { ReportDialog } from "./ReportDialog";
import { GiftPremiumDialog } from "./GiftPremiumDialog";

/**
 * Правая колонка чужого профиля.
 *
 * Вёрстка по макету «AniGalaxy — профиль и подписки»: «смотрит сейчас»,
 * орбиты статусов, кнопки, счётчики подписок и друзья.
 *
 * Что здесь настоящее:
 *
 *   • орбиты — из `animehub:statuses:v1`, того же стора, что и выбор статуса
 *     на странице тайтла; дуг ровно столько, сколько реальных статусов;
 *   • «смотрит сейчас» — последняя открытая серия из `animehub:history:v1`,
 *     и живой пульс только если её открыли в последние два часа;
 *   • «Поделиться» копирует адрес страницы.
 *
 * Чего в проекте нет, поэтому вместо правды — прочерк и честная подсказка:
 * подписок, друзей и других аккаунтов. Ников из макета не рисуем: 64
 * подписчика, которых не существует, выглядели бы как данные.
 */

const ICON = {
  personPlus: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M3 20c.5-3.5 3-5.5 6-5.5s5.5 2 6 5.5M18 8v6M15 11h6" />
    </>
  ),
  crown: <path d="M3.5 18h17M3.5 18 2.5 8.7 8 12.4 12 5.6l4 6.8 5.5-3.7-1 9.3z" />,
  gift: (
    <>
      <rect x="3.5" y="8.5" width="17" height="4" rx="1" />
      <path d="M5 12.5V20h14v-7.5M12 8.5V20M12 8.5C10 8.5 8 7.5 8 6s1.5-2 3-1c1 .7 1 2.5 1 3.5 0-1 0-2.8 1-3.5 1.5-1 3 0 3 1s-2 2.5-4 2.5" />
    </>
  ),
  share: (
    <>
      <circle cx="6" cy="12" r="2.4" />
      <circle cx="17.5" cy="6" r="2.4" />
      <circle cx="17.5" cy="18" r="2.4" />
      <path d="m8.1 10.9 7.3-3.8M8.1 13.1l7.3 3.8" />
    </>
  ),
  flag: <path d="M5 21V4M5 5h12l-2.5 4L17 13H5" />,
  friends: (
    <>
      <circle cx="9" cy="8" r="3.4" />
      <path d="M3 20c.5-3.4 3-5.4 6-5.4s5.5 2 6 5.4" />
      <path d="M16 5.2a3.4 3.4 0 0 1 0 6.2M18 14.8c1.8.7 3 2.5 3.3 5" />
    </>
  ),
} as const;

/** Орбиты: внешняя — запланировано, средняя — смотрю, внутренняя — просмотрено.
 *  Порядок из макета; «брошено» в кольцо не входит — в макете его тоже нет. */
const ORBIT: { status: WatchStatus; r: number; g: string }[] = [
  { status: "planned", r: 62, g: "#60a5fa" },
  { status: "watching", r: 47, g: "#34d399" },
  { status: "completed", r: 32, g: "#a78bfa" },
];

/** Доля от радиуса: 0.92 оставляет щель, как в макете */
const FILL = 0.92;

/** Минимум дуги. В макете так же: даже у нулевого статуса виден обрубок,
 *  иначе кольцо выглядит сломанным, а не пустым. */
const MIN_FILL = 0.04;

/** Открыли меньше этого времени назад — серия считается текущей */
const LIVE_MS = 2 * 60 * 60 * 1000;

export interface GuestSidebarProps {
  nickname: string;
  onShare: () => void;
}

const FOLLOW_LABEL: Record<Relation, string> = {
  self: "Это вы",
  none: "Подписаться",
  outgoing: "Заявка отправлена",
  incoming: "Принять заявку",
  friends: "Вы друзья",
};

export function GuestSidebar({ nickname, onShare }: GuestSidebarProps) {
  const watch = watchStore.useStore();
  const social = useProfileSocial(nickname);
  const [busy, setBusy] = useState(false);
  const [followError, setFollowError] = useState<string | null>(null);
  const relation = social.data?.relation ?? null;

  const onFollow = async () => {
    if (busy || !social.data) return;
    if (relation === null) {
      // Зритель не вошёл: окно входа открывает основная страница
      postToParent({ type: "ag-auth" });
      return;
    }
    setBusy(true);
    setFollowError(null);
    const error =
      relation === "none" || relation === "incoming"
        ? await followPlayer(nickname)
        : relation === "outgoing" || relation === "friends"
          ? await unfollowPlayer(nickname, social.data.userId)
          : null;
    setBusy(false);
    if (error === "auth") postToParent({ type: "ag-auth" });
    else setFollowError(error);
  };

  const counts = useMemo(() => {
    const map = loadStatuses();
    const acc: Record<WatchStatus, number> = { planned: 0, watching: 0, completed: 0, dropped: 0 };
    let total = 0;
    for (const status of Object.values(map)) {
      if (!STATUS_ORDER.includes(status)) continue;
      acc[status] += 1;
      total += 1;
    }
    return { acc, total };
  }, []);

  // «Смотрит сейчас» сравнивается с текущим временем, поэтому оно берётся из
  // состояния, а не зовётся прямо в рендере: иначе рендер не был бы чистым.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  /** Последняя открытая серия: она же «смотрит сейчас», если открыта недавно */
  const latest = useMemo(() => {
    const last = [...watch.records].sort((a, b) => b.at - a.at)[0];
    if (!last) return null;
    return { record: last, live: now - last.at <= LIVE_MS };
  }, [watch.records, now]);

  return (
    <aside className="ag-pf-side gst">
      {/* --------------------------- Смотрит сейчас ---------------------- */}
      <section className="gst-panel" style={{ "--i": 0 } as React.CSSProperties}>
        {latest ? (
          <div className="gst-now">
            <div
              className="gst-poster"
              style={
                latest.record.poster
                  ? { backgroundImage: `url(${latest.record.poster})`, backgroundSize: "cover" }
                  : undefined
              }
              aria-hidden="true"
            />
            <div className="gst-meta">
              <div className="gst-live">
                <i />
                {latest.live ? "Смотрит сейчас" : "Смотрел недавно"}
                {latest.live && (
                  <span className="gst-eq" aria-hidden="true">
                    <b />
                    <b />
                    <b />
                  </span>
                )}
              </div>
              <h4>{latest.record.title}</h4>
              <div className="gst-ep">
                Серия<b>{latest.record.episode}</b>
              </div>
            </div>
          </div>
        ) : (
          <div className="gst-now">
            <div className="gst-poster" aria-hidden="true" />
            <div className="gst-meta">
              <div className="gst-live">
                <i />
                Ничего не открыто
              </div>
              <h4>История пока пустая</h4>
            </div>
          </div>
        )}
      </section>

      {/* ------------------------------ Орбиты -------------------------- */}
      <section className="gst-panel" style={{ "--i": 1 } as React.CSSProperties}>
        <div className="gst-orb">
          <svg
            viewBox="0 0 152 152"
            role="img"
            aria-label={`${counts.total} аниме в списках: ${ORBIT.map(
              (o) => `${STATUS_LABEL[o.status]} — ${counts.acc[o.status]}`,
            ).join(", ")}`}
          >
            <text className="gst-core" x="76" y="80">
              {counts.total}
            </text>
            <text className="gst-coreS" x="76" y="96">
              в списках
            </text>
            {ORBIT.map((o) => {
              const len = 2 * Math.PI * o.r;
              const share = counts.total === 0 ? 0 : counts.acc[o.status] / counts.total;
              const f = Math.max(share * FILL, MIN_FILL);
              // Точка на конце дуги — из макета: по ней видно, где конкретный
              // статус закончился, и без неё кольцо читается как три случайных
              // обрубка. Угол считается так же: от −90° (верх) по часовой.
              const angle = (f * 360 - 90) * (Math.PI / 180);
              const dot = { cx: 76 + o.r * Math.cos(angle), cy: 76 + o.r * Math.sin(angle) };
              return (
                <g key={o.status}>
                  <circle className="gst-trk" cx="76" cy="76" r={o.r} />
                  <circle
                    className="gst-arc"
                    cx="76"
                    cy="76"
                    r={o.r}
                    stroke={o.g}
                    transform="rotate(-90 76 76)"
                    style={{ "--g": o.g, strokeDasharray: `${f * len} ${len}` } as React.CSSProperties}
                  />
                  <circle
                    className="gst-pl"
                    cx={dot.cx}
                    cy={dot.cy}
                    r={3.6}
                    fill="#fff"
                    style={{ "--g": o.g } as React.CSSProperties}
                  />
                </g>
              );
            })}
          </svg>

          <div className="gst-leg">
            {ORBIT.map((o) => (
              <button key={o.status} type="button" style={{ "--g": o.g } as React.CSSProperties}>
                <i />
                {STATUS_LABEL[o.status]}
                <b>{counts.acc[o.status]}</b>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ----------------------------- Действия -------------------------- */}
      <section className="gst-panel gst-act" style={{ "--i": 2 } as React.CSSProperties}>
        <button
          type="button"
          className="gst-btn is-main"
          disabled={busy || !social.loaded || !social.data || relation === "self"}
          onClick={() => void onFollow()}
          title={
            relation === "outgoing"
              ? "Нажмите, чтобы отменить заявку"
              : relation === "friends"
                ? "Нажмите, чтобы удалить из друзей"
                : relation === null
                  ? "Войдите, чтобы подписаться"
                  : undefined
          }
        >
          <svg className="gst-i" viewBox="0 0 24 24" aria-hidden="true">
            {ICON.personPlus}
          </svg>
          {relation === null ? "Подписаться" : FOLLOW_LABEL[relation]}
        </button>
        {followError ? (
          <p className="gst-note" role="alert">
            {followError}
          </p>
        ) : null}

        <GiftPremiumDialog
          recipient={nickname}
          className="gst-btn is-prem"
          label={
            <>
              <i className="gst-sp" />
              <i className="gst-sp" />
              <i className="gst-sp" />
              <svg className="gst-i" viewBox="0 0 24 24" aria-hidden="true">
                {ICON.crown}
              </svg>
              <span>Подарить Premium</span>
            </>
          }
        />

        <div className="gst-row2">
          <button type="button" className="gst-btn is-ghost" onClick={onShare}>
            <svg className="gst-i" viewBox="0 0 24 24" aria-hidden="true">
              {ICON.share}
            </svg>
            Поделиться
          </button>
        </div>

        <ReportDialog
          className="gst-btn is-rep"
          nickname={nickname}
          label={
            <>
              <svg className="gst-i" viewBox="0 0 24 24" aria-hidden="true">
                {ICON.flag}
              </svg>
              Пожаловаться
            </>
          }
        />
      </section>

      {/* --------------------------- Подписчики -------------------------- */}
      <section className="gst-panel gst-fol" style={{ "--i": 3 } as React.CSSProperties}>
        <PlayerSocialDialog
          nickname={nickname}
          tab={0}
          className="gst-fb"
          label={
            <>
              <span>Подписчики</span>
              <b>{social.data?.followers.length || "—"}</b>
            </>
          }
        />
        <PlayerSocialDialog
          nickname={nickname}
          tab={1}
          className="gst-fb"
          label={
            <>
              <span>Подписки</span>
              <b>{social.data?.following.length || "—"}</b>
            </>
          }
        />
      </section>

      {/* ------------------------------ Друзья --------------------------- */}
      <section className="gst-panel" style={{ "--i": 4 } as React.CSSProperties}>
        <div className="gst-fh">
          <h3>
            <svg className="gst-i" viewBox="0 0 24 24" style={{ color: "var(--gst-vio)" }} aria-hidden="true">
              {ICON.friends}
            </svg>
            Друзья <small>{social.data?.friends.length || "—"}</small>
          </h3>
          <PlayerSocialDialog nickname={nickname} tab={2} className="gst-fh-all" label="Все" />
        </div>

        <div className="gst-grid">
          {Array.from({ length: 8 }, (_, i) => {
            const friend = social.data?.friends[i];
            return friend ? (
              <a
                key={friend.nickname}
                className="gst-av"
                href={`/u/${encodeURIComponent(friend.nickname)}`}
                title={friend.nickname}
                aria-label={`Профиль ${friend.nickname}`}
              >
                {friend.nickname[0]?.toUpperCase()}
              </a>
            ) : (
              <span key={i} className="gst-av is-empty" aria-hidden />
            );
          })}
        </div>
        {social.loaded && !social.data?.friends.length ? <p className="gst-note">Друзей пока нет</p> : null}
      </section>
    </aside>
  );
}