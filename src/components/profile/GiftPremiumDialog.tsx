"use client";

import { openCheckout } from "@/lib/checkout";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Окно «Подарить Premium» — дословная транскрипция макета
 * «AniGalaxy — подарить Premium»: разметка, стили, данные и логика из его
 * скрипта, включая карточку с переворотом, наклон за курсором, «путь
 * щедрости», промокоды, доставку по дате и раздачу случайным зрителям.
 *
 * Единственное отличие от макета — префикс `gd-` у классов: в макете они
 * generic (.shell, .pay, .tf, .sw), такими именами забрали бы весь интерфейс.
 */

/* ----------------------------- Данные макета ----------------------------- */

const TF = [
  { n: "Месяц", d: 30, p: 99, t: "1 месяц" },
  { n: "3 месяца", d: 90, p: 249, t: "3 месяца", hit: 1 },
  { n: "Год", d: 365, p: 790, t: "1 год" },
];

const WR = [
  ["Лазурь", "#38bdf8", "#2563eb"],
  ["Сакура", "#f472b6", "#fb7185"],
  ["Неон", "#22d3ee", "#34d399"],
  ["Золото", "#6bcbf5", "#b45309"],
];

const FR = [
  ["Weiz", "#2563eb,#ec4899"],
  ["Аки", "#f472b6,#2563eb"],
  ["Рин", "#94a3b8,#334155"],
  ["Юки", "#24affb,#b45309"],
  ["Хана", "#fb7185,#9f1239"],
];

const PM: readonly (readonly [string, string, string])[] = [
  ["card", "Банковская карта", "Visa, Mastercard, МИР"],
  ["sbp", "СБП", "Система быстрых платежей"],
  ["usdt", "Криптовалюта", "USDT и другие монеты"],
  ["tg", "Telegram-бот", "Нужен привязанный аккаунт"],
];

const MS = [1, 5, 10, 25, 50, 100, 250, 500, 1000];
const RK = [
  "Донатер",
  "Сэмпай",
  "Участник щедрости",
  "Меценат",
  "Благотворитель",
  "Филантроп",
  "Патрон",
  "Звёздный дар",
  "Легенда щедрости",
];
const CUR = 3;

const DS: readonly (readonly [number, number])[] = [
  [100, 30],
  [50, 25],
  [25, 20],
  [10, 15],
  [3, 5],
];

const PC: Record<string, number> = { GALAXY10: 10, SAKURA15: 15, ANIME20: 20 };

const OC = [
  ["День рождения", "С днём рождения! Пусть в этом году будет только крутое аниме."],
  ["Спасибо", "Спасибо за рекомендации, ты лучший!"],
  ["Просто так", "Смотрим вместе? Держи Premium: двойные награды и эксклюзивные рамки."],
];

const WH = [
  ["now", "Сразу"],
  ["tm", "Завтра в 10:00"],
  ["pick", "Выбрать"],
] as const;

const KJ = [
  '<svg viewBox="0 0 24 24"><path d="M12 1.5c.9 5.8 3.7 8.6 9.5 10.5-5.8 1.9-8.6 4.7-9.5 10.5-.9-5.8-3.7-8.6-9.5-10.5C8.3 10.1 11.1 7.3 12 1.5z"/></svg>',
  '<svg viewBox="0 0 24 24"><g transform="translate(12 12)"><path d="M0 0C-4-2-4-8 0-10 4-8 4-2 0 0z"/><path transform="rotate(72)" d="M0 0C-4-2-4-8 0-10 4-8 4-2 0 0z"/><path transform="rotate(144)" d="M0 0C-4-2-4-8 0-10 4-8 4-2 0 0z"/><path transform="rotate(216)" d="M0 0C-4-2-4-8 0-10 4-8 4-2 0 0z"/><path transform="rotate(288)" d="M0 0C-4-2-4-8 0-10 4-8 4-2 0 0z"/></g></svg>',
  '<svg viewBox="0 0 24 24"><path d="M13 2 4 14h7l-1 8 9-12h-7z"/></svg>',
  '<svg viewBox="0 0 24 24"><path d="M2 8l5.5 4L12 4l4.5 8L22 8l-2 11H4z"/></svg>',
];

const CROWN = <path d="M3.5 18h17M3.5 18 2.5 8.7 8 12.4 12 5.6l4 6.8 5.5-3.7-1 9.3z" />;

/* ------------------------------- Помощники ------------------------------- */

function disc(n: number): number {
  for (const [from, d] of DS) if (n >= from) return d;
  return 0;
}

function rub(v: number): string {
  return `${Math.round(v).toLocaleString("ru-RU")}\u00a0₽`;
}

function pl(n: number, a: readonly [string, string, string]): string {
  const x = n % 10;
  const y = n % 100;
  return a[x === 1 && y !== 11 ? 0 : x >= 2 && x <= 4 && (y < 10 || y >= 20) ? 1 : 2];
}

function tomorrow10(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(10, 0, 0, 0);
  return d;
}

function fmt(d: Date): string {
  return d.toLocaleString("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
}

/* -------------------------------- Состояние ------------------------------ */

type Mode = "f" | "r";
type When = (typeof WH)[number][0];

interface State {
  m: Mode;
  t: number;
  n: number;
  anon: boolean;
  pay: string;
  w: number;
  to: string;
  /** Подпись на карточке — в макете это #msg, отдельное поле */
  msg: string;
  pr: number;
  pc: string;
  when: When;
  at: string;
  code: string;
  /** Номер заказа: в макете генерируется в момент оплаты */
  order: string;
  bk: boolean;
}

const INITIAL: State = {
  m: "f",
  t: 1,
  n: 10,
  anon: false,
  pay: "sbp",
  w: 0,
  to: "Weiz",
  msg: "",
  pr: 0,
  pc: "",
  when: "now",
  at: "",
  code: "",
  order: "",
  bk: false,
};

/* --------------------------------- Компонент ------------------------------ */

export interface GiftPremiumDialogProps {
  /** Ник игрока, которому дарим (профиль игрока): поле закреплено за ним */
  recipient?: string;
  className?: string;
  label: React.ReactNode;
}

export function GiftPremiumDialog({ className, label, recipient }: GiftPremiumDialogProps) {
  const dlgRef = useRef<HTMLDialogElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const shownRef = useRef<number | null>(null);

  const [S, setS] = useState<State>(recipient ? { ...INITIAL, to: recipient } : INITIAL);
  const [tot, setTot] = useState<number | null>(null);
  const [fin, setFin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fa, setFa] = useState("");
  const [pcNote, setPcNote] = useState("");
  const [pcBad, setPcBad] = useState(false);
  const [copied, setCopied] = useState(false);

  const set = useCallback((patch: Partial<State>) => setS((prev) => ({ ...prev, ...patch })), []);

  const cnt = S.m === "f" ? 1 : S.n;
  const base = TF[S.t].p * cnt;
  const d = disc(S.n);
  const cur = Math.round(base * (1 - (S.m === "r" ? d : 0) / 100) * (1 - S.pr / 100));

  /* Итог с плавной доводкой — tween из макета */
  useEffect(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    const from = shownRef.current ?? cur;
    const t0 = performance.now();
    const step = (t: number) => {
      const p = Math.min((t - t0) / 450, 1);
      const v = from + (cur - from) * (1 - Math.pow(1 - p, 3));
      shownRef.current = v;
      setTot(v);
      if (p < 1) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [cur]);

  useEffect(() => {
    const el = dlgRef.current;
    if (!el) return;
    const onBackdrop = (e: MouseEvent) => {
      if (e.target === el) el.close();
    };
    el.addEventListener("click", onBackdrop);
    return () => el.removeEventListener("click", onBackdrop);
  }, []);

  const open = useCallback(() => {
    setFin(false);
    dlgRef.current?.showModal();
  }, []);

  const close = useCallback(() => dlgRef.current?.close(), []);

  const sched = S.m === "f" && S.when !== "now" ? (S.when === "tm" ? tomorrow10() : S.at ? new Date(S.at) : null) : null;

  const promo = useCallback(() => {
    const code = S.pc.trim().toUpperCase();
    if (PC[code]) {
      set({ pr: PC[code], pc: code });
      setPcNote("");
      setPcBad(false);
    } else {
      set({ pr: 0, pc: "" });
      setPcNote(code ? "Такого промокода нет. Попробуй GALAXY10" : "");
      setPcBad(Boolean(code));
    }
  }, [S.pc, set]);

  const setN = useCallback((v: number) => set({ n: Math.max(1, Math.min(800, Math.round(v) || 1)) }), [set]);

  /* Переворот карточки */
  const flip = useCallback(() => {
    if (busy) return;
    setBusy(true);
    setFa("out");
    window.setTimeout(() => {
      set({ bk: !S.bk });
      setFa("in");
      setBusy(false);
    }, 180);
  }, [busy, S.bk, set]);

  /* Наклон карточки за курсором */
  const onMove = useCallback((e: React.PointerEvent) => {
    const top = stageRef.current?.querySelector(".gd-gc.gd-top") as HTMLElement | null;
    if (!top) return;
    const r = top.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    top.style.setProperty("--ry", `${x * 18}deg`);
    top.style.setProperty("--rx", `${-y * 18}deg`);
    top.style.setProperty("--gx", `${(x + 0.5) * 100}%`);
    top.style.setProperty("--gy", `${(y + 0.5) * 100}%`);
  }, []);

  const onLeave = useCallback(() => {
    const top = stageRef.current?.querySelector(".gd-gc.gd-top") as HTMLElement | null;
    if (!top) return;
    top.style.setProperty("--ry", "0deg");
    top.style.setProperty("--rx", "0deg");
  }, []);

  /* Путь щедрости */
  const after = CUR + cnt;
  const st = 292 / (MS.length - 1);
  const xOf = (v: number) => {
    for (let i = 0; i < MS.length - 1; i++) {
      if (v < MS[i + 1]) return 14 + i * st + Math.max(0, (v - MS[i]) / (MS[i + 1] - MS[i])) * st;
    }
    return 306;
  };
  let reached = -1;
  MS.forEach((m, i) => {
    if (after >= m) reached = i;
  });
  const nextIdx = reached + 1;

  /* Получатель */
  const q = S.to.trim().toLowerCase();
  const hit = Boolean(recipient) || FR.some((x) => x[0].toLowerCase() === q);
  const rsText = recipient
    ? `Получатель — ${recipient}`
    : hit
    ? "Профиль найден"
    : q.length < 3
      ? "Введи минимум 3 символа"
      : "Профиль не найден";

  /* Итог: строка расшифровки скидок */
  const brkParts = [S.m === "f" ? TF[S.t].t : `${TF[S.t].t} × ${S.n}`];
  if (S.m !== "f" && d) brkParts.push(`объём −${d}%`);
  if (S.pr) brkParts.push(`промокод −${S.pr}%`);

  const tp = Math.round((1 - cur / base) * 100);
  const payDisabled = S.m === "f" && !S.to.trim();
  const nxt = [...DS].reverse().find(([from]) => from > S.n);

  /* Данные карточки */
  const wrap = WR[S.m === "f" ? S.w : 0];
  const who = S.m === "f" ? `для ${S.to || "…"}` : `случайным зрителям ×${S.n}`;
  const from = S.anon ? "Анонимный зритель" : "от тебя";
  const msg = S.msg.trim() ? `«${S.msg.trim()}»` : "";
  const sn = `№ AG-${TF[S.t].d}-${S.m === "f" ? "01" : `×${S.n}`}`;
  const stack = Math.min(3, S.m === "r" ? (S.n >= 10 ? 3 : S.n >= 3 ? 2 : 1) : 1);

  const rows: [string, string][] = [
    // Номер заказа в макете рождается в момент оплаты, а не при рендере:
    // иначе он менялся бы на каждом кадре tween-а итога.
    ["Заказ", S.order ? `AG-${S.order}` : "—"],
    ["Тариф", S.m === "f" ? TF[S.t].t : `${TF[S.t].t} × ${S.n}`],
    ["Получатель", S.m === "f" ? S.to : "Случайные зрители"],
    ["Доставка", sched ? fmt(sched) : "Сразу"],
    ["Оплата", PM.find((p) => p[0] === S.pay)?.[1] ?? ""],
  ];
  if (S.pr) rows.push(["Промокод", `${S.pc} (−${S.pr}%)`]);

  const copyLink = () => {
    const url = `https://anigalaxy.app/gift/${S.code}`;
    try {
      void navigator.clipboard.writeText(url);
    } catch {
      /* буфер недоступен — кнопка всё равно отработает */
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const head = (
    <div className="row t">
      <span className="lg">
        <svg className="gd-i" viewBox="0 0 24 24" aria-hidden="true">
          {CROWN}
        </svg>
        <b className="wm">
          <em>AniGalaxy</em>
          <small>Premium</small>
        </b>
      </span>
      <i className="chip" />
    </div>
  );

  return (
    <>
      <button type="button" className={className} onClick={open}>
        {label}
      </button>

      <dialog ref={dlgRef} className="gd" aria-labelledby="gd-ttl">
        <div className="gd-shell" data-mode={S.m} data-fin={fin ? "y" : undefined}>
          <button type="button" className="gd-x" onClick={close} aria-label="Закрыть">
            <svg className="gd-i" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>

          <div className="gd-scroll">
            <h2 id="gd-ttl">
              <span className="gd-gi">
                <svg className="gd-i" viewBox="0 0 24 24" aria-hidden="true">
                  <rect x="3.5" y="8.5" width="17" height="4" rx="1" />
                  <path d="M5 12.5V20h14v-7.5M12 8.5V20M12 8.5C10 8.5 8 7.5 8 6s1.5-2 3-1c1 .7 1 2.5 1 3.5 0-1 0-2.8 1-3.5 1.5-1 3 0 3 1s-2 2.5-4 2.5" />
                </svg>
              </span>
              Подари Premium
            </h2>
            <p className="gd-lead">
              Выбери тариф и получателя.
            </p>

            <div className="gd-seg" role="tablist">
              <i className="gd-ind" />
              <button role="tab" data-m="f" type="button" aria-selected={S.m === "f"} onClick={() => set({ m: "f" })}>
                Конкретному другу
              </button>
              <button role="tab" data-m="r" type="button" aria-selected={S.m === "r"} onClick={() => set({ m: "r" })}>
                Раздать случайным
              </button>
            </div>

            <div className="gd-cols">
              <div>
                {/* --------------------------- Кому --------------------------- */}
                <div data-m="f">
                  <div className="gd-lb">
                    Кому <span>ник или имя в профиле</span>
                  </div>
                  <div className="gd-fld">
                    <svg className="gd-i" viewBox="0 0 24 24" aria-hidden="true">
                      <circle cx="11" cy="11" r="6.5" />
                      <path d="m16 16 4 4" />
                    </svg>
                    <input
                      value={S.to}
                      autoComplete="off"
                      aria-label="Получатель"
                      readOnly={Boolean(recipient)}
                      onChange={(e) => set({ to: e.target.value })}
                    />
                  </div>
                  <div className="gd-frs">
                    {(recipient ? [] : FR).map(([name, color]) => (
                      <button
                        key={name}
                        type="button"
                        className={`gd-fr${S.to === name ? " on" : ""}`}
                        onClick={() => set({ to: name })}
                      >
                        <span
                          className="gd-av"
                          style={{ "--g": `linear-gradient(140deg,${color})` } as React.CSSProperties}
                        >
                          {name[0]}
                        </span>
                        {name}
                      </button>
                    ))}
                  </div>
                  <div className={`gd-rs${hit ? " ok" : ""}`}>
                    <i />
                    <span>{rsText}</span>
                  </div>
                </div>

                {/* ----------------------- Случайным зрителям -------------------- */}
                <div data-m="r">
                  <div className="gd-save" style={{ margin: "0 0 18px" }}>
                    <svg className="gd-i" viewBox="0 0 24 24" aria-hidden="true">
                      <circle cx="12" cy="12" r="9" />
                      <path d="M12 8v5M12 16h.01" />
                    </svg>
                    <span>
                      Подарки достанутся активным зрителям без Premium. Получатели увидят твою
                      подпись, ник и количество, если не выбрать «Анонимно».
                    </span>
                  </div>
                  <div className="gd-lb">
                    Сколько подарков <span>до 800 за платёж</span>
                  </div>
                  <div className="gd-cnt">
                    <input
                      className="gd-num"
                      type="number"
                      min={1}
                      max={800}
                      value={S.n}
                      aria-label="Количество"
                      onChange={(e) => setN(Number(e.target.value))}
                    />
                    <input
                      type="range"
                      min={1}
                      max={800}
                      value={S.n}
                      aria-label="Количество подарков"
                      onChange={(e) => setN(Number(e.target.value))}
                    />
                  </div>
                  <div className="gd-chips">
                    {[3, 5, 10, 25, 50, 100, 800].map((v) => (
                      <button key={v} type="button" className={S.n === v ? "on" : ""} onClick={() => set({ n: v })}>
                        ×{v}
                      </button>
                    ))}
                  </div>
                  <div className="gd-save">
                    <svg className="gd-i" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="m4 7 6 6 3-3 7 7M20 11v6h-6" />
                    </svg>
                    <span>
                      {d ? (
                        <>
                          Скидка {d}%: экономия {rub(base - cur)}
                          {nxt ? (
                            <>
                              <br />
                              <small style={{ color: "var(--mut)" }}>
                                Ещё +{nxt[0] - S.n} и скидка {nxt[1]}%
                              </small>
                            </>
                          ) : null}
                        </>
                      ) : (
                        "Скидка от 3 подарков"
                      )}
                    </span>
                    {d ? <b>−{d}%</b> : null}
                  </div>
                </div>

                {/* ---------------------------- Тариф --------------------------- */}
                <div className="gd-lb">
                  {S.m === "r" ? "Тариф для каждого" : "Тариф"}
                </div>
                <div className="gd-tfs" role="radiogroup">
                  {TF.map((t, i) => (
                    <button
                      key={t.n}
                      type="button"
                      role="radio"
                      className="gd-tf"
                      aria-checked={S.t === i}
                      onClick={() => set({ t: i })}
                    >
                      {t.hit ? <span className="gd-hit">Хит</span> : null}
                      <small>{t.n}</small>
                      <b>
                        {t.p.toLocaleString("ru-RU")}
                        <i> ₽</i>
                      </b>
                      <em>{(t.p / t.d).toFixed(2).replace(".", ",")} ₽ в день</em>
                    </button>
                  ))}
                </div>

                {/* --------------------------- Обёртка --------------------------- */}
                <div data-m="f">
                  <div className="gd-lb">
                    Обёртка <span>{WR[S.w][0]}</span>
                  </div>
                  <div className="gd-sws" role="radiogroup">
                    {WR.map(([name, a, b], i) => (
                      <button
                        key={name}
                        type="button"
                        role="radio"
                        className="gd-sw"
                        style={{ "--sw1": a, "--sw2": b } as React.CSSProperties}
                        aria-label={name}
                        aria-checked={S.w === i}
                        onClick={() => set({ w: i })}
                      />
                    ))}
                  </div>
                </div>

                {/* ---------------------------- Подпись --------------------------- */}
                <div className="gd-lb">
                  Подпись <span>{S.msg.length} / 120</span>
                </div>
                <textarea
                  className="gd-msg"
                  maxLength={120}
                  placeholder={
                    S.m === "f"
                      ? "Пара слов от тебя, они появятся на карточке: «погнали смотреть новый сезон вместе!»"
                      : "Одна подпись для всех получателей: «лови Premium, смотрим аниме без рекламы!»"
                  }
                  value={S.msg}
                  onChange={(e) => set({ msg: e.target.value })}
                />
                <div className="gd-chips occ">
                  {OC.map(([title, text], i) => (
                    <button key={i} type="button" onClick={() => set({ msg: text })}>
                      {title}
                    </button>
                  ))}
                </div>

                {/* --------------------------- Доставка -------------------------- */}
                <div data-m="f">
                  <div className="gd-lb">
                    Когда доставить{" "}
                    <span>{S.when === "now" ? "сразу" : sched ? fmt(sched) : "укажи дату"}</span>
                  </div>
                  <div className="gd-when" role="radiogroup">
                    {WH.map(([id, label]) => (
                      <button
                        key={id}
                        type="button"
                        role="radio"
                        aria-checked={S.when === id}
                        onClick={() => set({ when: id })}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <input
                    type="datetime-local"
                    className="gd-at"
                    aria-label="Дата и время доставки"
                    style={{ display: S.when === "pick" ? "block" : "none" }}
                    value={S.at}
                    onChange={(e) => set({ at: e.target.value })}
                  />
                </div>

                {/* ---------------------------- Анонимно ------------------------- */}
                <div
                  className="gd-tog"
                  role="switch"
                  aria-checked={S.anon}
                  tabIndex={0}
                  onClick={() => set({ anon: !S.anon })}
                  onKeyDown={(e) => {
                    if (e.key === " " || e.key === "Enter") {
                      e.preventDefault();
                      set({ anon: !S.anon });
                    }
                  }}
                >
                  <svg className="gd-i" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M3 10c2-3 5-4 9-4s7 1 9 4c-1 6-4 9-9 9s-8-3-9-9z" />
                    <path d="M8.5 11.5h.01M15.5 11.5h.01" />
                  </svg>
                  <p>
                    Подарить анонимно
                    <small>Вместо имени увидят «Анонимный зритель»</small>
                  </p>
                  <span className="gd-sw2" />
                </div>

                {/* ---------------------------- Промокод ------------------------- */}
                <div className="gd-lb">
                  Промокод <span>необязательно</span>
                </div>
                <div className={`gd-fld${S.pr ? " good" : ""}${pcBad ? " bad" : ""}`}>
                  <svg className="gd-i" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M20 12 12 20 4 12V4h8z" />
                    <path d="M8.5 8.5h.01" />
                  </svg>
                  <input
                    placeholder="Например, GALAXY10"
                    autoComplete="off"
                    aria-label="Промокод"
                    style={{ textTransform: "uppercase" }}
                    value={S.pc}
                    onChange={(e) => set({ pc: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        promo();
                      }
                    }}
                  />
                  <button type="button" className="gd-pcb" onClick={promo}>
                    Применить
                  </button>
                </div>
                <div className="gd-pnote">{S.pr ? `Промокод ${S.pc} применён: −${S.pr}%` : pcNote}</div>

                {/* ---------------------------- Оплата --------------------------- */}
                <div className="gd-lb">Способ оплаты</div>
                <div className="gd-pms" role="radiogroup">
                  {PM.map(([id, title, note]) => (
                    <button
                      key={id}
                      type="button"
                      role="radio"
                      className="gd-pm"
                      aria-checked={S.pay === id}
                      aria-disabled={id === "tg" ? true : undefined}
                      onClick={() => {
                        if (id !== "tg") set({ pay: id });
                      }}
                    >
                      <span className="ic">
                        <svg className="gd-i" viewBox="0 0 24 24" aria-hidden="true">
                          <rect x="3" y="6" width="18" height="12" rx="2.5" />
                          <path d="M3 10.5h18" />
                        </svg>
                      </span>
                      <p>
                        {title}
                        <small>{note}</small>
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              {/* ---------------------------- Витрина ------------------------- */}
              <aside className="gd-right">
                <div
                  className="gd-stage"
                  ref={stageRef}
                  onPointerMove={onMove}
                  onPointerLeave={onLeave}
                  onClick={flip}
                  onKeyDown={(e) => {
                    if ((e.key === "Enter" || e.key === " ") && (e.target as HTMLElement).classList.contains("gd-top")) {
                      e.preventDefault();
                      flip();
                    }
                  }}
                >
                  {Array.from({ length: stack }, (_, i) => stack - 1 - i).map((i) => (
                    <div
                      key={i}
                      className={`gd-gc ${i === 0 ? `gd-top${fa ? ` ${fa}` : ""}` : `gd-s${i}`}${S.t === 2 ? " holo" : ""}`}
                      style={{ "--w1": wrap[1], "--w2": wrap[2] } as React.CSSProperties}
                      {...(i === 0 ? { tabIndex: 0, role: "button", "aria-label": "Перевернуть карточку" } : {})}
                    >
                      {i === 0 ? (
                        <>
                          {head}
                          <div
                            className="kj"
                            dangerouslySetInnerHTML={{ __html: KJ[S.m === "f" ? S.w : 0] }}
                          />
                          {S.bk ? (
                            <>
                              <div className="bm">
                                {msg ||
                                  "Здесь появится твоя подпись. Нажми на карточку, чтобы вернуть лицевую сторону."}
                              </div>
                              <div className="fm">
                                <span>{from}</span>
                                <span>{sn}</span>
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="big">{TF[S.t].t}</div>
                              <div className="fm">
                                <span>{from}</span>
                                <span>{who}</span>
                              </div>
                              <p className="ms">{msg}</p>
                            </>
                          )}
                        </>
                      ) : null}
                    </div>
                  ))}
                  <small className="fh">Нажми на карточку, чтобы перевернуть</small>
                </div>

                <div className="gd-perks">
                  <span>4K</span>
                  <span>Двойной опыт</span>
                  <span>Тег Premium</span>
                  <span>Рамки и титулы</span>
                </div>

                <div className="gd-path">
                  <h4>
                    {reached < 0 ? "Путь щедрости" : `Звание «${RK[reached]}»`}
                  </h4>
                  <p>
                    {nextIdx < MS.length
                      ? `Следующая ступень — «${RK[nextIdx]}».`
                      : "Выше только легенда."}
                  </p>
                  <svg viewBox="0 0 320 60" aria-hidden="true">
                    <line x1="14" y1="24" x2="306" y2="24" stroke="rgba(255,255,255,.1)" strokeWidth="3" strokeLinecap="round" />
                    <line x1="14" y1="24" x2={xOf(CUR)} y2="24" stroke="#3b9eff" strokeWidth="3" strokeLinecap="round" />
                    <line
                      className="dash"
                      x1={xOf(CUR)}
                      y1="24"
                      x2={xOf(after)}
                      y2="24"
                      stroke="#6bcbf5"
                      strokeWidth="3"
                      strokeDasharray="4 4"
                      style={{ filter: "drop-shadow(0 0 4px #6bcbf5)" }}
                    />
                    {MS.map((m, i) => {
                      const x = 14 + i * st;
                      const c = m <= CUR ? "#3b9eff" : m <= after ? "#6bcbf5" : "#2a3150";
                      return (
                        <g key={m}>
                          <circle
                            cx={x}
                            cy="24"
                            r={m <= after ? 6 : 4.5}
                            fill={m <= after ? c : "#0b1024"}
                            stroke={c}
                            strokeWidth="2"
                            style={m <= after && m > CUR ? { filter: "drop-shadow(0 0 6px #6bcbf5)" } : undefined}
                          />
                          <text x={x} y="50" fill="#8792b4" fontSize="9" fontWeight="700" textAnchor="middle">
                            {m}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                </div>
              </aside>
            </div>
          </div>

          {!fin ? (
            <div className="gd-foot">
              <div className="gd-tot">
                <small>Сумма</small>
                <b>
                  {rub(tot ?? cur)}
                  {tp > 0 ? (
                    <>
                      <s>{rub(base)}</s>
                      <em>−{tp}%</em>
                    </>
                  ) : null}
                </b>
                <div className="gd-brk">{brkParts.join(" · ")}</div>
              </div>
              <button
                type="button"
                className="gd-pay"
                disabled={payDisabled}
                onClick={() => {
                  if (payDisabled) return;
                  openCheckout({
                    title: S.m === "f" ? `Подарок Premium · ${TF[S.t].t}` : `Подарки Premium × ${S.n}`,
                    caption: S.m === "f" ? `Для ${S.to}` : "Случайным зрителям",
                    price: cur,
                    onPaid: () => {
                      set({
                        code: Math.random().toString(36).slice(2, 8).toUpperCase(),
                        order: String(Math.floor(1e5 + Math.random() * 9e5)),
                      });
                      setFin(true);
                    },
                  });
                }}
              >
                <svg className="gd-i" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 20.4C7.1 16.4 3.6 13.2 3.6 9.6 3.6 7.1 5.6 5.1 8 5.1c1.6 0 3.1.8 4 2.1.9-1.3 2.4-2.1 4-2.1 2.4 0 4.4 2 4.4 4.5 0 3.6-3.5 6.8-8.4 10.8z" />
                </svg>
                <span>
                  {S.m === "r"
                    ? `Оплатить: ${S.n} ${pl(S.n, ["подарок", "подарка", "подарков"])}`
                    : "Оплатить подарок"}
                </span>
              </button>
            </div>
          ) : (
            <div className="gd-done">
              <div className="gd-orb">
                <svg className="gd-i" viewBox="0 0 24 24" aria-hidden="true">
                  {CROWN}
                </svg>
                {Array.from({ length: 9 }, (_, k) => (
                  <i key={k} style={{ "--k": k } as React.CSSProperties} />
                ))}
              </div>
              <h3>
                {sched
                  ? `Заявка на подарок для ${S.to} принята`
                  : S.m === "f"
                    ? `Заявка на подарок для ${S.to} принята`
                    : `Заявка принята: ${S.n} ${pl(S.n, ["подарок", "подарка", "подарков"])}`}
              </h3>
              <p>
                {sched
                  ? "Оплата не подключена, поэтому подарок не запланирован и никому не придёт."
                  : S.m === "f"
                    ? "Оплата не подключена: Premium получателю не активирован, деньги не списаны."
                    : "Оплата не подключена: случайные зрители ничего не получат, деньги не списаны."}
              </p>
              <div className="gd-rcpt">
                {rows.map(([label, value]) => (
                  <div key={label}>
                    <span>{label}</span>
                    <b>{value}</b>
                  </div>
                ))}
                <div>
                  <span>Итого</span>
                  <b>{rub(cur)}</b>
                </div>
              </div>
              <button type="button" className="gd-cp" onClick={copyLink}>
                <svg className="gd-i" viewBox="0 0 24 24" aria-hidden="true">
                  <rect x="8" y="8" width="12" height="12" rx="2.5" />
                  <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
                </svg>
                <span>{copied ? "Ссылка скопирована" : "Скопировать ссылку на подарок"}</span>
              </button>
              <button type="button" className="gd-pay" style={{ margin: 0 }} onClick={close}>
                Готово
              </button>
            </div>
          )}
        </div>
      </dialog>
    </>
  );
}