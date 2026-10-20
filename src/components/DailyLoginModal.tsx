"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import {
  DAILY_CATCHUPS,
  DAILY_ENTRY_AC,
  claimDailyCell,
  dailyMonth,
  dailyView,
  toggleAuto,
  type DailyCell,
} from "@/lib/daily-login";
import { PREMIUM_QUEST_MULT } from "@/lib/premium-perks";
import "./daily-login.css";

/**
 * Окно ежедневного входа по макету `AniGalaxy · Ежедневный вход.html`.
 *
 * Разметка, стили и анимации перенесены из него как есть (React-бандл макета,
 * CSS достался строкой): календарь месяца, главный приз с лисёнком, сетка
 * ячеек, подпись «Сегодня», блок возврата пропущенных дней и тумблер
 * автосбора.
 *
 * Данные настоящие, а не как в макете:
 *   • месяц — текущий, ячейки — дни месяца, а не «16 из 31» константой;
 *   • награда за ячейку кладётся в профиль через `addCoins`/`addXp`
 *     (макет называет монеты AniCoin — в проекте это атомы, AC);
 *   • ×2 появляется только у подписчика: множитель настоящий;
 *   • «Вернуть пропуск» тратит накопленные попытки и досчитывает пропущенные
 *     дни, а не рисует обещание.
 */

const GEM = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M6 3h12l4 6-10 12L2 9l4-6Z" />
    <path d="M2 9h20M9 3l3 6 3-6M12 21 9 9m3 12 3-12" />
  </svg>
);

const GIFT = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="3" y="8" width="18" height="13" rx="2" />
    <path d="M12 8v13M3 13h18M12 8c-2 0-5-.5-5-3a2.5 2.5 0 0 1 5 0c0-2.5 5-3.5 5 0 0 2.5-3 3-5 3Z" />
  </svg>
);

const CLOSE = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);

const MONTHS = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];

export function DailyLoginModal({ open, onClose, premium }: { open: boolean; onClose: () => void; premium: boolean }) {
  const [tick, setTick] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  /* Закрытие с анимацией ухода: сначала флаг, потом вызов родителя */
  const close = useCallback(() => {
    setLeaving(true);
    window.setTimeout(() => {
      setLeaving(false);
      onClose();
    }, 300);
  }, [onClose]);

  /* Состояние окна целиком перечитывается раз в минуту — на смену суток
     ячейка «сегодня» должна сдвинуться сама, без перезагрузки страницы */
  const view = useMemo(() => dailyView(), [tick]);
  const month = useMemo(() => dailyMonth(), [tick]);

  /* Открытие окна: прыжок лисёнка с вспышкой — состояние `opening` из макета.
     Флаг ставится сразу (компонент монтируется вместе с открытием окна), а
     снимается по таймеру — синхронный setState в эффекте лишний рендер. */
  const [opening, setOpening] = useState(true);
  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => setOpening(false), 1100);
    return () => window.clearTimeout(id);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const id = window.setInterval(() => setTick((value) => value + 1), 60_000);
    return () => window.clearInterval(id);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, close]);

  /* Взятие награды: макет сначала «стреляет» конфетти, затем показывает
     карточку с выпавшей наградой. Здесь тот же порядок и та же выдача —
     `claimDailyCell` кладёт атомы и опыт в профиль. */
  const [reward, setReward] = useState<{ ac: number; xp: number; day: number; frame: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [burst, setBurst] = useState<{ key: number; x: number; y: number; size: number; color: string; delay: number }[]>([]);

  const onClaim = (catchUp = false) => {
    if (busy) return;
    if (catchUp ? view.missed === 0 : !view.canClaim) return;
    setBusy(true);
    /* Три залпа, как в макете: 22 + 20 + 18 частиц */
    const colors = ["#dff3ff", "#38c8ff", "#8a5cff"];
    const pieces: typeof burst = [];
    const waves = [22, 20, 18];
    let n = 0;
    for (let w = 0; w < waves.length; w++) {
      for (let i = 0; i < waves[w]; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 60 + Math.random() * 110;
        pieces.push({
          key: n++,
          x: Math.round(Math.cos(angle) * dist),
          y: Math.round(Math.sin(angle) * dist - 30),
          size: 4 + Math.round(Math.random() * 4),
          color: colors[w % colors.length],
          delay: w * 0.15,
        });
      }
    }
    setBurst(pieces);
    /* Пауза перед выдачей — как спиннер в макете */
    window.setTimeout(() => {
      const result = claimDailyCell(view.today, catchUp, premium);
      if (result.ok) setReward({ ac: result.ac, xp: result.xp, day: view.today, frame: result.frame });
      setTick((value) => value + 1);
      setBusy(false);
    }, 620);
  };

  if (!open) return null;

  const big = month.cells.find(
    (cell) => cell.kind === "box" && !view.claimedDays.includes(cell.day),
  );
  const mult = premium ? PREMIUM_QUEST_MULT : 1;

  return createPortal(
    <div className={`dm${leaving ? " leaving" : ""}`}>
      <svg width="0" height="0" aria-hidden style={{ position: "absolute" }}>
        <defs>
          <linearGradient id="dm-gx" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#7dd3fc" />
            <stop offset="1" stopColor="#2563eb" />
          </linearGradient>
          <linearGradient id="dm-gs" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#67e8f9" />
            <stop offset="1" stopColor="#1d4ed8" />
          </linearGradient>
          <linearGradient id="dm-gp" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#f0abfc" />
            <stop offset=".55" stopColor="#a78bfa" />
            <stop offset="1" stopColor="#22d3ee" />
          </linearGradient>
          <linearGradient id="dm-gc" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#8acdfd" />
            <stop offset="1" stopColor="#0bb5f5" />
          </linearGradient>
        </defs>
      </svg>

      <div className="dm-veil" onClick={close} />
      <div className={`dm-m${opening ? " opening" : ""}`} ref={dialogRef} role="dialog" aria-modal="true" aria-label="Ежедневный вход">
        <button type="button" className="dm-x dm-rip" onClick={close} aria-label="Закрыть">
          {CLOSE}
        </button>

        {/* ----------------------------- Левая колонка ---------------------------- */}
        <aside className="dm-left">
          <div className="dm-stars" aria-hidden>
            {Array.from({ length: 18 }, (_, i) => (
              <i key={i} style={{ left: `${(i * 37) % 96}%`, animationDelay: `${(i % 7) * 0.6}s` }} />
            ))}
          </div>

          <span className="dm-eyebrow">
            {GEM}
            Ежедневный вход
          </span>

          <div className="dm-stage">
            <span className="dm-halo" />
            <span className="dm-flash" />
            <div className="dm-mw">
              <div className="dm-mi">
                <Image src="/images/daily-mascot.png" alt="" width={597} height={640} priority />
              </div>
            </div>
            <span className="dm-shadow" />
          </div>

          <div className="dm-prize">
            <span className="dm-cap">Главный приз недели</span>
            <h3>{big ? "Большая коробка" : "Гранд месяца"}</h3>
            <span className="dm-when">
              День {big?.day ?? month.days}
              {big ? (big.day === view.today ? " · сегодня" : ` · через ${pluralDays(big.day - view.today)}`) : ""}
            </span>
            <span className="dm-cap s">Внутри</span>
            <div className="dm-slots">
              <span className="dm-slot">
                <Image className="dm-coin" src="/coin.png" alt="" width={76} height={76} />
              </span>
              <span className="dm-slot">
                <Image className="dm-exp" src="/images/daily-exp.png" alt="" width={88} height={84} />
              </span>
            </div>
          </div>

          <div className="dm-act">
            <button
              type="button"
              className={`dm-primary dm-rip${view.canClaim ? "" : " dim"}${busy ? " busy" : ""}`}
              disabled={!view.canClaim || busy}
              onClick={() => onClaim()}
            >
              {GIFT}
              {view.canClaim ? "Забрать награду" : "Уже получено"}
            </button>
            <div className="dm-pills">
              <span className="dm-pill">
                <Image src="/coin.png" alt="" width={18} height={18} />
                + {view.entryAc} AC за вход
              </span>
              {premium ? (
                <span className="dm-pill pr">
                  <Image src="/coin.png" alt="" width={18} height={18} />+ {view.entryAc * PREMIUM_QUEST_MULT} AC за вход с <em>Premium</em>
                </span>
              ) : (
                <span className="dm-pill pr off">
                  <Image src="/coin.png" alt="" width={18} height={18} />
                  + {view.entryAc * PREMIUM_QUEST_MULT} AC с <em>Premium</em>
                </span>
              )}
            </div>
          </div>
        </aside>

        {/* ----------------------------- Правая колонка --------------------------- */}
        <section className="dm-right">
          <div className="dm-top">
            <div className="dm-ttl">
              <h2>{MONTHS[month.month - 1] ? capitalize(MONTHS[month.month - 1]) : ""}</h2>
              {premium ? (
                <span className="dm-prem">
                  {GEM}
                  Premium ×{mult}
                </span>
              ) : null}
              <p>Каждый день открывает свою ячейку. Пропуски возвращает звёздный кристалл. С Premium AC и EXP вдвое больше.</p>
            </div>
            <div className="dm-cnt">
              <div>
                <b>{view.claimed}</b>
                <span>из {month.days}</span>
              </div>
              <div className="dm-bar">
                <i style={{ width: `${(view.claimed / month.days) * 100}%` }} />
                {/* Деления полосы — каждые четыре дня, как в макете */}
                {Array.from({ length: Math.floor((month.days - 1) / 4) }, (_, k) => {
                  const mark = (k + 1) * 4;
                  return <u key={mark} className={mark <= view.claimed ? "on" : undefined} style={{ left: `${(mark / month.days) * 100}%` }} />;
                })}
              </div>
            </div>
          </div>

          <div className="dm-grid">
            {month.cells.map((cell) => (
              <Cell key={cell.day} cell={cell} claimedDays={view.claimedDays} today={view.today} canClaim={view.canClaim} onPick={() => {
                /* Клик по сегодняшней ячейке — тот же путь, что у кнопки:
                   иначе награда выдавалась молча, без экрана получения. */
                if (cell.day === view.today) onClaim();
              }} />
            ))}
          </div>

          <div className="dm-info">
            <span className="dm-ii">
              <Image src="/coin.png" alt="" width={30} height={30} />
            </span>
            <div>
              <h4>Сегодня — {(view.todayAc + view.entryAc) * mult} AC</h4>
              <p>{cellNote(month.cells[view.today - 1], premium, mult)}</p>
            </div>
          </div>

          {/* Возврат пропуска — блок макета: подпись и кнопка дословно из него.
              Показываем, пока остались попытки, чтобы кнопка не исчезала
              вместе с пропуском (в макете блок виден всегда). */}
          {view.catchups < DAILY_CATCHUPS ? (
            <div className="dm-catch">
              <p>
                {view.missed === 0 ? (
                  <>Пропусков нет — все дни до сегодняшнего закрыты. Осталось <b>{pluralTries(DAILY_CATCHUPS - view.catchups)}</b> на этот месяц.</>
                ) : (
                  <>Лисёнок заметил пропуск: <b>{pluralDays(view.missed)}</b> без награды. Звёздный кристалл
                  вернёт их — осталось <b>{pluralTries(DAILY_CATCHUPS - view.catchups)}</b> на этот месяц.</>
                )}
              </p>
              <button
                type="button"
                className="dm-cbtn dm-rip"
                disabled={view.catchups >= DAILY_CATCHUPS || view.missed === 0 || busy}
                onClick={() => onClaim(true)}
              >
                {GEM}
                Вернуть пропуск
              </button>
            </div>
          ) : null}

          <label className="dm-auto">
            <span>
              <b>Забирать автоматически</b>
              <small>Окно не будет открываться само — награда зачислится при следующем заходе на сайт. Отключить можно здесь же.</small>
            </span>
            <input
              type="checkbox"
              checked={view.auto}
              onChange={() => {
                toggleAuto();
                setTick((value) => value + 1);
              }}
            />
            <span className="dm-tr">
              <i />
            </span>
          </label>
        </section>
      </div>

      {/* Получение награды — экран макета: конфетти, кольцо, карточка с
          выпавшей наградой и кнопкой. Показывается поверх окна. */}
      {burst.length ? (
        <div className="dm-rv" onClick={() => setBurst([])}>
          <div className="dm-rvc" onClick={(event) => event.stopPropagation()}>
            <span className="dm-rays" style={{ "--t": "#22d3ee", animation: "dm-dlRot 9s linear infinite" } as CSSProperties} />
            <span className="dm-ring" />
            {burst.map((piece) => (
              <i
                key={piece.key}
                className="dm-cf"
                style={
                  {
                    "--x": `${piece.x}px`,
                    "--y": `${piece.y}px`,
                    width: piece.size,
                    height: piece.size * 1.7,
                    background: piece.color,
                    boxShadow: `0 0 10px ${piece.color}`,
                    animationDelay: `${piece.delay}s`,
                  } as CSSProperties
                }
              />
            ))}
            <div className="dm-rvi">
              <Image className="dm-coin" src="/coin.png" alt="" width={120} height={120} />
            </div>
            <span className="dm-rvk">Получено</span>
            <h3>День {reward?.day ?? view.today}</h3>
            <span className="dm-rva">
              {reward?.frame && reward.ac === 0 && reward.xp === 0
                ? "Рамка"
                : `+${reward ? reward.ac : (view.todayAc + view.entryAc) * mult}`}
            </span>
            <span className="dm-rvd">
              {reward?.frame && reward.ac === 0 && reward.xp === 0 ? (
                "Рамка аватара из косметики"
              ) : (
                <>
                  {reward ? reward.ac : (view.todayAc + view.entryAc) * mult} AC
                  {reward && reward.xp > 0 ? ` и ${reward.xp} XP` : ""}
                  {reward?.frame ? " и рамка" : ""}
                  {premium && (reward ? reward.ac > 0 || reward.xp > 0 : true)
                    ? ` с Premium ×${mult}`
                    : ""}
                </>
              )}
            </span>
            <p>Награда уже на балансе — лисёнок её утащил в копилку.</p>
            <button
              type="button"
              className="dm-primary dm-rip"
              style={{ width: "100%", marginTop: 8 }}
              onClick={() => setBurst([])}
            >
              Отлично
            </button>
          </div>
        </div>
      ) : null}
    </div>,
    document.body,
  );
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function pluralDays(n: number): string {
  if (n % 10 === 1 && n % 100 !== 11) return `${n} день`;
  if (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20)) return `${n} дня`;
  return `${n} дней`;
}

/** «3 попытки / 2 попытки / 5 попыток» — как в подписи макета */
function pluralTries(n: number): string {
  if (n % 10 === 1 && n % 100 !== 11) return `${n} попытка`;
  if (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20)) return `${n} попытки`;
  return `${n} попыток`;
}

function cellNote(cell: DailyCell | undefined, premium: boolean, mult: number): string {
  if (!cell) return "";
  const suffix = premium ? ` С подпиской — ×${mult}.` : "";
  switch (cell.kind) {
    case "ac":
      return `AC на баланс.${suffix}`;
    case "exp":
      return `Опыт профиля.${suffix}`;
    case "box":
      return `Коробка: +${cell.amount} AC и +300 XP сверх входа.`;
    case "frame":
      return "Рамка аватара из косметики — попадёт в профиль.";
    case "grand":
      return `Гранд: +${cell.amount} AC и +1000 XP сверх входа.`;
    case "skip":
      return `День пропуска: +${DAILY_ENTRY_AC * 3 * cell.amount} XP к профилю.`;
    default:
      return "";
  }
}

function Cell({
  cell,
  claimedDays,
  today,
  canClaim,
  onPick,
}: {
  cell: DailyCell;
  claimedDays: number[];
  today: number;
  canClaim: boolean;
  onPick: () => void;
}) {
  const claimed = new Set(claimedDays);
  const done = claimed.has(cell.day);
  /* «Следующая» — сегодняшняя ячейка, пока её не забрали. Пропущенные дни
     не подсвечиваются как доступные: их возвращает кристалл. */
  const next = cell.day === today && !done;
  const cls = [
    "dm-c",
    /* Класс из макета, но с префиксом: одиночный `fx` в проекте занят
       служебной кнопкой 40×40 (app/guest-follows-report.css) и схлопывал
       каждую ячейку календаря до квадратика */
    "dm-fx",
    "dm-tilt",
    done ? "done" : "",
    cell.kind === "box" || cell.kind === "grand" ? "big" : "",
    cell.kind === "grand" ? "grandc" : "",
    next ? "next" : "",
    next && canClaim ? "sel" : "",
    cell.day > today ? "lock" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button type="button" className={cls} onClick={onPick} disabled={!next || !canClaim}>
      {done ? (
        <span className="dm-ok" aria-hidden>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="m5 12 5 5L19 7" />
          </svg>
        </span>
      ) : null}
      <span className="dm-n">{cell.day}</span>
      <span className="dm-ic">
        {cell.kind === "ac" ? (
          <Image className="dm-coin" src="/coin.png" alt="" width={76} height={76} />
        ) : null}
        {cell.kind === "exp" ? (
          <Image className="dm-exp" src="/images/daily-exp.png" alt="" width={88} height={84} />
        ) : null}
        {cell.kind === "box" ? (
          <Image className="dm-mini-m" src="/images/daily-mascot-mini.png" alt="" width={100} height={102} />
        ) : null}
        {/* Рамка аватара — рисунок макета: силуэт внутри кольца с лучами */}
        {cell.kind === "frame" ? (
          <span className="dm-fr">
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <circle cx="12" cy="8" r="4" />
              <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
            </svg>
            <span className="dm-fr-ph">
              <u />
              <u />
              <u />
              <u />
            </span>
          </span>
        ) : null}
        {cell.kind === "grand" ? (
          <span className="dm-grand s">
            <Image className="dm-mini-m gm" src="/images/daily-mascot-grand.png" alt="" width={132} height={122} />
            <b>★</b>
          </span>
        ) : null}
        {cell.kind === "skip" ? <span className="dm-sk">{GEM}</span> : null}
      </span>
      <span className={`dm-am${cell.kind === "box" || cell.kind === "grand" || cell.kind === "frame" ? " s" : ""}`}>
        {cell.kind === "ac" ? cell.amount : null}
        {cell.kind === "exp" ? cell.amount : null}
        {cell.kind === "box" ? `+${cell.amount}` : null}
        {cell.kind === "frame" ? "Рамка" : null}
        {cell.kind === "grand" ? cell.amount : null}
        {cell.kind === "skip" ? `${DAILY_ENTRY_AC * 3 * cell.amount} XP` : null}
        {cell.kind === "exp" ? <small>EXP</small> : null}
        {cell.kind === "grand" ? <small>ГРАНД</small> : null}
      </span>
    </button>
  );
}