"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

/**
 * Окна услуг «Смена ника» и «Цвет ника».
 *
 * Транскрипция макета «AniGalaxy — смена ника и цвет ника»: баннер бонуса,
 * превью, правила поля, палитра, градиенты, переливание, свечение, разбивка
 * «К оплате» и экран «готово» — всё как в макете.
 *
 * Единственное отличие — префикс `nk-` у классов (в макете они generic:
 * .dg, .bn, .sw, .tog), иначе окна забрали бы стили всего интерфейса.
 *
 * Что изменено по сути, а не по оформлению:
 *   • проверка «свободен ли ник» синхронная. Сервера у проекта нет, а список
 *     занятых имён из макета — выдуманные данные, подставлять их нельзя.
 *     Проверяются только правила поля и совпадение с текущим именем;
 *   • «бонус Premium» — не демо-переключатель макета, а реальная подписка
 *     аккаунта, а состояние бонуса лежит в документе прогрессии.
 */

import { displayNameOf, isPremiumActive, setDisplayName } from "@/lib/auth";
import { updateProfile, useProfile } from "@/lib/profile";
import { useAccount } from "@/lib/use-account";
import { progressEmit, useProgress } from "@/lib/progression/events";
import { expectedPrice } from "@/lib/progression/deals";
import { PROGRESSION_CONFIG } from "@/lib/progression/progression.config";
import {
  NICK_GRADIENTS,
  NICK_MAX,
  NICK_MIN,
  NICK_PALETTE,
  NICK_SPEED_LABELS,
  NICK_SPEEDS,
  START_NICK_STYLE,
  checkNickname,
  nickBonusState,
  nickBonusText,
  nickColorTotal,
  nickCostLines,
  nickSignature,
  normalizeNickStyle,
  type NickStyle,
} from "@/lib/nickname";
import { NickName } from "./NickName";

/* ------------------------------- Данные -------------------------------- */

const SVC_NICK = "svc_nick";
const SVC_COLOR = "svc_color";

/** Флаги документа: бонус подписки на каждую услугу одноразовый */
const BONUS_FLAG: Record<string, string> = {
  [SVC_NICK]: "bonus:svc_nick",
  [SVC_COLOR]: "bonus:svc_color",
};

/** «1 240» — разряды по-русски, как в остальном интерфейсе */
const fm = (n: number): string => n.toLocaleString("ru-RU").replace(/\u00a0/g, " ");

const CHECK_ICON = (
  <svg viewBox="0 0 24 24" className="i" aria-hidden>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </svg>
);

const CLOSE_ICON = (
  <svg viewBox="0 0 24 24" className="i" aria-hidden>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);

const CRYSTAL_ICON = (
  <svg viewBox="0 0 24 24" className="i" aria-hidden>
    <path d="M3.5 18h17M3.5 18 2.5 8.7 8 12.4 12 5.6l4 6.8 5.5-3.7-1 9.3z" />
  </svg>
);

/* ------------------------------- Оболочка ------------------------------- */

interface ShellProps {
  title: string;
  titleId: string;
  lead: ReactNode;
  children: ReactNode;
  /** Сумма подвала: либо «250 AC», либо «Бесплатно 250 AC» */
  total: ReactNode;
  action: ReactNode;
  /** Содержимое экрана «готово» (заголовок, текст, превью) */
  done: ReactNode;
  isDone: boolean;
  onClose: () => void;
}

/** Каркас окна из макета: шапка, тело, подвал, экран «готово» */
function Shell({ title, titleId, lead, children, total, action, done, isDone, onClose }: ShellProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onBackdrop = (event: MouseEvent) => {
      if (event.target === el) onClose();
    };
    el.addEventListener("click", onBackdrop);
    return () => el.removeEventListener("click", onBackdrop);
  }, [onClose]);

  useEffect(() => {
    const el = ref.current;
    if (el && !el.open) el.showModal();
  }, []);

  return (
    <dialog ref={ref} className={`nk${isDone ? " nk-fin" : ""}`} aria-labelledby={titleId} onClose={onClose}>
      <div className="nk-sh">
        <button type="button" className="nk-x" aria-label="Закрыть" onClick={onClose}>
          {CLOSE_ICON}
        </button>
        <div className="nk-body">
          <h2 id={titleId}>{title}</h2>
          <p className="nk-lead">{lead}</p>
          {children}
        </div>
        <div className="nk-foot">
          <div className="nk-tot">
            <small>К оплате</small>
            <b>{total}</b>
          </div>
          {action}
        </div>
        <div className="nk-done">
          <div className="nk-orb">{CHECK_ICON}</div>
          {done}
          <button type="button" className="nk-buy nk-done-btn" onClick={onClose}>
            Готово
          </button>
        </div>
      </div>
    </dialog>
  );
}

/* --------------------------- Общие части окна --------------------------- */

interface PreviewProps {
  name: string;
  style: NickStyle;
  login: string;
  premium: boolean;
}

/** Превью из макета: строка профиля и строка комментария */
function Preview({ name, style, login, premium }: PreviewProps) {
  const letter = (name[0] || "?").toUpperCase();
  return (
    <div className="nk-pv">
      <div className="nk-l1">
        <div className="nk-av">{letter}</div>
        <div>
          <div>
            <NickName name={name} style={style} />
            {premium && <span className="nk-pt">PREMIUM</span>}
          </div>
          <small>@{login}</small>
        </div>
      </div>
      <div className="nk-l2">
        <div className="nk-av">{letter}</div>
        <NickName name={name} style={style} />
        <span className="t">Лучшая серия сезона!</span>
      </div>
    </div>
  );
}

/** Баннер бонуса Premium */
function BonusBanner({ state, what }: { state: ReturnType<typeof nickBonusState>; what: "смена ника" | "цвет ника" }) {
  const text = nickBonusText(state, what);
  return (
    <div className={`nk-bn${text.on ? " on" : ""}`}>
      {CRYSTAL_ICON}
      <span>
        <b>{text.title}</b>
        {text.note}
      </span>
    </div>
  );
}

interface ToggleProps {
  title: string;
  note: string;
  checked: boolean;
  disabled?: boolean;
  onChange: () => void;
}

/** Переключатель макета: клик и клавиатура работают одинаково */
function Toggle({ title, note, checked, disabled, onChange }: ToggleProps) {
  return (
    <div
      className="nk-tog"
      role="switch"
      tabIndex={disabled ? -1 : 0}
      aria-checked={checked}
      aria-disabled={disabled}
      onClick={() => !disabled && onChange()}
      onKeyDown={(event) => {
        if (disabled) return;
        if (event.key === " " || event.key === "Enter") {
          event.preventDefault();
          onChange();
        }
      }}
    >
      <p>
        {title}
        <small>{note}</small>
      </p>
      <i />
    </div>
  );
}

/** Кнопка подвала: блокировка и «не хватает» — как в макете */
function BuyButton({
  label,
  can,
  shortfall,
  onClick,
}: {
  label: string;
  can: boolean;
  /** Сколько не хватает до покупки; null — подпись как есть */
  shortfall: number | null;
  onClick: () => void;
}) {
  return (
    <button type="button" className="nk-buy" disabled={!can} onClick={onClick}>
      {shortfall === null ? label : `Не хватает ${fm(shortfall)} AC`}
    </button>
  );
}

/** Экран «готово»: тексты из макета + актуальное имя */
function DoneScreen({
  title,
  note,
  name,
  style,
}: {
  title: string;
  note: string;
  name: string;
  style: NickStyle;
}) {
  return (
    <>
      <div className="nk-pv nk-done-pv">
        <div className="nk-l1" style={{ justifyContent: "center" }}>
          <div>
            <NickName name={name} style={style} />
          </div>
        </div>
      </div>
      <h3>{title}</h3>
      <p>{note}</p>
    </>
  );
}

/* ------------------------------ Смена ника ------------------------------ */

const REJECT_TEXT: Record<string, string> = {
  insufficient_ac: "Не хватает AC — они копятся за вход, квесты и активность",
  price_mismatch: "Цена изменилась — обновите страницу",
  limit_reached: "Лимит услуги уже достигнут",
  unknown_item: "Услуга недоступна",
  invalid_nickname: "Такое имя сохранить нельзя",
};

export interface NickDialogProps {
  open: boolean;
  onClose: () => void;
  onMessage?: (text: string) => void;
}

/** Услуга «Смена ника»: правила имени, цена, бонус Premium */
export function NicknameDialog({ open, onClose, onMessage }: NickDialogProps) {
  const account = useAccount();
  const profile = useProfile();
  const doc = useProgress();
  const inputRef = useRef<HTMLInputElement>(null);
  const wasOpen = useRef(false);

  const [value, setValue] = useState("");
  const [done, setDone] = useState(false);
  const [now, setNow] = useState<number | null>(null);

  const current = displayNameOf(account);
  const login = account?.nickname ?? "";
  const premium = isPremiumActive(account);
  const balance = doc.progress.acBalance;
  const style = normalizeNickStyle(profile.nickStyle);

  /* Сброс — только в момент открытия. Пока окно открыто, `open` не меняется,
     а после применения меняется `profile`, и второй сброс стёр бы экран
     «готово». */
  useEffect(() => {
    if (open && !wasOpen.current) {
      setValue("");
      setDone(false);
      setNow(Date.now());
    }
    wasOpen.current = open;
  }, [open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open, now]);

  const bonusUsed = (doc.flags[BONUS_FLAG[SVC_NICK]] ?? 0) >= PROGRESSION_CONFIG.nickname.freeUses;
  const free = nickBonusState(premium, bonusUsed) === "available";

  /* Цена — от времени открытия окна: `Date.now()` во время рендера ломал бы
     и линтер, и гидратацию. */
  const base = now === null ? 0 : expectedPrice(PROGRESSION_CONFIG.shop, SVC_NICK, now);
  const price = free ? 0 : base;

  const check = useMemo(() => checkNickname(value, current), [value, current]);
  /* Без аккаунта покупать нельзя: AC списались бы, а записывать имя было бы
     некуда — деньги за воздух. */
  const hasAccount = Boolean(account?.nickname);
  const can = hasAccount && check.state === "ok" && (free || balance >= price);

  const submit = useCallback(() => {
    if (!can || !account) return;
    const name = value.trim();
    const res = progressEmit({ type: "NICKNAME_RENAMED", nickname: name, price });
    if (res.rejected) {
      onMessage?.(REJECT_TEXT[res.rejected.reason] ?? "Смена не прошла");
      return;
    }
    const err = setDisplayName(name);
    if (err) {
      onMessage?.(err);
      return;
    }
    setDone(true);
    onMessage?.("Отображаемое имя изменено");
  }, [can, account, value, price, onMessage]);

  if (!open) return null;

  return (
    <Shell
      title="Смена ника"
      titleId="nk-title-nick"
      lead={
        <>
          Разовая смена отображаемого ника. Логин <b>@{login || "ник"}</b> и ссылка на профиль не
          изменятся.
        </>
      }
      isDone={done}
      onClose={onClose}
      total={free ? <><span className="nk-free">Бесплатно</span> <s>{fm(base)} AC</s></> : `${fm(price)} AC`}
      action={
        <BuyButton
          can={can}
          shortfall={hasAccount && !free && balance < price ? price - balance : null}
          onClick={submit}
          label={
            !hasAccount
              ? "Нужен вход в аккаунт"
              : free
                ? "Сменить бесплатно"
                : `Купить за ${fm(price)} AC`
          }
        />
      }
      done={
        <DoneScreen
          title="Ник изменён"
          note={`${free ? "Бонус Premium использован. " : ""}Новый ник уже виден в профиле и комментариях.`}
          name={value.trim() || current}
          style={style}
        />
      }
    >
      <BonusBanner state={nickBonusState(premium, bonusUsed)} what="смена ника" />
      <Preview name={value.trim() || current} style={style} login={login} premium={premium} />
      <div className="nk-lb">
        Новый ник
        <span>
          {value.length} / {NICK_MAX}
        </span>
      </div>
      <div className={`nk-fld ${check.state}`}>
        <input
          ref={inputRef}
          value={value}
          maxLength={NICK_MAX}
          autoComplete="off"
          spellCheck={false}
          placeholder="Например, StarWalker"
          aria-label="Новый ник"
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && can) submit();
          }}
        />
        <i className="nk-dot" />
      </div>
      <div className={`nk-hint ${check.state}`}>{check.message}</div>
      <div className="nk-info">
        <b>ПРАВИЛА</b>
        {NICK_MIN}–{NICK_MAX} символов: буквы, цифры и «_», без пробелов. Ник виден в профиле,
        комментариях и рейтингах.
      </div>
    </Shell>
  );
}

/* ------------------------------ Цвет ника ------------------------------- */

export interface NickColorDialogProps {
  open: boolean;
  onClose: () => void;
  onMessage?: (text: string) => void;
}

/** Услуга «Цвет ника»: цвет, градиент, переливание, свечение */
export function NickColorDialog({ open, onClose, onMessage }: NickColorDialogProps) {
  const account = useAccount();
  const profile = useProfile();
  const doc = useProgress();
  const wasOpen = useRef(false);

  const [draft, setDraft] = useState<NickStyle>(START_NICK_STYLE);
  const [done, setDone] = useState(false);
  const [now, setNow] = useState<number | null>(null);

  const name = displayNameOf(account);
  const login = account?.nickname ?? "";
  const premium = isPremiumActive(account);
  const balance = doc.progress.acBalance;
  const applied = normalizeNickStyle(profile.nickStyle);

  useEffect(() => {
    if (open && !wasOpen.current) {
      setDone(false);
      setNow(Date.now());
      // Оформления ещё нет — открываем на стартовом цвете из макета
      setDraft(applied.mode === "def" ? START_NICK_STYLE : applied);
    }
    wasOpen.current = open;
  }, [open, applied]);

  const bonusUsed = (doc.flags[BONUS_FLAG[SVC_COLOR]] ?? 0) >= PROGRESSION_CONFIG.nickname.freeUses;
  const free = nickBonusState(premium, bonusUsed) === "available";

  const addons = PROGRESSION_CONFIG.nickname.addons;
  const base = now === null ? 0 : expectedPrice(PROGRESSION_CONFIG.shop, SVC_COLOR, now);
  const total = nickColorTotal(base, addons, draft);
  const price = free ? 0 : total;

  const same = nickSignature(draft) === nickSignature(applied);
  const can = !same && (free || balance >= price);

  /* Без useCallback: компилятор React не может сохранить мемоизацию при
     зависимости-объекте (черновик меняется целиком при каждом правлении),
     а передавать эти функции дальше некуда. */
  const patch = (part: Partial<NickStyle>) => setDraft((prev) => ({ ...prev, ...part }));

  const submit = () => {
    if (!can) return;
    const res = progressEmit({ type: "NICK_COLOR_SET", style: draft, price });
    if (res.rejected) {
      onMessage?.(REJECT_TEXT[res.rejected.reason] ?? "Стиль не применён");
      return;
    }
    updateProfile({ nickStyle: draft });
    setDone(true);
    onMessage?.("Стиль ника применён");
  };

  if (!open) return null;

  const gradient = draft.mode === "grad";

  return (
    <Shell
      title="Цвет ника"
      titleId="nk-title-color"
      lead="Выбери цвет или градиент. Градиент можно сделать переливающимся: он плавно «бежит» по нику."
      isDone={done}
      onClose={onClose}
      total={
        free ? <><span className="nk-free">Бесплатно</span> <s>{fm(total)} AC</s></> : `${fm(total)} AC`
      }
      action={
        <BuyButton
          can={can}
          shortfall={!free && balance < price ? price - balance : null}
          onClick={submit}
          label={
            same ? "Уже применено" : free ? "Применить бесплатно" : `Применить за ${fm(price)} AC`
          }
        />
      }
      done={
        <DoneScreen
          title="Стиль ника применён"
          note={`${free ? "Бонус Premium использован. " : ""}${
            gradient && draft.anim
              ? "Теперь твой ник переливается градиентом."
              : "Новый цвет уже виден везде."
          }`}
          name={name}
          style={draft}
        />
      }
    >
      <BonusBanner state={nickBonusState(premium, bonusUsed)} what="цвет ника" />
      <Preview name={name} style={draft} login={login} premium={premium} />

      <div className={`nk-seg${gradient ? " g" : ""}`} role="tablist">
        <i />
        <button type="button" role="tab" aria-selected={!gradient} onClick={() => patch({ mode: "solid" })}>
          Цвет
        </button>
        <button type="button" role="tab" aria-selected={gradient} onClick={() => patch({ mode: "grad" })}>
          Градиент
        </button>
      </div>

      {!gradient ? (
        <div>
          <div className="nk-lb">
            Палитра
            <span>или свой оттенок</span>
          </div>
          <div className="nk-sws">
            {NICK_PALETTE.map((color) => (
              <button
                key={color}
                type="button"
                role="radio"
                aria-checked={draft.c1 === color}
                aria-label={`Цвет ${color}`}
                className="nk-sw"
                style={{ background: color }}
                onClick={() => patch({ c1: color })}
              />
            ))}
            <label className="nk-cu" title="Свой цвет">
              +
              <input
                type="color"
                value={draft.c1}
                aria-label="Свой цвет"
                onChange={(event) => patch({ c1: event.target.value })}
              />
            </label>
          </div>
        </div>
      ) : (
        <div>
          <div className="nk-lb">Готовые градиенты</div>
          <div className="nk-sws">
            {NICK_GRADIENTS.map((item) => (
              <button
                key={item.name}
                type="button"
                role="radio"
                aria-checked={draft.c1 === item.c1 && draft.c2 === item.c2}
                className="nk-sw nk-sw-w"
                style={{ backgroundImage: `linear-gradient(90deg, ${item.c1}, ${item.c2})` }}
                onClick={() => patch({ c1: item.c1, c2: item.c2 })}
              >
                {item.name}
              </button>
            ))}
          </div>
          <div className="nk-pk">
            <label>
              Цвет 1
              <input
                type="color"
                value={draft.c1}
                aria-label="Цвет 1"
                onChange={(event) => patch({ c1: event.target.value })}
              />
            </label>
            <label>
              Цвет 2
              <input
                type="color"
                value={draft.c2}
                aria-label="Цвет 2"
                onChange={(event) => patch({ c2: event.target.value })}
              />
            </label>
          </div>
          <Toggle
            title="Переливание"
            note="Градиент плавно движется по нику (+100 AC)"
            checked={draft.anim}
            onChange={() => patch({ anim: !draft.anim })}
          />
          <div className={`nk-spd${draft.anim ? "" : " off"}`}>
            {NICK_SPEEDS.map((sec, index) => (
              <button
                key={sec}
                type="button"
                aria-pressed={draft.sp === sec}
                onClick={() => patch({ sp: sec })}
              >
                {NICK_SPEED_LABELS[index]}
              </button>
            ))}
          </div>
        </div>
      )}

      <Toggle
        title="Свечение"
        note="Мягкий ореол вокруг ника (+50 AC)"
        checked={draft.glow}
        onChange={() => patch({ glow: !draft.glow })}
      />

      <div className="nk-bk">
        {nickCostLines(base, addons, draft, free).map((line) => (
          <div key={line.label}>
            <span>{line.label}</span>
            <b className={line.minus ? "minus" : undefined}>{line.value}</b>
          </div>
        ))}
      </div>
    </Shell>
  );
}
